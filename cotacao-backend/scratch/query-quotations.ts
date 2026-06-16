import { DataSource } from 'typeorm';
import ormConfig from '../src/orm.config.ts';

const dataSource = new DataSource({
  ...ormConfig,
  entities: ['src/**/*.entity.ts'],
});

async function check() {
  await dataSource.initialize();
  const count = await dataSource.query('SELECT count(*) FROM quotations');
  console.log('Quotation count:', count);
  const sample = await dataSource.query('SELECT id, is_test, status, transportadora_escolhida, created_at, user_id FROM quotations ORDER BY id DESC LIMIT 20');
  console.log('Sample quotations:', JSON.stringify(sample, null, 2));
  await dataSource.destroy();
}

check().catch(console.error);
