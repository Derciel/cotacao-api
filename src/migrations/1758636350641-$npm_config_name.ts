import { MigrationInterface, QueryRunner } from "typeorm";

export class  $npmConfigName1758636350641 implements MigrationInterface {
    name = ' $npmConfigName1758636350641'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quotation_items" DROP CONSTRAINT "FK_quotation_items_quotations"`);
        await queryRunner.query(`ALTER TABLE "quotation_items" DROP CONSTRAINT "FK_quotation_items_products"`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_clients"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "numero_pedido_manual" character varying(50)`);
        await queryRunner.query(`COMMENT ON COLUMN "quotations"."numero_pedido_manual" IS 'Número do pedido/cotação definido manualmente pelo usuário'`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "razao_social"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "razao_social" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "fantasia"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "fantasia" character varying`);
        await queryRunner.query(`ALTER TABLE "clients" DROP CONSTRAINT "clients_cnpj_key"`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "cnpj"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "cnpj" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ADD CONSTRAINT "UQ_c2528f5ea78df3e939950b861c0" UNIQUE ("cnpj")`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "cep"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "cep" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "cidade"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "cidade" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "nome"`);
        await queryRunner.query(`ALTER TABLE "products" ADD "nome" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "medida_cm"`);
        await queryRunner.query(`ALTER TABLE "products" ADD "medida_cm" character varying`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "products" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "products" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "quotation_items" ADD CONSTRAINT "FK_c9e2dea84928feba1d24874c160" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quotation_items" ADD CONSTRAINT "FK_a37d018d835e122b911b30ca3bb" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD CONSTRAINT "FK_118e5246cab853e3c1d958732d8" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "FK_118e5246cab853e3c1d958732d8"`);
        await queryRunner.query(`ALTER TABLE "quotation_items" DROP CONSTRAINT "FK_a37d018d835e122b911b30ca3bb"`);
        await queryRunner.query(`ALTER TABLE "quotation_items" DROP CONSTRAINT "FK_c9e2dea84928feba1d24874c160"`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "products" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "products" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "medida_cm"`);
        await queryRunner.query(`ALTER TABLE "products" ADD "medida_cm" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "nome"`);
        await queryRunner.query(`ALTER TABLE "products" ADD "nome" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "cidade"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "cidade" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "cep"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "cep" character varying(9) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" DROP CONSTRAINT "UQ_c2528f5ea78df3e939950b861c0"`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "cnpj"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "cnpj" character varying(18) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clients" ADD CONSTRAINT "clients_cnpj_key" UNIQUE ("cnpj")`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "fantasia"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "fantasia" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "razao_social"`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "razao_social" character varying(255) NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "quotations"."numero_pedido_manual" IS 'Número do pedido/cotação definido manualmente pelo usuário'`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "numero_pedido_manual"`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_clients" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quotation_items" ADD CONSTRAINT "FK_quotation_items_products" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quotation_items" ADD CONSTRAINT "FK_quotation_items_quotations" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
