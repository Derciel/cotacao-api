import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL
    });
    try {
        await client.connect();
        
        console.log("Listando todas as transportadoras distintas na tabela 'region_deadlines':");
        const res = await client.query(`
            SELECT carrier, COUNT(*) as total_registros
            FROM region_deadlines 
            GROUP BY carrier
            ORDER BY total_registros DESC;
        `);
        console.log(res.rows);

    } catch (e) {
        console.error("Erro na consulta:", e);
    } finally {
        await client.end();
    }
}
run();
