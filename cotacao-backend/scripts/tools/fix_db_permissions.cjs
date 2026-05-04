const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();

        console.log('--- Granting all permissions to all users ---');
        const perms = JSON.stringify(['/', '/nova-cotacao', '/historico', '/relatorios', '/usuarios']);
        await client.query('UPDATE users SET permissions = $1', [perms]);

        console.log('--- Assigning quotations with NULL user_id to user ID 1 (Admin) ---');
        const res = await client.query('UPDATE quotations SET user_id = 1 WHERE user_id IS NULL');
        console.log(`Updated ${res.rowCount} quotations.`);

        console.log('--- Cleanup complete ---');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
run();
