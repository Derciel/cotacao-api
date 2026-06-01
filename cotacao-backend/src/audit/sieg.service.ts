import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export class SiegService {
  private readonly logger = new Logger(SiegService.name);
  private readonly apiKey: string;
  private readonly email: string;
  private readonly clientId: string;
  private readonly secretKey: string;
  private readonly cnpjNicopel = '09012538000190';
  private readonly baseUrl = 'https://api.sieg.com';

  private cachedJwtToken: string | null = null;
  private tokenExpiration: Date | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('SIEG_API_KEY') || '';
    this.email = this.configService.get<string>('SIEG_EMAIL') || '';
    this.clientId = this.configService.get<string>('SIEG_CLIENT_ID') || '';
    this.secretKey = this.configService.get<string>('SIEG_SECRET_KEY') || '';
  }

  /**
   * Obtém o token JWT para autenticação na Nova API da SIEG (com cache em memória)
   */
  private async getJwtToken(): Promise<string> {
    const now = new Date();
    // Se o token estiver no cache e ainda for válido (expira em no mínimo 10 minutos)
    if (this.cachedJwtToken && this.tokenExpiration && this.tokenExpiration.getTime() > now.getTime() + 600000) {
      return this.cachedJwtToken;
    }

    try {
      this.logger.log('Solicitando novo Token JWT para a API SIEG...');
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/create-jwt`,
          {},
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-Client-Id': this.clientId,
              'X-Secret-Key': this.secretKey,
            },
          }
        )
      );

      let token = '';
      if (response.data && typeof response.data === 'string') {
        token = response.data.trim();
      } else if (response.data && response.data.Token) {
        token = response.data.Token.trim();
      } else {
        token = String(response.data).trim();
      }

      // Limpa aspas do início e fim caso venha encapsulado
      token = token.replace(/^"|"$/g, '').trim();

      if (!token || !token.startsWith('ey')) {
        throw new Error(`Token inválido retornado pela API: ${token ? token.substring(0, 50) : 'vazio'}`);
      }

      this.cachedJwtToken = token;
      // Define a expiração do cache para 12 horas no futuro (o token expira em 24 horas normalmente)
      this.tokenExpiration = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      this.logger.log('Novo Token JWT da SIEG obtido e armazenado em cache com sucesso.');
      return token;
    } catch (error: any) {
      this.logger.error(`Erro ao gerar Token JWT na SIEG: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca um CT-e que referencia uma NF-e específica na Nova API da SIEG
   */
  async findCteByNf(nfNumber: string, context?: any): Promise<any> {
    try {
      this.logger.log(`Iniciando busca real na Nova API da SIEG para NF: ${nfNumber}`);
      
      if (!this.clientId || !this.secretKey || !this.apiKey) {
        this.logger.warn('Credenciais da SIEG não configuradas completamente no .env. Pulando para fallbacks locais.');
        throw new Error('Credenciais incompletas');
      }

      // 1. Obter o JWT Token
      const token = await this.getJwtToken();

      // 2. Definir datas (90 dias atrás até hoje)
      const now = new Date();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(now.getDate() - 90);

      const payload = {
        TipoXml: 2, // CTe
        Take: 50,
        Skip: 0,
        DataEmissaoInicio: ninetyDaysAgo.toISOString(),
        DataEmissaoFim: now.toISOString()
      };

      this.logger.log(`Consultando download em lote na SIEG (/api/v1/baixar-xmls) de ${ninetyDaysAgo.toLocaleDateString()} a ${now.toLocaleDateString()}`);

      // 3. Fazer requisição de lote binário
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/baixar-xmls`,
          payload,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-API-Key': this.apiKey
            },
            responseType: 'arraybuffer'
          }
        )
      );

      const buffer = Buffer.from(response.data);
      let docsFound = 0;

      // 4. Se a resposta for um arquivo ZIP, processamos
      if (buffer.length > 4 && buffer.toString('utf8', 0, 2) === 'PK') {
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();
        docsFound = zipEntries.length;
        
        this.logger.log(`Busca SIEG retornou pacote ZIP com ${docsFound} documentos de CT-e.`);

        for (const entry of zipEntries) {
          try {
            const xmlContent = entry.getData().toString('utf8');
            const cte = this.parseXmlToObj(xmlContent);
            if (!cte) continue;

            const chavesNf = this.extractNfChaves(cte);
            const targetNf = nfNumber.replace(/^0+/, '');
            
            const hasNfMatch = chavesNf.some(ch => {
                const cleanCh = ch.replace(/^0+/, '');
                if (cleanCh.length === 44) {
                   return cleanCh.substring(25, 34).replace(/^0+/, '') === targetNf;
                }
                return cleanCh === targetNf || ch === nfNumber;
            });

            if (hasNfMatch) {
                const key = entry.entryName.replace(/\.xml$/i, '');
                this.logger.log(`CT-e validado com sucesso via Nova API SIEG! Chave: ${key}`);
                const dataFromXml = this.extractDataFromXml(xmlContent, key);
                if (dataFromXml) return dataFromXml;
            }
          } catch (e: any) {
            this.logger.warn(`Erro ao analisar XML individual do ZIP: ${e.message}`);
          }
        }
      } else {
        const textResponse = buffer.toString('utf8');
        this.logger.warn(`API da SIEG não retornou pacote ZIP. Resposta: ${textResponse.substring(0, 200)}`);
      }

      this.logger.warn(`Nenhum CT-e correspondente à NF ${nfNumber} foi localizado no lote de ${docsFound} documentos.`);

      // Se não achou na API, vai para fallbacks locais
      this.logger.log('Iniciando fallback para busca em arquivos XML locais...');
      const xmlData = await this.findCteByXmlFolder(nfNumber, context);
      if (xmlData) return xmlData;

      this.logger.log('Iniciando fallback para busca em planilhas Excel...');
      return this.findCteByExcel(nfNumber, context);

    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        this.logger.log('SIEG reportou 404 (Nenhum arquivo XML localizado no período). Partindo para fallbacks locais...');
      } else {
        this.logger.error(`Erro ao buscar dados na SIEG (Nova API): ${error.message}`);
      }
      return this.findCteByXmlFolder(nfNumber, context);
    }
  }

  async findCteByXmlFolder(nfNumber: string, context?: any): Promise<any> {
    if (!nfNumber || nfNumber.trim() === '' || nfNumber === '---') return null;

    try {
      const rootPath = path.resolve('..');
      const entries = fs.readdirSync(rootPath, { withFileTypes: true });
      const folders = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);
      folders.push('.');

      const targetNf = nfNumber.replace(/^0+/, '');
      const contextCnpj = context?.cnpj ? String(context.cnpj).replace(/\D/g, '') : null;

      for (const folder of folders) {
        const folderPath = path.join(rootPath, folder);
        if (!fs.existsSync(folderPath)) continue;

        const possibleXmlPaths = [
            folderPath,
            path.join(folderPath, 'xml'),
            path.join(folderPath, 'XML'),
            path.join(rootPath, 'xml', folder)
        ];

        for (const xmlDir of possibleXmlPaths) {
          if (!fs.existsSync(xmlDir)) continue;
          const files = this.getAllFiles(xmlDir).filter(f => f.endsWith('.xml'));
          
          for (const filePath of files) {
            try {
              const xmlContent = fs.readFileSync(filePath, 'utf-8');
              const cte = this.parseXmlToObj(xmlContent);
              if (!cte) continue;

              const chavesNf = this.extractNfChaves(cte);
              const hasNfMatch = chavesNf.some(ch => {
                const cleanCh = ch.replace(/^0+/, '');
                if (cleanCh.length === 44) {
                   return cleanCh.substring(25, 34).replace(/^0+/, '') === targetNf;
                }
                return cleanCh === targetNf || ch === nfNumber;
              });

              if (!hasNfMatch) continue;

              let contextMatch = true; 
              if (contextCnpj) {
                  const cnpjs = [
                    cte.emit?.CNPJ, cte.rem?.CNPJ, cte.dest?.CNPJ, 
                    cte.toma3?.CNPJ, cte.toma4?.CNPJ
                  ].map(c => String(c || '').replace(/\D/g, ''));
                  contextMatch = cnpjs.includes(contextCnpj);
              }

              if (contextCnpj && !contextMatch) continue;

              this.logger.log(`Match encontrado no XML local: ${path.basename(filePath)}`);
              return this.extractDataFromXml(xmlContent, path.basename(filePath));
            } catch (e) { continue; }
          }
        }
      }

      // LOGICA BRUTA: Por Valor
      if (context?.valor && context?.valor > 0) {
        this.logger.log(`Tentando Lógica Bruta por Valor (R$ ${context.valor})...`);
        for (const folder of folders) {
          const folderPath = path.join(rootPath, folder);
          const xmlDir = path.join(folderPath, 'xml');
          if (!fs.existsSync(xmlDir)) continue;

          const files = this.getAllFiles(xmlDir).filter(f => f.endsWith('.xml'));
          for (const filePath of files) {
            try {
              const xmlContent = fs.readFileSync(filePath, 'utf-8');
              const cte = this.parseXmlToObj(xmlContent);
              if (!cte) continue;

              const valCte = Number(cte.vPrest?.vTPrest || 0);
              if (Math.abs(valCte - context.valor) < 0.01) {
                  this.logger.log(`Match por VALOR encontrado: ${path.basename(filePath)}`);
                  return this.extractDataFromXml(xmlContent, path.basename(filePath));
              }
            } catch (e) { continue; }
          }
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    try {
        const files = fs.readdirSync(dirPath);
        files.forEach((file) => {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                if (!file.includes('node_modules') && !file.startsWith('.')) {
                    arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
                }
            } else {
                arrayOfFiles.push(fullPath);
            }
        });
        return arrayOfFiles;
    } catch (e) {
        return arrayOfFiles;
    }
  }

  private extractNfChaves(cte: any): string[] {
    const chaves: string[] = [];
    const infNFe = cte.infCTeNorm?.infDoc?.infNFe;
    
    const process = (k: any) => {
        const sk = String(k || '');
        if (sk.length === 44) chaves.push(sk.substring(25, 34).replace(/^0+/, ''));
        if (sk) chaves.push(sk);
    };

    if (Array.isArray(infNFe)) infNFe.forEach(n => process(n.chave));
    else if (infNFe?.chave) process(infNFe.chave);

    const infNF = cte.infCTeNorm?.infDoc?.infNF;
    if (Array.isArray(infNF)) infNF.forEach(n => chaves.push(String(n.nDoc || '').replace(/^0+/, '')));
    else if (infNF?.nDoc) chaves.push(String(infNF.nDoc).replace(/^0+/, ''));

    return chaves;
  }

  async findCteByExcel(nfNumber: string, context?: any): Promise<any> {
    if (!nfNumber || nfNumber.trim() === '' || nfNumber === '---') return null;
    try {
      const rootPath = path.resolve('..');
      const files = fs.readdirSync(rootPath).filter(f => f.endsWith('.xlsx'));
      const target = nfNumber.replace(/^0+/, '');

      for (const fileName of files) {
        const workbook = XLSX.readFile(path.join(rootPath, fileName));
        const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        for (const row of data) {
          const rowNf = String(row.Numero || '').replace(/^0+/, '');
          const rowChave = String(row.Chave || '');
          
          let match = false;
          if (rowChave.length === 44) {
            const nfFromKey = rowChave.substring(25, 34).replace(/^0+/, '');
            match = (nfFromKey === target);
          } else {
            match = (rowNf === target);
          }

          if (match) {
            const localXml = await this.findCteByXmlFolder(nfNumber, context);
            return {
              numero_cte: rowChave || rowNf || 'N/A',
              valor_frete: Number(row.Valor) || 0,
              peso: Number(row.Peso) || 0,
              volumes: Number(row.Volumes) || 1,
              xml_content: localXml?.xml_content || null,
              xml_filename: localXml?.xml_filename || null
            };
          }
        }
      }
      return null;
    } catch (e) { return null; }
  }

  private parseXmlToObj(xml: string): any {
    try {
        const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
        const obj = parser.parse(xml);
        return obj?.cteProc?.CTe?.infCte || obj?.CTe?.infCte || obj?.infCte;
    } catch (e) { return null; }
  }

  private extractDataFromXml(xml: string, key: string) {
    const cte = this.parseXmlToObj(xml);
    if (!cte) return null;
    const infQ = cte.infCTeNorm?.infCarga?.infQ;
    const getQ = (type: string) => {
        if (Array.isArray(infQ)) return infQ.find(q => String(q.tpMed).toUpperCase().includes(type))?.qCarga;
        return infQ?.qCarga;
    };
    return {
        numero_cte: cte.ide?.nCT || key,
        valor_frete: Number(cte.vPrest?.vTPrest || 0),
        peso: Number(getQ('PESO') || 0),
        volumes: Number(getQ('VOLUME') || 1),
        xml_content: xml,
        xml_filename: `${key}.xml`
    };
  }

  /**
   * Baixa um XML individual na Nova API do SIEG
   */
  async getXml(xmlKey: string, type: 'nfe' | 'cte'): Promise<string | null> {
    try {
      const token = await this.getJwtToken();
      const payload = {
        ChaveXml: xmlKey,
        TipoXml: type === 'cte' ? 2 : 1,
        BaixarEventos: false
      };

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/baixar-xml`,
          payload,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-API-Key': this.apiKey
            }
          }
        )
      );

      if (response.data && response.data.IsSuccess && response.data.Data) {
        return response.data.Data;
      }
      return null;
    } catch (e: any) {
      this.logger.error(`Erro ao baixar XML individual da SIEG: ${e.message}`);
      return null;
    }
  }

  /**
   * Valida a conexão e credenciais com a Nova API do SIEG
   */
  async testConnection(): Promise<any> {
    try {
      if (!this.clientId || !this.secretKey || !this.apiKey) {
        return { success: false, message: 'Credenciais incompletas no .env (SIEG_CLIENT_ID, SIEG_SECRET_KEY ou SIEG_API_KEY).' };
      }

      this.logger.log('Testando conexão e autenticação com a Nova API da SIEG...');
      const token = await this.getJwtToken();

      // Busca 1 registro leve de teste (último 1 dia)
      const now = new Date();
      const oneDayAgo = new Date();
      oneDayAgo.setDate(now.getDate() - 1);

      const payload = {
        TipoXml: 2,
        Take: 1,
        Skip: 0,
        DataEmissaoInicio: oneDayAgo.toISOString(),
        DataEmissaoFim: now.toISOString()
      };

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/baixar-xmls`,
          payload,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-API-Key': this.apiKey
            },
            responseType: 'arraybuffer'
          }
        )
      );

      const buffer = Buffer.from(response.data);
      let isZip = buffer.length > 4 && buffer.toString('utf8', 0, 2) === 'PK';

      return {
        success: true,
        message: 'Conexão e autenticação com a Nova API realizadas com sucesso absoluta!',
        details: isZip ? 'Pacote de dados ZIP retornado' : 'Canal ativado (resposta sem dados)'
      };
    } catch (e: any) {
      this.logger.error(`Erro no teste de conexão da SIEG: ${e.message}`);
      return { success: false, message: e.message };
    }
  }
}
