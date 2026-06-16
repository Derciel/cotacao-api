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

  // Cabeçalhos comuns
  const headerKeys = [
    'apikey', 'api-key', 'api_key', 'apiKey', 'ApiKey',
    'X-API-KEY', 'X-Api-Key', 'x-api-key', 'X-ApiKey', 'x-apikey',
    'X-API-Key'
  ];

  // Parâmetros comuns
  const paramKeys = [
    'apikey', 'api-key', 'api_key', 'apiKey', 'ApiKey'
  ];

  console.log('Iniciando varredura de combinações de autenticação...');

  // 1. Testando Cabeçalhos (Headers)
  for (const hKey of headerKeys) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'email': email
      };
      headers[hKey] = apiKey;

      const res = await axios.post(url, `"${xmlBase64}"`, { headers, timeout: 5000 });
      console.log(`[Sucesso Header] Chave: ${hKey}. Status: ${res.status}. Tamanho: ${res.data.length}`);
      return;
    } catch (err) {
      console.log(`[Falha Header] Chave: ${hKey}. Erro: ${err.message}. Resposta: ${JSON.stringify(err.response?.data)}`);
    }
  }

  // 2. Testando Query Params
  for (const pKey of paramKeys) {
    try {
      const fullUrl = `${url}?${pKey}=${apiKey}&email=${email}`;
      const res = await axios.post(fullUrl, `"${xmlBase64}"`, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      console.log(`[Sucesso Param] Chave: ${pKey}. Status: ${res.status}. Tamanho: ${res.data.length}`);
      return;
    } catch (err) {
      console.log(`[Falha Param] Chave: ${pKey}. Erro: ${err.message}. Resposta: ${JSON.stringify(err.response?.data)}`);
    }
  }
}

run();
