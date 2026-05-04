import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

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
    this.email = this.configService.get<string>('SIEG_EMAIL') || '';
  }

  /**
   * Busca um CT-e que referencia uma NF-e específica
   */
  async findCteByNf(nfNumber: string, context?: any): Promise<any> {
    try {
      this.logger.log(`Iniciando busca real na SIEG para NF: ${nfNumber}`);
      
      // 1. Definir os filtros de busca
      // Tentaremos primeiro uma busca sem filtros de CNPJ (pode retornar docs de todas as empresas da conta)
      // e depois com filtros específicos se nada for encontrado.
      const filterOptions = [
          { }, // Sem filtro (Global)
          { cnpjtomador: this.cnpjNicopel },
          { cnpjremetente: this.cnpjNicopel },
          { cnpjdestinatario: this.cnpjNicopel }
      ];
      
      let docs: any[] = [];

      for (const filter of filterOptions) {
          const payload: any = {
            apikey: this.apiKey,
            type: 'cte',
            ...filter
          };
          
          if (this.email) {
            payload.email = this.email;
          }

          const response = await firstValueFrom(
            this.httpService.post(`${this.baseUrl}/getdocs`, payload)
          );

          if (response.data && Array.isArray(response.data)) {
              this.logger.log(`Busca SIEG com filtro ${JSON.stringify(filter)} retornou ${response.data.length} documentos.`);
              docs = [...docs, ...response.data];
              if (docs.length > 0) break; // Se encontrou algo, para de tentar outros filtros
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
          if (!xml) continue;

          // Limpamos zeros à esquerda do número da NF para garantir o match (ex: 000067704 -> 67704)
          const cleanNfNumber = nfNumber.replace(/^0+/, '');
          
          // Verifica se o XML contém a NF em tags comuns de documentos originários
          // <nDoc> é comum em CT-es para referenciar o número da NF-e sem a chave
          // <nNF> é a tag padrão de número de nota
          const isMatch = (
              xml.includes(`<nDoc>${nfNumber}</nDoc>`) || 
              xml.includes(`<nDoc>${cleanNfNumber}</nDoc>`) || 
              xml.includes(`<nNF>${nfNumber}</nNF>`) ||
              xml.includes(`<nNF>${cleanNfNumber}</nNF>`) ||
              (nfNumber.length >= 7 && xml.includes(nfNumber)) || // Busca genérica se for um número longo
              (nfNumber.length === 44 && xml.includes(nfNumber))  // Busca exata por chave de acesso
          );

          if (isMatch) {
              this.logger.log(`CT-e encontrado com sucesso! Chave: ${doc.XmlKey}`);
              return this.extractDataFromXml(xml, doc.XmlKey);
          }
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Erro ao buscar dados na SIEG (API): ${error.message}`);
      
      // Fallback para Excel conforme solicitado pelo usuário
      this.logger.log('Iniciando fallback para busca em planilhas Excel...');
      return this.findCteByExcel(nfNumber, context);
    }
  }

  /**
   * Busca dados em planilhas Excel na raiz do projeto
   */
  async findCteByExcel(nfNumber: string, context?: any): Promise<any> {
    try {
      const rootPath = path.resolve('..');
      const files = fs.readdirSync(rootPath).filter(f => f.endsWith('.xlsx'));
      
      this.logger.log(`Varrendo ${files.length} arquivos Excel em ${rootPath}`);

      for (const fileName of files) {
        const filePath = path.join(rootPath, fileName);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data: any[] = XLSX.utils.sheet_to_json(worksheet);

        for (const row of data) {
          // 1. Match Principal por NF
          const matchNf = String(row.Numero).includes(nfNumber.replace(/^0+/, '')) || 
                         String(row.Chave).includes(nfNumber);

          // 2. Se não houver NF ou se quisermos validar mais (conforme pedido pelo user)
          let matchContext = false;
          if (context) {
            const matchCnpj = [row.CnpjEmit, row.CnpjDest, row.CnpjRem, row.CnpjTom].includes(context.cnpj?.replace(/\D/g, ''));
            const matchRazao = [row.RzEmit, row.RzDest].some(r => r?.toUpperCase().includes(context.razaoSocial?.toUpperCase()));
            const matchValor = Math.abs((row.Valor || 0) - (context.valor || 0)) < 10.00; // Tolerância de 10 reais para "aproximado"

            // Se bater CNPJ e Valor, ou Razão e Valor, consideramos match
            if ((matchCnpj && matchValor) || (matchRazao && matchValor)) {
                matchContext = true;
            }
          }

          if (matchNf || matchContext) {
            this.logger.log(`Match encontrado no Excel (${fileName}) para NF ${nfNumber} / Contexto: ${matchContext}`);
            return {
              numero_cte: row.Chave || row.Numero,
              valor_frete: row.Valor || 0,
              peso: 0,
              volumes: 1
            };
          }
        }
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Erro ao ler arquivos Excel: ${error.message}`);
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
      const payload: any = {
        apikey: this.apiKey,
        type: type,
        xmlkey: xmlKey
      };

      if (this.email) {
        payload.email = this.email;
      }

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/getxml`, payload)
      );

      return response.data;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Testa a conexão com a SIEG e retorna o status
   */
  async testConnection(): Promise<any> {
      try {
          const payload: any = {
            apikey: this.apiKey,
            type: 'cte'
          };

          if (this.email) {
            payload.email = this.email;
          }

          const response = await firstValueFrom(
            this.httpService.post(`${this.baseUrl}/getdocs`, payload)
          );

          return {
              success: true,
              email: this.email,
              docsCount: Array.isArray(response.data) ? response.data.length : 0,
              message: 'Conexão com SIEG estabelecida com sucesso!'
          };
      } catch (error: any) {
          this.logger.error(`Erro no teste de conexão SIEG: ${error.message}`);
          return {
              success: false,
              message: `Erro ao conectar com SIEG: ${error.message}`,
              status: error.response?.status
          };
      }
  }
}
