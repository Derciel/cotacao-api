const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();

        console.log('--- DB INFO ---');
        const dbInfo = await client.query('SELECT current_database(), current_user, current_setting(\'search_path\')');
        console.table(dbInfo.rows);

        console.log('\n--- COLUMN DETAIL (quotations) ---');
        const colDetail = await client.query(`
            SELECT table_schema, table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'quotations' AND column_name IN ('nf', 'data_coleta')
        `);
        console.table(colDetail.rows);

        console.log('\n--- TEST QUERY ---');
        try {
            const res = await client.query('SELECT "nf", "data_coleta" FROM "quotations" LIMIT 1');
            console.log('Query successful, columns found.');
        } catch (e) {
            console.error('Query failed:', e.message);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
