import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeProductValueNullable1772556731863 implements MigrationInterface {
    name = 'MakeProductValueNullable1772556731863'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_user"`);
        await queryRunner.query(`ALTER TABLE "quotation_items" DROP CONSTRAINT "FK_quotation_items_quotations_cascade"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_client_cnpj_empresa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cnpj_empresa"`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "nome" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "categoria" SET NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "products"."categoria" IS NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "valor_unitario" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "created_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "updated_at" SET NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."permissions" IS NULL`);
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
        await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "UQ_quotations_numero_pedido_manual"`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."quotations_status_enum" AS ENUM('PENDENTE', 'APROVADO', 'AGUARDANDO COLETA', 'ENVIADO', 'CANCELADO')`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "status" "public"."quotations_status_enum" NOT NULL DEFAULT 'PENDENTE'`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "nf"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "nf" character varying`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "data_coleta"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "data_coleta" character varying`);
        await queryRunner.query(`ALTER TABLE "quotations" ALTER COLUMN "is_test" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "quotations" ALTER COLUMN "created_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "quotations" ALTER COLUMN "updated_at" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ed628e0a49beffd658afa0641a" ON "clients" ("cnpj", "empresa_faturamento") `);
        await queryRunner.query(`ALTER TABLE "quotations" ADD CONSTRAINT "FK_745e9b5cbcf0863a7bbe5c80424" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quotation_items" ADD CONSTRAINT "FK_c9e2dea84928feba1d24874c160" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quotation_items" DROP CONSTRAINT "FK_c9e2dea84928feba1d24874c160"`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "FK_745e9b5cbcf0863a7bbe5c80424"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ed628e0a49beffd658afa0641a"`);
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
        await queryRunner.query(`COMMENT ON COLUMN "users"."permissions" IS 'JSON array of permissions'`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "updated_at" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "created_at" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "valor_unitario" SET NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "products"."categoria" IS 'Define se o produto é POTE ou CAIXA para cálculo de IPI'`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "categoria" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "nome" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "updated_at" TIMESTAMP DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "created_at" TIMESTAMP DEFAULT now()`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cnpj_empresa" ON "clients" ("cnpj", "empresa_faturamento") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_client_cnpj_empresa" ON "clients" ("cnpj", "empresa_faturamento") `);
        await queryRunner.query(`ALTER TABLE "quotation_items" ADD CONSTRAINT "FK_quotation_items_quotations_cascade" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
