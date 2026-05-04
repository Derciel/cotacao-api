import { DataSource } from 'typeorm';
import ormConfig from './src/orm.config.js';

const dataSource = new DataSource({
  ...ormConfig,
  entities: ['src/**/*.entity.ts'],
});

async function seed() {
  await dataSource.initialize();
  
  const products = [
    { nome: 'SEXTAVADA 25', medida_cm: '62x33x09', unidades_caixa: 50, peso_caixa_kg: 5, categoria: 'OUTROS' },
    { nome: 'SEXTAVADA 30', medida_cm: '73x39x09', unidades_caixa: 50, peso_caixa_kg: 7, categoria: 'OUTROS' },
    { nome: 'SEXTAVADA 35', medida_cm: '82x43x09', unidades_caixa: 50, peso_caixa_kg: 9, categoria: 'OUTROS' }
  ];

  for (const p of products) {
    await dataSource.query(
      `INSERT INTO "products" (nome, medida_cm, unidades_caixa, peso_caixa_kg, categoria, peso_unitario_kg, valor_unitario) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT DO NOTHING`,
      [p.nome, p.medida_cm, p.unidades_caixa, p.peso_caixa_kg, p.categoria, p.peso_caixa_kg / p.unidades_caixa, null]
    );
  }
  
  console.log('Produtos cadastrados com sucesso!');
  await dataSource.destroy();
}

seed().catch(console.error);
