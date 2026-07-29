import { Resolver, Query, Args, Int, Mutation, Context } from '@nestjs/graphql';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard.js';
import { ApiKeyRole } from '../auth/entities/api-key.entity.js';
import { QuotationType } from './types/integration.types.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quotation, QuotationStatus } from '../quotations/entities/quotation.entity.js';

@Resolver(() => QuotationType)
@UseGuards(ApiKeyGuard)
export class IntegrationResolver {
    constructor(
        @InjectRepository(Quotation)
        private readonly quotationsRepository: Repository<Quotation>,
    ) {}

    @Query(() => [QuotationType])
    async externalQuotations(
        @Args('limit', { type: () => Int, defaultValue: 50 }) limit: number,
        @Context() context: any
    ) {
        // O ApiKeyGuard injeta os dados do usuário no request express do GraphQL context
        const req = context.req;
        return this.quotationsRepository.find({
            relations: ['client', 'items', 'user'],
            order: { created_at: 'DESC' },
            take: limit,
        });
    }

    @Query(() => QuotationType, { nullable: true })
    async externalQuotation(
        @Args('id', { type: () => Int }) id: number
    ) {
        return this.quotationsRepository.findOne({
            where: { id },
            relations: ['client', 'items', 'user'],
        });
    }

    @Mutation(() => QuotationType)
    async updateExternalQuotationStatus(
        @Args('id', { type: () => Int }) id: number,
        @Args('status') status: string,
        @Context() context: any
    ) {
        const req = context.req;
        
        // Bloqueia escrita se a chave for READ_ONLY
        if (req.user.apiKeyRole === ApiKeyRole.READ_ONLY) {
            throw new ForbiddenException('Sua chave de API possui acesso de apenas leitura (READ_ONLY).');
        }

        const quotation = await this.quotationsRepository.findOne({ where: { id } });
        if (!quotation) {
            throw new Error('Cotação não encontrada.');
        }

        quotation.status = status as QuotationStatus;
        return this.quotationsRepository.save(quotation);
    }
}
