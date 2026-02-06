import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, MoreThanOrEqual } from 'typeorm';
import { Quotation, QuotationStatus, EmpresaFaturamento } from './entities/quotation.entity.js';
import { User, UserRole } from '../auth/entities/user.entity.js';
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

  async create(createDto: CreateQuotationDto, user?: any): Promise<Quotation> {
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

      if (user && user.userId) {
        quotation.userId = user.userId;
      }

      const savedQuotation = await queryRunner.manager.save(quotation);

      let accumulatedTotalProdutos = 0;
      let accumulatedIpi = 0;

      const quotationItems: QuotationItem[] = [];
      for (const item of createDto.items) {
        const product = await queryRunner.manager.findOne(Product, { where: { id: item.productId } });
        if (!product) continue;

        const valUnitInput = item.valorUnitario !== undefined ? item.valorUnitario : Number(product.valor_unitario);
        const qItem = new QuotationItem();
        qItem.quotation = savedQuotation;
        qItem.product = product;
        qItem.quantidade = item.quantidade;

        // Cálculo do Total com IPI Embutido (para Nicopel) ou Total Direto (outros)
        const totalComIpiInput = Number((qItem.quantidade * valUnitInput).toFixed(2));

        // Determinação da Alíquota
        let aliquotaResult = 0;
        if (quotation.empresa_faturamento === EmpresaFaturamento.NICOPEL) {
          const nomeSuperior = product.nome.toUpperCase();
          const categoriaSuperior = product.categoria ? product.categoria.toUpperCase() : 'POTE';

          if (nomeSuperior.includes('SERIGRAFIA') || nomeSuperior.includes('TAMPA')) {
            aliquotaResult = 0;
          } else if (categoriaSuperior === 'POTE') {
            aliquotaResult = 9.75;
          } else {
            aliquotaResult = 3.25;
          }
        } else if (createDto.percentualIpi) {
          aliquotaResult = createDto.percentualIpi;
        }

        // Extração/Cálculo
        let valorBaseItem = totalComIpiInput;
        let valorIpiItem = 0;

        if (aliquotaResult > 0) {
          // Fórmula: Base = Total / (1 + Alíquota/100)
          valorBaseItem = Number((totalComIpiInput / (1 + aliquotaResult / 100)).toFixed(2));
          valorIpiItem = Number((totalComIpiInput - valorBaseItem).toFixed(2));
        }

        // Salvando os resultados no item
        qItem.valor_total_item = valorBaseItem;
        qItem.valor_unitario_na_cotacao = Number((valorBaseItem / qItem.quantidade).toFixed(4));

        accumulatedTotalProdutos += valorBaseItem;
        accumulatedIpi += valorIpiItem;

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

  async findAll(user?: any): Promise<Quotation[]> {
    const where: any = {};
    const shouldRestrict = user?.permissions?.includes('quota_restricted');
    if (user && shouldRestrict) {
      where.userId = user.userId;
    }

    return this.quotationRepository.find({
      where,
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
        relations: ['client', 'items', 'items.product'],
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
        const subtotal = Number(item.valor_total_item);
        novoValorTotalProdutos += subtotal;

        let aliquotaResult = 0;
        if (quotation.empresa_faturamento === EmpresaFaturamento.NICOPEL) {
          const nome = item.product ? item.product.nome.toUpperCase() : '';
          const categoria = (item.product as any)?.categoria ? (item.product as any).categoria.toUpperCase() : 'POTE';

          if (nome.includes('SERIGRAFIA') || nome.includes('TAMPA')) {
            aliquotaResult = 0;
          } else if (categoria === 'POTE') {
            aliquotaResult = 9.75;
          } else {
            aliquotaResult = 3.25;
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

      // Lógica de Isenção de Frete para o cliente
      const isExento = this.isFreightExempt(quotation.client.razao_social, quotation.client.fantasia);
      const freteAplicado = isExento ? 0 : (quotation.valor_frete || 0);

      quotation.valor_total_nota = Number((quotation.valor_total_produtos + quotation.valor_ipi + freteAplicado).toFixed(2));

      if (quotation.transportadora_escolhida.includes('WHATSAPP')) {
        quotation.status = QuotationStatus.PENDENTE;
      } else {
        quotation.status = QuotationStatus.APROVADO;
      }

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

  public isFreightExempt(razaoSocial: string, fantasia?: string): boolean {
    const r = (razaoSocial || '').toUpperCase();
    const f = (fantasia || '').toUpperCase();
    const grupos = [
      'THE BEST',
      'GELA BOCA',
      'BARONE',
      'SANTA PIZZA',
      'PIMENTA ROSA',
      'FRATELLO',
      'GMEL'
    ];
    return grupos.some(g => r.includes(g) || f.includes(g));
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

  async getAnalytics(days: number, user?: any) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: any = { created_at: MoreThanOrEqual(startDate) };
    const shouldRestrict = user?.permissions?.includes('quota_restricted');

    if (user && shouldRestrict) {
      where.userId = user.userId;
    }

    const quotations = await this.quotationRepository.find({
      where,
      relations: ['client'],
    });

    const approved = quotations.filter(q =>
      (q.status === QuotationStatus.APROVADO || q.status === QuotationStatus.ENVIADO) && Number(q.valor_frete || 0) > 0
    );

    const totalSpend = approved.reduce((acc, q) => acc + Number(q.valor_frete || 0), 0);
    const freightCount = approved.length;

    // Freight Categories Breakdown (FOB vs CIF)
    const fobCount = approved.filter(q => q.tipo_frete === 'FOB').length;
    const cifCount = approved.filter(q => q.tipo_frete === 'CIF').length;

    const leadTimeItems = approved.filter(q => q.dias_para_entrega !== null);
    const avgLeadTime = leadTimeItems.length > 0
      ? leadTimeItems.reduce((acc, q) => acc + (q.dias_para_entrega || 0), 0) / leadTimeItems.length
      : 0;

    // Agrupar por dia para dailyData (Valor e Quantidade)
    const dailyMap = new Map<string, { value: number, count: number }>();
    approved.forEach(q => {
      const dateStr = new Date(q.created_at).toISOString().split('T')[0];
      const current = dailyMap.get(dateStr) || { value: 0, count: 0 };
      dailyMap.set(dateStr, {
        value: current.value + Number(q.valor_frete || 0),
        count: current.count + 1
      });
    });
    const dailyData = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, value: data.value, count: data.count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Agrupar por transportadora para topCarriers
    const carrierMap = new Map<string, { count: number, value: number }>();
    approved.forEach(q => {
      const name = q.transportadora_escolhida || 'Outros/Manual';
      const current = carrierMap.get(name) || { count: 0, value: 0 };
      carrierMap.set(name, {
        count: current.count + 1,
        value: current.value + Number(q.valor_frete || 0)
      });
    });
    const topCarriers = Array.from(carrierMap.entries())
      .map(([name, data]) => ({ name, count: data.count, value: data.value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalSpend,
      freightCount,
      fobCount,
      cifCount,
      avgLeadTime: Number(avgLeadTime.toFixed(1)),
      totalSavings: totalSpend * 0.12,
      dailyData,
      topCarriers
    };
  }

  async getDashboardStats(user?: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseWhere: any = { created_at: MoreThanOrEqual(today) };
    const shouldRestrict = user?.permissions?.includes('quota_restricted');

    if (user && shouldRestrict) {
      baseWhere.userId = user.userId;
    }

    const quotationsToday = await this.quotationRepository.count({
      where: baseWhere,
    });

    const pendingWhere: any = { status: QuotationStatus.PENDENTE };
    if (user && shouldRestrict) {
      pendingWhere.userId = user.userId;
    }

    const pendingCount = await this.quotationRepository.count({
      where: pendingWhere,
    });

    // Valor Total hoje (aprovadas/enviadas hoje)
    const approvedWhere: any = {
      status: QuotationStatus.APROVADO,
      created_at: MoreThanOrEqual(today)
    };
    if (user && shouldRestrict) {
      approvedWhere.userId = user.userId;
    }

    const approvedToday = await this.quotationRepository.find({
      where: approvedWhere,
    });
    const totalValue = approvedToday.reduce((acc, q) => acc + Number(q.valor_frete || 0), 0);

    const totalAllWhere: any = {};
    if (user && shouldRestrict) {
      totalAllWhere.userId = user.userId;
    }
    const totalAll = await this.quotationRepository.count({ where: totalAllWhere });

    const approvedAllWhere: any = { status: QuotationStatus.APROVADO };
    if (user && shouldRestrict) {
      approvedAllWhere.userId = user.userId;
    }
    const approvedAll = await this.quotationRepository.count({
      where: approvedAllWhere,
    });
    const conversionRate = totalAll > 0 ? Math.round((approvedAll / totalAll) * 100) : 0;

    return {
      quotationsToday,
      totalValue,
      pendingCount,
      conversionRate
    };
  }

  async getRecentQuotations(limit: number, user?: any): Promise<Quotation[]> {
    const where: any = {};
    const shouldRestrict = user?.permissions?.includes('quota_restricted');
    if (user && shouldRestrict) {
      where.userId = user.userId;
    }

    return this.quotationRepository.find({
      where,
      relations: ['client'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}