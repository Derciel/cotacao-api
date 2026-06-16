import axios from 'axios';

async function testSiegNew() {
  const apiKey = 'zdd0A5HXJJreO9uSAv0BpgPbUgluP7j2_tAigAY5iFM';
  const email = 'ti@nicopel.com.br';
  const cnpjNicopel = '09012538000190';
  
  console.log('=== TESTANDO INTEGRAÇÃO SIEG (NOVAS CREDENCIAIS) ===');
  console.log(`Email / Client ID: ${email}`);
  console.log(`API Key / Secret Key: ${apiKey}`);
  
  // Vamos tentar o endpoint clásico v2 getdocs do SIEG
  const baseUrl = 'https://api.sieg.com/aws/service.svc/v2/getdocs';
  
  // Testaremos com filtro do CNPJ da Nicopel como Tomador
  const payload = {
    apikey: apiKey,
    email: email,
    type: 'cte'
  };
  
  try {
    console.log('\nEnviando requisição de teste para a API da SIEG...');
    const response = await axios.post(baseUrl, payload, { timeout: 15000 });
    
    console.log('\n[SUCESSO] COMUNICAÇÃO ESTABELECIDA COM A API DO SIEG!');
    if (response.data && Array.isArray(response.data)) {
      console.log(`Total de documentos recuperados: ${response.data.length}`);
      console.log('Detalhes do primeiro CT-e encontrado:');
      console.log(JSON.stringify(response.data[0], null, 2));
    } else {
      console.log('A API retornou dados com sucesso, mas em outro formato:', response.data);
    }
  } catch (error: any) {
    console.error('\n[ERRO] FALHA AO CONECTAR COM AS NOVAS CREDENCIAIS!');
    if (error.response) {
      console.error(`Status HTTP: ${error.response.status}`);
      console.error('Resposta do Servidor:', error.response.data);
    } else {
      console.error('Erro de Rede/Timeout:', error.message);
    }
  }
}

testSiegNew();
