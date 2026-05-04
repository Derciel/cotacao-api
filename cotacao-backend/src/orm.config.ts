// src/orm.config.ts

import { DataSourceOptions } from 'typeorm'; // Altere o import
import 'dotenv/config';

// Altere o tipo aqui para DataSourceOptions
const config: DataSourceOptions = process.env.DATABASE_URL
  ? {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    extra: { ssl: { rejectUnauthorized: false } },
    entities: ['dist/**/*.entity.js', 'src/**/*.entity.ts'],
    migrations: ['dist/migrations/*.js', 'src/migrations/*.ts'],
    synchronize: false,
  }
  : {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: ['dist/**/*.entity.js', 'src/**/*.entity.ts'],
    migrations: ['dist/migrations/*.js', 'src/migrations/*.ts'],
    synchronize: false,
  };

export default config;