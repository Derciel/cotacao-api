// src/products/products.controller.ts

import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Controller('products') // Define a rota base como /products
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Post() // Rota: POST /products
  create(@Body() createProductDto: CreateProductDto) {
    // Validação de dados feita automaticamente pelo DTO
    return this.productsService.create(createProductDto);
  }

  @Get() // Rota: GET /products
  findAll(@Query('search') search?: string) {
    return this.productsService.findAll(search);
  }

  @Get(':id') // Rota: GET /products/123
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Patch(':id') // Rota: PATCH /products/123
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @Delete(':id') // Rota: DELETE /products/123
  remove(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }
}