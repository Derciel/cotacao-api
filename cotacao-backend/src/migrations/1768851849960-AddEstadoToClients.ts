import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEstadoToClients1768851849960 implements MigrationInterface {
    public async up(query_runner: QueryRunner): Promise<void> {
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "estado" VARCHAR DEFAULT 'PR'`);
    }

    public async down(query_runner: QueryRunner): Promise<void> {
        await query_runner.query(`ALTER TABLE "clients" DROP COLUMN "estado"`);
    }
}