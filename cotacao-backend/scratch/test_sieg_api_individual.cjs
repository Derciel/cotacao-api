const fs = require('fs');

const CLIENT_ID = 'nicopel_cargo_e9ba8acde33f';
const SECRET_KEY = 'zdd0A5HXJJreO9uSAv0BpgPbUgluP7j2_tAigAY5iFM';
const API_KEY = 'vFPmjhnVBtimeq19FX6yXosGF8PznplfoA9yGbj2DIs';

// Chave válida extraída do nosso ZIP de teste
const TEST_KEY = '41260340186976000115570010001849161202603250';

async function runTest() {
  console.log('=== TESTE DE DOWNLOAD DE XML INDIVIDUAL DA SIEG ===');
  console.log(`Chave de Teste: ${TEST_KEY}`);

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

  // 2. Chamar o endpoint /api/v1/baixar-xml
  console.log('\n2. Buscando XML individual...');
  try {
    const payload = {
      ChaveXml: TEST_KEY,
      TipoXml: 2, // CTe
      BaixarEventos: false
    };

    const res = await fetch('https://api.sieg.com/api/v1/baixar-xml', {
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
      const rawText = await res.text();
      // Vamos gravar em arquivo para ver se é XML direto ou JSON
      const debugPath = 'e:\\Projetos Finalizados\\projeto-cotacao-2025\\cotacao-backend\\scratch\\sieg_xml_individual_debug.txt';
      fs.writeFileSync(debugPath, rawText, 'utf8');
      console.log(`   Resposta gravada em: ${debugPath}`);
      console.log(`   Início da resposta: ${rawText.substring(0, 200)}`);
    } else {
      const text = await res.text();
      console.error('   API retornou falha:', text);
    }

  } catch (err) {
    console.error('Erro de busca:', err.message);
  }
}

runTest();
