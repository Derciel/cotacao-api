import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import { QuotationsService } from '../quotations/quotations.service.js';
import { Quotation, EmpresaFaturamento } from '../quotations/entities/quotation.entity.js';

@Injectable()
export class PdfService {
  private readonly templatePath: string;

  constructor(private readonly quotationsService: QuotationsService) {
    this.templatePath = path.resolve(process.cwd(), 'src/documents/templates/quotation.html');
    this._registerHandlebarsHelpers();
  }

  async generateQuotationPdf(quotationId: number): Promise<Buffer> {
    const quotation = await this.quotationsService.findOne(quotationId);
    if (!quotation) throw new NotFoundException(`Cotação #${quotationId} não encontrada.`);

    const finalHtml = await this._compileHtmlTemplate(quotation);
    return this._generatePdfFromHtml(finalHtml);
  }

  private async _compileHtmlTemplate(quotation: Quotation): Promise<string> {
    const templateHtml = await fs.readFile(this.templatePath, 'utf8');
    const template = handlebars.compile(templateHtml);
    const cleaned = JSON.parse(JSON.stringify(quotation));

    const themes = {
      [EmpresaFaturamento.NICOPEL]: '#F2F2F2',
      [EmpresaFaturamento.FLEXOBOX]: '#BDD7EE',
      [EmpresaFaturamento.L_LOG]: '#F2F2F2',
    };

    const logos = {
      [EmpresaFaturamento.NICOPEL]: 'https://i.ibb.co/NdjsTWgb/NP-Cargo.jpg',
      [EmpresaFaturamento.L_LOG]: 'https://i.ibb.co/HLh2RFHP/logo-l-log.png',
      [EmpresaFaturamento.FLEXOBOX]: 'https://i.ibb.co/WtrW9Qf/FLEXOBOX.png',
    };

    let totalVol = 0, totalWeight = 0;
    cleaned.items?.forEach((item: any) => {
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
    handlebars.registerHelper('formatCurrency', (v) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0));

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