// src/orm.config.ts

import { DataSourceOptions } from 'typeorm'; // Altere o import
import 'dotenv/config';

// Altere o tipo aqui para DataSourceOptions
const config: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false, // Lembre-se que mudamos para false
};

export default config;