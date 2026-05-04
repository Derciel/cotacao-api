const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const searchNames = [
    'THE BEST',
    'ACA',
    'GELA BOCA',
    'BARONE',
    'SANTA PIZZA',
    'PIMENTA ROSA',
    'FRATELLO',
    'GMEL'
];

async function run() {
    try {
        await client.connect();
        console.log('Searching for target clients...');

        for (const name of searchNames) {
            const res = await client.query(
                "SELECT id, fantasia, razao_social FROM clients WHERE fantasia ILIKE $1 OR razao_social ILIKE $1",
                [`%${name}%`]
            );
            console.log(`Results for "${name}":`);
            console.log(JSON.stringify(res.rows, null, 2));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
