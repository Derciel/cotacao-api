// scratch/add-column.js
import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL não configurada no .env!");
    process.exit(1);
  }

  console.log("Conectando ao banco de dados...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Conectado com sucesso!");

    console.log("Adicionando coluna 'exibir_frete_isento' se não existir...");
    const query = `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS exibir_frete_isento boolean DEFAULT false;`;
    await client.query(query);
    console.log("Coluna adicionada com sucesso!");

  } catch (err) {
    console.error("Erro ao executar script:", err);
  } finally {
    await client.end();
  }
}

main();
