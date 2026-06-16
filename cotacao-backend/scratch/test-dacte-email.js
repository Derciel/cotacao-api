import axios from 'axios';
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

async function run() {
  const apiKey = process.env.SIEG_API_KEY;
  const email = process.env.SIEG_EMAIL;

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  let xmlContent = '';
  try {
    await client.connect();
    const res = await client.query('SELECT xml_content FROM audits WHERE id = 7');
    xmlContent = res.rows[0].xml_content;
  } catch (err) {
    console.error(err);
    return;
  } finally {
    await client.end();
  }

  const xmlBase64 = Buffer.from(xmlContent, 'utf-8').toString('base64');
  const url = 'https://api.sieg.com/api/Arquivos/GerarDacteViaXml';

  // Nomes de parâmetros comuns para e-mail na API antiga do SIEG
  const emailParams = ['email', 'emailUsuario', 'usuario', 'username', 'login', 'user', 'email_usuario'];

  console.log('Iniciando teste de chaves de e-mail na query string...');

  for (const ep of emailParams) {
    try {
      const fullUrl = `${url}?api_key=${apiKey}&${ep}=${email}`;
      const res = await axios.post(fullUrl, `"${xmlBase64}"`, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      console.log(`[Sucesso] Param: ${ep}. Status: ${res.status}. Tamanho: ${res.data.length}`);
      return;
    } catch (err) {
      console.log(`[Falha] Param: ${ep}. Erro: ${err.message}. Resposta: ${JSON.stringify(err.response?.data)}`);
    }
  }
}

run();
