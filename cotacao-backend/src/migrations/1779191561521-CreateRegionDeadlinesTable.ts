import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRegionDeadlinesTable1779191561521 implements MigrationInterface {
    name = 'CreateRegionDeadlinesTable1779191561521'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Criar tabela region_deadlines de forma isolada e segura
        await queryRunner.query(`
            CREATE TABLE "region_deadlines" (
                "id" SERIAL NOT NULL, 
                "cidade" character varying NOT NULL, 
                "uf" character varying NOT NULL, 
                "cep_prefix" character varying, 
                "carrier" character varying NOT NULL, 
                "deadline" integer NOT NULL, 
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "PK_4817315677ea21144c587c6f99e" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_273277683ceeebacd3c2145caf" ON "region_deadlines" ("cidade", "uf", "carrier")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_273277683ceeebacd3c2145caf"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "region_deadlines"`);
    }
}
