const axios = require('axios');

async function testFinalVariants(nf, cnpj) {
    const url = 'https://ssw.inf.br/api/tracking';

    // Teste com CNPJ minúsculo e 'DS' vs 'cnpj'
    const payloads = [
        { NR: nf, DS: cnpj, JSON: 'S' },
        { NR: nf, cnpj: cnpj, tipo: 'D', JSON: 'S' },
        { NR: nf, RS: cnpj, JSON: 'S' }
    ];

    for (const p of payloads) {
        try {
            console.log(`\n--- Testando Payload: ${JSON.stringify(p)} ---`);
            const response = await axios.post(url, new URLSearchParams(p).toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                timeout: 8000
            });
            console.log(`Resposta:`, JSON.stringify(response.data).substring(0, 500));
        } catch (e) {
            console.log(`Erro: ${e.message}`);
        }
    }
}

testFinalVariants('65957', '10815855000124');
