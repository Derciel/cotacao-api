import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['https://cotacao.nicopel.com.br', 'http://localhost:4321', 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.setGlobalPrefix('api');
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

  // --- Lógica de Graceful Shutdown ---
  const server = app.getHttpServer();
  let activeConnections = 0;
  let isShuttingDown = false;
  const gracePeriod = 60000; // 60 segundos
  let shutdownResolve: (() => void) | null = null;

  const checkShutdown = () => {
    if (isShuttingDown && activeConnections === 0) {
      logger.log('Todas as requisições ativas foram concluídas com sucesso. Encerrando de forma limpa.');
      if (shutdownResolve) shutdownResolve();
    }
  };

  // Middleware para rastrear requisições ativas
  app.use((req: any, res: any, next: any) => {
    if (isShuttingDown) {
      res.setHeader('Connection', 'close');
      res.status(503).send('O servidor está sendo atualizado. Por favor, tente novamente em instantes.');
      return;
    }

    let decremented = false;
    activeConnections++;

    const decrement = () => {
      if (!decremented) {
        decremented = true;
        activeConnections--;
        checkShutdown();
      }
    };

    res.on('finish', decrement);
    res.on('close', decrement);

    next();
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  // Notificação visual destacada nos logs do servidor de que a atualização foi aplicada com sucesso
  logger.log('================================================================');
  logger.log('    [OK] ATUALIZAÇÃO EXECUTADA E APLICAÇÃO ONLINE COM SUCESSO   ');
  logger.log(`    Servidor escutando em: http://0.0.0.0:${port}/api-docs`);
  logger.log('================================================================');

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.warn(`Sinal ${signal} recebido. Iniciando encerramento gracioso (Graceful Shutdown)...`);
    logger.log(`Aguardando a conclusão de ${activeConnections} requisições ativas antes de desligar...`);

    // Parar de aceitar novas conexões
    server.close((err: any) => {
      if (err) {
        logger.error('Erro ao encerrar servidor HTTP:', err);
      } else {
        logger.log('Servidor HTTP parou de aceitar novas conexões.');
      }
    });

    if (activeConnections > 0) {
      await new Promise<void>((resolve) => {
        shutdownResolve = resolve;
        setTimeout(() => {
          logger.warn(`Timeout de segurança de ${gracePeriod}ms atingido. Forçando encerramento imediato...`);
          resolve();
        }, gracePeriod);
      });
    } else {
      logger.log('Nenhuma requisição ativa no momento. Desligando imediatamente.');
    }

    await app.close();
    logger.log('Conexões de banco de dados e NestJS encerrados de forma limpa.');
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}
bootstrap();