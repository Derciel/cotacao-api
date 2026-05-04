const axios = require('axios');

async function testZeroPadded(nf, cnpj) {
    const url = 'https://ssw.inf.br/api/tracking';
    const roles = ['RS', 'DS'];

    // Testar com e sem zeros à esquerda para total de 9 dígitos (comum em NFs)
    const padded = nf.padStart(9, '0');
    const simple = nf;

    for (const n of [simple, padded]) {
        for (const role of roles) {
            try {
                process.stdout.write(`Testing NF ${n} as ${role}... `);
                const payload = { NR: n, JSON: 'S' };
                payload[role] = cnpj;

                const response = await axios.post(url, new URLSearchParams(payload).toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                    timeout: 5000
                });

                if (JSON.stringify(response.data).includes('success":true')) {
                    console.log(`FOUND!`);
                } else {
                    console.log(`Not found.`);
                }
            } catch (e) {
                console.log(`Error: ${e.message}`);
            }
        }
    }
}

testZeroPadded('1065957', '10815855000124');
