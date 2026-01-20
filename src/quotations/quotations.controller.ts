import { Controller, Get, Post, Body, Param, Patch, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { QuotationsService } from './quotations.service.js';
import { FrenetService } from 'src/freight/frenet.service.js';
import { PdfService } from 'src/documents/pdf.service.js';

import { CreateQuotationDto } from './dto/create-quotation.dto.js';
import { FinalizeQuotationDto } from './dto/finalize-quotation.dto.js';

/**
 * @ApiTags('Quotations')
 * @Controller('quotations')
 * Controller responsável por gerenciar todas as operações de cotações.
 */
@ApiTags('Quotations')
@Controller('quotations')
export class QuotationsController {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly frenetService: FrenetService,
    private readonly pdfService: PdfService,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova cotação com seus itens' })
  @ApiResponse({ status: 201, description: 'Cotação criada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  create(@Body() createQuotationDto: CreateQuotationDto) {
    return this.quotationsService.create(createQuotationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todas as cotações' })
  @ApiResponse({ status: 200, description: 'Lista de cotações retornada com sucesso.' })
  findAll() {
    return this.quotationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma cotação pelo ID' })
  @ApiResponse({ status: 200, description: 'Dados da cotação retornados com sucesso.' })
  @ApiResponse({ status: 404, description: 'Cotação não encontrada.' })
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(+id);
  }

  @Post(':id/calculate-freight')
  @ApiOperation({ summary: 'Calcula o frete para uma cotação existente' })
  @ApiResponse({ status: 201, description: 'Cálculo de frete retornado com sucesso.' }) // POST geralmente retorna 201 ou 200
  @ApiResponse({ status: 404, description: 'Cotação não encontrada.' })
  calculateFreight(@Param('id') id: string) {
    return this.frenetService.calculateForQuotation(+id);
  }

  @Patch(':id/finalize')
  @ApiOperation({ summary: 'Finaliza uma cotação adicionando frete e calculando IPI' })
  @ApiResponse({ status: 200, description: 'Cotação finalizada com sucesso.' })
  @ApiResponse({ status: 404, description: 'Cotação não encontrada.' })
  finalize(@Param('id') id: string, @Body() finalizeDto: FinalizeQuotationDto) {
    return this.quotationsService.finalize(+id, finalizeDto);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Gera e baixa o PDF de uma cotação' })
  @ApiResponse({ status: 200, description: 'PDF da cotação gerado com sucesso.', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 404, description: 'Cotação não encontrada.' })
  async getQuotationPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.pdfService.generateQuotationPdf(+id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename=orcamento-${id}.pdf`,
    });

    res.end(pdfBuffer);
  }
}