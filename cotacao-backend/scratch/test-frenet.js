import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const ceps = [
    { cep: '79904596', desc: 'Ponta Porã - MS (Histórico: TEX R$ 99.18)' },
    { cep: '78557247', desc: 'Sinop - MT (Histórico: TEX R$ 318.22)' },
    { cep: '03323000', desc: 'São Paulo - SP (Histórico: Tex Encomendas R$ 65.42)' },
    { cep: '79010241', desc: 'Campo Grande - MS (Histórico: Tex Encomendas R$ 214.62)' }
];

async function run() {
    const url = process.env.FRENET_URL || 'https://api.frenet.com.br/shipping/quote';
    
    for (const item of ceps) {
        console.log(`\n========================================`);
        console.log(`Testando CEP ${item.cep} - ${item.desc}`);
        const payload = {
            SellerCEP: process.env.SELLER_CEP.replace(/\D/g, ''),
            RecipientCEP: item.cep.replace(/\D/g, ''),
            ShipmentInvoiceValue: 500,
            ShippingItemArray: [{
                Weight: 5, // Peso um pouco maior
                Width: 20,
                Height: 20,
                Length: 20,
                Quantity: 1
            }]
        };

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'token': process.env.FRENET_API_TOKEN,
                    'Content-Type': 'application/json'
                }
            });
            
            const options = response.data.ShippingSevicesArray || [];
            console.log(`Transportadoras retornadas (${options.length}):`);
            options.forEach(opt => {
                console.log(`- Carrier: "${opt.Carrier}" | Desc: "${opt.ServiceDescription}" | Preço: R$ ${opt.ShippingPrice} | Prazo: ${opt.DeliveryTime} dias`);
            });
        } catch (e) {
            console.error(`Erro para o CEP ${item.cep}:`, e.response ? e.response.data : e.message);
        }
    }
}
run();
