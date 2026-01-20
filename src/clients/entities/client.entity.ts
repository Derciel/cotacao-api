import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

@Entity('clients')
// Define que a combinação de CNPJ + Empresa é única
@Index(['cnpj', 'empresa_faturamento'], { unique: true })
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  razao_social: string;

  @Column({ nullable: true })
  fantasia: string;

  @Column()
  cnpj: string;

  @Column()
  cep: string;

  @Column()
  cidade: string;

  @Column()
  estado: string;

  @Column()
  empresa_faturamento: string;

  @CreateDateColumn()
  createdAt: Date;
}