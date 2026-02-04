import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AiService } from './ai.service.js';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Get('insights')
    @ApiOperation({ summary: 'Gera insights logísticos usando IA' })
    @ApiResponse({ status: 200, description: 'Insights gerados com sucesso' })
    getInsights() {
        return this.aiService.getInsights();
    }
}
