import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Audit, AuditStatus } from './entities/audit.entity.js';
import { SiegService } from './sieg.service.js';
import { Quotation } from '../quotations/entities/quotation.entity.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly TOLERANCIA_CENTAVOS = 0.50; // Tolerância de R$ 0,50 conforme solicitado

  constructor(
    @InjectRepository(Audit)
    private readonly auditRepository: Repository<Audit>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    private readonly siegService: SiegService,
  ) {}

  /**
   * Realiza a conferência de uma cotação específica
   */
  async auditQuotation(quotationId: number): Promise<Audit> {
    const quotation = await this.quotationRepository.findOne({
      where: { id: quotationId },
      relations: ['items'],
    });

    if (!quotation) {
      throw new NotFoundException('Cotação não encontrada.');
    }

    if (!quotation.nf) {
      throw new BadRequestException('Esta cotação não possui número de NF associado para auditoria.');
    }

    // Busca dados reais no SIEG
    const siegData = await this.siegService.findCteByNf(quotation.nf);
    
    if (!siegData) {
      this.logger.warn(`Conferência abortada: Nenhum CT-e encontrado no SIEG para a NF ${quotation.nf}`);
      throw new NotFoundException(`Não foi possível localizar o CT-e correspondente na SIEG para a NF ${quotation.nf}. Verifique se o documento já foi sincronizado no portal SIEG.`);
    }

    const actualFreight = Number(siegData.valor_frete);
    const actualWeight = Number(siegData.peso);
    const actualVolumes = Number(siegData.volumes);

    const diff = actualFreight - Number(quotation.valor_frete);
    
    let status = AuditStatus.OK;
    if (diff > this.TOLERANCIA_CENTAVOS) {
      status = AuditStatus.DIVERGENTE;
    }

    const audit = this.auditRepository.create({
      quotationId: quotation.id,
      nfe_number: quotation.nf,
      cte_number: siegData?.numero_cte || 'CTE-SIMULADO',
      valor_frete_cotado: quotation.valor_frete,
      valor_frete_sieg: actualFreight,
      peso_cotado: 100, // Idealmente viria da soma dos itens da cotação
      peso_sieg: actualWeight,
      volumes_cotados: 1, // Idem
      volumes_sieg: actualVolumes,
      divergencia_valor: diff,
      status: status,
      transportadora: quotation.transportadora_escolhida,
    });

    return await this.auditRepository.save(audit);
  }

  /**
   * Obtém o resumo de ganhos/perdas por transportadora em um período
   */
  async getSummaryByCarrier(startDate: Date, endDate: Date) {
    const audits = await this.auditRepository.find({
      where: {
        created_at: Between(startDate, endDate),
      },
    });

    const summary = {};

    audits.forEach(audit => {
      const carrier = audit.transportadora || 'Desconhecida';
      if (!summary[carrier]) {
        summary[carrier] = { gains: 0, losses: 0, total_divergence: 0, count: 0 };
      }

      if (audit.divergencia_valor > 0) {
        summary[carrier].losses += Number(audit.divergencia_valor);
      } else {
        summary[carrier].gains += Math.abs(Number(audit.divergencia_valor));
      }
      
      summary[carrier].total_divergence += Number(audit.divergencia_valor);
      summary[carrier].count++;
    });

    return summary;
  }

  /**
   * Lista todas as auditorias com filtros
   */
  async findAll() {
    return await this.auditRepository.find({
      order: { created_at: 'DESC' },
      relations: ['quotation'],
    });
  }

  /**
   * Aprovação manual de uma divergência
   */
  async checkManual(auditId: number, userId: number) {
    const audit = await this.auditRepository.findOne({ where: { id: auditId } });
    if (!audit) throw new NotFoundException('Auditoria não encontrada');

    audit.status = AuditStatus.CONFERIDO;
    audit.data_conferencia = new Date();
    audit.conferidoPorId = userId;

    return await this.auditRepository.save(audit);
  }

  async testSieg() {
    return this.siegService.testConnection();
  }
}
