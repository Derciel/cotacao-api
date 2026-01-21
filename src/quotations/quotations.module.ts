import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// Caminhos relativos com .js para evitar erro TS2307 no Render
import { DocumentsModule } from '../documents/documents.module.js';
import { FreightModule } from '../freight/freight.module.js';
import { Client } from '../clients/entities/client.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { QuotationItem } from './entities/quotation-item.entity.js';
import { Quotation } from './entities/quotation.entity.js';
import { QuotationsController } from './quotations.controller.js';
import { QuotationsService } from './quotations.service.js';

@Module({
  imports: [
    // Uso de forwardRef para evitar dependência circular
    forwardRef(() => DocumentsModule),
    FreightModule,
    TypeOrmModule.forFeature([Quotation, QuotationItem, Client, Product])
  ],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule { }