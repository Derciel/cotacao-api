import { DataSource } from 'typeorm';
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
}

const dataSource = new DataSource({
    type: 'postgres',
    url: dbUrl,
    ssl: { rejectUnauthorized: false },
    extra: { ssl: { rejectUnauthorized: false } },
});

async function check() {
    try {
        await dataSource.initialize();
        console.log('Connected.');

        const tables = ['products', 'clients', 'quotations', 'quotation_items', 'users'];

        for (const table of tables) {
            console.log(`\n--- TABLE: ${table} ---`);
            const columns = await dataSource.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '${table}'
                ORDER BY ordinal_position;
            `);
            columns.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type})`);
            });
        }
    } catch (e) {
        console.error('Check failed:', e);
    } finally {
        await dataSource.destroy();
    }
}

check();
