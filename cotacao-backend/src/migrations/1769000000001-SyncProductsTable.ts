import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncProductsTable1769000000001 implements MigrationInterface {
    public async up(query_runner: QueryRunner): Promise<void> {
        // Garantindo que a tabela products tenha todas as colunas necessárias para o Seed e Operação
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "peso_caixa_kg" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unidades_caixa" INTEGER DEFAULT 1`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "categoria" VARCHAR(20) DEFAULT 'POTE'`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "valor_unitario" NUMERIC(10,2) DEFAULT 0`);

        // Garante que as colunas de data existem
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    }

    public async down(query_runner: QueryRunner): Promise<void> {
        // Não removemos para segurança
    }
}
