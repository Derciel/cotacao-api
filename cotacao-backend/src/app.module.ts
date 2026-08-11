import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ClientsModule } from './clients/clients.module.js';
import { ProductsModule } from './products/products.module.js';
import { QuotationsModule } from './quotations/quotations.module.js';
import { FreightModule } from './freight/freight.module.js';
import { SeedModule } from './seed/seed.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuditModule } from './audit/audit.module.js';
import { FuelsModule } from './fuels/fuels.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { GraphQLIntegrationModule } from './graphql/graphql-integration.module.js';
import { SystemsatxModule } from './systemsatx/systemsatx.module.js';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL') || '';
        const useSsl = !dbUrl.includes('sslmode=disable') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost');

        if (!dbUrl) {
          throw new Error('DATABASE_URL não encontrada no painel do Render');
        }

        return {
          type: 'postgres',
          url: dbUrl,
          autoLoadEntities: true,
          logging: true, // Adicionado para depurar o erro 'Missing column'
          // synchronize: false protege os dados dos seus 6.000+ clientes
          synchronize: false,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          extra: {
            ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
            keepAlive: true,                  // Mantém o socket ativo e detecta quedas rapidamente
            connectionTimeoutMillis: 5000,    // Aguarda no máximo 5s por uma nova conexão do pool
            idleTimeoutMillis: 15000,         // Fecha conexões inativas após 15 segundos para evitar sockets órfãos
            max: 20,                          // Pool máximo de conexões
          },
          // Resiliência: aguarda reconexão VPN/SOCKS5 no startup de forma rápida sem travar o health check do Render
          retryAttempts: 3,          // tenta reconectar até 3x no startup
          retryDelay: 3000,          // espera 3s entre tentativas
          connectTimeoutMS: 5000,    // timeout de 5s por tentativa
        };
      },
    }),

    ClientsModule,
    ProductsModule,
    QuotationsModule,
    FreightModule,
    SeedModule,
    DocumentsModule,
    AuthModule,
    UsersModule,
    AiModule,
    AuditModule,
    FuelsModule,
    IntegrationsModule,
    GraphQLIntegrationModule,
    SystemsatxModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'frontend', 'dist'),
      exclude: ['/api*'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }