import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';
import { QuotationsService } from 'src/quotations/quotations.service';
import { Quotation, EmpresaFaturamento } from 'src/quotations/entities/quotation.entity';

@Injectable()
export class PdfService {
  private readonly templatePath: string;

  constructor(private readonly quotationsService: QuotationsService) {
    this.templatePath = path.resolve(process.cwd(), 'src/documents/templates/quotation.html');
    this._registerHandlebarsHelpers();
  }

  async generateQuotationPdf(quotationId: number): Promise<Uint8Array> {
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
      [EmpresaFaturamento.NICOPEL]: '#F2F2F2',  // Cinza
      [EmpresaFaturamento.FLEXOBOX]: '#BDD7EE', // Azul
      [EmpresaFaturamento.L_LOG]: '#F2F2F2',
    };

    const logos = {
      [EmpresaFaturamento.NICOPEL]: 'https://i.ibb.co/zWJstk81/logo-nicopel-8.png',
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
      // Data corrigida para Brasília
      formattedDate: new Date(cleaned.data_cotacao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      cityState: `${cleaned.client.cidade} - ${cleaned.client.estado || 'PR'}`,
      totalVolume: totalVol.toFixed(0),
      totalWeight: totalWeight.toFixed(2),
    });
  }

  private async _generatePdfFromHtml(html: string): Promise<Uint8Array> {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1.5cm', right: '1.5cm', bottom: '1.5cm', left: '1.5cm' },
    });
    await browser.close();
    return pdf;
  }

  private _registerHandlebarsHelpers(): void {
    handlebars.registerHelper('formatCurrency', (v) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0));

    handlebars.registerHelper('calculateVolume', (u, q) => (u > 0 ? (q / u).toFixed(0) : '0'));
    handlebars.registerHelper('calculateWeight', (p, q, u) => (u > 0 ? ((q / u) * p).toFixed(2) : '0.00'));

    // Suporte dinâmico a CPF (11) e CNPJ (14)
    handlebars.registerHelper('formatDocument', (doc) => {
      if (!doc) return '';
      const d = doc.toString().replace(/\D/g, '');
      if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
      if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
      return doc;
    });

    // Resolve o erro [object Object]
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