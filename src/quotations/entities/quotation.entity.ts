import { Client } from '../../clients/entities/client.entity.js';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { QuotationItem } from './quotation-item.entity.js';
import { ApiProperty } from '@nestjs/swagger';

export enum EmpresaFaturamento {
  NICOPEL = 'NICOPEL',
  L_LOG = 'L_LOG',
  FLEXOBOX = 'FLEXOBOX',
}

export enum QuotationStatus {
  PENDENTE = 'PENDENTE',
  APROVADO = 'APROVADO',
  ENVIADO = 'ENVIADO',
  CANCELADO = 'CANCELADO',
}

@Entity({ name: 'quotations' })
export class Quotation {
  @PrimaryGeneratedColumn()
  id!: number; // Adicionado '!' para erro TS2564

  @ApiProperty({ description: 'Número do pedido/cotação definido manualmente pelo usuário', required: false, example: 'COT-2025-001' })
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    unique: true,
    comment: 'Número do pedido/cotação definido manualmente pelo usuário',
  })
  numero_pedido_manual!: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @OneToMany(() => QuotationItem, (item) => item.quotation, {
    cascade: true,
  })
  items!: QuotationItem[];

  @Column({ type: 'date' })
  data_cotacao!: Date;

  @Column({ nullable: true })
  prazo_pagamento!: string;

  @Column({ type: 'integer', nullable: true })
  dias_para_entrega!: number | null

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  valor_total_produtos!: number;

  @Column({ nullable: true })
  transportadora_escolhida!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  valor_frete!: number;

  @Column({ nullable: true })
  tipo_frete!: string;

  @Column({ type: 'text', nullable: true })
  obs!: string;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    default: QuotationStatus.PENDENTE,
  })
  status!: QuotationStatus;

  @Column({
    type: 'enum',
    enum: EmpresaFaturamento,
    default: EmpresaFaturamento.NICOPEL,
  })
  empresa_faturamento!: EmpresaFaturamento;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  percentual_ipi!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  valor_ipi!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  valor_total_nota!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}