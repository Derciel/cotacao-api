import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {
        // Cria usuário admin inicial se não existir
        this.createInitialAdmin();
    }

    async createInitialAdmin() {
        const admin = await this.userRepository.findOne({ where: { role: UserRole.ADMIN } });
        if (!admin) {
            const username = this.configService.get<string>('INITIAL_ADMIN_USER') || 'admin';
            const password = this.configService.get<string>('INITIAL_ADMIN_PASS') || 'admin123';

            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = this.userRepository.create({
                username: username,
                password: hashedPassword,
                role: UserRole.ADMIN,
                permissions: ['/', '/nova-cotacao', '/historico', '/relatorios', '/usuarios']
            });
            await this.userRepository.save(newUser);
            // Removido log de senha por segurança
        }
    }

    async validateUser(username: string, pass: string): Promise<any> {
        const user = await this.userRepository.findOne({ where: { username } });
        if (user && await bcrypt.compare(pass, user.password)) {
            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        const payload = { username: user.username, sub: user.id, role: user.role };

        // Garante que permissions seja um array, corrigindo possíveis erros de persistência simple-json
        let permissions = user.permissions;
        if (typeof permissions === 'string') {
            try {
                permissions = JSON.parse(permissions);
            } catch (e) {
                console.error('Erro ao fazer parse das permissões:', e);
                permissions = [];
            }
        }

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: Array.isArray(permissions) ? permissions : []
            }
        };
    }
}
