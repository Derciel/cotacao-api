import { Injectable, InternalServerErrorException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import { QuotationsService } from '../quotations/quotations.service.js';
import { Quotation, EmpresaFaturamento } from '../quotations/entities/quotation.entity.js';

type QuotationsServicePort = Pick<QuotationsService, 'findOne' | 'isFreightExempt'>;

@Injectable()
export class PdfService {
  private readonly templatePath: string;

  constructor(
    @Inject(forwardRef(() => QuotationsService))
    private readonly quotationsService: QuotationsServicePort
  ) {
    this.templatePath = path.resolve(process.cwd(), 'src/documents/templates/quotation.html');
    this._registerHandlebarsHelpers();
  }

  async generateQuotationPdf(quotationId: number): Promise<Buffer> {
    const quotation = await this.quotationsService.findOne(quotationId);
    if (!quotation) throw new NotFoundException(`Cotação #${quotationId} não encontrada.`);

    const finalHtml = await this._compileHtmlTemplate(quotation);
    return this._generatePdfFromHtml(finalHtml);
  }

  async generateMultipleQuotationsPdf(quotationIds: number[]): Promise<{ name: string, buffer: Buffer }[]> {
    let browser: any;
    const results: { name: string, buffer: Buffer }[] = [];
    
    try {
      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: true
      });

      for (const id of quotationIds) {
        try {
          const quotation = await this.quotationsService.findOne(id);
          if (!quotation) continue;

          const finalHtml = await this._compileHtmlTemplate(quotation as any);
          
          const page = await browser.newPage();
          await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

          const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
          });

          await page.close();

          let clientName = quotation.client?.fantasia || quotation.client?.razao_social || 'cliente';
          clientName = clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

          results.push({
            name: `${clientName}_orcamento-${id}.pdf`,
            buffer: Buffer.from(pdfBuffer)
          });
        } catch (err) {
          console.error(`Erro ao gerar PDF para cotação ${id} em lote:`, err);
        }
      }
    } catch (err: any) {
      console.error('Erro ao iniciar Puppeteer em lote:', err.message);
    } finally {
      if (browser) await browser.close();
    }
    
    return results;
  }

  async generateBatchQuotationsPdf(quotationIds: number[]): Promise<Buffer> {
    const quotations: any[] = [];
    
    for (const id of quotationIds) {
      try {
        const quotation = await this.quotationsService.findOne(id);
        if (!quotation) continue;

        const cleaned = JSON.parse(JSON.stringify(quotation));

        // Lógica de Isenção de Frete Visual no PDF
        const isExento = this.quotationsService.isFreightExempt(quotation.client.razao_social, quotation.client.fantasia);
        if (isExento) {
          cleaned.valor_frete = 0;
        }

        const themes: Record<string, string> = {
          [EmpresaFaturamento.NICOPEL]: '#F2F2F2',
          [EmpresaFaturamento.FLEXOBOX]: '#BDD7EE',
          [EmpresaFaturamento.L_LOG]: '#F2F2F2',
        };

        const logos: Record<string, string> = {
          [EmpresaFaturamento.NICOPEL]: 'https://i.ibb.co/zWJstk81/logo-nicopel-8.png',
          [EmpresaFaturamento.L_LOG]: 'https://i.ibb.co/HLh2RFHP/logo-l-log.png',
          [EmpresaFaturamento.FLEXOBOX]: 'https://i.ibb.co/WtrW9Qf/FLEXOBOX.png',
        };

        let totalVol = 0, totalWeight = 0;
        cleaned.items?.forEach((item: any) => {
          item.quantidade = Number(item.quantidade);
          if (item.product?.unidades_caixa > 0) {
            const caixas = item.quantidade / item.product.unidades_caixa;
            totalVol += caixas;
            totalWeight += caixas * (parseFloat(item.product.peso_caixa_kg) || 0);
          }
        });

        cleaned.themeColor = themes[cleaned.empresa_faturamento as keyof typeof themes] || '#F2F2F2';
        cleaned.logoUrl = logos[cleaned.empresa_faturamento as keyof typeof logos] || '';
        cleaned.formattedDate = new Date(cleaned.data_cotacao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        cleaned.cityState = `${cleaned.client.cidade} - ${cleaned.client.estado || 'PR'}`;
        cleaned.totalVolume = totalVol.toFixed(0);
        cleaned.totalWeight = totalWeight.toFixed(2);

        quotations.push(cleaned);
      } catch (err) {
        console.error(`Erro ao carregar dados para cotação ${id} no lote unificado:`, err);
      }
    }

    // Agrupa em pares de cotações para cada página
    const pagePairs: any[][] = [];
    for (let i = 0; i < quotations.length; i += 2) {
      pagePairs.push(quotations.slice(i, i + 2));
    }

    const templateHtml = await fs.readFile(path.resolve(process.cwd(), 'src/documents/templates/quotation_batch.html'), 'utf8');
    const template = handlebars.compile(templateHtml);
    const finalHtml = template({ pagePairs });

    return this._generatePdfFromHtmlForBatch(finalHtml);
  }

  private async _generatePdfFromHtmlForBatch(html: string): Promise<Buffer> {
    let browser;
    try {
      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: true
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
      });

      await browser.close();
      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      if (browser) await browser.close();
      console.error('Erro no Puppeteer em lote:', error.message);
      throw new InternalServerErrorException(`Falha ao gerar PDF em lote: ${error.message}`);
    }
  }

  private async _compileHtmlTemplate(quotation: Quotation): Promise<string> {
    const templateHtml = await fs.readFile(this.templatePath, 'utf8');
    const template = handlebars.compile(templateHtml);
    const cleaned = JSON.parse(JSON.stringify(quotation));

    // Lógica de Isenção de Frete Visual no PDF
    const isExento = this.quotationsService.isFreightExempt(quotation.client.razao_social, quotation.client.fantasia);
    if (isExento) {
      cleaned.valor_frete = 0;
    }

    const themes: Record<string, string> = {
      [EmpresaFaturamento.NICOPEL]: '#F2F2F2',
      [EmpresaFaturamento.FLEXOBOX]: '#BDD7EE',
      [EmpresaFaturamento.L_LOG]: '#F2F2F2',
    };

    const logos: Record<string, string> = {
      [EmpresaFaturamento.NICOPEL]: 'https://i.ibb.co/zWJstk81/logo-nicopel-8.png',
      [EmpresaFaturamento.L_LOG]: 'https://i.ibb.co/HLh2RFHP/logo-l-log.png',
      [EmpresaFaturamento.FLEXOBOX]: 'https://i.ibb.co/WtrW9Qf/FLEXOBOX.png',
    };

    let totalVol = 0, totalWeight = 0;
    cleaned.items?.forEach((item: any) => {
      item.quantidade = Number(item.quantidade); // Remove trailing zeros (4 casas) from database
      if (item.product?.unidades_caixa > 0) {
        const caixas = item.quantidade / item.product.unidades_caixa;
        totalVol += caixas;
        totalWeight += caixas * (parseFloat(item.product.peso_caixa_kg) || 0);
      }
    });

    return template({
      quotation: cleaned,
      themeColor: themes[cleaned.empresa_faturamento as keyof typeof themes] || '#F2F2F2',
      logoUrl: logos[cleaned.empresa_faturamento as keyof typeof logos] || '',
      formattedDate: new Date(cleaned.data_cotacao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      cityState: `${cleaned.client.cidade} - ${cleaned.client.estado || 'PR'}`,
      totalVolume: totalVol.toFixed(0),
      totalWeight: totalWeight.toFixed(2),
    });
  }

  private async _generatePdfFromHtml(html: string): Promise<Buffer> {
    let browser;
    try {
      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: true
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
      });

      await browser.close();
      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      if (browser) await browser.close();
      console.error('Erro no Puppeteer:', error.message);
      throw new InternalServerErrorException(`Falha ao gerar PDF: ${error.message}`);
    }
  }

  private _registerHandlebarsHelpers(): void {
    handlebars.registerHelper('formatInteger', (v) => {
      if (v === undefined || v === null) return '0';
      return Math.round(Number(v)).toString();
    });

    handlebars.registerHelper('formatCurrency', (v) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0));

    handlebars.registerHelper('formatUnitValue', (v) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 5, maximumFractionDigits: 5 }).format(v || 0));

    handlebars.registerHelper('calculateVolume', (u, q) => (u > 0 ? (q / u).toFixed(0) : '0'));
    handlebars.registerHelper('calculateWeight', (p, q, u) => (u > 0 ? ((q / u) * p).toFixed(2) : '0.00'));

    handlebars.registerHelper('formatDocument', (doc) => {
      if (!doc) return '';
      const d = doc.toString().replace(/\D/g, '');
      if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
      if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
      return doc;
    });

    handlebars.registerHelper('valueOrDefault', (v, d) => {
      const isOpt = d && typeof d === 'object' && d.hash;
      return (v && typeof v !== 'object') ? v : (isOpt ? '' : (d || ''));
    });

    handlebars.registerHelper('formatDeliveryDays', (d) => (d ? `${d} dias úteis` : 'A combinar'));
    handlebars.registerHelper('displayQuotationNumber', (q) => q.numero_pedido_manual || q.id);
    handlebars.registerHelper('formatCEP', (c) => {
      if (!c) return '';
      const v = c.toString().replace(/\D/g, '');
      return v.length === 8 ? `${v.slice(0, 2)}.${v.slice(2, 5)}-${v.slice(5)}` : c;
    });
  }
}
