import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCepsToQuotations1770000000001 implements MigrationInterface {
    name = 'AddCepsToQuotations1770000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quotations" ADD "origem_cep" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD "destino_cep" character varying(10)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "destino_cep"`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "origem_cep"`);
    }

}
