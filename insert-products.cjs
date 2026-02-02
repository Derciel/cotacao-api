const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const products = [
    { nome: 'POTE 120ML - Matsuri', unidades_caixa: 1000, peso_caixa_kg: 5, medida_cm: '36x28x47', valor_unitario: 0.38, categoria: 'POTE' },
    { nome: 'POTE 240ML - Matsuri', unidades_caixa: 1000, peso_caixa_kg: 9, medida_cm: '50x42x60', valor_unitario: 0.38, categoria: 'POTE' },
    { nome: 'TAMPA 120ML - Matsuri', unidades_caixa: 1000, peso_caixa_kg: 5, medida_cm: '45x37x44', valor_unitario: 0.11, categoria: 'POTE' },
    { nome: 'TAMPA 240ML - Matsuri', unidades_caixa: 1000, peso_caixa_kg: 5, medida_cm: '45x37x44', valor_unitario: 0.25, categoria: 'POTE' },
    { nome: 'Emb Box P - Matsuri', unidades_caixa: 100, peso_caixa_kg: 5, medida_cm: '47x42x09', valor_unitario: 1.59, categoria: 'CAIXA' },
    { nome: 'Emb Box M - Matsuri', unidades_caixa: 100, peso_caixa_kg: 7, medida_cm: '47x42x10', valor_unitario: 1.72, categoria: 'CAIXA' },
    { nome: 'Emb Box G - Matsuri', unidades_caixa: 100, peso_caixa_kg: 9, medida_cm: '53x42x10', valor_unitario: 2.22, categoria: 'CAIXA' },
    { nome: 'Emb p. R02 - Matsuri', unidades_caixa: 250, peso_caixa_kg: 8, medida_cm: '40x10x20', valor_unitario: 1.00, categoria: 'CAIXA' },
    { nome: 'Kit Temaki - Matsuri', unidades_caixa: 250, peso_caixa_kg: 3, medida_cm: '30x18x15', valor_unitario: 0.51, categoria: 'CAIXA' },
    { nome: 'Emb MokThe Poke PP', unidades_caixa: 250, peso_caixa_kg: 6, medida_cm: '37x27x15', valor_unitario: 1.40, categoria: 'CAIXA' },
    { nome: 'Emb MokThe Poke P', unidades_caixa: 250, peso_caixa_kg: 7, medida_cm: '37x27x20', valor_unitario: 1.40, categoria: 'CAIXA' },
    { nome: 'Emb MokThe Poke G', unidades_caixa: 200, peso_caixa_kg: 8, medida_cm: '37x27x25', valor_unitario: 1.45, categoria: 'CAIXA' },
    { nome: 'Luva cinta', unidades_caixa: 500, peso_caixa_kg: 5, medida_cm: '31x21x09', valor_unitario: 0.34, categoria: 'CAIXA' },
    { nome: 'Bandeja P - Poke', unidades_caixa: 250, peso_caixa_kg: 5, medida_cm: '34x23x12', valor_unitario: 0.90, categoria: 'CAIXA' }
];

async function run() {
    try {
        await client.connect();
        console.log('Processing products...');

        for (const p of products) {
            // Manual existence check by name
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

        console.log('All products processed successfully.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
