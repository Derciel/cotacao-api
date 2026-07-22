import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL
    });
    try {
        await client.connect();
        
        console.log("Buscando cotações com transportadora contendo 'TEX' ou 'TOTAL':");
        const res = await client.query(`
            SELECT id, transportadora_escolhida, valor_frete, destino_cep, created_at 
            FROM quotations 
            WHERE transportadora_escolhida ILIKE '%tex%' OR transportadora_escolhida ILIKE '%total%'
            ORDER BY id DESC LIMIT 50;
        `);
        console.log(res.rows);

    } catch (e) {
        console.error("Erro na consulta:", e);
    } finally {
        await client.end();
    }
}
run();
