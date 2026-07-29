import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        @InjectRepository(ApiKey)
        private readonly apiKeyRepository: Repository<ApiKey>,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        
        // Verifica a chave no header ou na query string (para consumo no Excel)
        const key = request.headers['x-api-key'] || request.query.apiKey;

        if (!key) {
            throw new UnauthorizedException('Chave de API não informada.');
        }

        const apiKey = await this.apiKeyRepository.findOne({
            where: { key: String(key), isActive: true },
            relations: ['user'],
        });

        if (!apiKey) {
            throw new UnauthorizedException('Chave de API inválida.');
        }

        // Verifica a expiração
        if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
            throw new UnauthorizedException('Esta chave de API expirou.');
        }

        // Injeta os dados do usuário e o escopo da chave no request
        request.user = {
            userId: apiKey.user.id,
            username: apiKey.user.username,
            role: apiKey.user.role,
            permissions: apiKey.user.permissions || [],
            apiKeyRole: apiKey.role, // READ_ONLY ou FULL_ACCESS
        };

        return true;
    }
}
