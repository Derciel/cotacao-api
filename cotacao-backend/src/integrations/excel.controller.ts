import { Controller, Get, UseGuards, Res, Query, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeyGuard } from '../auth/guards/api-key.guard.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quotation } from '../quotations/entities/quotation.entity.js';

@Controller('integration/excel')
@UseGuards(ApiKeyGuard)
export class ExcelController {
    constructor(
        @InjectRepository(Quotation)
        private readonly quotationsRepository: Repository<Quotation>,
    ) {}

    @Get('quotations')
    async getQuotationsForExcel(@Res() res: Response, @Query('limit') limit?: string) {
        const queryLimit = limit ? +limit : 500;

        // Busca as cotações com os relacionamentos básicos
        const quotations = await this.quotationsRepository.find({
            relations: ['client', 'items', 'user'],
            order: { created_at: 'DESC' },
            take: queryLimit,
        });

        // Transforma os dados em linhas achatadas para formato de planilha (CSV)
        let csvContent = 'ID Cotacao;Numero Pedido;Data Cotacao;Cliente;CNPJ;Destino CEP;Cidade;Estado;Valor Produtos;Valor Frete;Total Nota;Status;Usuario Vendedor;Itens Detalhes\n';
        
        for (const q of quotations) {
            const clientName = q.client?.razao_social?.replace(/;/g, ',') || '';
            const cnpj = q.client?.cnpj || '';
            const status = q.status || '';
            const username = q.user?.username || '';
            const itemSummary = q.items?.map(i => `${i.quantidade}x ${i.product?.nome || 'Produto'}`).join(' | ').replace(/;/g, ',') || '';

            csvContent += `${q.id};${q.numero_pedido_manual || ''};${q.data_cotacao || ''};${clientName};${cnpj};${q.destino_cep || ''};${q.client?.cidade || ''};${q.client?.estado || ''};${q.valor_total_produtos};${q.valor_frete || 0};${q.valor_total_nota || 0};${status};${username};${itemSummary}\n`;
        }

        // Define os headers apropriados para download do Excel no formato CSV delimitado por ponto e vírgula com UTF-8 BOM
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=cotacoes_integracao.csv');
        
        // Escreve o BOM UTF-8 para o Excel abrir acentos perfeitamente
        res.write(Buffer.from('\uFEFF'));
        res.write(csvContent);
        res.end();
    }
}
