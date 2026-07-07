// src/orm.config.ts

import { DataSourceOptions } from 'typeorm'; // Altere o import
import 'dotenv/config';

// Altere o tipo aqui para DataSourceOptions
const dbUrl = process.env.DATABASE_URL || '';
const useSsl = !dbUrl.includes('sslmode=disable') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost');

const config: DataSourceOptions = process.env.DATABASE_URL
  ? {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    extra: {
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      keepAlive: true,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 15000,
      max: 20
    },
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