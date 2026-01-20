import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Quotation } from 'src/quotations/entities/quotation.entity';
import { Repository } from 'typeorm';

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
  recommendation: 'best_option' | 'suggest_whatsapp' | 'normal';
}

@Injectable()
export class FrenetService {
  private readonly frenetApiUrl: string;
  private readonly sellerCEP: string;
  private readonly apiToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
  ) {
    // Busca as variáveis do ambiente
    const cep = this.configService.get<string>('SELLER_CEP');
    const token = this.configService.get<string>('FRENET_API_TOKEN');
    const url = this.configService.get<string>('FRENET_URL') || 'https://api.frenet.com.br/shipping/quote';

    if (!cep || !token) {
      throw new Error('Erro Crítico: SELLER_CEP ou FRENET_API_TOKEN não encontrados no ambiente.');
    }

    this.sellerCEP = cep;
    this.apiToken = token;
    this.frenetApiUrl = url;
  }

  async calculateForQuotation(quotationId: number): Promise<ProcessedShippingOption[]> {
    const quotation = await this.getQuotationData(quotationId);
    const frenetPayload = this.buildFrenetPayload(quotation);

    if (frenetPayload.ShippingItemArray.length === 0) {
      return [];
    }

    const shippingOptions = await this.fetchFrenetOptions(frenetPayload);
    return this.processFrenetResponse(shippingOptions, quotation.valor_total_produtos);
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
      const product = quotation.items.find(i => i.product.id === productId)!.product;

      if (product.unidades_caixa > 0 && product.medida_cm) {
        const numberOfBoxes = Math.ceil(totalQty / product.unidades_caixa);
        // Limpeza de string para evitar erros de conversão
        const dimensoes = product.medida_cm.toLowerCase().replace(/cm/g, '').split('x').map(Number);
        const [comprimento, largura, altura] = dimensoes;

        shippingItems.push({
          Weight: product.peso_caixa_kg,
          Width: largura || 0,
          Height: altura || 0,
          Length: comprimento || 0,
          Quantity: numberOfBoxes,
        });
      }
    }

    return {
      SellerCEP: this.sellerCEP,
      // Proteção contra CEP nulo e remoção de hífen
      RecipientCEP: (quotation.client?.cep || '').replace(/\D/g, ''),
      ShipmentInvoiceValue: quotation.valor_total_produtos,
      ShippingItemArray: shippingItems,
    };
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
    } catch (error) {
      // Melhoria no Log: Mostra a mensagem real do erro de rede ou da API
      const errorMsg = error.response?.data?.Message || error.message;
      console.error('Erro na API Frenet:', errorMsg);
      throw new InternalServerErrorException(`Erro no frete: ${errorMsg}`);
    }
  }

  private processFrenetResponse(shippingOptions: any[], productsValue: number): ProcessedShippingOption[] {
    return shippingOptions.map(option => {
      const freightValue = parseFloat(option.ShippingPrice);
      const percentage = (freightValue / productsValue) * 100;

      let recommendation: 'best_option' | 'suggest_whatsapp' | 'normal' = 'normal';
      if (percentage > 10) {
        recommendation = 'suggest_whatsapp';
      } else if (percentage <= 9) {
        recommendation = 'best_option';
      }

      return {
        carrier: option.Carrier,
        service_description: option.ServiceDescription,
        price: freightValue,
        deadline: parseInt(option.DeliveryTime, 10),
        percentage: parseFloat(percentage.toFixed(2)),
        recommendation,
      };
    });
  }
}