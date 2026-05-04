import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Conferência')
@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas as auditorias realizadas' })
  async findAll() {
    return this.auditService.findAll();
  }

  @Post(':quotationId')
  @ApiOperation({ summary: 'Realiza a auditoria de uma cotação via SIEG' })
  async audit(@Param('quotationId') quotationId: string) {
    return this.auditService.auditQuotation(+quotationId);
  }

  @Post(':auditId/check')
  @ApiOperation({ summary: 'Realiza o check manual de uma divergência' })
  async check(@Param('auditId') auditId: string, @Request() req) {
    return this.auditService.checkManual(+auditId, req.user.userId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Obtém resumo de ganhos/perdas por período' })
  async getSummary(
    @Query('start') start: string,
    @Query('end') end: string
  ) {
    const startDate = start ? new Date(start) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = end ? new Date(end) : new Date();
    return this.auditService.getSummaryByCarrier(startDate, endDate);
  }

  @Get('test-connection')
  @ApiOperation({ summary: 'Testa a conexão com a API da SIEG' })
  async testSieg() {
    return this.auditService.testSieg();
  }
}
