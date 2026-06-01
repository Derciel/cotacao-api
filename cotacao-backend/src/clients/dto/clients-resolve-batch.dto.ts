import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ClientsResolveBatchDto {
  @ApiProperty({
    description: 'Lista de CNPJs (com ou sem formatação) para resolver e cadastrar em lote',
    example: ['10815855000124', '51.033.576/0006-09'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  cnpjs: string[];
}
