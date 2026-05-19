import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('region_deadlines')
@Index(['cidade', 'uf', 'carrier'], { unique: true })
export class RegionDeadline {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cidade: string;

  @Column()
  uf: string;

  @Column({ nullable: true })
  cep_prefix: string; // Guarda os primeiros 5 dígitos do CEP (ex: "14800") para referência

  @Column()
  carrier: string;

  @Column()
  deadline: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
