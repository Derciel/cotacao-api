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

/**
 * @Injectable()
 * Serviço responsável pela comunicação com a API da Frenet para cálculo de frete.
 */
@Injectable()
export class FrenetService {
  private readonly frenetApiUrl = 'https://api.frenet.com.br/shipping/quote';
  private readonly sellerCEP: string;
  private readonly apiToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
  ) {
    const cep = this.configService.get<string>('SELLER_CEP');
    const token = this.configService.get<string>('FRENET_API_TOKEN');

    if (!cep || !token) {
      throw new Error('As variáveis SELLER_CEP e FRENET_API_TOKEN precisam estar no .env');
    }

    this.sellerCEP = cep;
    this.apiToken = token;
  }

  /**
   * Orquestra o cálculo de frete para uma cotação específica.
   * @param quotationId O ID da cotação a ser calculada.
   * @returns Uma promessa com a lista de opções de frete processadas.
   */
  async calculateForQuotation(quotationId: number): Promise<ProcessedShippingOption[]> {
    const quotation = await this.getQuotationData(quotationId);
    const frenetPayload = this.buildFrenetPayload(quotation);
    
    if (frenetPayload.ShippingItemArray.length === 0) {
      return []; // Retorna vazio se não houver itens para cotar
    }
    
    const shippingOptions = await this.fetchFrenetOptions(frenetPayload);
    
    return this.processFrenetResponse(shippingOptions, quotation.valor_total_produtos);
  }

  /**
   * Busca os dados da cotação e suas relações no banco de dados.
   */
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

  /**
   * Constrói o payload para a API da Frenet com base nos dados da cotação.
   */
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
        const [comprimento, largura, altura] = product.medida_cm.replace(/cm/i, '').split('x').map(Number);

        shippingItems.push({
          Weight: product.peso_caixa_kg,
          Width: largura,
          Height: altura,
          Length: comprimento,
          Quantity: numberOfBoxes,
        });
      }
    }

    return {
      SellerCEP: this.sellerCEP,
      RecipientCEP: quotation.client.cep.replace('-', ''),
      ShipmentInvoiceValue: quotation.valor_total_produtos,
      ShippingItemArray: shippingItems,
    };
  }

  /**
   * Realiza a chamada HTTP para a API da Frenet.
   */
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
      // Captura erros da chamada HTTP e lança um erro interno do servidor
      console.error('Erro ao chamar a API da Frenet:', error.response?.data);
      throw new InternalServerErrorException('Falha ao calcular o frete com o provedor externo.');
    }
  }

  /**
   * Aplica a regra de negócio interna sobre as opções de frete retornadas.
   */
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