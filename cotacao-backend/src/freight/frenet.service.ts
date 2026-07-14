import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
// CORREÇÃO 1: Caminho relativo com extensão .js (Essencial para NodeNext)
import { Quotation } from '../quotations/entities/quotation.entity.js';
import { Repository } from 'typeorm';
import { VipFreightService } from './vip-freight.service.js';
import { RodonavesService } from './rodonaves.service.js';

export interface FrenetShippingItem {
  Weight: number;
  Width: number;
  Height: number;
  Length: number;
  Quantity: number;
}

export interface FrenetPayload {
  SellerCEP: string;
  RecipientCEP: string;
  ShipmentInvoiceValue: number;
  ShippingItemArray: FrenetShippingItem[];
}

export interface ProcessedShippingOption {
  carrier: string;
  service_description: string;
  price: number;
  deadline: number;
  percentage: number;
  recommendation: 'best_option' | 'suggest_whatsapp' | 'normal' | 'manual_quote';
}

@Injectable()
export class FrenetService {
  // CORREÇÃO 2: Uso de '!' para garantir inicialização definitiva no construtor (Erro TS2564)
  private readonly frenetApiUrl!: string;
  private readonly sellerCEP!: string;
  private readonly apiToken!: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    private readonly vipFreightService: VipFreightService,
    private readonly rodonavesService: RodonavesService,
  ) {
    const cep = this.configService.get<string>('SELLER_CEP');
    const token = this.configService.get<string>('FRENET_API_TOKEN');
    const url = this.configService.get<string>('FRENET_URL') || 'https://api.frenet.com.br/shipping/quote';

    if (!cep || !token) {
      console.error('AVISO CRÍTICO: SELLER_CEP ou FRENET_API_TOKEN não encontrados no ambiente.');
    }

    this.sellerCEP = cep || '';
    this.apiToken = token || '';
    this.frenetApiUrl = url;
  }

  async calculateForQuotation(quotationId: number): Promise<ProcessedShippingOption[]> {
    const quotation = await this.getQuotationData(quotationId);
    const frenetPayload = this.buildFrenetPayload(quotation);

    if (frenetPayload.ShippingItemArray.length === 0) {
      return [];
    }

    // Calcula peso real e peso de cubagem (Volume m3 * 100) para a VIP
    let totalRealWeight = 0;
    let totalVolumeM3 = 0;

    frenetPayload.ShippingItemArray.forEach(item => {
      totalRealWeight += (item.Weight * item.Quantity);
      // Volume = (Comprimento * Largura * Altura * Qtd) / 1.000.000 (convertendo cm3 para m3)
      const volumeItemM3 = (item.Length * item.Width * item.Height * item.Quantity) / 1000000;
      totalVolumeM3 += volumeItemM3;
    });

    const cubageWeight = totalVolumeM3 * 100;

    console.log(`[FrenetService] Pesos Calculados - Real: ${totalRealWeight.toFixed(2)}kg, Cubado: ${cubageWeight.toFixed(2)}kg, Volume: ${totalVolumeM3.toFixed(4)}m3`);

    // Busca opções em paralelo com tratamento de erro individual
    const [frenetOptions, vipOption, rodonavesOption] = await Promise.all([
      this.fetchFrenetOptions(frenetPayload).catch(err => {
        console.warn('Frenet API Error (Silenced):', err.message);
        return [];
      }),
      this.vipFreightService.calculateVipFreight(
        quotation.client?.cidade || '',
        totalRealWeight,
        cubageWeight,
        quotation.valor_total_nota || quotation.valor_total_produtos
      ).catch(err => {
        console.warn('VIP Freight Error (Silenced):', err.message);
        return null;
      }),
      this.rodonavesService.calculateFreight(
        this.sellerCEP,
        frenetPayload.RecipientCEP,
        totalRealWeight > cubageWeight ? totalRealWeight : cubageWeight,
        quotation.valor_total_nota || quotation.valor_total_produtos
      ).catch(err => {
        console.warn('Rodonaves Freight Error (Silenced):', err.message);
        return null;
      })
    ]);

    const processedOptions = this.processFrenetResponse(frenetOptions, quotation.valor_total_nota || quotation.valor_total_produtos);

    // Se houver opção VIP, adiciona à lista
    if (vipOption && vipOption.price > 0) {
      processedOptions.push(vipOption);
    }

    // Se houver opção Rodonaves, adiciona à lista
    if (rodonavesOption && rodonavesOption.price > 0) {
      processedOptions.push(rodonavesOption);
    }

    // FILTRO FINAL: Remove qualquer opção que tenha preço <= 0, exceto a TEX que pode vir sem preço se for a combinar
    const finalOptions = processedOptions.filter(opt => opt.price > 0 || opt.carrier.toUpperCase().includes('TEX'));

    // Se não houver NENHUMA opção válida, cria a opção de Cotação Manual
    if (finalOptions.length === 0) {
      finalOptions.push({
        carrier: 'DEPARTAMENTO DE LOGÍSTICA',
        service_description: 'SOLICITAR COTAÇÃO MANUAL',
        price: 0.01, // Valor simbólico para aparecer no template
        deadline: 0,
        percentage: 0,
        recommendation: 'manual_quote',
      });
    }

    return finalOptions;
  }

  private async getQuotationData(quotationId: number): Promise<Quotation> {
    const quotation = await this.quotationRepository.findOne({
      where: { id: quotationId },
      relations: ['client', 'items', 'items.product'],
    });

    if (!quotation) {
      throw new NotFoundException(`Cotação com ID #${quotationId} não encontrada.`);
    }
    return quotation;
  }

  private buildFrenetPayload(quotation: Quotation): FrenetPayload {
    const itemsGroupedByProduct = new Map<number, number>();

    for (const item of quotation.items) {
      const currentQty = itemsGroupedByProduct.get(item.product.id) || 0;
      itemsGroupedByProduct.set(item.product.id, currentQty + item.quantidade);
    }

    const shippingItems: FrenetShippingItem[] = [];
    for (const [productId, totalQty] of itemsGroupedByProduct.entries()) {
      const product = quotation.items.find((i) => i.product.id === productId)!.product;

      const unidadesPorCaixa = Number(product.unidades_caixa) > 0 ? Number(product.unidades_caixa) : 1;
      const numberOfBoxes = Math.ceil(totalQty / unidadesPorCaixa);

      // Parse refinado de medida_cm (CxLxA ou apenas números separados por x)
      let dimensoes = [15, 15, 15]; // Padrão: Comprimento, Largura, Altura
      if (product.medida_cm) {
        const parts = product.medida_cm.toLowerCase().split('x').map(p => parseFloat(p.replace(/[^0-9.]/g, '')));
        if (parts.length === 3 && parts.every(p => !isNaN(p) && p > 0)) {
          dimensoes = parts;
        } else {
          console.warn(`[FrenetService] Dimensões inválidas para Produto #${product.id}: "${product.medida_cm}". Usando padrão 15x15x15.`);
        }
      }

      const [comprimento, largura, altura] = dimensoes;
      const pesoCaixa = Number(product.peso_caixa_kg) > 0 ? Number(product.peso_caixa_kg) : 0.5;

      shippingItems.push({
        Weight: pesoCaixa,
        Width: largura || 15,
        Height: altura || 15,
        Length: comprimento || 15,
        Quantity: numberOfBoxes,
      });
    }

    const payload: FrenetPayload = {
      SellerCEP: (quotation.origem_cep || this.sellerCEP).replace(/\D/g, ''),
      RecipientCEP: (quotation.destino_cep || quotation.client?.cep || '').replace(/\D/g, ''),
      ShipmentInvoiceValue: Number(quotation.valor_total_nota || quotation.valor_total_produtos),
      ShippingItemArray: shippingItems,
    };

    console.log(`[FrenetService] Payload Gerado para Cotação #${quotation.id}:`, JSON.stringify(payload, null, 2));
    return payload;
  }

  private async fetchFrenetOptions(payload: FrenetPayload): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.frenetApiUrl, payload, {
          headers: {
            'token': this.apiToken,
            'Content-Type': 'application/json',
          },
        }),
      );
      return response.data.ShippingSevicesArray || [];
    } catch (error: any) {
      const errorMsg = error.response?.data?.Message || error.message;
      console.error('Erro na API Frenet:', errorMsg);
      throw new InternalServerErrorException(`Erro no frete: ${errorMsg}`);
    }
  }

  private processFrenetResponse(shippingOptions: any[], productsValue: number): ProcessedShippingOption[] {
    if (!Array.isArray(shippingOptions)) return [];

    return shippingOptions.map(option => {
      // Se a opção já estiver no formato processado (vinda de outro serviço), apenas retorna ela
      if (option.carrier && option.price !== undefined) {
        return option as ProcessedShippingOption;
      }

      // Se for o formato bruto da Frenet, processa
      const freightValue = parseFloat(option.ShippingPrice || "0");
      const percentage = productsValue > 0 ? (freightValue / productsValue) * 100 : 0;

      let recommendation: 'best_option' | 'suggest_whatsapp' | 'normal' = 'normal';
      if (percentage > 10) {
        recommendation = 'suggest_whatsapp';
      } else if (percentage > 0 && percentage <= 9) {
        recommendation = 'best_option';
      }

      let carrier = option.Carrier || option.carrier || 'Transportadora';
      let service_description = option.ServiceDescription || option.service_description || carrier;

      if (carrier.toUpperCase().includes('LOGISTICA PROPRIA') || carrier.toUpperCase().includes('LOGÍSTICA PRÓPRIA')) {
        const temp = carrier;
        carrier = service_description;
        service_description = temp;
      }

      return {
        carrier,
        service_description,
        price: freightValue,
        deadline: parseInt(option.DeliveryTime || option.deadline || "0", 10),
        percentage: parseFloat(percentage.toFixed(2)),
        recommendation: (option.recommendation as any) || recommendation,
      };
    });
  }

  async simulateDeadline(destCep: string, cidade?: string): Promise<ProcessedShippingOption[]> {
    const payload: FrenetPayload = {
      SellerCEP: this.sellerCEP.replace(/\D/g, ''),
      RecipientCEP: destCep.replace(/\D/g, ''),
      ShipmentInvoiceValue: 100, // Valor simbólico
      ShippingItemArray: [{
        Weight: 1,
        Width: 15,
        Height: 15,
        Length: 15,
        Quantity: 1,
      }],
    };

    const [frenetOptions, vipOption, rodonavesOption] = await Promise.all([
      this.fetchFrenetOptions(payload).catch(err => {
        console.warn('Frenet Simulate Error:', err.message);
        return [];
      }),
      cidade ? this.vipFreightService.calculateVipFreight(cidade, 1, 1, 100).catch(() => null) : Promise.resolve(null),
      this.rodonavesService.calculateFreight(payload.SellerCEP, payload.RecipientCEP, 1, 100).catch(() => null)
    ]);

    const processedOptions = this.processFrenetResponse(frenetOptions, 100);
    if (vipOption && vipOption.price > 0) processedOptions.push(vipOption);
    if (rodonavesOption && rodonavesOption.price > 0) processedOptions.push(rodonavesOption);

    return processedOptions.filter(opt => opt.price > 0 || opt.deadline > 0);
  }
}