import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RodonavesService } from './rodonaves.service.js';

@ApiTags('Freight')
@Controller('freight')
export class FreightController {
  constructor(
    private readonly rodonavesService: RodonavesService,
  ) { }

  @Get('tracking/:nf/:cnpj')
  @ApiOperation({ summary: 'Rastreio em tempo real na Rodonaves' })
  async getTracking(@Param('nf') nf: string, @Param('cnpj') cnpj: string) {
    return this.rodonavesService.getTracking(nf, cnpj);
  }
}