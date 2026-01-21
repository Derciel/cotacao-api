import { Injectable, InternalServerErrorException } from '@nestjs/common';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

@Injectable()
export class PdfService {
  async generateQuotationPdf(htmlContent: string): Promise<Buffer> {
    let browser;
    try {
      browser = await puppeteer.launch({
        // Flags obrigatórias para rodar no ambiente Linux do Render
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote'
        ],
        // Tenta usar o caminho do cache se definido, ou deixa o puppeteer encontrar
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: true
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

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
}