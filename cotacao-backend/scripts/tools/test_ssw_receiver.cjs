const axios = require('axios');

async function testSSW(nf, cnpj, type) {
    console.log(`\n--- Testando SSW ${type} (NF: ${nf}, CNPJ: ${cnpj}) ---`);
    const url = 'https://ssw.inf.br/api/tracking';

    try {
        const payloadParams = { NR: nf, JSON: 'S' };
        if (type === 'RS') payloadParams.RS = cnpj;
        else payloadParams.DS = cnpj;

        const response = await axios.post(url, new URLSearchParams(payloadParams).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
        });

        console.log(`Status:`, response.status);
        console.log(`Data:`, JSON.stringify(response.data).substring(0, 500));
    } catch (error) {
        console.log(`Erro:`, error.message);
    }
}

async function run() {
    const nf = '1065957';
    const cnpj = '10815885000124'; // Exemplo Nicopel
    await testSSW(nf, cnpj, 'RS');
    await testSSW(nf, cnpj, 'DS');
}

run();
