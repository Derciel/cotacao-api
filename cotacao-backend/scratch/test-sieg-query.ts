import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { AuditService } from '../src/audit/audit.service.js';

async function bootstrap() {
  console.log('Fazendo bootstrap do contexto de aplicação NestJS...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const auditService = app.get(AuditService);
  
  console.log('Iniciando teste de sieg-query no script scratch...');
  try {
    // Busca CT-es do último mês
    const res = await auditService.querySiegCtes([], '2026-05-01', '2026-06-01');
    console.log('Resultado obtido com sucesso! Total de registros:', res.length);
    if (res.length > 0) {
      console.log('Amostra do primeiro registro:', JSON.stringify(res[0], null, 2));
    }
  } catch (error) {
    console.error('=== ERRO DETECTADO NO SIEG-QUERY ===');
    console.error(error);
  } finally {
    await app.close();
  }
}

bootstrap();
