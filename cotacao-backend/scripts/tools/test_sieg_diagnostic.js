import axios from 'axios';

const apiKey = 'vFPmjhnVBtimeq19FX6yXosGF8PznplfoA9yGbj2DIs';
const email = 'ti@nicopel.com.br';

async function testSiegHeaders() {
    console.log('--- Teste SIEG (Auth via Headers) ---');
    
    // Tentando o novo endpoint REST que parece mais provável
    const url = 'https://api.sieg.com/api/v1/cte/download'; 
    
    try {
        console.log(`Enviando GET para ${url} com Headers...`);
        const response = await axios.get(url, {
            headers: {
                'apikey': apiKey,
                'email': email,
                'Content-Type': 'application/json'
            },
            params: {
                // Se for GET, os filtros vão aqui
                'take': 5
            },
            timeout: 15000
        });
        
        console.log('SUCESSO!');
        console.log('Status:', response.status);
        console.log('Documentos:', response.data);
    } catch (error) {
        console.log('FALHA!');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Dados:', JSON.stringify(error.response.data));
        } else {
            console.log('Mensagem:', error.message);
        }
    }
}

testSiegHeaders();
