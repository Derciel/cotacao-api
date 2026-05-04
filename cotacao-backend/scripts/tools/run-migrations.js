import { DataSource } from 'typeorm';
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
}

const dataSource = new DataSource({
    type: 'postgres',
    url: dbUrl,
    entities: ['./dist/**/*.entity.js'],
    migrations: ['./dist/migrations/*.js'],
    synchronize: false,
    ssl: { rejectUnauthorized: false },
    extra: { ssl: { rejectUnauthorized: false } },
});

async function run() {
    try {
        console.log('Initializing Data Source with URL:', dbUrl.split('@')[1]); // Log only the host part for security
        await dataSource.initialize();
        console.log('Successfully connected. Running migrations...');
        const migrations = await dataSource.runMigrations();
        if (migrations.length === 0) {
            console.log('No new migrations to run.');
        } else {
            console.log('Migrations executed:', migrations.map(m => m.name));
        }
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await dataSource.destroy();
    }
}

run();
