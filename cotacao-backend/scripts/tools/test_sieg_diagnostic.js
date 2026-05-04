import axios from 'axios';

const apiKey = 'vFPmjhnVBtimeq19FX6yXosGF8PznplfoA9yGbj2DIs';
const email = 'ti@nicopel.com.br';
const baseUrl = 'https://api.sieg.com/aws/service.svc';

async function testSieg() {
    console.log('--- Iniciando Teste de Conexão SIEG ---');
    console.log(`Email: ${email}`);
    
    try {
        const payload = {
            apikey: apiKey,
            email: email,
            type: 'cte'
        };

        console.log('Enviando requisição para getxml...');
        const response = await axios.post(`${baseUrl}/getxml`, payload);
        
        if (response.data && Array.isArray(response.data)) {
            console.log(`SUCESSO! Foram encontrados ${response.data.length} documentos.`);
            console.log('Últimos 3 documentos:');
            response.data.slice(0, 3).forEach(doc => {
                console.log(`- Data: ${doc.Date}, Chave: ${doc.XmlKey.substring(0, 20)}...`);
            });
        } else {
            console.log('Resposta inesperada ou vazia:', response.data);
        }
    } catch (error) {
        console.error('ERRO na conexão:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados:', error.response.data);
        }
    }
}

testSieg();
