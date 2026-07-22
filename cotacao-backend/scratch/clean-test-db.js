import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL
    });
    try {
        await client.connect();
        
        console.log("Removendo itens da cotação de teste #2937...");
        await client.query('DELETE FROM quotation_items WHERE quotation_id = 2937');
        
        console.log("Removendo cotação de teste #2937...");
        await client.query('DELETE FROM quotations WHERE id = 2937');
        
        console.log("Limpeza concluída com sucesso!");

    } catch (e) {
        console.error("Erro na limpeza:", e);
    } finally {
        await client.end();
    }
}
run();
