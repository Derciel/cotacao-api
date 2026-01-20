import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async onModuleInit() {
    await this.seedProducts();
  }

  private async seedProducts() {
    // Lista completa de produtos transcritos das 7 imagens
    const productsToSeed = [
      // Imagem: ...15.46.26.jpeg
      { nome: 'R2', peso_caixa_kg: 6, unidades_caixa: 50, medida_cm: '84x29x18cm', valor_unitario: 0 },
      { nome: 'R7', peso_caixa_kg: 12, unidades_caixa: 100, medida_cm: '84x29x32cm', valor_unitario: 0 },
      { nome: 'R8', peso_caixa_kg: 11, unidades_caixa: 100, medida_cm: '74x54x26cm', valor_unitario: 0 },
      { nome: 'R12', peso_caixa_kg: 7, unidades_caixa: 50, medida_cm: '68x47x31cm', valor_unitario: 0 },
      { nome: 'RM', peso_caixa_kg: 14, unidades_caixa: 100, medida_cm: '90x43x32cm', valor_unitario: 0 },
      { nome: 'Papel de Bandeja', peso_caixa_kg: 1.5, unidades_caixa: 100, medida_cm: '74x52x32cm', valor_unitario: 0 },
      { nome: 'Cumbuca', peso_caixa_kg: 24, unidades_caixa: 1000, medida_cm: '44x28x9cm', valor_unitario: 0 },
      { nome: 'Fatias', peso_caixa_kg: 10, unidades_caixa: 400, medida_cm: '40x40x20cm', valor_unitario: 0 },
      { nome: 'Caixa Porção', peso_caixa_kg: 8, unidades_caixa: 100, medida_cm: '23x36x23cm', valor_unitario: 0 },
      { nome: 'Cones', peso_caixa_kg: 2, unidades_caixa: 200, medida_cm: '22x24x15cm', valor_unitario: 0 },
      { nome: 'Caixa de Ovos de Colher', peso_caixa_kg: 9, unidades_caixa: 100, medida_cm: '42x38x20cm', valor_unitario: 0 },
      { nome: 'J2-3Soitavada Tampa', peso_caixa_kg: 9, unidades_caixa: 100, medida_cm: '45x45x29cm', valor_unitario: 0 },
      { nome: 'J2-3Soitavada Base', peso_caixa_kg: 5, unidades_caixa: 50, medida_cm: '54x54x19cm', valor_unitario: 0 },
      { nome: 'Pá Madeira', peso_caixa_kg: 1.5, unidades_caixa: 1, medida_cm: '43x187cmx2cm', valor_unitario: 0 },
      
      // Imagem: ...15.46.26 (1).jpeg (e duplicatas)
      { nome: 'Bolo 37 TAMPA', peso_caixa_kg: 17, unidades_caixa: 50, medida_cm: '82x58x32cm', valor_unitario: 0 },
      { nome: 'Bolo 37 BASE', peso_caixa_kg: 17, unidades_caixa: 50, medida_cm: '66.5x48x13cm', valor_unitario: 0 },
      { nome: 'Bolo 48 TAMPA', peso_caixa_kg: 4, unidades_caixa: 50, medida_cm: '79x64x14cm', valor_unitario: 0 },
      { nome: 'Bolo 48 BASE', peso_caixa_kg: 5, unidades_caixa: 50, medida_cm: '72x59x13cm', valor_unitario: 0 },
      { nome: 'Bolo 4015 TAMPA', peso_caixa_kg: 5, unidades_caixa: 50, medida_cm: '89x75x14cm', valor_unitario: 0 },
      { nome: 'Bolo 4015 BASE', peso_caixa_kg: 6, unidades_caixa: 50, medida_cm: '81x67x14cm', valor_unitario: 0 },
      { nome: 'SORVETE 5L', peso_caixa_kg: 14, unidades_caixa: 30, medida_cm: '35x30x55cm', valor_unitario: 0 },
      { nome: 'SORVETE 10L', peso_caixa_kg: 14, unidades_caixa: 6, medida_cm: '45x37x43cm', valor_unitario: 0 },
      { nome: 'POTE 80ML', peso_caixa_kg: 5, unidades_caixa: 1000, medida_cm: '45x37x43cm', valor_unitario: 0 },
      { nome: 'POTE 120 ML', peso_caixa_kg: 5, unidades_caixa: 1000, medida_cm: '36x28x47cm', valor_unitario: 0 },
      { nome: 'POTE 150 ML', peso_caixa_kg: 5, unidades_caixa: 1000, medida_cm: '36x28x47cm', valor_unitario: 0 },
      { nome: 'POTE 240 / 250 ML', peso_caixa_kg: 9, unidades_caixa: 1000, medida_cm: '50x42x60cm', valor_unitario: 0 },
      { nome: 'POTE 480 ML', peso_caixa_kg: 13, unidades_caixa: 1000, medida_cm: '63x60x50cm', valor_unitario: 0 },
      { nome: 'POTE 500 ML', peso_caixa_kg: 14, unidades_caixa: 1000, medida_cm: '58x50x66cm', valor_unitario: 0 },
      { nome: 'POTE 1000 ML', peso_caixa_kg: 14, unidades_caixa: 500, medida_cm: '73x62x42cm', valor_unitario: 0 },
      { nome: 'COPO 200 ML', peso_caixa_kg: 7, unidades_caixa: 1000, medida_cm: '46x33x46cm', valor_unitario: 0 },
      { nome: 'COPO 360 ML', peso_caixa_kg: 7, unidades_caixa: 1000, medida_cm: '53x45x53cm', valor_unitario: 0 },
      { nome: 'TAMPA 80 ML / 120', peso_caixa_kg: 5, unidades_caixa: 1000, medida_cm: '45x37x43cm', valor_unitario: 0 },
      { nome: 'TAMPA 150 / 200ML', peso_caixa_kg: 5, unidades_caixa: 1000, medida_cm: '45x37x43cm', valor_unitario: 0 },
      { nome: 'TAMPA 240 ML', peso_caixa_kg: 5, unidades_caixa: 1000, medida_cm: '45x37x43cm', valor_unitario: 0 },
      { nome: 'Hamburguer', peso_caixa_kg: 6, unidades_caixa: 200, medida_cm: '46x26x22cm', valor_unitario: 0 },
      { nome: 'Pote 360 ml', peso_caixa_kg: 10, unidades_caixa: 1000, medida_cm: '53x54x50cm', valor_unitario: 0 },

      // Imagem: ...15.46.27 (1).jpeg
      { nome: 'Esfiha 05(OFF Set)', peso_caixa_kg: 5, unidades_caixa: 50, medida_cm: '58x30x16cm', valor_unitario: 0 },
      { nome: 'Esfiha 07', peso_caixa_kg: 6, unidades_caixa: 100, medida_cm: '58x30x19cm', valor_unitario: 0 },
      { nome: 'Esfiha 08', peso_caixa_kg: 10, unidades_caixa: 100, medida_cm: '64x31x34cm', valor_unitario: 0 },
      { nome: 'Esfiha 10', peso_caixa_kg: 6, unidades_caixa: 50, medida_cm: '64x31x24cm', valor_unitario: 0 },
      { nome: 'Esfiha 15', peso_caixa_kg: 9, unidades_caixa: 50, medida_cm: '66x48x21cm', valor_unitario: 0 },
      { nome: 'Esfiha 16', peso_caixa_kg: 13, unidades_caixa: 100, medida_cm: '74x37x28cm', valor_unitario: 0 },
      { nome: 'Calzone', peso_caixa_kg: 8, unidades_caixa: 50, medida_cm: '74x37x15cm', valor_unitario: 0 },
      { nome: 'Separador de acoplado', peso_caixa_kg: 14, unidades_caixa: 2000, medida_cm: '59x50x32cm', valor_unitario: 0 },
      { nome: 'Suporte para copos 500ml', peso_caixa_kg: 6, unidades_caixa: 200, medida_cm: '58x37x31cm', valor_unitario: 0 },
      { nome: 'Lacre e mesinha', peso_caixa_kg: 2, unidades_caixa: 1, medida_cm: '99x9x25cm', valor_unitario: 0 }, // '1pct' assumido como 1 unidade
      { nome: 'Divisórias', peso_caixa_kg: 8, unidades_caixa: 500, medida_cm: '36x12x12cm', valor_unitario: 0 },
      { nome: 'Bolo 3', peso_caixa_kg: 10, unidades_caixa: 50, medida_cm: '47x66x27cm', valor_unitario: 0 },
      { nome: 'Bolo 4', peso_caixa_kg: 13, unidades_caixa: 50, medida_cm: '52x70x26cm', valor_unitario: 0 },
      { nome: 'Bolo 5', peso_caixa_kg: 16, unidades_caixa: 50, medida_cm: '57x78x26cm', valor_unitario: 0 },
      { nome: 'Bolo 23', peso_caixa_kg: 7, unidades_caixa: 50, medida_cm: '63x48x18cm', valor_unitario: 0 },
      { nome: 'Bolo 28 (baixa)', peso_caixa_kg: 8, unidades_caixa: 50, medida_cm: '66x54x17cm', valor_unitario: 0 },
      { nome: 'Bolo 28 (alta)', peso_caixa_kg: 8, unidades_caixa: 50, medida_cm: '85x65x16cm', valor_unitario: 0 },
      { nome: 'Bolo 33', peso_caixa_kg: 14, unidades_caixa: 50, medida_cm: '72x58x26cm', valor_unitario: 0 },
      { nome: 'Bolo 33 (alta)', peso_caixa_kg: 14, unidades_caixa: 50, medida_cm: '89x69x17cm', valor_unitario: 0 },
      { nome: 'Bolo 35', peso_caixa_kg: 10, unidades_caixa: 50, medida_cm: '82x57x16cm', valor_unitario: 0 }, // Assumido Base

      // Imagem: ...15.46.27.jpeg
      { nome: 'D25', peso_caixa_kg: 9, unidades_caixa: 50, medida_cm: '91x41x18cm', valor_unitario: 0 },
      { nome: 'D30', peso_caixa_kg: 11, unidades_caixa: 50, medida_cm: '91x41x18cm', valor_unitario: 0 },
      { nome: 'D35', peso_caixa_kg: 11, unidades_caixa: 50, medida_cm: '97x42x32cm', valor_unitario: 0 },
      { nome: 'D40', peso_caixa_kg: 13, unidades_caixa: 50, medida_cm: '67x50x32cm', valor_unitario: 0 },
      { nome: 'DISCO 25', peso_caixa_kg: 4, unidades_caixa: 50, medida_cm: '25x25x47cm', valor_unitario: 0 },
      { nome: '40 oitavada', peso_caixa_kg: 11, unidades_caixa: 50, medida_cm: '35x35x50cm', valor_unitario: 0 },
      { nome: 'S2A', peso_caixa_kg: 12, unidades_caixa: 50, medida_cm: '52x40x20cm', valor_unitario: 0 },
      { nome: 'S1', peso_caixa_kg: 6, unidades_caixa: 100, medida_cm: '52x51x31cm', valor_unitario: 0 },
      { nome: 'S2', peso_caixa_kg: 7, unidades_caixa: 100, medida_cm: '60x52x32cm', valor_unitario: 0 },
      { nome: 'S3', peso_caixa_kg: 7, unidades_caixa: 50, medida_cm: '61x61x16cm', valor_unitario: 0 },
      { nome: 'Esfiha 02', peso_caixa_kg: 6, unidades_caixa: 100, medida_cm: '49x27x31cm', valor_unitario: 0 },
      { nome: 'Esfiha 03', peso_caixa_kg: 3, unidades_caixa: 50, medida_cm: '49x31x15cm', valor_unitario: 0 },
      { nome: 'Esfiha 05', peso_caixa_kg: 4, unidades_caixa: 100, medida_cm: '58x30x16cm', valor_unitario: 0 },

      // Imagem: ...15.46.26 (3).jpeg (e duplicatas)
      { nome: '20Q', peso_caixa_kg: 7, unidades_caixa: 100, medida_cm: '28x28x31cm', valor_unitario: 0 },
      { nome: '25QTS', peso_caixa_kg: 7, unidades_caixa: 50, medida_cm: '49x35x33cm', valor_unitario: 0 },
      { nome: '25PAF', peso_caixa_kg: 10, unidades_caixa: 100, medida_cm: '71x36x32cm', valor_unitario: 0 },
      { nome: '28Q', peso_caixa_kg: 7, unidades_caixa: 1, medida_cm: '60,5x33x32cm', valor_unitario: 0 }, // Unidade não especificada, assumido 1
      { nome: '30 oitavada', peso_caixa_kg: 12, unidades_caixa: 100, medida_cm: '75x37x33cm', valor_unitario: 0 },
      { nome: '30Q', peso_caixa_kg: 15, unidades_caixa: 100, medida_cm: '83x41x27cm', valor_unitario: 0 },
      { nome: '35 oitavada (3cm)', peso_caixa_kg: 8, unidades_caixa: 50, medida_cm: '42x42x32cm', valor_unitario: 0 },
      { nome: '35PAF', peso_caixa_kg: 9, unidades_caixa: 200, medida_cm: '39x39x36cm', valor_unitario: 0 },
      { nome: '35 c/3cm', peso_caixa_kg: 8, unidades_caixa: 50, medida_cm: '43x43x32cm', valor_unitario: 0 },
      { nome: '35QTS', peso_caixa_kg: 13, unidades_caixa: 50, medida_cm: '57x45x24cm', valor_unitario: 0 },
    ];
    
    console.log('Iniciando o seeding de produtos com a lista completa...');
    let newProductsCount = 0;

    for (const productData of productsToSeed) {
      const existingProduct = await this.productRepository.findOne({ where: { nome: productData.nome } });

      if (!existingProduct) {
        const newProduct = this.productRepository.create(productData);
        await this.productRepository.save(newProduct);
        newProductsCount++;
      }
    }
    
    console.log(`Seeding concluído. ${newProductsCount} novos produtos foram adicionados.`);
  }
}