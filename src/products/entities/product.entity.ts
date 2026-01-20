// src/products/entities/product.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nome: string;

  // CAMPO ANTIGO - Agora podemos considerá-lo opcional ou removê-lo
  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  peso_unitario_kg: number;

  // --- NOVOS CAMPOS ---
  @Column({ type: 'numeric', precision: 10, scale: 2, comment: 'Peso total da caixa em KG' })
  peso_caixa_kg: number;

  @Column({ type: 'integer', comment: 'Quantidade de unidades dentro da caixa' })
  unidades_caixa: number;

  @Column({ type: 'varchar', length: 20, default: 'POTE' })
  categoria: string; // 'POTE' ou 'CAIXA'

  // --- CAMPO EXISTENTE - Continua igual ---
  @Column({ nullable: true })
  medida_cm: string; // Formato "CxLxA" -> "43x31x27"

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  valor_unitario: number; // Este continua sendo o valor por UNIDADE, não por caixa

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

}
