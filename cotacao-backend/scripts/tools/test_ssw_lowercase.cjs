const axios = require('axios');

async function testLowercaseCNPJ(nf, cnpj) {
    const url = 'https://ssw.inf.br/api/tracking';

    try {
        console.log(`\n--- Testando com parâmetro 'cnpj' (minúsculo) ---`);
        const payload = {
            NR: nf,
            cnpj: cnpj, // Alguns exemplos usam 'cnpj' minúsculo no ssw_resultSSW, vamos testar na API
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

testLowercaseCNPJ('1065957', '10815855000124');
