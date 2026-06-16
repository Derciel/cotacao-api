import axios from 'axios';
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

// Função auxiliar para simular o getJwtToken do backend
async function getJwtToken() {
  const baseUrl = 'https://api.sieg.com';
  const clientId = process.env.SIEG_CLIENT_ID;
  const secretKey = process.env.SIEG_SECRET_KEY;
  
  const res = await axios.post(`${baseUrl}/api/v1/create-jwt`, {}, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Client-Id': clientId,
      'X-Secret-Key': secretKey,
    }
  });
  
  let token = typeof res.data === 'string' ? res.data.trim() : (res.data.Token || String(res.data)).trim();
  return token.replace(/^"|"$/g, '').trim();
}

async function run() {
  const apiKey = process.env.SIEG_API_KEY;
  const email = process.env.SIEG_EMAIL;

  console.log('1. Conectando ao banco para obter o XML da auditoria 7...');
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
  console.log('Base64 obtido. Gerando JWT...');

  const token = await getJwtToken();
  console.log('JWT obtido com sucesso!');

  // Lista de tentativas de cabeçalhos
  const url = 'https://api.sieg.com/api/Arquivos/GerarDacteViaXml';

  // Tentativa A: Usar x-api-key e email nos headers tradicional
  console.log('\nTentativa A: x-api-key e email no header...');
  try {
    const res = await axios.post(url, `"${xmlBase64}"`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'email': email
      }
    });
    console.log('Sucesso Tentativa A! Status:', res.status, 'Tamanho:', res.data.length);
    return;
  } catch (err) {
    console.log('Erro A:', err.message, err.response?.data);
  }

  // Tentativa B: Usar apikey (sem hífen) e email no header
  console.log('\nTentativa B: apikey e email no header...');
  try {
    const res = await axios.post(url, `"${xmlBase64}"`, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'email': email
      }
    });
    console.log('Sucesso Tentativa B! Status:', res.status, 'Tamanho:', res.data.length);
    return;
  } catch (err) {
    console.log('Erro B:', err.message, err.response?.data);
  }

  // Tentativa C: Usar JWT Bearer Token e X-API-Key (como nos endpoints da API v1)
  console.log('\nTentativa C: Authorization Bearer JWT e X-API-Key...');
  try {
    const res = await axios.post(url, `"${xmlBase64}"`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-API-Key': apiKey
      }
    });
    console.log('Sucesso Tentativa C! Status:', res.status, 'Tamanho:', res.data.length);
    return;
  } catch (err) {
    console.log('Erro C:', err.message, err.response?.data);
  }

  // Tentativa D: XML sem aspas como string pura no body
  console.log('\nTentativa D: XML sem aspas, headers x-api-key e email...');
  try {
    const res = await axios.post(url, xmlBase64, {
      headers: {
        'Content-Type': 'text/plain',
        'x-api-key': apiKey,
        'email': email
      }
    });
    console.log('Sucesso Tentativa D! Status:', res.status, 'Tamanho:', res.data.length);
    return;
  } catch (err) {
    console.log('Erro D:', err.message, err.response?.data);
  }
  
  // Tentativa E: Usando o query param de apikey em maiúsculas "apiKey"
  console.log('\nTentativa E: apiKey e email no query param...');
  try {
    const res = await axios.post(`${url}?apiKey=${apiKey}&email=${email}`, `"${xmlBase64}"`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Sucesso Tentativa E! Status:', res.status, 'Tamanho:', res.data.length);
    return;
  } catch (err) {
    console.log('Erro E:', err.message, err.response?.data);
  }
}

run();
