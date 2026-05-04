import { IsInt, IsPositive, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQuotationItemDto {
  @ApiProperty({ description: 'ID do produto a ser cotado', example: 1 })
  @IsInt()
  @IsPositive()
  productId: number;

  @ApiProperty({ description: 'Quantidade do produto', example: 100 })
  @IsInt()
  @IsPositive()
  quantidade: number;

  @ApiProperty({ 
    description: 'Valor unitário customizado. Se não for enviado, o sistema usará o valor do cadastro do produto.', 
    example: 1.25, 
    required: false 
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  valorUnitario?: number;

}