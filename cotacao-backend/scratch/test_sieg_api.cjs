const fs = require('fs');
const path = require('path');

const CLIENT_ID = 'nicopel_cargo_e9ba8acde33f';
const SECRET_KEY = 'zdd0A5HXJJreO9uSAv0BpgPbUgluP7j2_tAigAY5iFM';
const API_KEY = 'vFPmjhnVBtimeq19FX6yXosGF8PznplfoA9yGbj2DIs';

async function runTest() {
  console.log('=== TESTE DE CONEXÃO COM A NOVA API DA SIEG ===');

  // 1. Obter o JWT Token
  let token = '';
  try {
    const authRes = await fetch('https://api.sieg.com/api/v1/create-jwt', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Client-Id': CLIENT_ID,
        'X-Secret-Key': SECRET_KEY
      }
    });

    const rawText = await authRes.text();
    try {
      const authData = JSON.parse(rawText);
      token = authData.Token || authData;
    } catch (e) {
      token = rawText.replace(/^"|"$/g, '').trim();
    }
  } catch (err) {
    console.error('Erro de Autenticação:', err.message);
    return;
  }

  // 2. Chamar o endpoint /api/v1/baixar-xmls
  console.log('\n2. Buscando XMLs de CT-e (últimos 90 dias)...');
  try {
    const now = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const payload = {
      TipoXml: 2, // CTe
      Take: 10,
      Skip: 0,
      DataEmissaoInicio: ninetyDaysAgo.toISOString(),
      DataEmissaoFim: now.toISOString()
    };

    console.log('   Payload:', JSON.stringify(payload));
    const res = await fetch('https://api.sieg.com/api/v1/baixar-xmls', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(payload)
    });

    console.log(`Status Busca: ${res.status} ${res.statusText}`);
    const contentType = res.headers.get('content-type') || '';
    console.log(`Content-Type retornado: ${contentType}`);

    if (res.status === 200) {
      const buffer = await res.arrayBuffer();
      const nodeBuffer = Buffer.from(buffer);
      
      // Checa se o buffer começa com 'PK' (cabeçalho ZIP)
      if (nodeBuffer.length > 4 && nodeBuffer.toString('utf8', 0, 2) === 'PK') {
        const zipPath = 'e:\\Projetos Finalizados\\projeto-cotacao-2025\\cotacao-backend\\scratch\\sieg_xmls.zip';
        fs.writeFileSync(zipPath, nodeBuffer);
        console.log(`   [SUCESSO] Recebeu arquivo ZIP! Salvo em: ${zipPath} (${nodeBuffer.length} bytes)`);
      } else {
        // Tenta ler como texto caso não seja ZIP (pode ser JSON)
        const text = nodeBuffer.toString('utf8');
        console.log('   Resposta de sucesso (não ZIP):', text.substring(0, 1000));
      }
    } else {
      const text = await res.text();
      console.error('   API retornou falha:', text);
    }

  } catch (err) {
    console.error('Erro de busca:', err.message);
  }
}

runTest();
