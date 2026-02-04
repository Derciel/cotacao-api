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
        const dbUrl = configService.get<string>('DATABASE_URL');

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
          ssl: {
            rejectUnauthorized: false,
          },
          extra: {
            ssl: {
              rejectUnauthorized: false,
            },
          },
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
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'frontend', 'dist'),
      exclude: ['/api*'], // Correção para evitar PathError: Missing parameter name
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }