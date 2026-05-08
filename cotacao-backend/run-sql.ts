import { AppDataSource } from './data-source.ts';

async function run() {
    try {
        await AppDataSource.initialize();
        console.log("Conectado ao DB!");
        await AppDataSource.query(`ALTER TABLE "quotation_items" ALTER COLUMN "valor_unitario_na_cotacao" TYPE numeric(12,5)`);
        console.log("Precision atualizada com sucesso.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
