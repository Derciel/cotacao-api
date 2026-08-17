import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SSXApiService, FleetVehiclePosition } from '../services/ssx-api.service.js';
import { RouteScheduleService, RouteDaySchedule } from '../services/route-schedule.service.js';

@ApiTags('systemsatx-fleet')
@Controller('systemsatx')
export class FleetController {
  constructor(
    private readonly ssxApiService: SSXApiService,
    private readonly scheduleService: RouteScheduleService,
  ) {}

  @Get('fleet')
  @ApiOperation({ summary: 'Obter posições e status da frota em tempo real (Systemsat SSX)' })
  @ApiResponse({ status: 200, description: 'Lista de veículos com localização em tempo real' })
  async getFleetPositions(): Promise<FleetVehiclePosition[]> {
    return await this.ssxApiService.getFleetLivePositions();
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Obter cronograma semanal de rotas e cidades atendidas por dia' })
  @ApiResponse({ status: 200, description: 'Cronograma semanal de rotas' })
  getSchedule(): RouteDaySchedule[] {
    return this.scheduleService.getSchedule();
  }

  @Get('schedule/check')
  @ApiOperation({ summary: 'Verificar se uma cidade pertence à rota de um dia específico' })
  @ApiQuery({ name: 'city', type: String, required: true })
  @ApiQuery({ name: 'day', type: String, required: true })
  checkCityRoute(@Query('city') city: string, @Query('day') day: string) {
    const isIncluded = this.scheduleService.isCityInDayRoute(city, day);
    return { city, day, isIncluded };
  }
}
