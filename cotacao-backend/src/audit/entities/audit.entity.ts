import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, type Relation } from 'typeorm';
import { Quotation } from '../../quotations/entities/quotation.entity.js';
import { User } from '../../auth/entities/user.entity.js';

export enum AuditStatus {
  OK = 'OK',
  DIVERGENTE = 'DIVERGENTE',
  CONFERIDO = 'CONFERIDO',
}

@Entity({ name: 'audits' })
export class Audit {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Quotation)
  @JoinColumn({ name: 'quotation_id' })
  quotation!: Relation<Quotation>;

  @Column({ name: 'quotation_id' })
  quotationId!: number;

  @Column({ nullable: true })
  nfe_number!: string;

  @Column({ nullable: true })
  cte_number!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  valor_frete_cotado!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  valor_frete_sieg!: number;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  peso_cotado!: number;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  peso_sieg!: number;

  @Column({ type: 'integer', nullable: true })
  volumes_cotados!: number;

  @Column({ type: 'integer', nullable: true })
  volumes_sieg!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  divergencia_valor!: number;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.OK,
  })
  status!: AuditStatus;

  @Column({ nullable: true })
  transportadora!: string;

  @Column({ type: 'timestamp', nullable: true })
  data_conferencia!: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'conferido_por_id' })
  conferido_por!: Relation<User>;

  @Column({ name: 'conferido_por_id', nullable: true })
  conferidoPorId!: number;

  @CreateDateColumn()
  created_at!: Date;
}
