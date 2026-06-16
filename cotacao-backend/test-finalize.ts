import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { QuotationsService } from './src/quotations/quotations.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const quotationsService = app.get(QuotationsService);

  try {
    const result = await quotationsService.finalize(2534, {
      transportadoraEscolhida: "TEST",
      valorFrete: 10,
      diasParaEntrega: 2,
    });
    console.log("SUCESSO:", result);
  } catch (error) {
    console.error("ERRO ESPERADO:", error);
  } finally {
    await app.close();
  }
}

bootstrap();
