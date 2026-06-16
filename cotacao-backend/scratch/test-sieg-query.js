import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { AuditService } from '../dist/audit/audit.service.js';

async function bootstrap() {
  console.log('Fazendo bootstrap do contexto NestJS a partir de dist/...');
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const auditService = app.get(AuditService);
    
    console.log('Iniciando teste de sieg-query no script scratch...');
    const res = await auditService.querySiegCtes([], '2026-05-01', '2026-06-01');
    console.log('Resultado obtido com sucesso! Total de registros:', res.length);
    if (res.length > 0) {
      console.log('Amostra do primeiro registro:', JSON.stringify(res[0], null, 2));
    }
    await app.close();
  } catch (error) {
    console.error('=== ERRO DETECTADO NO SIEG-QUERY ===');
    console.error(error);
  }
}

bootstrap();
