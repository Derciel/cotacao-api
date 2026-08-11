import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { PositionService } from './services/position.service.js';
import { DeviationService } from './services/deviation.service.js';
import { DeviationController } from './controllers/deviation.controller.js';
import { SystemsatxAuth } from '../auth/entities/systemsatx-auth.entity.js';
import { ApiKey } from './entities/api-key.entity.js';
import { Truck } from './entities/truck.entity.js';
import { Route } from './entities/route.entity.js';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([
      SystemsatxAuth,
      ApiKey,
      Truck,
      Route,
    ]),
  ],
  controllers: [DeviationController],
  providers: [
    ConfigService,
    PositionService,
    DeviationService,
  ],
  exports: [
    DeviationService,
    PositionService,
  ],
})
export class SystemsatxModule {}