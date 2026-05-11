import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BatchItemDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  quantidade: number;

  @IsOptional()
  @IsNumber()
  valorUnitario?: number;
}

class BatchRequestItemDto {
  @IsString()
  @IsNotEmpty()
  cnpj: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchItemDto)
  items: BatchItemDto[];

  @IsOptional()
  @IsString()
  originCep?: string;

  @IsOptional()
  @IsString()
  empresaFaturamento?: string;
}

export class BatchQuotationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchRequestItemDto)
  requests: BatchRequestItemDto[];
}
