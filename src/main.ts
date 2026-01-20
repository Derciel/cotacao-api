import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Libera o acesso para o seu frontend local
  app.enableCors({
    origin: '*', // Em produção, substitua pelo domínio do seu front se desejar
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // O Render define a porta automaticamente pela variável de ambiente PORT
  await app.listen(process.env.PORT || 3000);
}
bootstrap();