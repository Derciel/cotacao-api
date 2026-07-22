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
            SELECT id, username, role, permissions, updated_at
            FROM users
            ORDER BY id ASC;
        `);
        console.log("Usuários cadastrados no banco:");
        console.table(res.rows);

        process.exit(0);
    } catch (e) {
        console.error("Erro ao listar usuários:", e);
        process.exit(1);
    } finally {
        await client.end();
    }
}
run();
