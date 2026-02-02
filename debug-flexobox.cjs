const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const res = await client.query("SELECT * FROM quotations WHERE empresa_faturamento = 'FLEXOBOX' ORDER BY id DESC LIMIT 5");
        console.log('RECORDS FLEXOBOX:');
        console.log(JSON.stringify(res.rows, null, 2));

        const res2 = await client.query("SELECT * FROM quotations ORDER BY id DESC LIMIT 2");
        console.log('\nLAST 2 RECORDS (ANY):');
        console.log(JSON.stringify(res2.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
