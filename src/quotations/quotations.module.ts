import { Module, forwardRef } from '@nestjs/common'; // 1. IMPORTE 'forwardRef'
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsModule } from 'src/documents/documents.module';
import { FreightModule } from 'src/freight/freight.module';
import { Client } from 'src/clients/entities/client.entity';
import { Product } from 'src/products/entities/product.entity';
import { QuotationItem } from './entities/quotation-item.entity';
import { Quotation } from './entities/quotation.entity';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';

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
export class QuotationsModule {}