import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { DeviationService } from '../services/deviation.service.js';
import { RouteCreationDto, RouteUpdateDto } from '../interfaces/route.interface.js';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

const routeCreationSchema = {
  type: 'object',
  required: ['name', 'coordinates', 'truckId'],
  properties: {
    name: { type: 'string', example: 'Rota Centro - Bairro' },
    truckId: { type: 'number', example: 1 },
    coordinates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          latitude: { type: 'number', example: -23.5505 },
          longitude: { type: 'number', example: -46.6333 },
        },
      },
    },
    expectedPath: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          latitude: { type: 'number', example: -23.5505 },
          longitude: { type: 'number', example: -46.6333 },
        },
      },
    },
    deviationThreshold: { type: 'number', example: 100, description: 'Em metros' },
  },
};

const routeUpdateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', example: 'Rota Centro - Bairro' },
    truckId: { type: 'number', example: 1 },
    coordinates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          latitude: { type: 'number', example: -23.5505 },
          longitude: { type: 'number', example: -46.6333 },
        },
      },
    },
    expectedPath: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          latitude: { type: 'number', example: -23.5505 },
          longitude: { type: 'number', example: -46.6333 },
        },
      },
    },
    deviationThreshold: { type: 'number', example: 100, description: 'Em metros' },
  },
};

@ApiTags('systemsatx-deviation')
@Controller('systemsatx/deviation')
export class DeviationController {
  constructor(private readonly deviationService: DeviationService) {}

  @Post('check')
  @ApiOperation({ summary: 'Check if a truck has deviated from its route' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        truckId: { type: 'number', example: 1 },
        latitude: { type: 'number', example: -23.5505 },
        longitude: { type: 'number', example: -46.6333 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Deviation check result' })
  @ApiResponse({ status: 404, description: 'Truck or route not found' })
  async checkDeviation(
    @Body('truckId') truckId: number,
    @Body('latitude') latitude: number,
    @Body('longitude') longitude: number,
  ) {
    return await this.deviationService.checkDeviation(truckId, latitude, longitude);
  }

  @Post('routes')
  @ApiOperation({ summary: 'Create a new route for a truck' })
  @ApiBody({ schema: routeCreationSchema })
  @ApiResponse({ status: 201, description: 'Route created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Truck not found' })
  async createRoute(@Body() routeData: RouteCreationDto) {
    return await this.deviationService.createRoute(routeData.truckId, routeData);
  }

  @Get('routes/:truckId')
  @ApiOperation({ summary: 'Get all routes for a truck' })
  @ApiParam({ name: 'truckId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Routes retrieved successfully' })
  async getRoutesByTruckId(@Param('truckId') truckId: number) {
    return await this.deviationService.getRoutesByTruckId(truckId);
  }

  @Get('routes/:routeId')
  @ApiOperation({ summary: 'Get route by ID' })
  @ApiParam({ name: 'routeId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Route retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Route not found' })
  async getRouteById(@Param('routeId') routeId: number) {
    return await this.deviationService.getRouteById(routeId);
  }

  @Put('routes/:routeId')
  @ApiOperation({ summary: 'Update an existing route' })
  @ApiParam({ name: 'routeId', type: 'number' })
  @ApiBody({ schema: routeUpdateSchema })
  @ApiResponse({ status: 200, description: 'Route updated successfully' })
  @ApiResponse({ status: 404, description: 'Route not found' })
  async updateRoute(
    @Param('routeId') routeId: number,
    @Body() routeData: RouteUpdateDto,
  ) {
    return await this.deviationService.updateRoute(routeId, routeData);
  }
}