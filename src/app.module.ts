import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule } from './clients/clients.module';
import { ProductsModule } from './products/products.module';
import { QuotationsModule } from './quotations/quotations.module';
import { FreightModule } from './freight/freight.module';
import { SeedModule } from './seed/seed.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    // 1. Carrega as variáveis do .env globalmente
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 2. Configuração Assíncrona: Garante que o ConfigService esteja pronto
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Busca a External Database URL do seu .env
        const dbUrl = configService.get<string>('DATABASE_URL');

        if (!dbUrl) {
          throw new Error('DATABASE_URL não encontrada no arquivo .env');
        }

        return {
          type: 'postgres',
          url: dbUrl,
          autoLoadEntities: true, // Carrega entidades automaticamente
          synchronize: false, // Use apenas em desenvolvimento local

          // CONFIGURAÇÃO OBRIGATÓRIA PARA RENDER
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

    // Seus módulos de funcionalidades
    ClientsModule,
    ProductsModule,
    QuotationsModule,
    FreightModule,
    SeedModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }