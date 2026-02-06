const https = require('https');

function testApi() {
    const url = 'https://cotacao.nicopel.com.br/api/users';
    console.log(`Testando GET ${url}...`);

    https.get(url, (res) => {
        console.log(`Status: ${res.status || res.statusCode}`);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`Resposta: ${data.substring(0, 500)}`);
        });
    }).on('error', (e) => {
        console.error(`Erro:`, e.message);
    });
}

testApi();
