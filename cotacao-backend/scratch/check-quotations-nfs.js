import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

async function run() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Conectado ao banco!');

    // Pega as auditorias fictícias e traz as informações da cotação local relacionada
    const query = `
      SELECT 
        a.id as audit_id, 
        a.quotation_id, 
        a.nfe_number as audit_nf, 
        q.nf as quotation_nf,
        q.valor_frete as quotation_frete,
        q.transportadora_escolhida as quotation_carrier
      FROM audits a
      JOIN quotations q ON q.id = a.quotation_id
      WHERE a.cte_number = '41260444914992003820570030035263041035263040'
      LIMIT 15
    `;

    const res = await client.query(query);
    console.log('Auditorias fictícias encontradas:', res.rows.length);
    console.log('Amostra de cruzamento local:', JSON.stringify(res.rows, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
