const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();

        console.log('--- Fetching users to fix permissions ---');
        const res = await client.query('SELECT id, permissions FROM users');

        for (const user of res.rows) {
            let perms = user.permissions;
            if (typeof perms === 'string') {
                try {
                    // Se estiver com aspas extras ou escapado
                    const parsed = JSON.parse(perms);
                    if (typeof parsed === 'string') {
                        // Double stringified! Parse novamente
                        const final = JSON.parse(parsed);
                        if (Array.isArray(final)) {
                            console.log(`Fixing user ${user.id}...`);
                            await client.query('UPDATE users SET permissions = $1 WHERE id = $2', [JSON.stringify(final), user.id]);
                        }
                    }
                } catch (e) {
                    // Não é JSON válido ou algo assim, ignorar ou logar
                }
            }
        }

        console.log('--- Data fix complete ---');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
run();
