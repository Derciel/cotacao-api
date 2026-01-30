const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('--- TABLES ---');
        const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(tablesRes.rows.map(r => r.table_name));

        console.log('\n--- QUOTATIONS COLUMNS ---');
        const colsRes = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'quotations'");
        console.table(colsRes.rows);

        console.log('\n--- QUOTATIONS CONSTRAINTS ---');
        const consRes = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid) 
            FROM pg_constraint c 
            JOIN pg_namespace n ON n.oid = c.connamespace 
            WHERE n.nspname = 'public' AND conrelid = 'quotations'::regclass
        `);
        console.table(consRes.rows);

        console.log('\n--- QUOTATION_ITEMS COLUMNS ---');
        const itemsColsRes = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'quotation_items'");
        console.table(itemsColsRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
