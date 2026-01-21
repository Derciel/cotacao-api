import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FrenetService } from './frenet.service.js';
import { FreightController } from './freight.controller.js';
// CORREÇÃO: Troque 'src/quotations/...' por '../quotations/...'
import { Quotation } from '../quotations/entities/quotation.entity.js';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Quotation]),
  ],
  providers: [FrenetService],
  controllers: [FreightController],
  exports: [FrenetService],
})
export class FreightModule { }