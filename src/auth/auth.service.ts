import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
    ) {
        // Cria usuário admin inicial se não existir
        this.createInitialAdmin();
    }

    async createInitialAdmin() {
        const admin = await this.userRepository.findOne({ where: { role: UserRole.ADMIN } });
        if (!admin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const newUser = this.userRepository.create({
                username: 'admin',
                password: hashedPassword,
                role: UserRole.ADMIN,
                permissions: ['/', '/nova-cotacao', '/historico', '/relatorios', '/usuarios']
            });
            await this.userRepository.save(newUser);
            console.log('Usuário administrador inicial criado: admin / admin123');
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
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions || []
            }
        };
    }
}
