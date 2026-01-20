import { Module, forwardRef } from '@nestjs/common'; // 1. IMPORTE 'forwardRef'
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsModule } from 'src/documents/documents.module.js';
import { FreightModule } from 'src/freight/freight.module.js';
import { Client } from 'src/clients/entities/client.entity.js';
import { Product } from 'src/products/entities/product.entity.js';
import { QuotationItem } from './entities/quotation-item.entity.js';
import { Quotation } from './entities/quotation.entity.js';
import { QuotationsController } from './quotations.controller.js';
import { QuotationsService } from './quotations.service.js';

@Module({
  imports: [
    forwardRef(() => DocumentsModule), // 2. USE forwardRef() AQUI
    FreightModule,
    TypeOrmModule.forFeature([Quotation, QuotationItem, Client, Product])
  ],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService], // Exporte o serviço para que outros módulos o vejam
})
export class QuotationsModule { }