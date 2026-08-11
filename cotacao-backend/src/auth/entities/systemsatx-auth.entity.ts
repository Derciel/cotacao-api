import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiKey } from './api-key.entity.js';
import { User } from './user.entity.js';

/**
 * Representa as credenciais de acesso ao Systemsatx
 * Esta entidade armazena as credenciais de login que são usadas para obter a API key
 */
@Entity({ name: 'systemsatx_auth' })
export class SystemsatxAuth {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    email!: string;

    @Column()
    password!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ name: 'api_key_id' })
    apiKeyId!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}