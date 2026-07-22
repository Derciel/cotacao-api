import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3002/api';

async function run() {
  console.log("Iniciando testes locais...");

  // Espera 3 segundos para garantir que o servidor local iniciou
  await new Promise(resolve => setTimeout(resolve, 3000));

  let token = "";
  try {
    console.log("1. Testando login real na API local...");
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    token = loginRes.data.access_token;
    console.log("Login efetuado com sucesso! Token obtido.");
  } catch (e: any) {
    console.error("Falha ao fazer login local:", e.response?.data || e.message);
    return;
  }

  try {
    console.log("\n2. Testando a nova rota GET /users/me...");
    const meRes = await axios.get(`${API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Dados do usuário logado:", JSON.stringify(meRes.data, null, 2));
    if (meRes.data && meRes.data.permissions) {
      console.log("[OK] Rota /users/me retornou os dados e permissões com sucesso!");
    } else {
      console.error("[ERRO] Rota /users/me não retornou a lista de permissões.");
    }
  } catch (e: any) {
    console.error("Erro ao chamar /users/me:", e.response?.data || e.message);
  }

  // 3. Testando rota GET CNPJ
  const testCnpj = '99999999000199';
  try {
    console.log(`\n3. Testando GET CNPJ ${testCnpj} (simulando falha da Brasil API retornando fallback do banco local se houver, ou retorno seguro)...`);
    const cnpjRes = await axios.get(`${API_URL}/clients/cnpj/${testCnpj}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Resultado da busca de CNPJ:", JSON.stringify(cnpjRes.data, null, 2));
    if (cnpjRes.data && 'isExternal' in cnpjRes.data) {
      console.log("[OK] Rota GET CNPJ tratou o retorno de forma estruturada com sucesso!");
    } else {
      console.error("[ERRO] Rota GET CNPJ retornou dados em formato inesperado.");
    }
  } catch (e: any) {
    console.error("Erro no GET CNPJ:", e.response?.data || e.message);
  }

  // 4. Testando criação de cliente (POST)
  try {
    console.log("\n4. Testando criação manual de cliente (POST)...");
    const payload = {
      cnpj: testCnpj,
      razao_social: 'Cliente Teste Local',
      fantasia: 'Teste Local',
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

    console.log("Cliente criado localmente com sucesso!", postRes.data);

    // Se funcionou, vamos remover
    const createdId = postRes.data.id;
    if (createdId) {
      console.log(`\n5. Removendo cliente local de teste com ID ${createdId}...`);
      await axios.delete(`${API_URL}/clients/${createdId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log("Cliente local de teste removido.");
    }

  } catch (e: any) {
    console.error("ERRO NO POST CLIENTS (LOCAL):", e.response?.data || e.message);
  }
}

run().catch(console.error);
