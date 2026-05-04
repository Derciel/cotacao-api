const axios = require('axios');

async function testSSW(nf, cnpj) {
    const url = 'https://ssw.inf.br/api/tracking';

    // Teste 1: Remetente (RS)
    try {
        console.log(`\n--- Testando SSW como REMETENTE (RS) ---`);
        const payloadRS = { NR: nf, RS: cnpj, JSON: 'S' };
        const resRS = await axios.post(url, new URLSearchParams(payloadRS).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        console.log(`Resposta RS:`, JSON.stringify(resRS.data).substring(0, 500));
    } catch (error) {
        console.log(`Erro RS:`, error.message);
    }

    // Teste 2: Destinatário (DS)
    try {
        console.log(`\n--- Testando SSW como DESTINATÁRIO (DS) ---`);
        const payloadDS = { NR: nf, DS: cnpj, JSON: 'S' };
        const resDS = await axios.post(url, new URLSearchParams(payloadDS).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        console.log(`Resposta DS:`, JSON.stringify(resDS.data).substring(0, 500));
    } catch (error) {
        console.log(`Erro DS:`, error.message);
    }
}

testSSW('65957', '10815855000124');
