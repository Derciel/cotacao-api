import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        const res = await client.query(`
          SELECT id, empresa_faturamento, status, created_at
          FROM quotations
          ORDER BY id DESC LIMIT 5
        `);
        console.log("Últimas 5 cotações:", res.rows);
        process.exit(0);
    } catch (e) {
        console.error("Erro:", e);
        process.exit(1);
    } finally {
        await client.end();
    }
}
run();
