import { Controller, Get, Query } from '@nestjs/common';
import { FuelsService, FuelPrices } from './fuels.service.js';

@Controller('fuels')
export class FuelsController {
  constructor(private readonly fuelsService: FuelsService) {}

  @Get('average')
  getAveragePrices(@Query('uf') uf?: string): Record<string, FuelPrices> | FuelPrices {
    if (uf) {
      return this.fuelsService.getPriceByUf(uf);
    }
    return this.fuelsService.getAveragePrices();
  }
}
