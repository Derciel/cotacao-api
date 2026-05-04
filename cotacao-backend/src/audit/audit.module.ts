import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Audit } from './entities/audit.entity.js';
import { Quotation } from '../quotations/entities/quotation.entity.js';
import { AuditService } from './audit.service.js';
import { SiegService } from './sieg.service.js';
import { AuditController } from './audit.controller.js';
import { QuotationsModule } from '../quotations/quotations.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Audit, Quotation]),
    HttpModule,
    QuotationsModule,
  ],
  controllers: [AuditController],
  providers: [AuditService, SiegService],
  exports: [AuditService],
})
export class AuditModule {}
