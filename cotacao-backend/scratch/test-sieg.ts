import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Carregar variáveis do .env manualmente para garantir independência de carregadores Nest
function loadEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) {
    console.error('Arquivo .env não encontrado!');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  });
  
  return env;
}

async function testSieg() {
  const env = loadEnv();
  const apiKey = env.SIEG_API_KEY;
  const email = env.SIEG_EMAIL;
  
  console.log('=== TESTANDO INTEGRAÇÃO SIEG ===');
  console.log(`Email de Teste: ${email}`);
  console.log(`API Key (Parcial): ${apiKey ? apiKey.substring(0, 10) + '...' : 'NÃO CONFIGURADA'}`);
  
  if (!apiKey || !email) {
    console.error('Credenciais da SIEG não estão preenchidas no arquivo .env!');
    return;
  }
  
  try {
    const baseUrl = 'https://api.sieg.com/aws/service.svc/v2/getdocs';
    const payload = {
      apikey: apiKey,
      email: email,
      type: 'cte'
    };
    
    console.log('\nEnviando requisição de teste para o endpoint do SIEG...');
    const response = await axios.post(baseUrl, payload, { timeout: 10000 });
    
    console.log('\n[OK] CONEXÃO COM A SIEG REALIZADA COM SUCESSO!');
    if (response.data && Array.isArray(response.data)) {
      console.log(`Total de documentos retornados na última consulta: ${response.data.length}`);
      console.log('Exemplo do primeiro documento retornado:');
      console.log(JSON.stringify(response.data[0], null, 2));
    } else {
      console.log('Resposta da API (Estrutura não-array ou vazia):', response.data);
    }
    
  } catch (error: any) {
    console.error('\n[ERRO] FALHA AO CONECTAR COM A API DA SIEG!');
    if (error.response) {
      console.error(`Status HTTP: ${error.response.status}`);
      console.error('Resposta de Erro do Servidor:', error.response.data);
    } else {
      console.error('Erro de Conexão:', error.message);
    }
  }
}

testSieg();
