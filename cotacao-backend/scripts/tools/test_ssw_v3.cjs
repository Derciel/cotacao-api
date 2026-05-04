const axios = require('axios');

async function testV3(nf, cnpj) {
    const url = 'https://ssw.inf.br/api/tracking';

    // O usuário disse: "ignore o 1 0 do print"
    // No print aparece "N Fiscal: 1065957" (ou talvez 1 065957)
    // Se ignorar o "1 0", sobra "65957".
    // Mas as vezes o sistema espera 6 ou 7 dígitos.
    const variants = ['65957', '065957', '0065957', '1065957'];

    for (const v of variants) {
        try {
            console.log(`\n--- Testando NF: ${v} (Destinatário: ${cnpj}) ---`);
            const payload = { NR: v, DS: cnpj, JSON: 'S' };
            const res = await axios.post(url, new URLSearchParams(payload).toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                timeout: 8000
            });
            console.log(`Resposta:`, JSON.stringify(res.data).substring(0, 300));
        } catch (e) {
            console.log(`Erro: ${e.message}`);
        }
    }
}

testV3('65957', '10815855000124');
