import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'Razão Social Ltda' })
  @IsString()
  @IsNotEmpty()
  razao_social: string;

  @ApiProperty({ example: 'Nome Fantasia', required: false })
  @IsString()
  @IsOptional()
  fantasia?: string;

  @ApiProperty({ example: '00000000000191' })
  @IsString()
  @IsNotEmpty()
  cnpj: string;

  @ApiProperty({ example: '86000000' })
  @IsString()
  @IsNotEmpty()
  cep: string;

  @ApiProperty({ example: 'Londrina' })
  @IsString()
  @IsNotEmpty()
  cidade: string;

  @ApiProperty({ example: 'PR' })
  @IsString()
  @IsNotEmpty()
  estado: string;

  // ESTA É A LINHA QUE ESTÁ FALTANDO:
  @ApiProperty({ example: 'NICOPEL', enum: ['NICOPEL', 'FLEXOBOX'] })
  @IsString()
  @IsNotEmpty()
  empresa_faturamento: string;
}