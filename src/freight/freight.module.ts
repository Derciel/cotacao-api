import { Module } from '@nestjs/common';
import { FrenetService } from './frenet.service.js';
import { FreightController } from './freight.controller.js';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quotation } from 'src/quotations/entities/quotation.entity.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule, // Para acessar o .env
    HttpModule,     // Para fazer chamadas HTTP
    TypeOrmModule.forFeature([Quotation]), // Para acessar o repositório de Cotações
  ],
  controllers: [FreightController],
  providers: [FrenetService],
  exports: [FrenetService], // 1. EXPORTE o FrenetService para que outros módulos possam usá-lo
})
export class FreightModule { }