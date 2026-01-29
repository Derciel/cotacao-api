import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNfAndDataColeta1769100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "nf" VARCHAR`);
        await queryRunner.query(`ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "data_coleta" VARCHAR`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "nf"`);
        await queryRunner.query(`ALTER TABLE "quotations" DROP COLUMN "data_coleta"`);
    }
}
