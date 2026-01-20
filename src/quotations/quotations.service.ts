import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Client } from 'src/clients/entities/client.entity';
import { Product } from 'src/products/entities/product.entity';

import { CreateQuotationDto } from './dto/create-quotation.dto';
import { FinalizeQuotationDto } from './dto/finalize-quotation.dto';
import { QuotationItem } from './entities/quotation-item.entity';
import { EmpresaFaturamento, Quotation } from './entities/quotation.entity';

@Injectable()
export class QuotationsService {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
  ) { }

  async create(createQuotationDto: CreateQuotationDto): Promise<Quotation> {
    const {
      clientId,
      items,
      numeroPedidoManual,
      empresaFaturamento,
      prazoPagamento,
      tipoFrete,
      obs
    } = createQuotationDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const client = await this.clientRepository.findOne({ where: { id: clientId } });
      if (!client) throw new BadRequestException(`Cliente #${clientId} não encontrado.`);

      // 1. Criamos a instância da cotação
      const newQuotation = this.quotationRepository.create({
        client,
        numero_pedido_manual: numeroPedidoManual,
        empresa_faturamento: empresaFaturamento,
        prazo_pagamento: prazoPagamento,
        tipo_frete: tipoFrete,
        obs: obs,
        data_cotacao: new Date(),
        valor_total_produtos: 0,
      });

      // 2. Salvamos primeiro para gerar o ID
      const savedQuotation = await queryRunner.manager.save(newQuotation);

      let valorTotalProdutos = 0;
      const quotationItems: QuotationItem[] = [];

      // 3. Processamos os itens
      for (const itemDto of items) {
        const product = await this.productRepository.findOne({ where: { id: itemDto.productId } });
        if (!product) throw new BadRequestException(`Produto #${itemDto.productId} não encontrado.`);

        const valorUnitario = itemDto.valorUnitario ?? product.valor_unitario;
        const totalItem = parseFloat((valorUnitario * itemDto.quantidade).toFixed(2));
        valorTotalProdutos += totalItem;

        const newItem = queryRunner.manager.create(QuotationItem, {
          product,
          quantidade: itemDto.quantidade,
          valor_unitario_na_cotacao: valorUnitario,
          valor_total_item: totalItem,
          quotation: savedQuotation
        });

        quotationItems.push(newItem);
      }

      // 4. Atualizamos o total e salvamos itens e cotação final
      savedQuotation.valor_total_produtos = parseFloat(valorTotalProdutos.toFixed(2));
      await queryRunner.manager.save(savedQuotation);
      await queryRunner.manager.save(quotationItems);

      await queryRunner.commitTransaction();
      return this.findOne(savedQuotation.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Quotation[]> {
    return this.quotationRepository.find({
      relations: ['client'],
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Quotation> {
    const quotation = await this.quotationRepository.findOne({
      where: { id },
      relations: ['client', 'items', 'items.product'],
    });
    if (!quotation) {
      throw new NotFoundException(`Cotação com ID #${id} não encontrada.`);
    }
    return quotation;
  }

  async finalize(id: number, finalizeDto: FinalizeQuotationDto): Promise<Quotation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const quotation = await queryRunner.manager.findOne(Quotation, {
        where: { id },
        relations: ['items', 'items.product'],
      });

      if (!quotation) throw new NotFoundException(`Cotação #${id} não encontrada.`);

      quotation.transportadora_escolhida = finalizeDto.transportadoraEscolhida;
      quotation.valor_frete = parseFloat(finalizeDto.valorFrete.toString());
      quotation.dias_para_entrega = finalizeDto.diasParaEntrega ?? null;

      let valorIpiTotalGeral = 0;
      let novoValorTotalProdutos = 0;

      if (quotation.empresa_faturamento === EmpresaFaturamento.NICOPEL) {
        for (const item of quotation.items) {
          const categoria = item.product.categoria ? item.product.categoria.toUpperCase() : 'POTE';
          const aliquota = (categoria === 'CAIXA') ? 3.25 : 9.75;

          const valorOriginalItem = parseFloat(item.valor_total_item.toString());
          const valorIpiItem = valorOriginalItem * (aliquota / 100);

          const novoValorTotalItem = parseFloat((valorOriginalItem + valorIpiItem).toFixed(2));
          item.valor_total_item = novoValorTotalItem;
          item.valor_unitario_na_cotacao = parseFloat((novoValorTotalItem / item.quantidade).toFixed(4));

          valorIpiTotalGeral += valorIpiItem;
          novoValorTotalProdutos += novoValorTotalItem;

          await queryRunner.manager.save(item);
        }

        quotation.valor_total_produtos = parseFloat(novoValorTotalProdutos.toFixed(2));
        quotation.valor_ipi = parseFloat(valorIpiTotalGeral.toFixed(2));
      } else {
        quotation.valor_ipi = 0;
      }

      const valorTotalNota = parseFloat(quotation.valor_total_produtos.toString()) + quotation.valor_frete;
      quotation.valor_total_nota = parseFloat(valorTotalNota.toFixed(2));

      const finalQuotation = await queryRunner.manager.save(quotation);
      await queryRunner.commitTransaction();

      return this.findOne(finalQuotation.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}