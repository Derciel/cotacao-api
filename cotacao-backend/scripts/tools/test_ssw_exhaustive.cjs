const axios = require('axios');

async function testExhaustive(nf, cnpj) {
    const url = 'https://ssw.inf.br/api/tracking';
    const roles = ['RS', 'DS', 'PG'];
    const nfs = [nf, parseInt(nf).toString()]; // Com e sem zeros a esquerda se houver

    for (const n of nfs) {
        for (const role of roles) {
            try {
                console.log(`\n--- Testando NF: ${n}, Role: ${role}, CNPJ: ${cnpj} ---`);
                const payload = { NR: n, JSON: 'S' };
                payload[role] = cnpj;

                const response = await axios.post(url, new URLSearchParams(payload).toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                    timeout: 8000
                });

                console.log(`Status:`, response.status);
                const dataStr = JSON.stringify(response.data);
                console.log(`Data (primeiros 300 chars):`, dataStr.substring(0, 300));

                if (dataStr.includes('success":true') || (typeof response.data === 'string' && response.data.includes('<success>true</success>'))) {
                    console.log(`!!!!! SUCESSO ENCONTRADO EM ${role} com NF ${n} !!!!!`);
                }
            } catch (error) {
                console.log(`Erro em ${role}/${n}:`, error.message);
            }
        }
    }
}

// O usuário mandou NF 1065957 e CNPJ 10815855000124
testExhaustive('1065957', '10815855000124');
