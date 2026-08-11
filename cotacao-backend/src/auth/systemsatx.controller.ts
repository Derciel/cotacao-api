import { Controller, Post, Body, UseGuards, Get, Param, Delete, Req, NotFoundException, ConflictException } from '@nestjs/common';
import { SystemsatxAuthService } from './services/systemsatx-auth.service.js';
import { ConfigureSystemsatxDto } from './dto/systemsatx.dto.js';
import { ConfigureSystemsatxResponseDto } from './dto/systemsatx.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { UserRole } from './entities/user.entity.js';

@ApiTags('Systemsatx')
@Controller('api/systemsatx')
export class SystemsatxController {
    constructor(private readonly systemsatxAuthService: SystemsatxAuthService) {}

    /**
     * Configura a integração com o Systemsatx
     * Endpoint para autenticação e obtenção da API key
     */
    @Post('configurar')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Configura integração com Systemsatx usando email e senha' })
    @ApiBody({ type: ConfigureSystemsatxDto })
    @ApiResponse({ status: 200, description: 'Integração configurada com sucesso', type: ConfigureSystemsatxResponseDto })
    @ApiResponse({ status: 400, description: 'Dados inválidos' })
    @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
    @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
    async configure(
        @Body() dto: ConfigureSystemsatxDto,
        @Req() req: any,
    ): Promise<ConfigureSystemsatxResponseDto> {
        // Autentica no Systemsatx
        const result = await this.systemsatxAuthService.authenticate(dto.email, dto.password);

        // Resposta de sucesso
        return {
            apiKey: result.apiKey,
            expiresAt: result.expiresAt,
            message: 'Integração com Systemsatx configurada com sucesso',
        };
    }

    /**
     * Busca a configuração atual do usuário
     */
    @Get('configuracao')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Recupera configuração atual da integração Systemsatx' })
    @ApiResponse({ status: 200, description: 'Configuração encontrada' })
    @ApiResponse({ status: 404, description: 'Configuração não encontrada' })
    async getConfiguration(@Req() req: any) {
        const userId = req.user.userId;
        const apiKey = await this.systemsatxAuthService.getApiKey(userId);

        if (!apiKey) {
            throw new NotFoundException('Integração com Systemsatx não configurada');
        }

        return {
            apiKeyId: apiKey.id,
            name: apiKey.name,
            role: apiKey.role,
            expiresAt: apiKey.expiresAt,
            isActive: apiKey.isActive,
            createdAt: apiKey.createdAt,
            updatedAt: apiKey.updatedAt,
        };
    }

    /**
     * Remove a configuração atual do usuário
     */
    @Delete('configuracao')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Remove configuração da integração Systemsatx' })
    @ApiResponse({ status: 200, description: 'Configuração removida com sucesso' })
    @ApiResponse({ status: 404, description: 'Configuração não encontrada' })
    async removeConfiguration(@Req() req: any) {
        const userId = req.user.userId;
        const apiKey = await this.systemsatxAuthService.getApiKey(userId);

        if (!apiKey) {
            throw new NotFoundException('Integração com Systemsatx não configurada');
        }

        // Remove a chave de API
        await this.systemsatxAuthService['apiKeyRepository'].remove(apiKey);

        return { message: 'Integração com Systemsatx removida com sucesso' };
    }
}