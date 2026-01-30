import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { InjectRepository } from '@nestjs/typeorm';
import { Quotation } from '../quotations/entities/quotation.entity.js';
import { Repository, MoreThanOrEqual } from 'typeorm';

@Injectable()
export class AiService {
    private genAI: GoogleGenerativeAI;

    constructor(
        private configService: ConfigService,
        @InjectRepository(Quotation)
        private quotationRepository: Repository<Quotation>,
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    async getInsights() {
        // Coleta alguns dados para dar contexto
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let quotationsToday: Quotation[];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const recentQuotations = await this.quotationRepository.find({
            where: { created_at: MoreThanOrEqual(sevenDaysAgo) },
            order: { created_at: 'DESC' },
            take: 20,
            relations: ['client']
        });

        const totalValue = recentQuotations.reduce((acc, q) => acc + Number(q.valor_total_nota || 0), 0);
        const approvedCount = recentQuotations.filter(q => q.status === 'APROVADO').length;
        const pendingCount = recentQuotations.filter(q => q.status === 'PENDENTE').length;

        if (!this.genAI) {
            return this.generateDynamicFallback(recentQuotations, totalValue, approvedCount, pendingCount);
        }

        try {
            const timeFrameDescription = 'dos últimos 7 dias';
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            const prompt = `Você é um consultor logístico especialista da Nicopel Cargo.
      Analise os dados das últimas 20 cotações (${timeFrameDescription}) e forneça 3 insights curtos (máximo 120 chars cada).
      
      Métricas Consolidadas:
      - Total de Cotações Analisadas: ${recentQuotations.length}
      - Valor Bruto em Negociação: R$ ${totalValue.toFixed(2)}
      - Taxa de Conversão Atual: ${recentQuotations.length > 0 ? Math.round((approvedCount / recentQuotations.length) * 100) : 0}%
      - Cotações Pendentes: ${pendingCount}

      Lista para Análise:
      ${JSON.stringify(recentQuotations.map(q => ({
                cliente: q.client?.fantasia || q.client?.razao_social,
                valor: q.valor_total_nota,
                status: q.status,
                transportadora: q.transportadora_escolhida
            })))}

      Retorne APENAS um JSON no formato: { "insights": [ { "type": "Oportunidade/Dica/Alerta", "text": "..." } ] }`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const cleanJson = text.replace(/```json|```/gi, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error('Erro ao gerar insights com Gemini:', error);
            return this.generateDynamicFallback(recentQuotations, totalValue, approvedCount, pendingCount);
        }
    }

    private generateDynamicFallback(recent: Quotation[], totalValue: number, approved: number, pending: number) {
        const insights = [];

        if (pending > 0) {
            insights.push({
                type: 'Alerta',
                text: `Existem ${pending} cotações aguardando finalização. Conclua hoje para evitar atrasos na coleta.`
            });
        }

        if (recent.length > 0) {
            const conversion = Math.round((approved / recent.length) * 100);
            insights.push({
                type: 'Oportunidade',
                text: `Sua taxa de conversão na última semana foi de ${conversion}%. Considere renegociar fretes para bater a meta de 80%.`
            });
        }

        if (totalValue > 5000) {
            insights.push({
                type: 'Dica',
                text: `Volume negociado de R$ ${totalValue.toLocaleString('pt-BR')} justifica a solicitação de uma tabela spot com as principais transportadoras.`
            });
        } else {
            insights.push({
                type: 'Dica',
                text: 'Consolidar mais itens em uma única cotação pode reduzir o valor do frete mínimo em até 20%.'
            });
        }

        // Garantir que sempre tenha ao menos 2
        if (insights.length < 2) {
            insights.push({ type: 'Dica', text: 'Mantenha o cadastro de clientes sempre atualizado para agilizar a emissão de minutas.' });
        }

        return { insights: insights.slice(0, 3) };
    }
}
