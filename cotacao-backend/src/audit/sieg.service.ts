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
      
      // 1. Buscar a listagem de CT-es que podem conter essa NF
      // Usamos getdocs para listar os documentos em formato JSON (mais leve que XML para busca)
      const payload = {
        apikey: this.apiKey,
        email: this.email,
        type: 'cte',
        cnpjtomador: this.cnpjNicopel
      };

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/getdocs`, payload)
      );

      const docs = response.data;
      if (!docs || !Array.isArray(docs)) {
        this.logger.warn(`Nenhum documento retornado pela SIEG para NF: ${nfNumber}`);
        return null;
      }

      // 2. Procurar nos documentos JSON algum que faça referência à NF
      // Na API v2, a resposta JSON contém campos básicos. Precisamos do XML para ver a NF vinculada.
      // Por performance, vamos pegar os 3 últimos CT-es e verificar o XML.
      const lastDocs = docs.slice(0, 5);
      
      for (const doc of lastDocs) {
          const xml = await this.getXml(doc.XmlKey, 'cte');
          if (xml && xml.includes(nfNumber)) {
              this.logger.log(`CT-e encontrado! Chave: ${doc.XmlKey}`);
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
