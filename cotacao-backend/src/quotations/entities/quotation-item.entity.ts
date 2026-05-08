import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, type Relation } from 'typeorm';
import { Product } from '../../products/entities/product.entity.js';
import { Quotation } from './quotation.entity.js';

@Entity({ name: 'quotation_items' })
export class QuotationItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Quotation, (quotation: Quotation) => quotation.items) // Tipagem explícita para evitar TS18046
  @JoinColumn({ name: 'quotation_id' })
  quotation!: Relation<Quotation>;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<Product>;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    default: 0,
    comment: 'Quantidade do produto (suporta valores fracionados).',
  })
  quantidade!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 5,
    comment: 'Valor unitário do produto no momento da cotação.',
  })
  valor_unitario_na_cotacao!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    comment: 'Valor total do item (quantidade * valor unitário).',
  })
  valor_total_item!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    comment: 'Valor base do item (sem IPI).',
  })
  valor_base_item!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    comment: 'Valor do IPI calculado para este item.',
  })
  valor_ipi_item!: number;
}