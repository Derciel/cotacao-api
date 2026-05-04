const axios = require('axios');

async function testWithCH(nf, cnpj) {
    const url = 'https://ssw.inf.br/api/tracking';

    try {
        console.log(`\n--- Testando com CH (Chave/Senha) ---`);
        const payload = {
            NR: nf,
            DS: cnpj, // Tentando como destinatário
            JSON: 'S',
            // Algumas integrações usam CH ou senha
            CH: '' // Tentando vazio primeiro
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

// NF 1065957, CNPJ 10815855000124
testWithCH('1065957', '10815855000124');
