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

    if (!quotation.nf || quotation.nf.trim() === '' || quotation.nf === '---') {
      this.logger.warn(`Cotação ${quotation.id} sem NF. Registrando auditoria como pendente.`);
      let audit = await this.auditRepository.findOne({ where: { quotationId: quotation.id } });
      if (!audit) {
        audit = this.auditRepository.create({ quotationId: quotation.id });
      }
      audit.nfe_number = '---';
      audit.status = AuditStatus.DIVERGENTE; // Mantemos divergente/pendente para atenção do usuário
      audit.cte_number = 'AGUARDANDO NF';
      audit.valor_frete_cotado = quotation.valor_frete;
      audit.valor_frete_sieg = 0;
      await this.auditRepository.save(audit);
      return audit;
    }

    // Busca dados reais no SIEG (API ou Excel Fallback)
    const siegData = await this.siegService.findCteByNf(quotation.nf, {
      cnpj: quotation.client?.cnpj,
      razaoSocial: quotation.client?.razao_social,
      valor: quotation.valor_frete,
      data: quotation.created_at
    });

    if (!siegData) {
      this.logger.warn(`Conferência pendente: Nenhum CT-e encontrado no SIEG ou Excel para a NF ${quotation.nf}`);
      
      // Em vez de estourar 404 (que gera erro no console), vamos criar/atualizar a auditoria como PENDENTE
      let audit = await this.auditRepository.findOne({ where: { quotationId: quotation.id } });
      if (!audit) {
        audit = this.auditRepository.create({ quotationId: quotation.id });
      }

      audit.nfe_number = quotation.nf || '---';
      audit.status = AuditStatus.DIVERGENTE; // Ou criar um novo status PENDENTE se preferir
      audit.divergencia_valor = 0;
      audit.valor_frete_cotado = quotation.valor_frete;
      audit.valor_frete_sieg = 0;
      audit.transportadora = quotation.transportadora_escolhida;
      audit.cte_number = 'NÃO LOCALIZADO';
      
      await this.auditRepository.save(audit);
      
      return audit;
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
      nfeNumber = '---'; // Mantém explicitamente como pendente se não houver NF
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

  /**
   * Consulta os CT-es no SIEG em um período e cruza com as cotações locais
   */
  async querySiegCtes(cnpjs: string[], startDateStr: string, endDateStr: string): Promise<any[]> {
    try {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      
      // Se a data de fim for igual a início, ajusta para pegar o dia completo
      if (endDateStr && endDateStr.length <= 10) {
        endDate.setHours(23, 59, 59, 999);
      }

      // 1. Obter todos os CT-es do período no SIEG
      const allCtes = await this.siegService.queryAllCtesInPeriod(startDate, endDate);

      // 2. Normalizar os CNPJs para comparação
      const cleanCnpjs = (cnpjs || []).map(c => String(c).replace(/\D/g, '')).filter(c => c.length > 0);

      // 3. Filtrar pelo CNPJ participante se foi informado
      const filteredCtes = allCtes.filter(cte => {
        if (cleanCnpjs.length === 0) return true; // Se não passar CNPJ, traz tudo
        
        const participants = [
          cte.remetente?.cnpj,
          cte.destinatario?.cnpj,
          cte.tomador?.cnpj
        ].filter(Boolean);
        return participants.some(p => cleanCnpjs.includes(p));
      });

      const result: any[] = [];

      // 4. Cruzar cada CT-e com as cotações do banco local
      for (const cte of filteredCtes) {
        try {
          let matchedQuotation: Quotation | null = null;
          let matchedAudit: Audit | null = null;

          // A) Se temos o número de NF-e, tentamos buscar a cotação local por NF-e e CNPJ
          if (cte.nfe_numero && String(cte.nfe_numero).trim().length > 0) {
            // Busca cotação pelo número da NF
            const quotations = await this.quotationRepository.find({
              where: { nf: cte.nfe_numero },
              relations: ['client', 'items']
            });

            // Tenta refinar pelo cliente
            if (quotations.length > 0) {
              matchedQuotation = quotations.find(q => {
                const clientCnpj = String(q.client?.cnpj || '').replace(/\D/g, '');
                return clientCnpj === cte.remetente?.cnpj || clientCnpj === cte.destinatario?.cnpj || clientCnpj === cte.tomador?.cnpj;
              }) || quotations[0];
            }
          }

          // B) Se achou a cotação, verifica se já existe uma auditoria salva no banco
          if (matchedQuotation) {
            matchedAudit = await this.auditRepository.findOne({
              where: { quotationId: matchedQuotation.id }
            });
          }

          // C) Monta os dados consolidados e calcula a auditoria caso não exista no banco
          let status = 'SEM_COTACAO';
          let valorFreteCotado = 0;
          let divergenciaValor = 0;
          let auditId: number | null = null;

          if (matchedQuotation) {
            valorFreteCotado = Number(matchedQuotation.valor_frete || 0);
            divergenciaValor = Number(cte.valor_frete) - valorFreteCotado;

            if (matchedAudit) {
              status = matchedAudit.status;
              auditId = matchedAudit.id;
            } else {
              // Calcula status dinâmico em memória para o frontend
              status = Math.abs(divergenciaValor) <= this.TOLERANCIA_CENTAVOS ? 'OK' : 'DIVERGENTE';
            }
          }

          result.push({
            cte_chave: cte.chave,
            cte_numero: cte.numero_cte,
            data_emissao: cte.data_emissao,
            valor_frete_sieg: cte.valor_frete,
            peso_sieg: cte.peso,
            volumes_sieg: cte.volumes,
            transportadora: cte.emitente?.nome || 'Transportadora Desconhecida',
            transportadora_cnpj: cte.emitente?.cnpj || '',
            remetente: cte.remetente?.nome || 'Remetente Desconhecido',
            remetente_cnpj: cte.remetente?.cnpj || '',
            destinatario: cte.destinatario?.nome || 'Destinatário Desconhecido',
            destinatario_cnpj: cte.destinatario?.cnpj || '',
            tomador: cte.tomador?.nome || 'Tomador Desconhecido',
            tomador_cnpj: cte.tomador?.cnpj || '',
            nfe_numero: cte.nfe_numero,
            nfe_chave: cte.nfe_chave,
            xml_filename: cte.xml_filename,
            xml_content: cte.xml_content,
            // Dados de Cruzamento Local
            status: status,
            audit_id: auditId,
            valor_frete_cotado: valorFreteCotado,
            divergencia_valor: divergenciaValor,
            cotacao: matchedQuotation ? {
              id: matchedQuotation.id,
              numero_pedido_manual: matchedQuotation.numero_pedido_manual,
              cliente: matchedQuotation.client?.razao_social,
              transportadora: matchedQuotation.transportadora_escolhida,
              status: matchedQuotation.status,
              nf: matchedQuotation.nf
            } : null
          });
        } catch (loopError: any) {
          this.logger.error(`Erro ao cruzar CT-e individual do SIEG ${cte.numero_cte}: ${loopError.message}`);
          // Fallback seguro por CT-e
          result.push({
            cte_chave: cte.chave,
            cte_numero: cte.numero_cte,
            data_emissao: cte.data_emissao,
            valor_frete_sieg: cte.valor_frete,
            peso_sieg: cte.peso,
            volumes_sieg: cte.volumes,
            transportadora: cte.emitente?.nome || 'Transportadora Desconhecida',
            transportadora_cnpj: cte.emitente?.cnpj || '',
            remetente: cte.remetente?.nome || 'Remetente Desconhecido',
            remetente_cnpj: cte.remetente?.cnpj || '',
            destinatario: cte.destinatario?.nome || 'Destinatário Desconhecido',
            destinatario_cnpj: cte.destinatario?.cnpj || '',
            tomador: cte.tomador?.nome || 'Tomador Desconhecido',
            tomador_cnpj: cte.tomador?.cnpj || '',
            nfe_numero: cte.nfe_numero,
            nfe_chave: cte.nfe_chave,
            xml_filename: cte.xml_filename,
            xml_content: cte.xml_content,
            status: 'SEM_COTACAO',
            audit_id: null,
            valor_frete_cotado: 0,
            divergencia_valor: 0,
            cotacao: null
          });
        }
      }

      return result;
    } catch (e: any) {
      this.logger.error(`Erro geral no querySiegCtes: ${e.message}`, e.stack);
      throw e;
    }
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
