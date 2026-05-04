import { MigrationInterface, QueryRunner } from "typeorm";

export class CleanupClientConstraints1769000000004 implements MigrationInterface {
    public async up(query_runner: QueryRunner): Promise<void> {
        // 1. Remove a restrição de CNPJ único (Antiga) que bloqueia múltiplos faturamentos para o mesmo CNPJ
        // Vimos que o nome real é UQ_c2528f5ea78df3e939950b861c0
        await query_runner.query(`ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "UQ_c2528f5ea78df3e939950b861c0"`);
        await query_runner.query(`ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "UQ_cnpj_unique"`); // Por garantia

        // 2. Garante que o índice composto existe (CNPJ + Empresa)
        await query_runner.query(`DROP INDEX IF EXISTS "IDX_cnpj_empresa"`);
        await query_runner.query(`CREATE UNIQUE INDEX "IDX_cnpj_empresa" ON "clients" ("cnpj", "empresa_faturamento")`);
    }

    public async down(query_runner: QueryRunner): Promise<void> {
        // Não faz sentido voltar para a restrição quebrada, mas se necessário:
        // await query_runner.query(`ALTER TABLE "clients" ADD CONSTRAINT "UQ_cnpj_unique" UNIQUE ("cnpj")`);
    }
}
