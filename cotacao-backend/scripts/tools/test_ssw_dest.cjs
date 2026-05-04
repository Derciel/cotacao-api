const axios = require('axios');

async function testVariant(nf, cnpj) {
    const url = 'https://ssw.inf.br/api/tracking';

    // Alguns sistemas usam 'dest' em vez de 'DS' para destinatário
    try {
        console.log(`\n--- Testando com parâmetro 'dest' ---`);
        const payload = {
            NR: nf,
            dest: cnpj,
            JSON: 'S'
        };

        const response = await axios.post(url, new URLSearchParams(payload).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            timeout: 8000
        });

        console.log(`Status:`, response.status);
        console.log(`Data:`, JSON.stringify(response.data).substring(0, 500));
    } catch (error) {
        console.log(`Erro:`, error.message);
    }
}

testVariant('1065957', '10815855000124');
