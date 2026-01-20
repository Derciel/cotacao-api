import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]) // O serviço precisa do repositório de Produto
  ],
  providers: [SeedService],
})
export class SeedModule { }