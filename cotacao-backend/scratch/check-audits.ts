import { DataSource } from 'typeorm';
import ormConfig from '../src/orm.config.ts';

const dataSource = new DataSource({
  ...ormConfig,
  entities: ['src/**/*.entity.ts'],
});

async function check() {
  await dataSource.initialize();
  console.log('Banco de dados inicializado com sucesso.');
  
  const auditsCount = await dataSource.query('SELECT count(*) FROM audits');
  console.log('Total de registros na tabela audits:', auditsCount);
  
  const samples = await dataSource.query('SELECT * FROM audits LIMIT 10');
  console.log('Amostra de registros na tabela audits:', JSON.stringify(samples, null, 2));
  
  await dataSource.destroy();
}

check().catch(console.error);
