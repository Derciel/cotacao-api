const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();

        const results = {};

        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'quotations'
            ORDER BY ordinal_position
        `);
        results.quotations_columns = res.rows;

        const resUsersCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        results.users_columns = resUsersCols.rows;

        const users = await client.query('SELECT id, username, role, permissions FROM users');
        results.users_data = users.rows;

        const quotCount = await client.query('SELECT count(*) FROM quotations');
        results.quotations_count = quotCount.rows[0].count;

        const quotSample = await client.query('SELECT id, user_id FROM quotations LIMIT 10');
        results.quotations_sample = quotSample.rows;

        console.log(JSON.stringify(results, null, 2));

    } catch (err) {
        console.error(JSON.stringify({ error: err.message }, null, 2));
    } finally {
        await client.end();
    }
}
run();
