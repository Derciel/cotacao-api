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
        
        const columnsRes = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'clients'
            ORDER BY ordinal_position;
        `);
        console.log("Colunas da tabela clients:");
        console.table(columnsRes.rows);

        const constraintsRes = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE c.conrelid = 'clients'::regclass;
        `);
        console.log("\nConstraints da tabela clients:");
        console.table(constraintsRes.rows);

        process.exit(0);
    } catch (e) {
        console.error("Erro ao inspecionar esquema:", e);
        process.exit(1);
    } finally {
        await client.end();
    }
}
run();
