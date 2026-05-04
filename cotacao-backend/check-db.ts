import { DataSource } from 'typeorm';
import ormConfig from './src/orm.config.ts';

const dataSource = new DataSource({
  ...ormConfig,
  entities: ['src/**/*.entity.ts'],
});

async function check() {
  await dataSource.initialize();
  const count = await dataSource.query('SELECT count(*) FROM products');
  console.log('Product count:', count);
  const sample = await dataSource.query('SELECT * FROM products LIMIT 5');
  console.log('Sample products:', JSON.stringify(sample, null, 2));
  await dataSource.destroy();
}

check().catch(console.error);
