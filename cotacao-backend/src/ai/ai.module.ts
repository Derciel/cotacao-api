import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { Quotation } from '../quotations/entities/quotation.entity.js';

@Module({
    imports: [TypeOrmModule.forFeature([Quotation])],
    controllers: [AiController],
    providers: [AiService],
    exports: [AiService],
})
export class AiModule { }
