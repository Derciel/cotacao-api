const axios = require('axios');

async function testAlternativeURL(nf, cnpj) {
    const url = 'https://ssw.inf.br/2/ssw_resultSSW';

    // Teste com tipo 'D' (Destinatário) nesse endpoint
    try {
        console.log(`\n--- Testando Endpoint /2/ssw_resultSSW com tipo D (Destinatário) ---`);
        const payload = {
            NR: nf,
            cnpj: cnpj,
            tipo: 'D'
        };

        const response = await axios.post(url, new URLSearchParams(payload).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });

        console.log(`Status:`, response.status);
        const html = response.data;
        if (typeof html === 'string') {
            console.log(`HTML Length:`, html.length);
            if (html.includes('LONDORINA') || html.includes('Envia Rapido') || html.includes('Lauro de Freitas')) {
                console.log(`!!!!! SUCESSO: Dados encontrados no HTML do resultSSW !!!!!`);
            } else {
                console.log(`Amostra do HTML (primeiros 500 chars):`, html.substring(0, 500));
            }
        }
    } catch (e) {
        console.log(`Erro no endpoint alternativo:`, e.message);
    }

    // Teste com tipo 'R' (Remetente) nesse endpoint
    try {
        console.log(`\n--- Testando Endpoint /2/ssw_resultSSW com tipo R (Remetente) ---`);
        const payloadR = { NR: nf, cnpj: cnpj, tipo: 'R' };
        const responseR = await axios.post(url, new URLSearchParams(payloadR).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        const htmlR = responseR.data;
        if (htmlR.includes('Envia Rapido')) console.log(`!!!!! SUCESSO: Dados encontrados com tipo R !!!!!`);
        else console.log(`Não encontrado com tipo R.`);
    } catch (e) { }
}

testAlternativeURL('65957', '10815855000124');
