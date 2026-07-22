import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL
    });
    try {
        await client.connect();
        
        console.log("1. Listando todas as tabelas em public:");
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        console.log(tablesRes.rows.map(r => r.table_name));

        console.log("\n2. Detalhes de alguns registros de 'TEX ENCOMENDAS' na tabela 'region_deadlines':");
        const regionRes = await client.query(`
            SELECT * 
            FROM region_deadlines 
            WHERE carrier ILIKE '%tex%'
            LIMIT 10;
        `);
        console.log(regionRes.rows);

    } catch (e) {
        console.error("Erro na consulta:", e);
    } finally {
        await client.end();
    }
}
run();
