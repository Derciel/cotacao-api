import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule } from './clients/clients.module';
import { ProductsModule } from './products/products.module';
import { QuotationsModule } from './quotations/quotations.module';
import { FreightModule } from './freight/freight.module';
import ormConfig from './orm.config'; // Nossa configuração centralizada
import { SeedModule } from './seed/seed.module'; 
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    // Configura a leitura do arquivo .env de forma global
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Configura o TypeORM usando nosso arquivo centralizado. É só isso!
    TypeOrmModule.forRoot(ormConfig),
    
    // Nossos módulos de funcionalidades
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
export class AppModule {}