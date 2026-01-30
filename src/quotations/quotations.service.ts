import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, MoreThanOrEqual } from 'typeorm';
import { Quotation, QuotationStatus, EmpresaFaturamento } from './entities/quotation.entity.js';
import { QuotationItem } from './entities/quotation-item.entity.js';
import { CreateQuotationDto } from './dto/create-quotation.dto.js';
import { FinalizeQuotationDto } from './dto/finalize-quotation.dto.js';
import { Product } from '../products/entities/product.entity.js';

@Injectable()
export class QuotationsService {
  constructor(
    @InjectRepository(Quotation)
    private quotationRepository: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private itemRepository: Repository<QuotationItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
  ) { }

  async create(createDto: CreateQuotationDto): Promise<Quotation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const quotation = new Quotation();
      quotation.client = { id: createDto.clientId } as any;
      quotation.data_cotacao = new Date();
      quotation.prazo_pagamento = createDto.prazoPagamento || '';
      quotation.tipo_frete = createDto.tipoFrete || '';
      quotation.obs = createDto.obs || '';
      quotation.empresa_faturamento = createDto.empresaFaturamento;

      // Corrigido para evitar erro de constraint UNIQUE '"UQ_quotations_numero_pedido_manual"'
      // No Postgres, múltiplos NULLs são permitidos em uma index única, mas múltiplas strings vazias não.
      quotation.numero_pedido_manual = createDto.numeroPedidoManual && createDto.numeroPedidoManual.trim() !== ''
        ? createDto.numeroPedidoManual.trim()
        : null;

      quotation.percentual_ipi = createDto.percentualIpi || 0;
      quotation.status = QuotationStatus.PENDENTE;

      quotation.valor_total_produtos = 0;
      quotation.valor_ipi = 0;
      quotation.valor_total_nota = 0;

      const savedQuotation = await queryRunner.manager.save(quotation);

      let accumulatedTotalProdutos = 0;
      let accumulatedIpi = 0;

      const quotationItems: QuotationItem[] = [];
      for (const item of createDto.items) {
        const product = await queryRunner.manager.findOne(Product, { where: { id: item.productId } });
        if (!product) continue;

        const qItem = new QuotationItem();
        qItem.quotation = savedQuotation;
        qItem.product = product;
        qItem.quantidade = item.quantidade;

        const valUnit = item.valorUnitario !== undefined ? item.valorUnitario : Number(product.valor_unitario);
        qItem.valor_unitario_na_cotacao = valUnit;

        const unitsPerBox = product.unidades_caixa ? Number(product.unidades_caixa) : 1;
        const subtotal = Number((qItem.quantidade * unitsPerBox * qItem.valor_unitario_na_cotacao).toFixed(2));
        qItem.valor_total_item = subtotal;

        accumulatedTotalProdutos += subtotal;

        // Lógica de IPI
        let aliquotaResult = 0;
        if (quotation.empresa_faturamento === EmpresaFaturamento.NICOPEL) {
          const nome = product.nome.toUpperCase();
          const categoria = product.categoria ? product.categoria.toUpperCase() : 'POTE';
          aliquotaResult = 9.75;

          if (categoria === 'CAIXA') {
            if (nome.includes('POTE') || nome.includes('PT')) {
              aliquotaResult = 9.75;
            } else {
              aliquotaResult = 15;
            }
          } else if (nome.includes('TAMPA')) {
            aliquotaResult = 15;
          }
        } else if (createDto.percentualIpi) {
          // Se não for Nicopel mas houver IPI manual no cabeçalho
          aliquotaResult = createDto.percentualIpi;
        }

        if (aliquotaResult > 0) {
          accumulatedIpi += subtotal * (aliquotaResult / 100);
        }

        quotationItems.push(qItem);
      }

      await queryRunner.manager.save(quotationItems);

      // Atualiza os totais da cotação
      savedQuotation.valor_total_produtos = Number(accumulatedTotalProdutos.toFixed(2));
      savedQuotation.valor_ipi = Number(accumulatedIpi.toFixed(2));
      savedQuotation.valor_total_nota = Number((savedQuotation.valor_total_produtos + savedQuotation.valor_ipi).toFixed(2));

      await queryRunner.manager.save(savedQuotation);

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

      quotation.transportadora_escolhida = finalizeDto.transportadoraEscolhida || 'WHATSAPP (Pendente)';
      quotation.valor_frete = finalizeDto.valorFrete ? parseFloat(finalizeDto.valorFrete.toString()) : 0;
      quotation.dias_para_entrega = finalizeDto.diasParaEntrega !== undefined ? Number(finalizeDto.diasParaEntrega) : null;

      if (finalizeDto.nf) quotation.nf = finalizeDto.nf;
      if (finalizeDto.dataColeta) quotation.data_coleta = finalizeDto.dataColeta;
      if (finalizeDto.tipoFrete) quotation.tipo_frete = finalizeDto.tipoFrete;

      // Mesmo ajuste para o número do pedido no finalize
      if (finalizeDto.numeroPedidoManual !== undefined) {
        quotation.numero_pedido_manual = finalizeDto.numeroPedidoManual && finalizeDto.numeroPedidoManual.trim() !== ''
          ? finalizeDto.numeroPedidoManual.trim()
          : null;
      }

      let valorIpiTotalGeral = 0;
      let novoValorTotalProdutos = 0;

      for (const item of quotation.items) {
        const unitsPerBox = item.product ? Number(item.product.unidades_caixa) : 1;
        const subtotal = Number(item.quantidade) * unitsPerBox * Number(item.valor_unitario_na_cotacao);
        novoValorTotalProdutos += subtotal;

        let aliquotaResult = 0;
        if (quotation.empresa_faturamento === EmpresaFaturamento.NICOPEL) {
          const nome = item.product ? item.product.nome.toUpperCase() : '';
          const categoria = (item.product as any)?.categoria ? (item.product as any).categoria.toUpperCase() : 'POTE';
          aliquotaResult = 9.75;

          if (categoria === 'CAIXA') {
            if (nome.includes('POTE') || nome.includes('PT')) {
              aliquotaResult = 9.75;
            } else {
              aliquotaResult = 15;
            }
          } else if (nome.includes('TAMPA')) {
            aliquotaResult = 15;
          }
        } else if (quotation.percentual_ipi) {
          aliquotaResult = quotation.percentual_ipi;
        }

        if (aliquotaResult > 0) {
          valorIpiTotalGeral += subtotal * (aliquotaResult / 100);
        }
      }

      quotation.valor_total_produtos = Number(novoValorTotalProdutos.toFixed(2));
      quotation.valor_ipi = Number(valorIpiTotalGeral.toFixed(2));
      quotation.valor_total_nota = Number((quotation.valor_total_produtos + quotation.valor_ipi + (quotation.valor_frete || 0)).toFixed(2));

      if (quotation.transportadora_escolhida.includes('WHATSAPP')) {
        quotation.status = QuotationStatus.PENDENTE;
      } else {
        quotation.status = QuotationStatus.APROVADO;
      }

      const saved = await queryRunner.manager.save(quotation);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: number, updateDto: any): Promise<Quotation> {
    if (updateDto.valor_frete !== undefined) updateDto.valor_frete = parseFloat(updateDto.valor_frete);
    if (updateDto.dias_para_entrega !== undefined) updateDto.dias_para_entrega = parseInt(updateDto.dias_para_entrega);

    // Se vier numero_pedido_manual, tratar para null se vazio
    if (updateDto.numero_pedido_manual !== undefined) {
      updateDto.numero_pedido_manual = updateDto.numero_pedido_manual && updateDto.numero_pedido_manual.trim() !== ''
        ? updateDto.numero_pedido_manual.trim()
        : null;
    }

    await this.quotationRepository.update(id, updateDto);

    const q = await this.findOne(id);
    q.valor_total_nota = Number((Number(q.valor_total_produtos || 0) + Number(q.valor_ipi || 0) + Number(q.valor_frete || 0)).toFixed(2));
    await this.quotationRepository.save(q);

    return q;
  }

  async updateStatus(id: number, status: string): Promise<Quotation> {
    await this.quotationRepository.update(id, { status: status as any });
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const quotation = await this.findOne(id);
    await this.quotationRepository.remove(quotation);
  }

  async getAnalytics(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const quotations = await this.quotationRepository.find({
      where: { created_at: MoreThanOrEqual(startDate) },
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

    return {
      totalSpend,
      freightCount,
      avgLeadTime: Number(avgLeadTime.toFixed(1)),
      totalSavings: totalSpend * 0.12,
    };
  }

  async getDashboardStats() {
    const total = await this.quotationRepository.count();
    const active = await this.quotationRepository.count({
      where: { status: QuotationStatus.APROVADO },
    });
    const pending = await this.quotationRepository.count({
      where: { status: QuotationStatus.PENDENTE },
    });

    return { total, active, pending };
  }

  async getRecentQuotations(limit: number): Promise<Quotation[]> {
    return this.quotationRepository.find({
      relations: ['client'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}