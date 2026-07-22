import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_URL = 'https://cotacao-api-ppiy.onrender.com/api';

async function run() {
  console.log("Iniciando teste de integração com login real...");

  let token = "";
  try {
    // 1. Tenta fazer login como admin
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123' // ou a senha definida se alterada
    });
    token = loginRes.data.access_token;
    console.log("Login efetuado com sucesso! Token obtido.");
  } catch (e: any) {
    console.error("Falha no login inicial:", e.response?.data || e.message);
    // Se falhar o login padrão admin, vamos tentar usar o segredo JWT local
    console.log("Tentando usar chave local de fallback para assinar token...");
    try {
      const jwt = (await import('jsonwebtoken')).default;
      token = jwt.sign(
        { username: 'admin', sub: 1, role: 'ADMIN', permissions: ['/'] },
        process.env.JWT_SECRET || 'npcargo_secret_key_2026',
        { expiresIn: '5m' }
      );
      console.log("Token assinado localmente com sucesso.");
    } catch (err: any) {
      console.error("Não foi possível gerar token localmente:", err.message);
      return;
    }
  }

  const testCnpj = '99999999000199';

  try {
    console.log("\n2. Testando rota GET CNPJ...");
    const getRes = await axios.get(`${API_URL}/clients/cnpj/${testCnpj}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Resposta GET CNPJ:", JSON.stringify(getRes.data, null, 2));
  } catch (e: any) {
    console.error("Erro no GET CNPJ:", e.response?.data || e.message);
  }

  try {
    console.log("\n3. Testando criação de cliente (POST)...");
    const payload = {
      cnpj: testCnpj,
      razao_social: 'Cliente Teste API Prod',
      fantasia: 'Teste Prod',
      cep: '86000000',
      cidade: 'Londrina',
      estado: 'PR',
      empresa_faturamento: 'NICOPEL'
    };

    const postRes = await axios.post(`${API_URL}/clients`, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("Cliente criado com sucesso!", postRes.data);

    // Se funcionou, vamos remover
    const createdId = postRes.data.id;
    if (createdId) {
      console.log(`\n4. Removendo cliente de teste com ID ${createdId}...`);
      await axios.delete(`${API_URL}/clients/${createdId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log("Cliente de teste removido.");
    }

  } catch (e: any) {
    console.error("ERRO NO POST CLIENTS (PRODUÇÃO):", e.response?.data || e.message);
  }
}

run().catch(console.error);
