
import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL;

async function run() {
    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log('--- TABLES ---');
        const tablesRes = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log(JSON.stringify(tablesRes.rows, null, 2));

        console.log('--- PRODUCTS (First 10) ---');
        const productsRes = await client.query('SELECT id, nome, categoria, created_at, updated_at FROM products LIMIT 10');
        console.log(JSON.stringify(productsRes.rows, null, 2));

        console.log('--- CLIENTS (First 10) ---');
        const clientsRes = await client.query('SELECT id, razao_social, cnpj, empresa_faturamento FROM clients LIMIT 10');
        console.log(JSON.stringify(clientsRes.rows, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
