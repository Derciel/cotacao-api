const { Client } = require('pg');
require('dotenv').config();

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await db.connect();

        // Find a recent quotation
        const qRes = await db.query("SELECT id FROM quotations ORDER BY id DESC LIMIT 1");
        if (qRes.rows.length === 0) {
            console.log("No quotations found.");
            return;
        }
        const qId = qRes.rows[0].id;
        console.log(`Testing with Quotation ID #${qId}`);

        // Try to fetch it like the backend does in finalize (without client relation)
        // In the backend, TypeORM usually returns null for missing relations if not specified,
        // but accessing a property on a missing relation will throw.

        // This script is just to check what values are there.
        const res = await db.query(`
            SELECT q.*, c.razao_social, c.fantasia 
            FROM quotations q 
            JOIN clients c ON q.client_id = c.id 
            WHERE q.id = $1
        `, [qId]);

        console.log("Quotation data:", JSON.stringify(res.rows[0], null, 2));

    } catch (err) {
        console.error("Test Error:", err);
    } finally {
        await db.end();
    }
}

run();
