const axios = require('axios');

async function testResultSSW(nf, cnpj) {
    const url = 'https://ssw.inf.br/2/ssw_resultSSW';

    try {
        console.log(`\n--- Testando Endpoint Alternativo ssw_resultSSW ---`);
        // No print do usuário, é por destinatário
        const payload = {
            NR: nf,
            cnpj: cnpj, // Algumas docs sugerem 'cnpj' minúsculo
            tipo: 'D' // D para Destinatário?
        };

        const response = await axios.post(url, new URLSearchParams(payload).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            timeout: 8000
        });

        console.log(`Status:`, response.status);
        // Se retornar HTML, vamos ver se tem a palavra "Lauro de Freitas" ou "Envia Rapido" do print
        const html = response.data;
        if (typeof html === 'string') {
            console.log(`HTML Length:`, html.length);
            if (html.includes('Lauro de Freitas') || html.includes('Envia Rapido')) {
                console.log(`!!!!! SUCESSO: Dados encontrados no HTML do resultSSW !!!!!`);
            } else {
                console.log(`Dados não encontrados no HTML.`);
                // Mostrar um pedaço do body pra ver o erro
                console.log(`Sample:`, html.substring(0, 500));
            }
        }
    } catch (error) {
        console.log(`Erro:`, error.message);
    }
}

testResultSSW('1065957', '10815855000124');
