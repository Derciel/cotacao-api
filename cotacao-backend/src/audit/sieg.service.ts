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
      
      // Fallback 1: XML (Mais preciso)
      this.logger.log('Iniciando fallback para busca em arquivos XML...');
      const xmlData = await this.findCteByXmlFolder(nfNumber, context);
      if (xmlData) return xmlData;

      // Fallback 2: Excel
      this.logger.log('Iniciando fallback para busca em planilhas Excel...');
      return this.findCteByExcel(nfNumber, context);
    }
  }

  /**
   * Busca dados em arquivos XML recursivamente na raiz do projeto
   */
  async findCteByXmlFolder(nfNumber: string, context?: any): Promise<any> {
    try {
      const rootPath = path.resolve('..');
      const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
      
      // Procurar por pastas que possam conter XMLs (ex: 'xmls', 'XML', etc)
      const entries = fs.readdirSync(rootPath, { withFileTypes: true });
      const folders = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);
      
      // Adicionar a própria raiz na busca
      folders.push('.');

      for (const folder of folders) {
        const folderPath = path.join(rootPath, folder);
        if (!fs.existsSync(folderPath)) continue;

        const files = this.getAllFiles(folderPath).filter(f => f.endsWith('.xml'));
        
        for (const filePath of files) {
          const xmlContent = fs.readFileSync(filePath, 'utf-8');
          const jsonObj = parser.parse(xmlContent);

          // Lógica simplificada para extrair dados de CT-e
          // O formato padrão é cteProc -> CTe -> infCte
          const cte = jsonObj?.cteProc?.CTe?.infCte || jsonObj?.CTe?.infCte;
          
          if (cte) {
            const chavesNf = this.extractNfChaves(cte);
            
            // Match preciso: o número da NF deve bater exatamente com a parte correspondente na chave de 44 dígitos
            const targetNf = nfNumber.replace(/^0+/, '');
            const matchNf = chavesNf.some(ch => {
              if (ch.length === 44) {
                const nfInKey = ch.substring(25, 34).replace(/^0+/, '');
                return nfInKey === targetNf;
              }
              return ch.includes(nfNumber);
            });

            if (matchNf) {
              this.logger.log(`Match encontrado no XML (${path.basename(filePath)}) para NF ${nfNumber}`);
              
              // Extração robusta usando o objeto já parseado
              const valorFrete = Number(cte.vPrest?.vTPrest || 0);
              
              // Peso: pode estar em diferentes tags dependendo da transportadora
              let peso = 0;
              const infQ = cte.infCTeNorm?.infCarga?.infQ;
              if (Array.isArray(infQ)) {
                const pesoObj = infQ.find(q => String(q.tpMed).toUpperCase().includes('PESO'));
                peso = Number(pesoObj?.qCarga || 0);
              } else if (infQ) {
                peso = Number(infQ.qCarga || 0);
              }

              // Volumes
              let volumes = 1;
              if (Array.isArray(infQ)) {
                const volObj = infQ.find(q => String(q.tpMed).toUpperCase().includes('VOLUME'));
                volumes = Number(volObj?.qCarga || 1);
              }

              return {
                numero_cte: cte.ide?.nCT || cte.ide?.cCT || 'N/A',
                valor_frete: valorFrete,
                peso: peso,
                volumes: volumes,
                xml_content: xmlContent,
                xml_filename: path.basename(filePath)
              };
            }
          }
        }
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Erro ao varrer pasta de XMLs: ${error.message}`);
      return null;
    }
  }

  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
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
  }

  private extractNfChaves(cte: any): string[] {
    const chaves: string[] = [];
    
    // 1. CT-e referenciando NF-e (Chave de 44 dígitos)
    const infNFe = cte.infCTeNorm?.infDoc?.infNFe;
    const processNfeKey = (key: string) => {
      if (key && key.length === 44) {
        // O número da NF-e fica nas posições 26 a 34 da chave de 44 dígitos
        const nfFromKey = key.substring(25, 34).replace(/^0+/, '');
        if (nfFromKey) chaves.push(nfFromKey);
      }
      if (key) chaves.push(String(key));
    };

    if (Array.isArray(infNFe)) {
      infNFe.forEach(nfe => nfe.chave && processNfeKey(String(nfe.chave)));
    } else if (infNFe?.chave) {
      processNfeKey(String(infNFe.chave));
    }

    // 2. CT-e referenciando NF manual (Número do documento)
    const infNF = cte.infCTeNorm?.infDoc?.infNF;
    if (Array.isArray(infNF)) {
      infNF.forEach(nf => nf.nDoc && chaves.push(String(nf.nDoc).replace(/^0+/, '')));
    } else if (infNF?.nDoc) {
      chaves.push(String(infNF.nDoc).replace(/^0+/, ''));
    }

    return chaves;
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
          // Normalização para busca
          const cleanNf = nfNumber.replace(/^0+/, '');
          const rowNumero = String(row.Numero || '').replace(/^0+/, '');
          const rowChave = String(row.Chave || '');

          // 1. Match Principal por NF ou Chave
          const matchNf = rowNumero === cleanNf || rowChave.includes(nfNumber);

          // 2. Contexto adicional
          let matchContext = false;
          if (context) {
            const rowCnpjs = [row.CnpjEmit, row.CnpjDest, row.CnpjRem, row.CnpjTom].map(c => String(c || '').replace(/\D/g, ''));
            const contextCnpj = String(context.cnpj || '').replace(/\D/g, '');
            const matchCnpj = contextCnpj && rowCnpjs.includes(contextCnpj);
            
            const rowRazao = String(row.RzEmit || row.RzDest || '').toUpperCase();
            const contextRazao = String(context.razaoSocial || '').toUpperCase();
            const matchRazao = contextRazao && rowRazao.includes(contextRazao);
            
            const matchValor = Math.abs((Number(row.Valor) || 0) - (Number(context.valor) || 0)) < 2.00;

            if ((matchCnpj && matchValor) || (matchRazao && matchValor)) {
                matchContext = true;
            }
          }

          if (matchNf || matchContext) {
            this.logger.log(`Match encontrado no Excel (${fileName}) para NF ${nfNumber}`);
            
            // Tenta buscar o XML localmente mesmo que tenha batido no Excel, para habilitar o "olho"
            const localXml = await this.findCteByXmlFolder(nfNumber, context);

            return {
              numero_cte: rowChave || rowNumero || 'N/A',
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
        const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
        const jsonObj = parser.parse(xml);
        const cte = jsonObj?.cteProc?.CTe?.infCte || jsonObj?.CTe?.infCte;

        if (!cte) return null;

        const valorFrete = Number(cte.vPrest?.vTPrest || 0);
        
        let peso = 0;
        const infQ = cte.infCTeNorm?.infCarga?.infQ;
        if (Array.isArray(infQ)) {
          const pesoObj = infQ.find(q => String(q.tpMed).toUpperCase().includes('PESO'));
          peso = Number(pesoObj?.qCarga || 0);
        } else if (infQ) {
          peso = Number(infQ.qCarga || 0);
        }

        let volumes = 1;
        if (Array.isArray(infQ)) {
          const volObj = infQ.find(q => String(q.tpMed).toUpperCase().includes('VOLUME'));
          volumes = Number(volObj?.qCarga || 1);
        }

        return {
            numero_cte: cte.ide?.nCT || cte.ide?.cCT || key,
            valor_frete: valorFrete,
            peso: peso,
            volumes: volumes,
            xml_content: xml,
            xml_filename: `${key}.xml`
        };
    } catch (e) {
        this.logger.error('Erro ao processar XML do CT-e via Parser');
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
