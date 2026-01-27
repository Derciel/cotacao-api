import { DataSource } from 'typeorm';
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL;

const dataSource = new DataSource({
    type: 'postgres',
    url: dbUrl,
    synchronize: false,
    ssl: { rejectUnauthorized: false },
    extra: { ssl: { rejectUnauthorized: false } },
});

async function run() {
    try {
        await dataSource.initialize();
        const qr = dataSource.createQueryRunner();
        const columns = await qr.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'quotations'
        `);
        console.log(JSON.stringify(columns, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await dataSource.destroy();
    }
}
run();
