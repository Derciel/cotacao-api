import { DataSource } from 'typeorm';
import ormConfig from './src/orm.config.ts';
import { Audit } from './src/audit/entities/audit.entity.ts';

const dataSource = new DataSource({
  ...ormConfig,
  entities: [Audit],
});

async function check() {
  await dataSource.initialize();
  const audits = await dataSource.getRepository(Audit).find({
    order: { created_at: 'DESC' },
    take: 10
  });
  console.log('Recent Audits:', JSON.stringify(audits, null, 2));
  await dataSource.destroy();
}

check().catch(console.error);
