import axios from 'axios';
import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

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
    if (res.rows.length > 0 && res.rows[0].xml_content) {
      xmlContent = res.rows[0].xml_content;
      console.log('XML obtido com sucesso! Tamanho:', xmlContent.length);
    } else {
      console.error('Nenhum XML encontrado para auditoria ID 7.');
      return;
    }
  } catch (err) {
    console.error('Erro ao conectar/buscar:', err.message);
    return;
  } finally {
    await client.end();
  }

  // Codifica o XML em Base64
  const xmlBase64 = Buffer.from(xmlContent, 'utf-8').toString('base64');
  console.log('XML convertido para Base64. Tamanho:', xmlBase64.length);

  // Tentativa 1: POST com apikey e email nos query params e o Base64 cru no body
  console.log('\nTentando POST GerarDacteViaXml com apikey/email nos query params e XML Base64 cru no body...');
  try {
    const url = `https://api.sieg.com/api/Arquivos/GerarDacteViaXml?apikey=${apiKey}&email=${email}`;
    const res = await axios.post(url, xmlBase64, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    console.log('Status 1:', res.status);
    if (res.data) {
      console.log('Tamanho do PDF retornado:', res.data.length);
      fs.writeFileSync('test-dacte-1.pdf', Buffer.from(res.data, 'base64'));
      console.log('Sucesso! Salvo test-dacte-1.pdf');
      return;
    }
  } catch (err) {
    console.error('Falha na tentativa 1:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Dados:', err.response.data);
    }
  }

  // Tentativa 2: POST enviando um JSON com o xml em Base64
  console.log('\nTentando POST GerarDacteViaXml com JSON e headers apikey/email...');
  try {
    const url = `https://api.sieg.com/api/Arquivos/GerarDacteViaXml`;
    const res = await axios.post(url, {
      xml: xmlBase64
    }, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'email': email
      }
    });
    console.log('Status 2:', res.status);
    if (res.data) {
      fs.writeFileSync('test-dacte-2.pdf', Buffer.from(res.data, 'base64'));
      console.log('Sucesso! Salvo test-dacte-2.pdf');
      return;
    }
  } catch (err) {
    console.error('Falha na tentativa 2:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Dados:', err.response.data);
    }
  }
}

run();
