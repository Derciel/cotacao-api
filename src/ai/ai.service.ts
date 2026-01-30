import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { InjectRepository } from '@nestjs/typeorm';
import { Quotation, QuotationStatus } from '../quotations/entities/quotation.entity.js';
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
        const approvedCount = recentQuotations.filter(q => q.status === QuotationStatus.APROVADO).length;
        const pendingCount = recentQuotations.filter(q => q.status === QuotationStatus.PENDENTE).length;

        // Análise por transportadora
        const carrierMap = new Map<string, { count: number, value: number }>();
        recentQuotations.filter(q => q.status === QuotationStatus.APROVADO || q.status === QuotationStatus.ENVIADO).forEach(q => {
            const name = q.transportadora_escolhida || 'Manual/Outros';
            const cur = carrierMap.get(name) || { count: 0, value: 0 };
            carrierMap.set(name, { count: cur.count + 1, value: cur.value + Number(q.valor_total_nota || 0) });
        });
        const carrierMetrics = Array.from(carrierMap.entries()).map(([name, data]) => ({
            name,
            count: data.count,
            value: data.value
        }));

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
      Métricas por Transportadora (7 dias):
      ${JSON.stringify(carrierMetrics)}

      Retorne APENAS um JSON no formato: { 
        "insights": [ { "type": "Oportunidade/Dica/Alerta", "text": "..." } ],
        "carrierMetrics": [ { "name": "...", "value": 0, "count": 0 } ]
      }`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const cleanJson = text.replace(/```json|```/gi, '').trim();
            const aiResponse = JSON.parse(cleanJson);

            // Garantir que os dados de métricas reais sejam retornados se a IA não retornar ou para consistência
            return {
                insights: aiResponse.insights,
                carrierMetrics: carrierMetrics.length > 0 ? carrierMetrics : (aiResponse.carrierMetrics || [])
            };
        } catch (error) {
            console.error('Erro ao gerar insights com Gemini:', error);
            const fallback = this.generateDynamicFallback(recentQuotations, totalValue, approvedCount, pendingCount);
            return { ...fallback, carrierMetrics };
        }
    }

    private generateDynamicFallback(recent: Quotation[], totalValue: number, approved: number, pending: number) {
        const insights: any[] = [];

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
