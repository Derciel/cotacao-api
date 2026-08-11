import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { SystemsatxAuth } from '../entities/systemsatx-auth.entity.js';
import { User } from '../entities/user.entity.js';
import { ApiKey } from '../entities/api-key.entity.js';
import { ApiKeyRole } from '../entities/api-key.entity.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SystemsatxAuthService {
    constructor(
        @InjectRepository(SystemsatxAuth)
        private readonly systemsatxAuthRepo: Repository<SystemsatxAuth>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(ApiKey)
        private readonly apiKeyRepository: Repository<ApiKey>,
        private readonly configService: ConfigService,
    ) {}

    /**
     * Autentica o usuário no Systemsatx e retorna a API key
     * @param email - Email do usuário
     * @param password - Senha do usuário
     * @returns API key se autenticação for bem-sucedida
     * @throws UnauthorizedException - Se credenciais forem inválidas
     * @throws BadRequestException - Se houver erro de rede ou Systemsatx retornar erro
     */
    async authenticate(email: string, password: string): Promise<{ apiKey: string; expiresAt: Date }> {
        // Verifica se o usuário existe no nosso sistema (o login usa username,
        // que costuma ser o e-mail do usuário)
        const user = await this.userRepository.findOne({
            where: { username: email }
        });
        if (!user) {
            throw new UnauthorizedException('Credenciais inválidas');
        }

        // Autentica no Systemsatx
        try {
            const authData = {
                email: email,
                password: password,
            };

            // Configuração da API do Systemsatx
            const response = await fetch('https://api.systemsatx.com/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(authData),
            });

            if (!response.ok) {
                // Handle HTTP error statuses
                if (response.status === 401 || response.status === 403) {
                    throw new UnauthorizedException('Credenciais inválidas');
                }
                if (response.status === 408) {
                    throw new BadRequestException('Timeout na comunicação com Systemsatx');
                }
                if (response.status >= 500) {
                    throw new BadRequestException('Erro de comunicação com Systemsatx');
                }
                throw new BadRequestException(`Erro HTTP ${response.status} ao comunicar com Systemsatx`);
            }

            const authResponse = await response.json();

            if (!authResponse.api_key) {
                throw new UnauthorizedException('Falha na autenticação no Systemsatx');
            }

            // Gera uma API key aleatória para armazenamento
            const apiKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;

            // Calcula validade (1 ano)
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            // Verifica se já existe uma chave para este usuário
            const existingKey = await this.apiKeyRepository.findOne({
                where: { userId: user.id }
            });

            if (existingKey) {
                await this.apiKeyRepository.remove(existingKey);
            }

            // Cria nova chave
            const newKey = this.apiKeyRepository.create({
                key: apiKey,
                name: `Systemsatx Integration - ${user.username}`,
                userId: user.id,
                role: ApiKeyRole.FULL_ACCESS,
                expiresAt: expiresAt,
                isActive: true,
            });

            await this.apiKeyRepository.save(newKey);

            // Atualiza ou cria registro de autenticação no Systemsatx
            let systemsatxAuth = await this.systemsatxAuthRepo.findOne({
                where: { userId: user.id }
            });

            if (!systemsatxAuth) {
                systemsatxAuth = this.systemsatxAuthRepo.create({
                    email: email,
                    password: password,
                    userId: user.id,
                });
            } else {
                systemsatxAuth.email = email;
                systemsatxAuth.password = password;
            }

            systemsatxAuth.apiKeyId = newKey.id;
            await this.systemsatxAuthRepo.save(systemsatxAuth);

            return {
                apiKey: apiKey,
                expiresAt: expiresAt,
            };
        } catch (error: any) {
            // Re-throw our custom exceptions
            if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }

            // Handle network errors and other unexpected errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new BadRequestException('Erro de comunicação com Systemsatx');
            }

            // Qualquer outro erro
            throw new UnauthorizedException('Falha na autenticação');
        }
    }

    /**
     * Busca a chave de API armazenada para um usuário
     * @param userId - ID do usuário
     * @returns API key ou null se não existir
     */
    async getApiKey(userId: number): Promise<ApiKey | null> {
        return this.apiKeyRepository.findOne({
            where: { userId: userId },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Verifica se a chave de API está válida (ativa e não expirada)
     * @param apiKeyId - ID da chave de API
     * @returns boolean indicando se a chave é válida
     */
    async isApiKeyValid(apiKeyId: number): Promise<boolean> {
        const apiKey = await this.apiKeyRepository.findOne({
            where: { id: apiKeyId },
        });

        if (!apiKey) {
            return false;
        }

        if (!apiKey.isActive) {
            return false;
        }

        if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
            return false;
        }

        return true;
    }
}