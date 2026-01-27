import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncQuotationsTable1769000000000 implements MigrationInterface {
    public async up(query_runner: QueryRunner): Promise<void> {
        // Garantindo que a tabela quotations tenha todas as colunas necessárias
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "numero_pedido_manual" VARCHAR(50)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "data_cotacao" DATE`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "prazo_pagamento" VARCHAR(255)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "dias_para_entrega" INTEGER`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "valor_total_produtos" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "transportadora_escolhida" VARCHAR(255)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "valor_frete" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "tipo_frete" VARCHAR(255)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "obs" TEXT`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'PENDENTE'`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "empresa_faturamento" VARCHAR(50) DEFAULT 'NICOPEL'`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "percentual_ipi" NUMERIC(5,2)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "valor_ipi" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "valor_total_nota" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // Ajuste de tipo para numero_pedido_manual se já existir mas com outro tipo
        // (Opcional, mas seguro se houver divergências)
        await query_runner.query(`ALTER TABLE "quotations" ALTER COLUMN "numero_pedido_manual" TYPE VARCHAR(50)`);
    }

    public async down(query_runner: QueryRunner): Promise<void> {
        // Não removemos colunas no down para evitar perda de dados em caso de rollback acidental de schema
    }
}
