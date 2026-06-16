import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL não configurada no .env');
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Conectado ao PostgreSQL com sucesso!');

    const countRes = await client.query('SELECT count(*) FROM audits');
    console.log('Total de registros em audits:', countRes.rows[0].count);

    const sampleRes = await client.query('SELECT id, quotation_id, nfe_number, cte_number, valor_frete_cotado, valor_frete_sieg, transportadora FROM audits LIMIT 10');
    console.log('Amostra de registros em audits:', JSON.stringify(sampleRes.rows, null, 2));

  } catch (error) {
    console.error('Erro ao consultar banco de dados:', error);
  } finally {
    await client.end();
  }
}

run();
