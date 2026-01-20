// src/products/dto/create-product.dto.ts
import { IsNotEmpty, IsString, IsNumber, IsPositive, IsOptional, IsInt } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsNumber()
  @IsPositive()
  peso_caixa_kg: number;

  @IsInt()
  @IsPositive()
  unidades_caixa: number;

  @IsString()
  @IsOptional()
  medida_cm?: string;

  @IsNumber()
  @IsPositive()
  valor_unitario: number;

  // O campo peso_unitario_kg pode ser removido ou tornado opcional
  @IsNumber()
  @IsPositive()
  @IsOptional()
  peso_unitario_kg?: number;
}