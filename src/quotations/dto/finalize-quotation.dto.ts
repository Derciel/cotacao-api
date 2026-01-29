import { IsNotEmpty, IsNumber, IsPositive, IsString, IsInt, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FinalizeQuotationDto {
  @ApiProperty({ description: 'Nome da transportadora escolhida', example: 'SEDEX' })
  @IsString()
  @IsNotEmpty()
  transportadoraEscolhida: string;

  @ApiProperty({ description: 'Valor do frete cobrado pela transportadora', example: 45.50 })
  @IsNumber()
  @IsPositive()
  valorFrete: number;

  @ApiProperty({ description: 'Prazo de entrega em dias fornecido pela transportadora', example: 5 })
  @IsInt()
  @IsPositive()
  @IsOptional()
  diasParaEntrega?: number;

  @ApiProperty({ description: 'Número da Nota Fiscal', example: '123456' })
  @IsString()
  @IsOptional()
  nf?: string;

  @ApiProperty({ description: 'Data da coleta prevista', example: '2025-01-30' })
  @IsString()
  @IsOptional()
  dataColeta?: string;

  @ApiProperty({ description: 'Tipo de frete (CIF/FOB)', example: 'CIF' })
  @IsString()
  @IsOptional()
  tipoFrete?: string;

  @ApiProperty({ description: 'Número do pedido manual', example: 'PED-123' })
  @IsString()
  @IsOptional()
  numeroPedidoManual?: string;
}