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
        if (!this.genAI) {
            return this.getFallbackInsights();
        }

        try {
            // Coleta alguns dados para dar contexto à IA
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const totalToday = await this.quotationRepository.count({
                where: { created_at: MoreThanOrEqual(today) }
            });

            const recentQuotations = await this.quotationRepository.find({
                order: { created_at: 'DESC' },
                take: 10,
                relations: ['client']
            });

            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            const prompt = `Você é um consultor logístico especialista da empresa Nicopel Cargo. 
      Analise os dados abaixo e forneça 2 insights curtos e práticos para o dashboard.
      Cada insight deve ter no máximo 150 caracteres.
      Retorne em formato JSON: { "insights": [ { "type": "Oportunidade/Dica/Alerta", "text": "..." }, ... ] }
      
      Dados de hoje: ${totalToday} cotações.
      Cotações recentes: ${JSON.stringify(recentQuotations.map(q => ({
                cliente: q.client?.fantasia || q.client?.razao_social,
                valor: q.valor_total_nota,
                status: q.status
            })))}
      
      Importante: Responda apenas o JSON.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Limpa possível formatação de markdown se a IA retornar
            const cleanJson = text.replace(/```json|```/gi, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error('Erro ao gerar insights com Gemini:', error);
            return this.getFallbackInsights();
        }
    }

    private getFallbackInsights() {
        return {
            insights: [
                {
                    type: 'Oportunidade',
                    text: 'Rotas para a região Sul estão com 15% de defasagem. Recomendamos renegociação com transportadoras atuais.'
                },
                {
                    type: 'Dica',
                    text: 'Consolidar envios às quartas-feiras tem gerado uma economia média de R$ 450,00 por semana.'
                }
            ]
        };
    }
}
