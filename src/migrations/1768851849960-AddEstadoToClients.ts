import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEstadoToClients123456789 {
    public async up(query_runner: QueryRunner): Promise<void> {
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN "estado" VARCHAR DEFAULT 'PR'`);
    }

    public async down(query_runner: QueryRunner): Promise<void> {
        await query_runner.query(`ALTER TABLE "clients" DROP COLUMN "estado"`);
    }
}