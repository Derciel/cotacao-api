import axios from 'axios';

async function run() {
  try {
    console.log('1. Realizando login para obter token JWT...');
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    const token = loginRes.data.access_token;
    console.log('Login efetuado com sucesso! Token:', token.substring(0, 30) + '...');

    // Pega as datas dos últimos 30 dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const payload = {
      cnpjs: [],
      startDate: startDate.toISOString().substring(0, 10),
      endDate: endDate.toISOString().substring(0, 10)
    };

    console.log(`2. Chamando api/audit/sieg-query com datas: ${payload.startDate} a ${payload.endDate}...`);
    
    const queryRes = await axios.post('http://localhost:3000/api/audit/sieg-query', payload, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Resposta do SIEG com sucesso!', queryRes.data.length, 'registros.');
  } catch (error) {
    console.error('Erro na requisição!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados do Erro:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Mensagem:', error.message);
    }
  }
}

run();
