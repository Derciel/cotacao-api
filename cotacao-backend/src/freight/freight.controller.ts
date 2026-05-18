import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RodonavesService } from './rodonaves.service.js';
import { FrenetService } from './frenet.service.js';

@ApiTags('Freight')
@Controller('freight')
export class FreightController {
  constructor(
    private readonly rodonavesService: RodonavesService,
    private readonly frenetService: FrenetService
  ) { }

  @Get('tracking/:nf/:cnpj')
  @ApiOperation({ summary: 'Rastreio em tempo real na Rodonaves' })
  async getTracking(@Param('nf') nf: string, @Param('cnpj') cnpj: string) {
    return this.rodonavesService.getTracking(nf, cnpj);
  }

  @Post('simulate')
  @ApiOperation({ summary: 'Simular prazo de entrega por CEP e Cidade' })
  async simulate(@Body() body: { cep: string, cidade?: string }) {
    if (!body.cep) return [];
    return this.frenetService.simulateDeadline(body.cep, body.cidade);
  }
}