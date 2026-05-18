import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FrenetService } from './frenet.service.js';
import { VipFreightService } from './vip-freight.service.js';
import { RodonavesService } from './rodonaves.service.js';
import { SswService } from './ssw.service.js';
import { FreightController } from './freight.controller.js';
// CORREÇÃO: Troque 'src/quotations/...' por '../quotations/...'
import { Quotation } from '../quotations/entities/quotation.entity.js';
import { Client } from '../clients/entities/client.entity.js';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Quotation, Client]),
  ],
  providers: [FrenetService, VipFreightService, RodonavesService, SswService],
  controllers: [FreightController],
  exports: [FrenetService, VipFreightService, RodonavesService, SswService],
})
export class FreightModule { }