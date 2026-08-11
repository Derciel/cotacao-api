import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemsatxTrucksRoutes20260811111030 implements MigrationInterface {
    name = 'CreateSystemsatxTrucksRoutes20260811111030'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "systemsatx_trucks" (
                "id" SERIAL NOT NULL,
                "licensePlate" character varying NOT NULL,
                "model" character varying NOT NULL,
                "year" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_2b2e7f6c9c5b3e8f4a1d2c3b4a5" UNIQUE ("licensePlate"),
                CONSTRAINT "PK_systemsatx_trucks" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "systemsatx_routes" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "coordinates" json NOT NULL,
                "expectedPath" json,
                "deviationThreshold" integer NOT NULL DEFAULT 100,
                "truckId" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_systemsatx_routes" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_systemsatx_routes_truckId" ON "systemsatx_routes" ("truckId")
        `);

        await queryRunner.query(`
            ALTER TABLE "systemsatx_routes"
            ADD CONSTRAINT "FK_systemsatx_routes_truckId"
            FOREIGN KEY ("truckId")
            REFERENCES "systemsatx_trucks"("id")
            ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "systemsatx_routes"
            DROP CONSTRAINT "FK_systemsatx_routes_truckId"
        `);

        await queryRunner.query(`
            DROP INDEX "IDX_systemsatx_routes_truckId"
        `);

        await queryRunner.query(`
            DROP TABLE "systemsatx_routes"
        `);

        await queryRunner.query(`
            DROP TABLE "systemsatx_trucks"
        `);
    }
}