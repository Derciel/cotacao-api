import axios from 'axios';
import 'dotenv/config';
import fs from 'fs';

async function run() {
  const apiKey = process.env.SIEG_API_KEY;
  const email = process.env.SIEG_EMAIL;
  
  // Chave real do CT-e da cotação 217
  const chave = '41260448161669000191570010000287081010929232';

  console.log('Testando GET GerarDacteViaChave com query params...');
  try {
    const url = `https://api.sieg.com/api/Arquivos/GerarDacteViaChave?apikey=${apiKey}&email=${email}&chave=${chave}`;
    const res = await axios.get(url);
    console.log('Status:', res.status);
    console.log('Tamanho da resposta:', res.data ? res.data.length : 0);
    if (res.data && typeof res.data === 'string') {
      console.log('Início da resposta (Base64?):', res.data.substring(0, 100));
      // Salva o PDF localmente na raiz do backend como teste
      const buffer = Buffer.from(res.data, 'base64');
      fs.writeFileSync('test-dacte.pdf', buffer);
      console.log('PDF gravado com sucesso em test-dacte.pdf');
    }
  } catch (error) {
    console.error('Erro na requisição por query string:', error.message);
    if (error.response) {
      console.error('Status do erro:', error.response.status);
      console.error('Dados do erro:', error.response.data);
    }
  }
}

run();
