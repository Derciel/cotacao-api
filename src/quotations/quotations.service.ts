import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, MoreThanOrEqual } from 'typeorm';

import { Client } from '../clients/entities/client.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { CreateQuotationDto } from './dto/create-quotation.dto.js';
import { FinalizeQuotationDto } from './dto/finalize-quotation.dto.js';
import { QuotationItem } from './entities/quotation-item.entity.js';
import { EmpresaFaturamento, Quotation, QuotationStatus } from './entities/quotation.entity.js';

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

      const savedQuotation = await queryRunner.manager.save(newQuotation);

      let valorTotalProdutos = 0;
      const quotationItems: QuotationItem[] = [];

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
      // Tipagem explícita para evitar o erro 'unknown'
      const quotation = await queryRunner.manager.findOne(Quotation, {
        where: { id },
        relations: ['items', 'items.product'],
      });

      if (!quotation) throw new NotFoundException(`Cotação #${id} não encontrada.`);

      quotation.transportadora_escolhida = finalizeDto.transportadoraEscolhida;
      quotation.valor_frete = parseFloat(finalizeDto.valorFrete.toString());
      quotation.dias_para_entrega = finalizeDto.diasParaEntrega ?? null;

      // Novos campos
      if (finalizeDto.nf) quotation.nf = finalizeDto.nf;
      if (finalizeDto.dataColeta) quotation.data_coleta = finalizeDto.dataColeta;
      if (finalizeDto.tipoFrete) quotation.tipo_frete = finalizeDto.tipoFrete;
      if (finalizeDto.numeroPedidoManual) quotation.numero_pedido_manual = finalizeDto.numeroPedidoManual;

      let valorIpiTotalGeral = 0;
      let novoValorTotalProdutos = 0;

      if (quotation.empresa_faturamento === EmpresaFaturamento.NICOPEL) {
        for (const item of quotation.items) {
          // Lógica de IPI baseada no nome/categoria do produto
          const nome = item.product.nome.toUpperCase();
          const categoria = (item.product as any).categoria ? (item.product as any).categoria.toUpperCase() : 'POTE';

          let aliquota = 9.75; // Padrão Potes

          // Se for caixa, verifica se é para pote ou normal
          if (nome.includes('CAIXA')) {
            if (nome.includes('POTE') || nome.includes('PARA POTE')) {
              aliquota = 9.75;
            } else {
              aliquota = 3.25;
            }
          } else if (categoria === 'CAIXA') {
            aliquota = 3.25;
          }

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
        quotation.percentual_ipi = 0; // Removido valor único pois agora é por item
      } else {
        // L_LOG e outros são Isentos (IPI = 0)
        quotation.valor_ipi = 0;
        quotation.percentual_ipi = 0;
      }

      const valorTotalNota = parseFloat(quotation.valor_total_produtos.toString()) + (quotation.valor_frete || 0);
      quotation.valor_total_nota = parseFloat(valorTotalNota.toFixed(2));

      // Se for L_LOG, o status permanece PENDENTE ou algo que indique que precisa de WhatsApp no front
      // Mas aqui liberamos a finalização normal.

      await queryRunner.manager.save(quotation);
      await queryRunner.commitTransaction();

      return this.findOne(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateStatus(id: number, status: string): Promise<Quotation> {
    await this.quotationRepository.update(id, { status: status as any });
    return this.findOne(id);
  }

  async update(id: number, updateDto: any): Promise<Quotation> {
    await this.quotationRepository.update(id, updateDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const quotation = await this.findOne(id);
    await this.quotationRepository.remove(quotation);
  }

  async getAnalytics(days: number) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Usando find com relação client para garantir dados completos
      const quotations = await this.quotationRepository.find({
        where: {
          created_at: MoreThanOrEqual(startDate),
        },
        relations: ['client'],
      });

      const approved = quotations.filter(q =>
        q.status === QuotationStatus.APROVADO || q.status === QuotationStatus.ENVIADO
      );

      const totalSpend = approved.reduce((acc, q) => acc + Number(q.valor_total_nota || 0), 0);
      const freightCount = approved.length;

      const leadTimeItems = approved.filter(q => q.dias_para_entrega !== null);
      const avgLeadTime = leadTimeItems.length > 0
        ? leadTimeItems.reduce((acc, q) => acc + (q.dias_para_entrega || 0), 0) / leadTimeItems.length
        : 0;

      const totalSavings = totalSpend * 0.12;

      const dailyDataMap = new Map<string, number>();
      approved.forEach(q => {
        try {
          // Usa created_at como fonte primária, fallback para data_cotacao
          const dateObj = q.created_at || q.data_cotacao;
          if (dateObj) {
            const dateStr = new Date(dateObj).toISOString().split('T')[0];
            dailyDataMap.set(dateStr, (dailyDataMap.get(dateStr) || 0) + Number(q.valor_total_nota || 0));
          }
        } catch (err) {
          console.warn(`Erro ao processar data da cotação #${q.id}`);
        }
      });

      const dailyData = Array.from(dailyDataMap.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const carrierMap = new Map<string, number>();
      approved.forEach(q => {
        if (q.transportadora_escolhida) {
          carrierMap.set(q.transportadora_escolhida, (carrierMap.get(q.transportadora_escolhida) || 0) + 1);
        }
      });

      const topCarriers = Array.from(carrierMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalSpend,
        totalSavings,
        freightCount,
        avgLeadTime: parseFloat(avgLeadTime.toFixed(1)),
        dailyData,
        topCarriers
      };
    } catch (error) {
      console.error('ERRO EM getAnalytics:', error);
      throw error;
    }
  }

  async getDashboardStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const quotationsToday = await this.quotationRepository.count({
        where: {
          created_at: MoreThanOrEqual(today)
        }
      });

      const approvedQuotes = await this.quotationRepository.find({
        where: [
          { status: QuotationStatus.APROVADO },
          { status: QuotationStatus.ENVIADO }
        ]
      });
      const totalValue = approvedQuotes.reduce((acc, q) => acc + Number(q.valor_total_nota || 0), 0);

      const pendingCount = await this.quotationRepository.count({
        where: { status: QuotationStatus.PENDENTE }
      });

      const totalQuotes = await this.quotationRepository.count();
      const conversionRate = totalQuotes > 0 ? (approvedQuotes.length / totalQuotes) * 100 : 0;

      return {
        quotationsToday,
        totalValue,
        pendingCount,
        conversionRate: parseFloat(conversionRate.toFixed(1))
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas do dashboard:', error);
      throw error;
    }
  }

  async getRecentQuotations(limit = 5) {
    try {
      return await this.quotationRepository.find({
        relations: ['client'],
        order: { created_at: 'DESC' },
        take: limit
      });
    } catch (error) {
      console.error('Erro ao buscar cotações recentes:', error);
      throw error;
    }
  }
}