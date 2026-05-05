import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { XMLParser } from 'fast-xml-parser';

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
              if (docs.length > 0) break;
          }
      }

      if (docs.length === 0) {
        this.logger.warn(`Nenhum documento retornado pela SIEG em nenhum papel fiscal (Tom/Rem/Des).`);
      } else {
        const uniqueDocs = Array.from(new Map(docs.map(item => [item.XmlKey, item])).values())
                                .sort((a: any, b: any) => b.Date.localeCompare(a.Date))
                                .slice(0, 15);
        
        for (const doc of uniqueDocs) {
            const xml = await this.getXml(doc.XmlKey, 'cte');
            if (!xml) continue;

            const dataFromXml = this.extractDataFromXml(xml, doc.XmlKey);
            if (!dataFromXml) continue;

            const chavesNf = this.extractNfChaves(this.parseXmlToObj(xml));
            const targetNf = nfNumber.replace(/^0+/, '');
            
            const hasNfMatch = chavesNf.some(ch => {
                const cleanCh = ch.replace(/^0+/, '');
                if (cleanCh.length === 44) {
                   return cleanCh.substring(25, 34).replace(/^0+/, '') === targetNf;
                }
                return cleanCh === targetNf || ch === nfNumber;
            });

            if (hasNfMatch) {
                this.logger.log(`CT-e validado com sucesso via API SIEG! Chave: ${doc.XmlKey}`);
                return dataFromXml;
            }
        }
      }

      // Se nada na API, tenta local
      this.logger.log('Iniciando fallback para busca em arquivos XML locais...');
      const xmlData = await this.findCteByXmlFolder(nfNumber, context);
      if (xmlData) return xmlData;

      this.logger.log('Iniciando fallback para busca em planilhas Excel...');
      return this.findCteByExcel(nfNumber, context);

    } catch (error: any) {
      this.logger.error(`Erro ao buscar dados na SIEG (API): ${error.message}`);
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
          const match = rowNf === target || (rowChave.length === 44 && rowChave.substring(25, 34).replace(/^0+/, '') === target);

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

  async getXml(xmlKey: string, type: 'nfe' | 'cte'): Promise<string | null> {
    try {
      const response = await firstValueFrom(this.httpService.post(`${this.baseUrl}/getxml`, { apikey: this.apiKey, email: this.email, type, xmlkey: xmlKey }));
      return response.data;
    } catch (e) { return null; }
  }

  async testConnection(): Promise<any> {
    try {
      const res = await firstValueFrom(this.httpService.post(`${this.baseUrl}/getdocs`, { apikey: this.apiKey, email: this.email, type: 'cte' }));
      return { success: true, docsCount: Array.isArray(res.data) ? res.data.length : 0 };
    } catch (e: any) { return { success: false, message: e.message }; }
  }
}
