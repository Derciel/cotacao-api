import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // 1. Configuração do Swagger
  const config = new DocumentBuilder()
    .setTitle('Cotação API Nicopel') // Nome do seu projeto
    .setDescription('Documentação das rotas de Cotações e Clientes')
    .setVersion('1.0 Final')
    .addTag('Clients')
    .addTag('Quotations')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // O primeiro parâmetro deve ser 'api-docs' para o link funcionar
  SwaggerModule.setup('api-docs', app, document);

  // 2. Verificação da Porta
  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Aplicação rodando em: http://localhost:${port}/api-docs`);
}
bootstrap();