const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'quotations'
        `);
        const dbCols = res.rows.map(r => r.column_name);

        const entityCols = [
            'id', 'numero_pedido_manual', 'client_id', 'data_cotacao',
            'prazo_pagamento', 'dias_para_entrega', 'valor_total_produtos',
            'transportadora_escolhida', 'valor_frete', 'tipo_frete', 'obs',
            'status', 'empresa_faturamento', 'percentual_ipi', 'valor_ipi',
            'valor_total_nota', 'nf', 'data_coleta', 'created_at', 'updated_at'
        ];

        console.log('--- SCHEMA COMPARISON ---');
        entityCols.forEach(col => {
            const status = dbCols.includes(col) ? 'OK' : 'MISSING';
            console.log(`${col.padEnd(25)}: ${status}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
