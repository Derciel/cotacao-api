const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const res = await client.query("SELECT id, numero_pedido_manual FROM quotations WHERE numero_pedido_manual = '' OR numero_pedido_manual IS NULL");
        console.log('RECORDS WITH EMPTY OR NULL numero_pedido_manual:');
        console.log(res.rows);

        const countsRes = await client.query("SELECT numero_pedido_manual, COUNT(*) FROM quotations GROUP BY numero_pedido_manual HAVING COUNT(*) > 1");
        console.log('\nDUPLICATES:');
        console.log(countsRes.rows);

        const totalRes = await client.query("SELECT COUNT(*) FROM quotations");
        console.log('\nTOTAL QUOTATIONS:', totalRes.rows[0].count);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
