import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity.js';
import { Quotation } from './quotation.entity';

/**
 * @Entity
 * Representa um único item de linha dentro de uma Cotação.
 */
@Entity({ name: 'quotation_items' })
export class QuotationItem {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Relacionamento Many-to-One: Muitos itens pertencem a uma cotação.
   */
  @ManyToOne(() => Quotation, (quotation) => quotation.items)
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  /**
   * Relacionamento Many-to-One: Muitos itens podem se referir ao mesmo produto.
   */
  @ManyToOne(() => Product, { eager: true }) // eager: true carrega o produto automaticamente
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  quantidade: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    comment: 'Valor unitário do produto no momento da cotação.',
  })
  valor_unitario_na_cotacao: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    comment: 'Valor total do item (quantidade * valor unitário).',
  })
  valor_total_item: number;
}