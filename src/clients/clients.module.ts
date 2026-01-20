import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';
import { Client } from './entities/client.entity.js';

@Module({
  // Registra a entidade para injeção do Repository
  imports: [HttpModule, TypeOrmModule.forFeature([Client])],

  // Registra o controller (agora devidamente exportado)
  controllers: [ClientsController],

  // Registra a lógica de negócio
  providers: [ClientsService],

  // Exporta para uso em outros módulos de cotação
  exports: [ClientsService],
})
export class ClientsModule { }