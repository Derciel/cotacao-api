import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js'; // Adicionado .js
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const config = new DocumentBuilder()
    .setTitle('Cotação API Nicopel')
    .setDescription('Documentação das rotas de Cotações e Clientes')
    .setVersion('1.0 Final')
    .addTag('Clients')
    .addTag('Quotations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT || 3000;
  // Escutando em 0.0.0.0 para o Render
  await app.listen(port, '0.0.0.0');

  logger.log(`Aplicação rodando em: http://0.0.0.0:${port}/api-docs`);
}
bootstrap();