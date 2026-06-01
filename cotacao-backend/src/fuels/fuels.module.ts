import { Module } from '@nestjs/common';
import { FuelsController } from './fuels.controller.js';
import { FuelsService } from './fuels.service.js';

@Module({
  controllers: [FuelsController],
  providers: [FuelsService],
  exports: [FuelsService],
})
export class FuelsModule {}
