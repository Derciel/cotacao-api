import { Injectable } from '@nestjs/common';
import { ProcessedShippingOption } from './frenet.service.js';

interface VipPrice {
    upTo20: number;
    upTo50: number;
    upTo100: number;
    upTo150: number;
    upTo200: number;
    upTo250: number;
}

@Injectable()
export class VipFreightService {
    private readonly discount = 0.25; // 25% de desconto

    private readonly cityPrices: Record<string, VipPrice> = {
        'LUPIOPOLIS': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'JUNDIAI DO SUL': { upTo20: 66, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'CAFEARA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'ABATIA': { upTo20: 66, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'AGUA BOA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'ALTO PARANA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'ALVORADA DO SUL': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'ANDIRA': { upTo20: 66, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'ARAPONGAS': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'ARICANDUVA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'ASSAI': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'ASTORGA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'BANDEIRANTES': { upTo20: 66, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'BARRA DO JACARE': { upTo20: 66, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'ARARUNA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'CAMBARA': { upTo20: 66, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'CAMBE': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'CAMBIRA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'CAMPO MOURAO': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'CARLOPOLIS': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'CENTENARIO DO SUL': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'CIANORTE': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'CONGONHINHAS': { upTo20: 66, upTo50: 87, upTo100: 130.5, upTo150: 174, upTo200: 217.5, upTo250: 261 },
        'CONSELHEIRO MAIRINCK': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'CORNELIO PROCOPIO': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'CURIUVA': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'DOUTOR CAMARGO': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'ENGENHEIRO BELTRAO': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'FIGUEIRA': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'FLORESTA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'FLORESTOPOLIS': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'GUAPIRAMA': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'GUARACI': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'IBAITI': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'IBIACI': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'IBIPORA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'IMBAU': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'INDIANOPOLIS': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'IRERE': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'ITAMBARACA': { upTo20: 66, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'IVATUBA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'JABOTI': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'JACAREZINHO': { upTo20: 72, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'JAGUAPITA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'JANDAIA DO SUL': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'JAPIRA': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'JATAIZINHO': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'JOAQUIM TAVORA': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'JUSSARA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'LEOPOLIS': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'LERROVILLE': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'LONDRINA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'MANDAGUACU': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'MANDAGUARI': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'MARIALVA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'MARINGA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'MAUA DA SERRA': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'MIRASELVA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'NOVA AMERICA DA COLINA': { upTo20: 66, upTo50: 87, upTo100: 130.5, upTo150: 174, upTo200: 217.5, upTo250: 261 },
        'NOVA ESPERANCA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'NOVA FATIMA': { upTo20: 66, upTo50: 87, upTo100: 130.5, upTo150: 174, upTo200: 217.5, upTo250: 261 },
        'NOVA SANTA BARBARA': { upTo20: 66, upTo50: 87, upTo100: 130.5, upTo150: 174, upTo200: 217.5, upTo250: 261 },
        'ORTIGUEIRA': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'PAICANDU': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'PAIQUERE': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'PARAISO DO NORTE': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'PARANAVAI': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'PEABIRU': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'PINHALAO': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'PINHAO': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'PORECATU': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'PRADO FERREIRA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'PRESIDENTE CASTELO BRANCO': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'PRIMEIRO DE MAIO': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'QUATIGUA': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'RANCHO ALEGRE': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'RESERVA': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'RIBEIRAO CLARO': { upTo20: 72, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'RIBEIRAO DO PINHAL': { upTo20: 66, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'ROLANDIA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'RONDON': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'SABAUDIA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'SALTO DO ITARARE': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'SANTA AMELIA': { upTo20: 66, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'SANTA CECILIA DO PAVAO': { upTo20: 66, upTo50: 87, upTo100: 130.5, upTo150: 174, upTo200: 217.5, upTo250: 261 },
        'SANTA MARGARIDA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'SANTA MARIANA': { upTo20: 66, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'SANTANA DO ITARARE': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'SANTO ANTONIO DA PLATINA': { upTo20: 72, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'SANTO ANTONIO DO PARAISO': { upTo20: 66, upTo50: 87, upTo100: 130.5, upTo150: 174, upTo200: 217.5, upTo250: 261 },
        'SAO JERONIMO DA SERRA': { upTo20: 66, upTo50: 87, upTo100: 130.5, upTo150: 174, upTo200: 217.5, upTo250: 261 },
        'SAO JOSE DA BOA VISTA': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'SAO MARTINHO': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'SAO PEDRO - DISTRITO APUCARANA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'SAO SEBASTIAO DA AMOREIRA': { upTo20: 66, upTo50: 87, upTo100: 130.5, upTo150: 174, upTo200: 217.5, upTo250: 261 },
        'SAPOPEMA': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'SARANDI': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'SERTANEJA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'SERTANOPOLIS': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'SIQUEIRA CAMPOS': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'TAMARANA': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'TAMBOARA': { upTo20: 72, upTo50: 92, upTo100: 138, upTo150: 184, upTo200: 230, upTo250: 276 },
        'TELEMACO BORBA': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'TIBAGI': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'TOMAZINA': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'URAI': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'VENTANIA': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'WARTA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'WENCESLAU BRAZ': { upTo20: 74, upTo50: 100, upTo100: 150, upTo150: 200, upTo200: 250, upTo250: 300 },
        'GUARAVERA': { upTo20: 74, upTo50: 99, upTo100: 148.5, upTo150: 198, upTo200: 247.5, upTo250: 297 },
        'APUCARANA': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'PIRAPO': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'PITANGUEIRAS': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
        'BELA VISTA DO PARAISO': { upTo20: 59, upTo50: 83, upTo100: 124.5, upTo150: 166, upTo200: 207.5, upTo250: 249 },
    };

    /**
   * Calcula o frete VIP se a cidade for atendida.
   */
    async calculateVipFreight(city: string, realWeight: number, cubageWeight: number, invoiceValue: number): Promise<ProcessedShippingOption | null> {
        const cityName = city.toUpperCase().trim();
        const prices = this.cityPrices[cityName];

        if (!prices) {
            console.warn(`[VipFreightService] Cidade não atendida pela VIP: ${cityName}`);
            return null;
        }

        // A regra diz que cada metro cúbico equivale a 100kg. 
        // Usamos o maior valor entre o peso real e o peso de cubagem.
        const effectiveWeight = Math.max(realWeight, cubageWeight);

        let basePrice = 0;
        if (effectiveWeight <= 20) basePrice = prices.upTo20;
        else if (effectiveWeight <= 50) basePrice = prices.upTo50;
        else if (effectiveWeight <= 100) basePrice = prices.upTo100;
        else if (effectiveWeight <= 150) basePrice = prices.upTo150;
        else if (effectiveWeight <= 200) basePrice = prices.upTo200;
        else if (effectiveWeight <= 250) basePrice = prices.upTo250;
        else {
            // Para pesos acima de 250kg, usamos uma regra proporcional baseada no teto de 250kg
            basePrice = prices.upTo250 * (effectiveWeight / 250);
        }

        // Aplica desconto de 25%
        let discountedPrice = basePrice * (1 - this.discount);

        // Regra de 1% para NF > 3500
        if (invoiceValue > 3500) {
            const minFreight = invoiceValue * 0.01;
            if (discountedPrice < minFreight) {
                discountedPrice = minFreight;
            }
        }

        const percentage = invoiceValue > 0 ? (discountedPrice / invoiceValue) * 100 : 0;

        console.log(`[VipFreightService] Cálculo concluído para ${cityName}: Peso=${effectiveWeight}kg, Vl. Nota=${invoiceValue}, Frete=${discountedPrice}`);

        return {
            carrier: 'VIP TRANSPORTADORA',
            service_description: 'ENTREGA REGIONAL PR',
            price: Number(discountedPrice.toFixed(2)),
            deadline: 3, // Prazo médio regional
            percentage: Number(percentage.toFixed(2)),
            recommendation: (percentage > 0 && percentage <= 9) ? 'best_option' : 'normal',
        };
    }
}
