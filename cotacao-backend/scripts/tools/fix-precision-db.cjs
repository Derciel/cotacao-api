const { Client } = require('pg');
require('dotenv').config();

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await db.connect();
        console.log("Connected to DB. Updating column precision...");

        await db.query(`
            ALTER TABLE quotation_items 
            ALTER COLUMN valor_unitario_na_cotacao TYPE numeric(10,4);
        `);

        console.log("Success: valor_unitario_na_cotacao now has 4 decimal places.");
    } catch (err) {
        console.error("Migration Error:", err);
        process.exit(1);
    } finally {
        await db.end();
    }
}

run();
