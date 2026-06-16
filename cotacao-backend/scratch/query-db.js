import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://cotacao_nicopel_user:Px425P2FjicMebAhIydCOJPuJbXDSpXI@dpg-d5nnnf4oud1c73a3c76g-a.ohio-postgres.render.com/cotacao_nicopel',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT count(*) FROM quotations WHERE is_test = true');
  console.log('Quotation count (is_test = true):', res.rows);
  
  const sample = await client.query('SELECT id, is_test, status, transportadora_escolhida, created_at, user_id FROM quotations WHERE is_test = true ORDER BY id DESC LIMIT 20');
  console.log('Sample quotations (is_test = true):', sample.rows);
  
  await client.end();
}

run().catch(console.error);
