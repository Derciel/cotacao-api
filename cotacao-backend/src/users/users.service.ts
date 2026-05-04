import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    async findAll() {
        return this.userRepository.find({
            select: ['id', 'username', 'role', 'permissions'],
        });
    }

    async create(userData: any) {
        // Se o ID vier vazio do frontend, removemos para o TypeORM gerar um novo
        if (userData.id === '' || userData.id === null) {
            delete userData.id;
        }

        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const newUser = this.userRepository.create({
            ...userData,
            password: hashedPassword,
        });
        return this.userRepository.save(newUser);
    }

    async update(id: number, updateData: any) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException('Usuário não encontrado');
        }

        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        } else {
            delete updateData.password;
        }

        delete updateData.id; // Garante que não tentamos alterar o ID

        Object.assign(user, updateData);
        return this.userRepository.save(user);
    }
}
