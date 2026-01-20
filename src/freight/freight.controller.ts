import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Freight')
@Controller('freight')
export class FreightController {
  // Nossos endpoints relacionados a frete viverão aqui.
}