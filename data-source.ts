import 'dotenv/config';
import { DataSource } from 'typeorm';
import ormConfig from './src/orm.config';

/**
 * Esta configuração é usada especificamente pela CLI do TypeORM para
 * executar comandos como a geração e execução de migrations.
 * Ela importa a configuração principal do 'orm.config.ts' e a adapta
 * para o contexto da CLI.
 */
const dataSource = new DataSource({
  ...ormConfig,
  entities: ['dist/**/*.entity.{js,ts}'],
  migrations: ['dist/migrations/*{.js,.ts}'],
});

export default dataSource;