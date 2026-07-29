import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { User } from './entities/user.entity.js';
import { ApiKey } from './entities/api-key.entity.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([User, ApiKey]),
        PassportModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'secretKey',
                signOptions: { expiresIn: '1d' },
            }),
        }),
    ],
    providers: [AuthService, JwtStrategy, ApiKeyGuard],
    controllers: [AuthController, ApiKeysController],
    exports: [AuthService, PassportModule, JwtModule, TypeOrmModule, ApiKeyGuard],
})
export class AuthModule { }
