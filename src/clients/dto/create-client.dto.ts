import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'; // IMPORTE

export class CreateClientDto {
  @ApiProperty({
    description: 'A razão social completa da empresa cliente.',
    example: 'EMPRESA DE TESTE LTDA',
  })
  @IsString()
  @IsNotEmpty({ message: 'A Razão Social não pode ser vazia.' })
  razao_social: string;

  // Adicione @ApiProperty para os outros campos também...
  @ApiProperty({
    description: 'CNPJ do cliente no formato XX.XXX.XXX/XXXX-XX.',
    example: '11.222.333/0001-44',
  })
  @IsString()
  @Length(18, 18, { message: 'O CNPJ deve ter 18 caracteres.' })
  cnpj: string;
  

}