import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { CreateQuotationItemDto } from './create-quotation-item.dto.js';
import { EmpresaFaturamento } from '../entities/quotation.entity.js';

export class CreateQuotationDto {
  @ApiProperty({ description: 'ID do cliente para a cotação', example: 1, required: false })
  @IsInt()
  @IsPositive()
  @IsOptional()
  clientId?: number;

  @ApiProperty({ description: 'CEP de origem para cotação rápida', example: '86087350', required: false })
  @IsString()
  @IsOptional()
  originCep?: string;

  @ApiProperty({ description: 'CEP de destino para cotação rápida', example: '01310100', required: false })
  @IsString()
  @IsOptional()
  destCep?: string;

  @ApiProperty({ description: 'Prazo de pagamento negociado', example: '28 dias DDL', required: false })
  @IsString()
  @IsOptional()
  prazoPagamento?: string;

  @ApiProperty({ description: 'Tipo do frete (CIF, FOB, etc)', example: 'FOB', required: false })
  @IsString()
  @IsOptional()
  tipoFrete?: string;

  @ApiProperty({ description: 'Observações gerais sobre a cotação', required: false })
  @IsString()
  @IsOptional()
  obs?: string;

  // --- CAMPO ADICIONADO AQUI ---
  @ApiProperty({ description: 'Número de pedido/cotação manual (opcional)', required: false, example: 'COT-2025-001' })
  @IsString()
  @IsOptional()
  numeroPedidoManual?: string;

  @ApiProperty({ enum: EmpresaFaturamento, description: 'Define a empresa faturadora.' })
  @IsEnum(EmpresaFaturamento) // Este decorator garante que apenas 'NICOPEL', 'L_LOG', ou 'FLEXOBOX' sejam aceitos
  empresaFaturamento: EmpresaFaturamento;

  @ApiProperty({ description: 'Percentual de IPI a ser aplicado (ex: 6.75)', required: false })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  percentualIpi?: number;

  @ApiProperty({ type: [CreateQuotationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items: CreateQuotationItemDto[];

  @ApiProperty({ description: 'Indica se é uma cotação de teste/consulta rápida', required: false, default: false })
  @IsOptional()
  isTest?: boolean;
}