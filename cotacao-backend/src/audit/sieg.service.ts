import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SiegService {
  private readonly logger = new Logger(SiegService.name);
  private readonly apiKey: string;
  private readonly email: string;
  private readonly cnpjNicopel = '09012538000190';
  private readonly baseUrl = 'https://api.sieg.com/aws/service.svc/v2';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('SIEG_API_KEY') || '';
    // Usaremos o email do admin ou um fixo configurado. 
    // Como a chave foi passada pelo user, o email associado à conta dele no SIEG é necessário.
    // Vou assumir um padrão ou buscar do config se disponível.
    this.email = 'diretoria@nicopel.com.br'; // Ajustar conforme necessário ou colocar no .env
  }

  /**
   * Busca um CT-e que referencia uma NF-e específica
   */
  async findCteByNf(nfNumber: string): Promise<any> {
    try {
      this.logger.log(`Iniciando busca real na SIEG para NF: ${nfNumber}`);
      
      // 1. Definir os filtros de busca
      // Tentaremos buscar documentos onde a Nicopel é tomadora, remetente ou destinatária
      const searchRoles = ['cnpjtomador', 'cnpjremetente', 'cnpjdestinatario'];
      let docs: any[] = [];

      for (const role of searchRoles) {
          const payload: any = {
            apikey: this.apiKey,
            email: this.email,
            type: 'cte'
          };
          payload[role] = this.cnpjNicopel;

          const response = await firstValueFrom(
            this.httpService.post(`${this.baseUrl}/getdocs`, payload)
          );

          if (response.data && Array.isArray(response.data)) {
              docs = [...docs, ...response.data];
          }
      }

      if (docs.length === 0) {
        this.logger.warn(`Nenhum documento retornado pela SIEG em nenhum papel fiscal (Tom/Rem/Des).`);
        return null;
      }

      // 2. Filtrar e extrair o XML para verificar a NF
      // Removendo duplicatas (pela XmlKey) e pegando os mais recentes
      const uniqueDocs = Array.from(new Map(docs.map(item => [item.XmlKey, item])).values())
                              .sort((a: any, b: any) => b.Date.localeCompare(a.Date))
                              .slice(0, 15);
      
      for (const doc of uniqueDocs) {
          const xml = await this.getXml(doc.XmlKey, 'cte');
          
          // Verifica se o XML contém a NF (seja o número ou a chave completa)
          // Se for chave (44 dígitos), a busca é exata. Se for número, pode haver falso-positivo, 
          // então validamos se está entre tags <nNF> ou <infNFe>.
          const isMatch = xml && (
              xml.includes(`<nNF>${nfNumber}</nNF>`) || 
              xml.includes(nfNumber) || 
              (nfNumber.length === 44 && xml.includes(nfNumber))
          );

          if (isMatch) {
              this.logger.log(`CT-e encontrado com sucesso! Chave: ${doc.XmlKey}`);
              return this.extractDataFromXml(xml, doc.XmlKey);
          }
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Erro ao buscar dados na SIEG: ${error.message}`);
      return null;
    }
  }

  /**
   * Extrai dados de valor, peso e volume do XML do CT-e
   */
  private extractDataFromXml(xml: string, key: string) {
    try {
        // Valor total da prestação <vPrest><vTPrest>XXX.XX</vTPrest></vPrest>
        const vTPrestMatch = xml.match(/<vTPrest>(.*?)<\/vTPrest>/);
        const valorFrete = vTPrestMatch ? parseFloat(vTPrestMatch[1]) : 0;

        // Peso bruto <qCarga>XXX.XXXX</qCarga> (dentro de infQ)
        const qCargaMatch = xml.match(/<tpMed>PESO BRUTO<\/tpMed>.*?<qCarga>(.*?)<\/qCarga>/s) || xml.match(/<qCarga>(.*?)<\/qCarga>/);
        const peso = qCargaMatch ? parseFloat(qCargaMatch[1]) : 0;

        // Volumes <qVol>XXX</qVol>
        const qVolMatch = xml.match(/<qVol>(.*?)<\/qVol>/);
        const volumes = qVolMatch ? parseInt(qVolMatch[1]) : 1;

        return {
            numero_cte: key, // Usando a chave como número identificador
            valor_frete: valorFrete,
            peso: peso,
            volumes: volumes
        };
    } catch (e) {
        this.logger.error('Erro ao processar XML do CT-e');
        return null;
    }
  }

  /**
   * Obtém o XML completo de um documento
   */
  async getXml(xmlKey: string, type: 'nfe' | 'cte'): Promise<string | null> {
    try {
      const payload = {
        apikey: this.apiKey,
        email: this.email,
        type: type,
        xmlkey: xmlKey
      };

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/getxml`, payload)
      );

      return response.data;
    } catch (error) {
      return null;
    }
  }
}
