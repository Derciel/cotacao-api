const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('Starting product category alignment...');

        // 1. Mark as POTE everything that has 'POTE' or 'TAMPA' in the name
        const resPote = await client.query(`
            UPDATE products 
            SET categoria = 'POTE' 
            WHERE nome ILIKE '%POTE%' OR nome ILIKE '%TAMPA%' 
            RETURNING id, nome;
        `);
        console.log(`- Updated ${resPote.rowCount} products to POTE.`);

        // 2. Mark as CAIXA everything else that corresponds to boxes
        const resCaixa = await client.query(`
            UPDATE products 
            SET categoria = 'CAIXA' 
            WHERE (nome ILIKE '%SERIGRAFIA%' 
               OR nome ILIKE '%BOLO%' 
               OR nome ILIKE '%CALZONE%' 
               OR nome ILIKE '%POKE%' 
               OR nome ILIKE '%EMB%' 
               OR nome ILIKE '%KIT TEMAKI%' 
               OR nome ILIKE '%BANDEJA%'
               OR nome ILIKE '%LUVA%')
               AND categoria != 'POTE';
        `);
        console.log(`- Updated ${resCaixa.rowCount} products to CAIXA.`);

        console.log('Category alignment finished successfully.');
    } catch (err) {
        console.error('Error during alignment:', err);
    } finally {
        await client.end();
    }
}

run();
