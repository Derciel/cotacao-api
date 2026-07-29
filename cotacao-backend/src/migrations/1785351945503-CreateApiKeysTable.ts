import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateApiKeysTable1785351945503 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Criar o ENUM correspondente
        await queryRunner.query(`CREATE TYPE "api_keys_role_enum" AS ENUM('READ_ONLY', 'FULL_ACCESS')`);

        // Criar a tabela api_keys
        await queryRunner.query(`
            CREATE TABLE "api_keys" (
                "id" SERIAL NOT NULL,
                "key" varchar NOT NULL,
                "name" varchar NOT NULL,
                "user_id" integer NOT NULL,
                "role" "api_keys_role_enum" NOT NULL DEFAULT 'READ_ONLY',
                "expires_at" TIMESTAMP NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_api_keys_key" UNIQUE ("key"),
                CONSTRAINT "PK_api_keys_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_api_keys_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "api_keys"`);
        await queryRunner.query(`DROP TYPE "api_keys_role_enum"`);
    }

}
