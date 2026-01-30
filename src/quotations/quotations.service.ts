import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, MoreThanOrEqual } from 'typeorm';
import { Quotation, QuotationStatus, EmpresaFaturamento } from './entities/quotation.entity.js';
import { QuotationItem } from './entities/quotation-item.entity.js';
import { CreateQuotationDto } from './dto/create-quotation.dto.js';
import { FinalizeQuotationDto } from './dto/finalize-quotation.dto.js';

@Injectable()
export class QuotationsService {
  constructor(
    @InjectRepository(Quotation)
    private quotationRepository: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private itemRepository: Repository<QuotationItem>,
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
      quotation.numero_pedido_manual = createDto.numeroPedidoManual || '';
      quotation.percentual_ipi = createDto.percentualIpi || 0;
      quotation.status = QuotationStatus.PENDENTE;

      // Inicializar valores que serão calculados no finalize ou mantidos default
      quotation.valor_total_produtos = 0;
      quotation.valor_ipi = 0;
      quotation.valor_total_nota = 0;

      const savedQuotation = await queryRunner.manager.save(quotation);

      const quotationItems = createDto.items.map((item) => {
        const qItem = new QuotationItem();
        qItem.quotation = savedQuotation;
        qItem.product = { id: item.productId } as any;
        qItem.quantidade = item.qty;
        qItem.unidades_por_caixa = item.units || 1;
        qItem.valor_unitario = item.unitValue;
        qItem.peso_total = item.weight || 0;
        qItem.altura = item.height || 0;
        qItem.largura = item.width || 0;
        qItem.comprimento = item.length || 0;
        return qItem;
      });

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

      // Atribuição de campos com defaults para o fluxo WhatsApp
      quotation.transportadora_escolhida = finalizeDto.transportadoraEscolhida || 'WHATSAPP (Pendente)';
      quotation.valor_frete = finalizeDto.valorFrete ? parseFloat(finalizeDto.valorFrete.toString()) : 0;
      quotation.dias_para_entrega = finalizeDto.diasParaEntrega !== undefined ? Number(finalizeDto.diasParaEntrega) : null;

      if (finalizeDto.nf) quotation.nf = finalizeDto.nf;
      if (finalizeDto.dataColeta) quotation.data_coleta = finalizeDto.dataColeta;
      if (finalizeDto.tipoFrete) quotation.tipo_frete = finalizeDto.tipoFrete;
      if (finalizeDto.numeroPedidoManual) quotation.numero_pedido_manual = finalizeDto.numeroPedidoManual;

      let valorIpiTotalGeral = 0;
      let novoValorTotalProdutos = 0;

      for (const item of quotation.items) {
        const subtotal = Number(item.quantidade) * Number(item.unidades_por_caixa) * Number(item.valor_unitario);
        novoValorTotalProdutos += subtotal;

        if (quotation.empresa_faturamento === EmpresaFaturamento.NICOPEL) {
          const nome = item.product.nome.toUpperCase();
          let aliquota = 9.75;
          if (nome.includes('TAMPA')) aliquota = 15;
          const valorIpiItem = subtotal * (aliquota / 100);
          valorIpiTotalGeral += valorIpiItem;
        }
      }

      quotation.valor_total_produtos = Number(novoValorTotalProdutos.toFixed(2));
      quotation.valor_ipi = Number(valorIpiTotalGeral.toFixed(2));
      quotation.valor_total_nota = Number((quotation.valor_total_produtos + quotation.valor_ipi + (quotation.valor_frete || 0)).toFixed(2));

      // Se for WhatsApp, mantém PENDENTE, senão pode mudar para APROVADO se houver frete
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
    // Garantir que tipos numéricos sejam convertidos se vierem como string
    if (updateDto.valor_frete !== undefined) updateDto.valor_frete = parseFloat(updateDto.valor_frete);
    if (updateDto.dias_para_entrega !== undefined) updateDto.dias_para_entrega = parseInt(updateDto.dias_para_entrega);

    await this.quotationRepository.update(id, updateDto);

    // Recalcular totais se houve mudança no frete
    const q = await this.findOne(id);
    q.valor_total_nota = Number((Number(q.valor_total_produtos) + Number(q.valor_ipi) + Number(q.valor_frete || 0)).toFixed(2));
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