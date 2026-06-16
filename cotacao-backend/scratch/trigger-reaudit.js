import axios from 'axios';

async function run() {
  try {
    console.log('1. Realizando login para obter token JWT...');
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    const token = loginRes.data.access_token;
    console.log('Login efetuado com sucesso!');

    console.log('2. Chamando api/audit/maintenance/reaudit-all para limpar e re-auditar todo o histórico de dados...');
    const res = await axios.post('http://localhost:3000/api/audit/maintenance/reaudit-all', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Resultado da re-auditoria:', JSON.stringify(res.data, null, 2));

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
