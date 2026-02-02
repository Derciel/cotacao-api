const { DataSource } = require('typeorm');
require('dotenv').config();
const { Quotation } = require('./src/quotations/entities/quotation.entity.js');
const { QuotationItem } = require('./src/quotations/entities/quotation-item.entity.js');
const { Product } = require('./src/products/entities/product.entity.js');
const { Client } = require('./src/clients/entities/client.entity.js');
const { PdfService } = require('./src/documents/pdf.service.js');
const { QuotationsService } = require('./src/quotations/quotations.service.js');

// Mock partial context as this is a NestJS service usually
const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Quotation, QuotationItem, Product, Client],
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await ds.initialize();
        const quoRepo = ds.getRepository(Quotation);
        const itemRepo = ds.getRepository(QuotationItem);
        const prodRepo = ds.getRepository(Product);

        const quoService = new QuotationsService(quoRepo, itemRepo, prodRepo, ds);
        const pdfService = new PdfService(quoService);

        console.log('Testing PDF for ID 71 (FLEXOBOX)...');
        const buffer = await pdfService.generateQuotationPdf(71);
        console.log('PDF generated successfully, size:', buffer.length);

    } catch (e) {
        console.error('PDF Generation Failed:', e);
    } finally {
        await ds.destroy();
    }
}

run();
