const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const products = [
    { nome: '16 OITAV - SERIGRAFIA', peso_caixa_kg: 3, medida_cm: '22X22X19', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '20 OITAV - SERIGRAFIA', peso_caixa_kg: 3, medida_cm: '28X28X31', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '25 OITAV - SERIGRAFIA', peso_caixa_kg: 5, medida_cm: '33.5X33.5X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '30 OITAV - SERIGRAFIA', peso_caixa_kg: 7, medida_cm: '38.5X38.5X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '35 OITAV - SERIGRAFIA', peso_caixa_kg: 9, medida_cm: '44X44X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '40 OITAV - SERIGRAFIA', peso_caixa_kg: 12, medida_cm: '49.5X49.5X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '45 OITAV - SERIGRAFIA', peso_caixa_kg: 13, medida_cm: '54.5X54.5X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '50 OITAV - SERIGRAFIA', peso_caixa_kg: 15, medida_cm: '59X59X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '60 OITAV - SERIGRAFIA', peso_caixa_kg: 24, medida_cm: '70X70X16.5', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '20Q - SERIGRAFIA', peso_caixa_kg: 7, medida_cm: '56X27X32', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '25Q - SERIGRAFIA', peso_caixa_kg: 12, medida_cm: '71X36X32', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '29Q - SERIGRAFIA', peso_caixa_kg: 12, medida_cm: '75X37X33', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '30Q - SERIGRAFIA', peso_caixa_kg: 7, medida_cm: '83X41X16', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '35Q - SERIGRAFIA', peso_caixa_kg: 9, medida_cm: '91X45X16', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '40Q - SERIGRAFIA', peso_caixa_kg: 12, medida_cm: '101X50X17', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '25 QTS - SERIGRAFIA', peso_caixa_kg: 7, medida_cm: '49X35X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '30 QTS - SERIGRAFIA', peso_caixa_kg: 10, medida_cm: '53X40X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '35 QTS - SERIGRAFIA', peso_caixa_kg: 13, medida_cm: '56X44X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '40 QTS - SERIGRAFIA', peso_caixa_kg: 14, medida_cm: '62X49X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'D25 - SERIGRAFIA', peso_caixa_kg: 10, medida_cm: '57X40X32', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'D30 - SERIGRAFIA', peso_caixa_kg: 11, medida_cm: '62X45X32', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'D35 - SERIGRAFIA', peso_caixa_kg: 12, medida_cm: '67X50X32', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'D40 - SERIGRAFIA', peso_caixa_kg: 15, medida_cm: '73X55X32', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'S2A - SERIGRAFIA', peso_caixa_kg: 12, medida_cm: '52X40X20', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'S3A - SERIGRAFIA', peso_caixa_kg: 9, medida_cm: '49X38X20', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'S4A - SERIGRAFIA', peso_caixa_kg: 13, medida_cm: '56X43X20', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'S1 - SERIGRAFIA', peso_caixa_kg: 6, medida_cm: '52X51X31', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'S2 - SERIGRAFIA', peso_caixa_kg: 7, medida_cm: '60X52X32', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'S3 - SERIGRAFIA', peso_caixa_kg: 7, medida_cm: '61X61X16', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'S4 - SERIGRAFIA', peso_caixa_kg: 10, medida_cm: '70X75X16', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'ESF 02 - SERIGRAFIA', peso_caixa_kg: 6, medida_cm: '49X27X31', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'ESF 03 - SERIGRAFIA', peso_caixa_kg: 6, medida_cm: '49X31X30', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'ESF 05 - SERIGRAFIA', peso_caixa_kg: 4, medida_cm: '58X30X16', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'ESF 07 - SERIGRAFIA', peso_caixa_kg: 8, medida_cm: '62X30X32', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'ESF 08 - SERIGRAFIA', peso_caixa_kg: 10, medida_cm: '64X31X34', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'ESF 10 - SERIGRAFIA', peso_caixa_kg: 11, medida_cm: '65X37X30', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'ESF 15 - SERIGRAFIA', peso_caixa_kg: 12, medida_cm: '66X38X34', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'ESF 16 - SERIGRAFIA', peso_caixa_kg: 13, medida_cm: '74X37X30', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '50X30 - SERIGRAFIA', peso_caixa_kg: 26, medida_cm: '71X41X33', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '70X35 - SERIGRAFIA', peso_caixa_kg: 40, medida_cm: '90X44X32', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: '100X35 - SERIGRAFIA', peso_caixa_kg: 24, medida_cm: '110X44X33', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'BOLO 02 - SERIGRAFIA', peso_caixa_kg: 7, medida_cm: '44X60X17', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'BOLO 03 - SERIGRAFIA', peso_caixa_kg: 10, medida_cm: '47X66X27', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'BOLO 04 - SERIGRAFIA', peso_caixa_kg: 13, medida_cm: '52X70X26', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'BOLO 05 - SERIGRAFIA', peso_caixa_kg: 16, medida_cm: '57X78X26', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'BOLO 06 - SERIGRAFIA', peso_caixa_kg: 19, medida_cm: '84X63X24', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'BOLO 23 - SERIGRAFIA', peso_caixa_kg: 7, medida_cm: '63X48X18', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'BOLO 28 (BAIXA) - SERIGRAFIA', peso_caixa_kg: 8, medida_cm: '66X54X17', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'BOLO 28 (ALTA) - SERIGRAFIA', peso_caixa_kg: 8, medida_cm: '85X65X16', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'BOLO 33 - SERIGRAFIA', peso_caixa_kg: 14, medida_cm: '72X58X26', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'BOLO 33 (ALTA) - SERIGRAFIA', peso_caixa_kg: 14, medida_cm: '89X69X17', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'R1 - SERIGRAFIA', peso_caixa_kg: 10, medida_cm: '71X28X19', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'R2 - SERIGRAFIA', peso_caixa_kg: 12, medida_cm: '84X29X32', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'R7 - SERIGRAFIA', peso_caixa_kg: 13, medida_cm: '58X48X16', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'R8 - SERIGRAFIA', peso_caixa_kg: 13, medida_cm: '90X43X32', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'R12 - SERIGRAFIA', peso_caixa_kg: 18, medida_cm: '74X52X32', unidades_caixa: 50, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'RM - SERIGRAFIA', peso_caixa_kg: 4.5, medida_cm: '65X24X10', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'CALZONE G - SERIGRAFIA', peso_caixa_kg: 12, medida_cm: '58X50X32', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' },
    { nome: 'CALZONE P - SERIGRAFIA', peso_caixa_kg: 5.5, medida_cm: '40X34X32', unidades_caixa: 100, valor_unitario: 0, categoria: 'CAIXA' }
];

async function run() {
    try {
        await client.connect();
        console.log('Processing Serigrafia products...');

        for (const p of products) {
            const checkRes = await client.query('SELECT id FROM products WHERE nome = $1', [p.nome]);

            if (checkRes.rows.length > 0) {
                const id = checkRes.rows[0].id;
                console.log(`- Updating: ${p.nome} (ID: ${id})`);
                const updateQuery = `
                    UPDATE products SET
                        unidades_caixa = $1,
                        peso_caixa_kg = $2,
                        medida_cm = $3,
                        valor_unitario = $4,
                        categoria = $5,
                        updated_at = NOW()
                    WHERE id = $6;
                `;
                await client.query(updateQuery, [p.unidades_caixa, p.peso_caixa_kg, p.medida_cm, p.valor_unitario, p.categoria, id]);
            } else {
                console.log(`- Inserting: ${p.nome}`);
                const insertQuery = `
                    INSERT INTO products (nome, unidades_caixa, peso_caixa_kg, medida_cm, valor_unitario, categoria, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW());
                `;
                await client.query(insertQuery, [p.nome, p.unidades_caixa, p.peso_caixa_kg, p.medida_cm, p.valor_unitario, p.categoria]);
            }
        }

        console.log('Serigrafia products processed successfully.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
