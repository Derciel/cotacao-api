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
      relations: ['client', 'items'],
    });

    if (!quotation) {
      throw new NotFoundException('Cotação não encontrada.');
    }

    if (!quotation.nf) {
      throw new BadRequestException('Esta cotação não possui número de NF associado para auditoria.');
    }

    // Busca dados reais no SIEG (API ou Excel Fallback)
    const siegData = await this.siegService.findCteByNf(quotation.nf, {
      cnpj: quotation.client?.cnpj,
      razaoSocial: quotation.client?.razao_social,
      valor: quotation.valor_frete,
      data: quotation.created_at
    });

    if (!siegData) {
      this.logger.warn(`Conferência abortada: Nenhum CT-e encontrado no SIEG ou Excel para a NF ${quotation.nf}`);
      throw new NotFoundException(`Não foi possível localizar o CT-e correspondente (API/Excel) para a NF ${quotation.nf}. Verifique se o documento está nas planilhas enviadas.`);
    }

    const actualFreight = Number(siegData.valor_frete);
    const actualWeight = Number(siegData.peso);
    const actualVolumes = Number(siegData.volumes);

    const diff = actualFreight - Number(quotation.valor_frete);
    
    let status = AuditStatus.OK;
    if (diff > this.TOLERANCIA_CENTAVOS) {
      status = AuditStatus.DIVERGENTE;
    }

    // Tentar encontrar auditoria existente para esta cotação
    let audit = await this.auditRepository.findOne({ where: { quotationId: quotation.id } });

    if (!audit) {
      audit = this.auditRepository.create({
        quotationId: quotation.id,
      });
    }

    // Normalização do número da NF para exibição como referência
    let nfeNumber = quotation.nf;
    if (!nfeNumber || nfeNumber.trim() === '' || nfeNumber === '---') {
      // Se não tem NF oficial, tenta usar o número do pedido manual como fallback para busca
      nfeNumber = quotation.numero_pedido_manual;
    }

    if (!nfeNumber || nfeNumber === '---') {
      // Último recurso: extrair da chave do CT-e se o SIEG retornou algo
      if (siegData.numero_cte && siegData.numero_cte.length === 44) {
        nfeNumber = siegData.numero_cte.substring(25, 34).replace(/^0+/, '');
      }
    }

    // Atualiza todos os campos
    audit.nfe_number = nfeNumber && nfeNumber !== '---' ? nfeNumber : (quotation.nf || '---');
    audit.cte_number = siegData?.numero_cte || 'CTE-SIMULADO';
    audit.valor_frete_cotado = quotation.valor_frete;
    audit.valor_frete_sieg = actualFreight;
    audit.peso_cotado = 100; // Poderia ser calculado dos itens
    audit.peso_sieg = actualWeight;
    audit.volumes_cotados = 1;
    audit.volumes_sieg = actualVolumes;
    audit.divergencia_valor = diff;
    audit.status = status;
    audit.transportadora = quotation.transportadora_escolhida;
    audit.xml_content = siegData.xml_content || audit.xml_content; // Preserva se o novo for nulo
    audit.xml_filename = siegData.xml_filename || audit.xml_filename;

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
    const audits = await this.auditRepository.find({
      order: { created_at: 'DESC' },
      relations: ['quotation'],
    });

    // Filtra para mostrar apenas a auditoria mais recente por cotação (evita repetições visuais)
    const uniqueAudits = new Map<number, Audit>();
    for (const audit of audits) {
      if (!uniqueAudits.has(audit.quotationId)) {
        uniqueAudits.set(audit.quotationId, audit);
      }
    }

    return Array.from(uniqueAudits.values());
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

  async getXmlContent(auditId: number) {
    const audit = await this.auditRepository.findOne({ where: { id: auditId } });
    if (!audit || !audit.xml_content) {
      throw new NotFoundException('XML não encontrado para esta auditoria.');
    }
    return {
      xml: audit.xml_content,
      filename: audit.xml_filename || `audit_${auditId}.xml`
    };
  }
}
