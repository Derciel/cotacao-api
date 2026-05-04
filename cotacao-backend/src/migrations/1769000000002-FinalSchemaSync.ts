import { MigrationInterface, QueryRunner } from "typeorm";

export class FinalSchemaSync1769000000002 implements MigrationInterface {
    public async up(query_runner: QueryRunner): Promise<void> {
        // --- PRODUCTS ---
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "nome" VARCHAR`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "peso_unitario_kg" NUMERIC(10,3)`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "peso_caixa_kg" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unidades_caixa" INTEGER DEFAULT 1`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "categoria" VARCHAR(20) DEFAULT 'POTE'`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "medida_cm" VARCHAR`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "valor_unitario" NUMERIC(10,2) DEFAULT 0`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await query_runner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // --- CLIENTS ---
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "razao_social" VARCHAR`);
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "fantasia" VARCHAR`);
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cnpj" VARCHAR`);
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cep" VARCHAR`);
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cidade" VARCHAR`);
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "estado" VARCHAR DEFAULT 'PR'`);
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "empresa_faturamento" VARCHAR(50)`);
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // --- QUOTATIONS ---
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "numero_pedido_manual" VARCHAR(50)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "client_id" INTEGER`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "data_cotacao" DATE`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "prazo_pagamento" VARCHAR`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "dias_para_entrega" INTEGER`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "valor_total_produtos" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "transportadora_escolhida" VARCHAR`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "valor_frete" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "tipo_frete" VARCHAR`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "obs" TEXT`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'PENDENTE'`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "empresa_faturamento" VARCHAR(50) DEFAULT 'NICOPEL'`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "percentual_ipi" NUMERIC(5,2)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "valor_ipi" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "valor_total_nota" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await query_runner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // --- QUOTATION_ITEMS ---
        await query_runner.query(`ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "quotation_id" INTEGER`);
        await query_runner.query(`ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "product_id" INTEGER`);
        await query_runner.query(`ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "quantidade" INTEGER`);
        await query_runner.query(`ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "valor_unitario_na_cotacao" NUMERIC(10,2)`);
        await query_runner.query(`ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "valor_total_item" NUMERIC(10,2)`);
    }

    public async down(query_runner: QueryRunner): Promise<void> {
    }
}
