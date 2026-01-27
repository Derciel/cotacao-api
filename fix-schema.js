import { DataSource } from 'typeorm';
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL;

const dataSource = new DataSource({
    type: 'postgres',
    url: dbUrl,
    synchronize: false,
    ssl: { rejectUnauthorized: false },
    extra: { ssl: { rejectUnauthorized: false } },
});

async function run() {
    try {
        await dataSource.initialize();
        const qr = dataSource.createQueryRunner();
        console.log('Adding missing columns to quotations...');

        const columns = [
            'ADD COLUMN IF NOT EXISTS "numero_pedido_manual" VARCHAR(50)',
            'ADD COLUMN IF NOT EXISTS "data_cotacao" DATE',
            'ADD COLUMN IF NOT EXISTS "prazo_pagamento" VARCHAR(255)',
            'ADD COLUMN IF NOT EXISTS "dias_para_entrega" INTEGER',
            'ADD COLUMN IF NOT EXISTS "valor_total_produtos" NUMERIC(10,2)',
            'ADD COLUMN IF NOT EXISTS "transportadora_escolhida" VARCHAR(255)',
            'ADD COLUMN IF NOT EXISTS "valor_frete" NUMERIC(10,2)',
            'ADD COLUMN IF NOT EXISTS "tipo_frete" VARCHAR(255)',
            'ADD COLUMN IF NOT EXISTS "obs" TEXT',
            'ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT \'PENDENTE\'',
            'ADD COLUMN IF NOT EXISTS "empresa_faturamento" VARCHAR(50) DEFAULT \'NICOPEL\'',
            'ADD COLUMN IF NOT EXISTS "percentual_ipi" NUMERIC(5,2)',
            'ADD COLUMN IF NOT EXISTS "valor_ipi" NUMERIC(10,2)',
            'ADD COLUMN IF NOT EXISTS "valor_total_nota" NUMERIC(10,2)',
            'ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        ];

        for (const col of columns) {
            try {
                await qr.query(`ALTER TABLE "quotations" ${col}`);
                console.log(`Success: ${col.split(' ')[4]}`);
            } catch (e) {
                console.warn(`Failed to add column (might already exist): ${col.split(' ')[4]}`, e.message);
            }
        }

        console.log('Schema sync completed.');
    } catch (e) {
        console.error(e);
    } finally {
        await dataSource.destroy();
    }
}
run();
