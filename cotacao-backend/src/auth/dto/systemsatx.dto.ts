import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para configuração de integração com Systemsatx
 * Recebe email e senha para autenticação na API do Systemsatx
 */
export class ConfigureSystemsatxDto {
    @ApiProperty({
        description: 'Email de acesso ao Systemsatx',
        example: 'usuario@empresa.com',
    })
    @IsEmail({}, { message: 'Email deve ter um formato válido' })
    @IsNotEmpty({ message: 'Email é obrigatório' })
    email!: string;

    @ApiProperty({
        description: 'Senha de acesso ao Systemsatx',
        example: 'minhasenha123',
        minLength: 6,
        maxLength: 50,
    })
    @IsString({ message: 'Senha deve ser uma string' })
    @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
    @MaxLength(50, { message: 'Senha deve ter no máximo 50 caracteres' })
    @IsNotEmpty({ message: 'Senha é obrigatória' })
    password!: string;
}

/**
 * DTO de resposta para a configuração do Systemsatx
 */
export class ConfigureSystemsatxResponseDto {
    @ApiProperty({
        description: 'Chave de API gerada pelo Systemsatx',
        example: 'sk_live_abc123def456',
    })
    apiKey!: string;

    @ApiProperty({
        description: 'Data de expiração da chave de API',
        example: '2026-12-31T23:59:59.000Z',
    })
    expiresAt!: Date;

    @ApiProperty({
        description: 'Mensagem de sucesso',
        example: 'Integração com Systemsatx configurada com sucesso',
    })
    message!: string;
}