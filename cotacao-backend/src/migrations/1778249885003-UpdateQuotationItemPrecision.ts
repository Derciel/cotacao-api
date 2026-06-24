import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateQuotationItemPrecision1778249885003 implements MigrationInterface {
    name = 'UpdateQuotationItemPrecision1778249885003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quotation_items" DROP CONSTRAINT IF EXISTS "FK_quotation_items_quotations_cascade"`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "FK_quotations_user"`);
        await queryRunner.query(`ALTER TABLE "audits" DROP CONSTRAINT IF EXISTS "audits_conferido_por_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "audits" DROP CONSTRAINT IF EXISTS "audits_quotation_id_fkey"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_client_cnpj_empresa"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_cnpj_empresa"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_audits_created_at"`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN IF EXISTS "created_at"`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN IF EXISTS "updated_at"`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "razao_social" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "cnpj" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "cep" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "cidade" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "estado" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "estado" DROP DEFAULT`);
        await queryRunner.query(`UPDATE "clients" SET "empresa_faturamento" = 'NICOPEL' WHERE "empresa_faturamento" IS NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "empresa_faturamento" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "createdAt" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "createdAt" SET DEFAULT now()`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."permissions" IS NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "nome" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "UQ_products_nome"`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "categoria" SET NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "products"."categoria" IS NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "created_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "updated_at" SET NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "quotation_items"."quantidade" IS 'Quantidade do produto (suporta valores fracionados).'`);
        await queryRunner.query(`ALTER TABLE "quotation_items" ALTER COLUMN "quantidade" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "quotation_items" ALTER COLUMN "valor_unitario_na_cotacao" TYPE numeric(12,5)`);
        await queryRunner.query(`COMMENT ON COLUMN "quotation_items"."valor_base_item" IS 'Valor base do item (sem IPI).'`);
        await queryRunner.query(`COMMENT ON COLUMN "quotation_items"."valor_ipi_item" IS 'Valor do IPI calculado para este item.'`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "UQ_quotations_numero_pedido_manual"`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN IF EXISTS "status"`);
        
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quotations_status_enum') THEN
                    CREATE TYPE "public"."quotations_status_enum" AS ENUM('PENDENTE', 'APROVADO', 'AGUARDANDO COLETA', 'ENVIADO', 'CANCELADO');
                END IF;
            END$$;
        `);

        await queryRunner.query(`ALTER TABLE "quotations" ADD "status" "public"."quotations_status_enum" NOT NULL DEFAULT 'PENDENTE'`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN IF EXISTS "nf"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "nf" character varying`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN IF EXISTS "data_coleta"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "data_coleta" character varying`);
        await queryRunner.query(`ALTER TABLE "quotations" ALTER COLUMN "is_test" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "quotations" ALTER COLUMN "created_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "quotations" ALTER COLUMN "updated_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "audits" ALTER COLUMN "quotation_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "audits" DROP COLUMN IF EXISTS "nfe_number"`);
        await queryRunner.query(`ALTER TABLE "audits" ADD "nfe_number" character varying`);
        await queryRunner.query(`ALTER TABLE "audits" DROP COLUMN IF EXISTS "cte_number"`);
        await queryRunner.query(`ALTER TABLE "audits" ADD "cte_number" character varying`);
        await queryRunner.query(`ALTER TABLE "audits" ALTER COLUMN "divergencia_valor" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "audits" DROP COLUMN IF EXISTS "status"`);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audits_status_enum') THEN
                    CREATE TYPE "public"."audits_status_enum" AS ENUM('OK', 'DIVERGENTE', 'CONFERIDO');
                END IF;
            END$$;
        `);

        await queryRunner.query(`ALTER TABLE "audits" ADD "status" "public"."audits_status_enum" NOT NULL DEFAULT 'OK'`);
        await queryRunner.query(`ALTER TABLE "audits" DROP COLUMN IF EXISTS "transportadora"`);
        await queryRunner.query(`ALTER TABLE "audits" ADD "transportadora" character varying`);
        await queryRunner.query(`ALTER TABLE "audits" ALTER COLUMN "created_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "audits" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ed628e0a49beffd658afa0641a" ON "clients" ("cnpj", "empresa_faturamento") `);

        const fk1Exists = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = 'FK_c9e2dea84928feba1d24874c160'`);
        if (fk1Exists.length === 0) {
            await queryRunner.query(`ALTER TABLE "quotation_items" ADD CONSTRAINT "FK_c9e2dea84928feba1d24874c160" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }
        
        const fk2Exists = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = 'FK_745e9b5cbcf0863a7bbe5c80424'`);
        if (fk2Exists.length === 0) {
            await queryRunner.query(`ALTER TABLE "quotations" ADD CONSTRAINT "FK_745e9b5cbcf0863a7bbe5c80424" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }
        
        const fk3Exists = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = 'FK_6ed7c94c07b02a2f84c344fb8ab'`);
        if (fk3Exists.length === 0) {
            await queryRunner.query(`ALTER TABLE "audits" ADD CONSTRAINT "FK_6ed7c94c07b02a2f84c344fb8ab" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }
        
        const fk4Exists = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = 'FK_76caba5dbe036078c37253a9af2'`);
        if (fk4Exists.length === 0) {
            await queryRunner.query(`ALTER TABLE "audits" ADD CONSTRAINT "FK_76caba5dbe036078c37253a9af2" FOREIGN KEY ("conferido_por_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audits" DROP CONSTRAINT "FK_76caba5dbe036078c37253a9af2"`);
        await queryRunner.query(`ALTER TABLE "audits" DROP CONSTRAINT "FK_6ed7c94c07b02a2f84c344fb8ab"`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "FK_745e9b5cbcf0863a7bbe5c80424"`);
        await queryRunner.query(`ALTER TABLE "quotation_items" DROP CONSTRAINT "FK_c9e2dea84928feba1d24874c160"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ed628e0a49beffd658afa0641a"`);
        await queryRunner.query(`ALTER TABLE "audits" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "audits" ALTER COLUMN "created_at" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "audits" DROP COLUMN "transportadora"`);
        await queryRunner.query(`ALTER TABLE "audits" ADD "transportadora" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "audits" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."audits_status_enum"`);
        await queryRunner.query(`ALTER TABLE "audits" ADD "status" character varying(50) DEFAULT 'OK'`);
        await queryRunner.query(`ALTER TABLE "audits" ALTER COLUMN "divergencia_valor" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "audits" DROP COLUMN "cte_number"`);
        await queryRunner.query(`ALTER TABLE "audits" ADD "cte_number" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "audits" DROP COLUMN "nfe_number"`);
        await queryRunner.query(`ALTER TABLE "audits" ADD "nfe_number" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "audits" ALTER COLUMN "quotation_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "quotations" ALTER COLUMN "updated_at" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "quotations" ALTER COLUMN "created_at" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "quotations" ALTER COLUMN "is_test" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "data_coleta"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "data_coleta" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "nf"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "nf" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."quotations_status_enum"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "status" character varying(50) DEFAULT 'PENDENTE'`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD CONSTRAINT "UQ_quotations_numero_pedido_manual" UNIQUE ("numero_pedido_manual")`);
        await queryRunner.query(`COMMENT ON COLUMN "quotation_items"."valor_ipi_item" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "quotation_items"."valor_base_item" IS NULL`);
        await queryRunner.query(`ALTER TABLE "quotation_items" ALTER COLUMN "valor_unitario_na_cotacao" TYPE numeric(12,4)`);
        await queryRunner.query(`ALTER TABLE "quotation_items" ALTER COLUMN "quantidade" DROP DEFAULT`);
        await queryRunner.query(`COMMENT ON COLUMN "quotation_items"."quantidade" IS NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "updated_at" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "created_at" DROP NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "products"."categoria" IS 'Define se o produto é POTE ou CAIXA para cálculo de IPI'`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "categoria" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "UQ_products_nome" UNIQUE ("nome")`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "nome" DROP NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."permissions" IS 'JSON array of permissions'`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "createdAt" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "empresa_faturamento"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "empresa_faturamento" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "estado" SET DEFAULT 'PR'`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "estado" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "cidade" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "cep" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "cnpj" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "razao_social" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "updated_at" TIMESTAMP DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "created_at" TIMESTAMP DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "idx_audits_created_at" ON "audits" ("created_at") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cnpj_empresa" ON "clients" ("cnpj", "empresa_faturamento") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_client_cnpj_empresa" ON "clients" ("cnpj", "empresa_faturamento") `);
        await queryRunner.query(`ALTER TABLE "audits" ADD CONSTRAINT "audits_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audits" ADD CONSTRAINT "audits_conferido_por_id_fkey" FOREIGN KEY ("conferido_por_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quotation_items" ADD CONSTRAINT "FK_quotation_items_quotations_cascade" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
