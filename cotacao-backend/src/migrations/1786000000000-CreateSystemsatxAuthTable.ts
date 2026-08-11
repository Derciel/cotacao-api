import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSystemsatxAuthTable1786000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Criar a tabela systemsatx_auth
        await queryRunner.query(`
            CREATE TABLE "systemsatx_auth" (
                "id" SERIAL NOT NULL,
                "email" varchar NOT NULL,
                "password" varchar NOT NULL,
                "user_id" integer NOT NULL,
                "api_key_id" integer NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_systemsatx_auth_email" UNIQUE ("email"),
                CONSTRAINT "PK_systemsatx_auth_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_systemsatx_auth_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_systemsatx_auth_api_key" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE
            )
        `);

        // Criar índices para melhor performance
        await queryRunner.query(`CREATE INDEX "IDX_systemsatx_auth_email" ON "systemsatx_auth" ("email")`);
        await queryRunner.query(`CREATE INDEX "IDX_systemsatx_auth_user_id" ON "systemsatx_auth" ("user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_systemsatx_auth_api_key_id" ON "systemsatx_auth" ("api_key_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_systemsatx_auth_api_key_id"`);
        await queryRunner.query(`DROP INDEX "IDX_systemsatx_auth_user_id"`);
        await queryRunner.query(`DROP INDEX "IDX_systemsatx_auth_email"`);
        await queryRunner.query(`DROP TABLE "systemsatx_auth"`);
    }

}