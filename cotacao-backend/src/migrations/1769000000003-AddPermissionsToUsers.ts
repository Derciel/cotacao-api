import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPermissionsToUsers1769000000003 implements MigrationInterface {
    public async up(query_runner: QueryRunner): Promise<void> {
        await query_runner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" TEXT`);
        await query_runner.query(`COMMENT ON COLUMN "users"."permissions" IS 'JSON array of permissions'`);
    }

    public async down(query_runner: QueryRunner): Promise<void> {
        await query_runner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "permissions"`);
    }
}
