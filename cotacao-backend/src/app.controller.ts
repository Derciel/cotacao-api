import { Controller, Get } from '@nestjs/common';
// A extensão .js é obrigatória para que o Node 22 localize o ficheiro na pasta dist
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}