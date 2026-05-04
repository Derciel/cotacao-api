const axios = require('axios');

async function testSSW(nf, cnpj) {
    const url = 'https://ssw.inf.br/api/tracking';
    const roles = ['RS', 'DS'];

    for (const role of roles) {
        try {
            console.log(`\n--- Testando NF: ${nf}, Role: ${role}, CNPJ: ${cnpj} ---`);
            const payload = { NR: nf, JSON: 'S' };
            payload[role] = cnpj;

            const response = await axios.post(url, new URLSearchParams(payload).toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                timeout: 8000
            });

            console.log(`Status:`, response.status);
            console.log(`Data:`, JSON.stringify(response.data).substring(0, 500));

            if (JSON.stringify(response.data).includes('success":true')) {
                console.log(`!!!!! ENCONTRADO EM ${role} com NF ${nf} !!!!!`);
            }
        } catch (error) {
            console.log(`Erro em ${role}:`, error.message);
        }
    }
}

testSSW('65957', '10815855000124');
