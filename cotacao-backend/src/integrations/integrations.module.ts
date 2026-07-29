import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExcelController } from './excel.controller.js';
import { Quotation } from '../quotations/entities/quotation.entity.js';

@Module({
    imports: [TypeOrmModule.forFeature([Quotation])],
    controllers: [ExcelController],
})
export class IntegrationsModule {}
