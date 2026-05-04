import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SiegService {
  private readonly logger = new Logger(SiegService.name);
  private readonly apiKey: string;
  private readonly email: string;
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
      this.logger.log(`Buscando CT-e na SIEG para a NF: ${nfNumber}`);
      
      // No SIEG, a busca geralmente é feita por período ou filtros.
      // Vamos tentar buscar documentos recentes e filtrar pelo número da NF no XML ou metadados.
      // Nota: A API da SIEG tem endpoints específicos para listar documentos (json).
      
      const payload = {
        apikey: this.apiKey,
        email: this.email,
        type: 'cte',
        // Filtros podem ser adicionados aqui dependendo do endpoint exato
      };

      // Exemplo de chamada para obter listagem de CT-es recentes
      // Para simplificar agora, vamos simular a resposta ou usar um endpoint de busca se documentado.
      // Na prática, precisaríamos do CNPJ da empresa também.
      
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/getxml`, payload)
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao buscar dados na SIEG: ${error.message}`);
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
