import { Injectable, NotFoundException, Inject, forwardRef, Logger } from '@nestjs/common';
import * as archiverModule from 'archiver';
const ZipArchive = (archiverModule as any).ZipArchive;
import { PassThrough, Writable } from 'node:stream';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, MoreThanOrEqual } from 'typeorm';
import { Quotation, QuotationStatus, EmpresaFaturamento } from './entities/quotation.entity.js';
import { User, UserRole } from '../auth/entities/user.entity.js';
import { QuotationItem } from './entities/quotation-item.entity.js';
import { CreateQuotationDto } from './dto/create-quotation.dto.js';
import { FinalizeQuotationDto } from './dto/finalize-quotation.dto.js';
import { Product } from '../products/entities/product.entity.js';
import { BatchQuotationDto } from './dto/batch-quotation.dto.js';
import { Client } from '../clients/entities/client.entity.js';
import { PdfService } from '../documents/pdf.service.js';
import { FrenetService } from '../freight/frenet.service.js';
import { ClientsService } from '../clients/clients.service.js';

type PdfServicePort = Pick<PdfService, 'generateQuotationPdf' | 'generateMultipleQuotationsPdf'>;

@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    @InjectRepository(Quotation)
    private quotationRepository: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private itemRepository: Repository<QuotationItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => PdfService))
    private pdfService: PdfServicePort,
    private frenetService: FrenetService,
    @Inject(forwardRef(() => ClientsService))
    private clientsService: ClientsService,
  ) { }

  async create(createDto: CreateQuotationDto, user?: any): Promise<Quotation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const quotation = new Quotation();
      if (createDto.clientId) {
        quotation.client = { id: createDto.clientId } as any;
      }
      quotation.origem_cep = createDto.originCep || null;
      quotation.destino_cep = createDto.destCep || null;
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
      quotation.is_test = createDto.isTest || false;

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
        const totalComIpiInput = qItem.quantidade * valUnitInput;

        // Determinação da Alíquota
        let aliquotaResult = 0;
        const canEditIpi = user?.role === UserRole.ADMIN || user?.username?.toLowerCase() === 'bianca';

        if (quotation.empresa_faturamento === EmpresaFaturamento.FLEXOBOX || 
            quotation.empresa_faturamento === EmpresaFaturamento.L_LOG) {
          aliquotaResult = 0;
        } else if (canEditIpi && item.percentualIpi !== undefined) {
          aliquotaResult = item.percentualIpi;
        } else if (canEditIpi && createDto.percentualIpi !== undefined) {
          aliquotaResult = createDto.percentualIpi;
        } else if (quotation.empresa_faturamento === EmpresaFaturamento.NICOPEL) {
          const nomeSuperior = product.nome.toUpperCase();
          const categoriaSuperior = product.categoria ? product.categoria.toUpperCase() : '';

          if (nomeSuperior.includes('SERIGRAFIA') || nomeSuperior.includes('TAMPA')) {
            aliquotaResult = 0;
          } else if (categoriaSuperior === 'POTE' || nomeSuperior.includes('POTE') || nomeSuperior.includes('COPO')) {
            aliquotaResult = 6.75;
          } else {
            aliquotaResult = 3.25;
          }
        }

        // Cálculo Base e IPI "Inclusive" (Extração Facilitada conforme solicitado)
        // A regra é: O valor digitado já tem IPI.
        // IPI = Total * (Alíquota/100)
        // Base = Total - IPI
        const totalIntegralItem = qItem.quantidade * valUnitInput;
        let valorIpiItem = 0;

        if (aliquotaResult > 0) {
          valorIpiItem = totalIntegralItem * (aliquotaResult / 100);
        }

        const valorBaseItem = totalIntegralItem - valorIpiItem;

        // Salvando os resultados no item
        qItem.valor_total_item = totalIntegralItem;
        qItem.valor_unitario_na_cotacao = valUnitInput;
        qItem.valor_base_item = valorBaseItem;
        qItem.valor_ipi_item = valorIpiItem;

        // Acumula os valores para o resumo da nota
        accumulatedTotalProdutos += valorBaseItem; // "Total Produto" (Base)
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
    const where: any = { is_test: false };
    const isAdmin = user?.role === 'ADMIN';

    if (!isAdmin && user?.userId) {
      where.userId = user.userId;
    }

    return this.quotationRepository.find({
      where,
      relations: ['client', 'user'],
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

      console.log(`Finalizando cotação #${id} - Itens: ${quotation.items?.length}`);

      quotation.transportadora_escolhida = finalizeDto.transportadoraEscolhida || 'WHATSAPP (Pendente)';
      quotation.valor_frete = finalizeDto.valorFrete ? parseFloat(finalizeDto.valorFrete.toString()) : 0;
      quotation.dias_para_entrega = finalizeDto.diasParaEntrega !== undefined ? Number(finalizeDto.diasParaEntrega) : null;

      if (finalizeDto.nf) quotation.nf = finalizeDto.nf;
      if (finalizeDto.dataColeta) quotation.data_coleta = finalizeDto.dataColeta;
      if (finalizeDto.tipoFrete) quotation.tipo_frete = finalizeDto.tipoFrete;
      if (finalizeDto.obs !== undefined) quotation.obs = finalizeDto.obs;

      // Mesmo ajuste para o número do pedido no finalize
      if (finalizeDto.numeroPedidoManual !== undefined) {
        quotation.numero_pedido_manual = finalizeDto.numeroPedidoManual && finalizeDto.numeroPedidoManual.trim() !== ''
          ? finalizeDto.numeroPedidoManual.trim()
          : null;
      }

      let valorIpiTotalGeral = 0;
      let novoValorTotalProdutos = 0;

      for (const item of quotation.items) {
        // No finalize, os itens já estão salvos como INTEGRAIS (valor_total_item com IPI)
        const totalIntegralItem = Number(item.valor_total_item);

        let aliquotaResult = 0;
        // No finalize não temos o objeto user direto, mas a cotação já tem o percentual_ipi salvo se foi editado no create
        
        if (quotation.empresa_faturamento === EmpresaFaturamento.FLEXOBOX || 
            quotation.empresa_faturamento === EmpresaFaturamento.L_LOG) {
          aliquotaResult = 0;
        } else if (quotation.percentual_ipi > 0) {
          aliquotaResult = Number(quotation.percentual_ipi);
        } else if (quotation.empresa_faturamento === EmpresaFaturamento.NICOPEL) {
          const nome = item.product?.nome ? item.product.nome.toUpperCase() : '';
          const categoria = (item.product as any)?.categoria ? String((item.product as any).categoria).toUpperCase() : '';

          if (nome.includes('SERIGRAFIA') || nome.includes('TAMPA')) {
            aliquotaResult = 0;
          } else if (categoria === 'POTE' || nome.includes('POTE') || nome.includes('COPO')) {
            aliquotaResult = 6.75;
          } else {
            aliquotaResult = 3.25;
          }
        }

        // Recalcular no finalize mantendo a regra de "Extração"
        // O valor salvo em valor_unitario_na_cotacao já é o valor INTEGRAL (com IPI)
        const totalIntegralItemFinal = item.quantidade * item.valor_unitario_na_cotacao;
        let valorIpiItemFinal = 0;

        if (aliquotaResult > 0) {
          valorIpiItemFinal = totalIntegralItemFinal * (aliquotaResult / 100);
        }

        const valorBaseItemFinal = totalIntegralItemFinal - valorIpiItemFinal;

        item.valor_total_item = totalIntegralItemFinal;
        item.valor_base_item = valorBaseItemFinal;
        item.valor_ipi_item = valorIpiItemFinal;

        novoValorTotalProdutos += valorBaseItemFinal;
        valorIpiTotalGeral += valorIpiItemFinal;
      }

      quotation.valor_total_produtos = Number(novoValorTotalProdutos.toFixed(2));
      quotation.valor_ipi = Number(valorIpiTotalGeral.toFixed(2));

      // Lógica de Isenção de Frete para o cliente
      const isExento = this.isFreightExempt(quotation.client.razao_social, quotation.client.fantasia);
      
      // Se for isento, força o valor do frete salvo a 0
      if (isExento) {
        quotation.valor_frete = 0;
      }

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
    const isExento = q.client ? this.isFreightExempt(q.client.razao_social, q.client.fantasia) : false;
    
    if (isExento) {
       q.valor_frete = 0;
    }

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

    const where: any = { created_at: MoreThanOrEqual(startDate), is_test: false };
    const isAdmin = user?.role === 'ADMIN';

    if (!isAdmin && user?.userId) {
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

    const baseWhere: any = { created_at: MoreThanOrEqual(today), is_test: false };
    const isAdmin = user?.role === 'ADMIN';

    if (!isAdmin && user?.userId) {
      baseWhere.userId = user.userId;
    }

    const quotationsToday = await this.quotationRepository.count({
      where: baseWhere,
    });

    const pendingWhere: any = { status: QuotationStatus.PENDENTE, is_test: false };
    if (!isAdmin && user?.userId) {
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
    if (!isAdmin && user?.userId) {
      approvedWhere.userId = user.userId;
    }

    const approvedToday = await this.quotationRepository.find({
      where: approvedWhere,
    });
    const totalValue = approvedToday.reduce((acc, q) => acc + Number(q.valor_frete || 0), 0);

    const totalAllWhere: any = {};
    if (!isAdmin && user?.userId) {
      totalAllWhere.userId = user.userId;
    }
    const totalAll = await this.quotationRepository.count({ where: totalAllWhere });

    const approvedAllWhere: any = { status: QuotationStatus.APROVADO };
    if (!isAdmin && user?.userId) {
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
    const where: any = { is_test: false };
    const isAdmin = user?.role === 'ADMIN';

    if (!isAdmin && user?.userId) {
      where.userId = user.userId;
    }

    return this.quotationRepository.find({
      where,
      relations: ['client', 'user'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findForCollections(user?: any): Promise<any[]> {
    const where: any = {
      // Filtrar apenas cotações com status específico de coleta
      status: QuotationStatus.AGUARDANDO_COLETA,
      is_test: false
    };

    const isAdmin = user?.role === 'ADMIN';
    if (!isAdmin && user?.userId) {
      where.userId = user.userId;
    }

    const quotations = await this.quotationRepository.find({
      where,
      relations: ['client', 'items', 'items.product'],
      order: { id: 'DESC' }
    });

    const groupsMap = new Map<string, any>();

    quotations.forEach(q => {
      let totalVolumes = 0;
      let totalWeight = 0;

      q.items.forEach(item => {
        const prod = item.product;
        if (prod && prod.unidades_caixa > 0) {
          const caixas = Math.ceil(item.quantidade / prod.unidades_caixa);
          totalVolumes += caixas;
          if (prod.peso_caixa_kg > 0) {
            totalWeight += caixas * Number(prod.peso_caixa_kg);
          } else if (prod.peso_unitario_kg > 0) {
            totalWeight += item.quantidade * Number(prod.peso_unitario_kg);
          }
        } else {
          totalVolumes += item.quantidade;
          if (prod && prod.peso_unitario_kg) {
            totalWeight += item.quantidade * Number(prod.peso_unitario_kg);
          }
        }
      });

      const carrierName = q.transportadora_escolhida || 'Não Definida';
      if (!groupsMap.has(carrierName)) {
        groupsMap.set(carrierName, {
          transportadora: carrierName,
          totalVolumes: 0,
          totalWeight: 0,
          quotations: []
        });
      }

      const group = groupsMap.get(carrierName);
      group.totalVolumes += totalVolumes;
      group.totalWeight += totalWeight;
      group.quotations.push({
        id: q.id,
        date: q.created_at,
        client: q.client?.razao_social || 'Cliente Desconhecido',
        volumes: totalVolumes,
        weight: totalWeight,
        status: q.status
      });
    });

    return Array.from(groupsMap.values());
  }
  async createBatch(batchDto: BatchQuotationDto, user: any) {
    const results: any[] = [];
    
    for (const req of batchDto.requests) {
      try {
        // 1. Encontrar ou buscar/enriquecer cliente por CNPJ de forma resiliente
        let client: Client | null = null;
        const cnpjLimpo = req.cnpj.replace(/\D/g, '');
        
        try {
          // Tenta obter/enriquecer os dados cadastrais diretamente da Brasil API
          const externalResult = await this.clientsService.findCnpjExternal(cnpjLimpo);
          
          if (externalResult) {
            if (externalResult.isAlreadyRegistered && externalResult.registeredId) {
              // Cliente já cadastrado, vamos buscar a entidade no banco de dados local
              client = await this.clientRepository.findOne({ where: { id: externalResult.registeredId } });
            } else {
              // Cliente não cadastrado na base local. Vamos cadastrar agora com os dados da Brasil API de forma resiliente!
              const empresaFaturamentoStr = req.empresaFaturamento || EmpresaFaturamento.NICOPEL;
              client = await this.clientsService.create({
                razao_social: externalResult.data.razao_social || 'Cliente Sem Razão Social',
                fantasia: externalResult.data.fantasia || '',
                cnpj: cnpjLimpo,
                cep: externalResult.data.cep || '',
                cidade: externalResult.data.cidade || 'Não Informada',
                estado: externalResult.data.estado || 'PR',
                empresa_faturamento: empresaFaturamentoStr as any
              });
            }
          }
        } catch (err: any) {
          this.logger.warn(`Falha ao obter dados da Brasil API para o CNPJ ${req.cnpj}: ${err.message}`);
        }

        // Se falhar a busca externa ou der algum problema, tenta buscar diretamente na base local pelo CNPJ
        if (!client) {
          client = await this.clientRepository.findOne({ where: { cnpj: cnpjLimpo } });
        }

        // Se ainda assim não existir o cliente, lançamos erro para este item do lote
        if (!client) {
          throw new Error(`CNPJ ${req.cnpj} não cadastrado localmente e não pôde ser consultado externamente.`);
        }

        // 2. Criar Cotação Base
        const quotation = await this.create({
          clientId: client.id,
          originCep: req.originCep || '86087350',
          destCep: client.cep,
          empresaFaturamento: (req.empresaFaturamento as any) || EmpresaFaturamento.NICOPEL,
          items: req.items,
          isTest: false
        }, user);

        // 3. Calcular Fretes
        const options = await this.frenetService.calculateForQuotation(quotation.id);
        
        // 4. Escolher o melhor (priorizando o menor preço de frete, depois o menor prazo de entrega)
        const bestOption = options
          .filter(o => o.price > 0 && o.recommendation !== 'manual_quote')
          .sort((a, b) => {
            if (a.price !== b.price) {
              return a.price - b.price;
            }
            return a.deadline - b.deadline;
          })[0];

        if (bestOption) {
          // 5. Finalizar
          const finalized = await this.finalize(quotation.id, {
            transportadoraEscolhida: bestOption.carrier,
            valorFrete: bestOption.price,
            diasParaEntrega: bestOption.deadline
          });
          results.push({
            id: quotation.id,
            cnpj: req.cnpj,
            status: 'SUCCESS',
            client: client.razao_social,
            carrier: bestOption.carrier,
            valorProdutos: Number(finalized.valor_total_produtos || 0),
            valorIpi: Number(finalized.valor_ipi || 0),
            valorFrete: Number(finalized.valor_frete || 0),
            valorTotalNota: Number(finalized.valor_total_nota || 0),
            prazo: bestOption.deadline
          });
        } else {
          results.push({
            id: quotation.id,
            cnpj: req.cnpj,
            status: 'MANUAL_REQUIRED',
            client: client.razao_social,
            message: 'Nenhuma transportadora automática disponível',
            valorProdutos: Number(quotation.valor_total_produtos || 0),
            valorIpi: Number(quotation.valor_ipi || 0),
            valorFrete: 0,
            valorTotalNota: Number(quotation.valor_total_nota || 0)
          });
        }
      } catch (e: any) {
        results.push({ cnpj: req.cnpj, status: 'ERROR', message: e.message });
      }
    }
    
    return results;
  }

  async generateZipBuffer(quotationIds: number[]): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const archive = new ZipArchive({ zlib: { level: 9 } });
        const chunks: Buffer[] = [];
        
        const stream = new Writable({
          write(chunk, encoding, callback) {
            chunks.push(chunk);
            callback();
          }
        });
        
        stream.on('finish', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
        
        archive.pipe(stream);
        
        // Gera todos os PDFs de forma ultra-otimizada
        const pdfFiles = await this.pdfService.generateMultipleQuotationsPdf(quotationIds);
        
        for (const file of pdfFiles) {
          archive.append(file.buffer, { name: file.name });
        }
        
        await archive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  }
}
