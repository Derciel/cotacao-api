import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity.js';
import { Quotation } from './quotation.entity.js';

@Entity({ name: 'quotation_items' })
export class QuotationItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Quotation, (quotation: Quotation) => quotation.items) // Tipagem explícita para evitar TS18046
  @JoinColumn({ name: 'quotation_id' })
  quotation!: Quotation;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column()
  quantidade!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    comment: 'Valor unitário do produto no momento da cotação.',
  })
  valor_unitario_na_cotacao!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    comment: 'Valor total do item (quantidade * valor unitário).',
  })
  valor_total_item!: number;
}