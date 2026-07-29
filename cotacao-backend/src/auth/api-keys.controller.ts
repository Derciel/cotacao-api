import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey, ApiKeyRole } from './entities/api-key.entity.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { UserRole } from './entities/user.entity.js';
import * as crypto from 'crypto';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
    constructor(
        @InjectRepository(ApiKey)
        private readonly apiKeyRepository: Repository<ApiKey>,
    ) {}

    @Get()
    async findAll(@Req() req: any) {
        // Se for admin, pode ver todas. Se não, apenas as suas.
        if (req.user.role === UserRole.ADMIN) {
            return this.apiKeyRepository.find({
                relations: ['user'],
                order: { createdAt: 'DESC' }
            });
        }
        return this.apiKeyRepository.find({
            where: { userId: req.user.userId },
            order: { createdAt: 'DESC' }
        });
    }

    @Post()
    async create(@Body() body: { name: string; expiresDays: number; role?: ApiKeyRole }, @Req() req: any) {
        const key = `np_live_${crypto.randomBytes(24).toString('hex')}`;
        
        let targetRole = ApiKeyRole.READ_ONLY;
        // Apenas Admin pode criar chaves FULL_ACCESS
        if (body.role === ApiKeyRole.FULL_ACCESS && req.user.role === UserRole.ADMIN) {
            targetRole = ApiKeyRole.FULL_ACCESS;
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (body.expiresDays || 30));

        const apiKey = this.apiKeyRepository.create({
            key,
            name: body.name,
            userId: req.user.userId,
            role: targetRole,
            expiresAt,
        });

        const saved = await this.apiKeyRepository.save(apiKey);
        return {
            ...saved,
            rawKey: key, // Retorna a chave gerada de forma limpa uma única vez
        };
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Req() req: any) {
        const key = await this.apiKeyRepository.findOne({ where: { id: +id } });
        if (!key) {
            throw new ForbiddenException('Chave não encontrada.');
        }

        // Apenas o dono ou um admin pode deletar
        if (key.userId !== req.user.userId && req.user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Sem permissão para deletar esta chave.');
        }

        await this.apiKeyRepository.remove(key);
        return { success: true };
    }
}
