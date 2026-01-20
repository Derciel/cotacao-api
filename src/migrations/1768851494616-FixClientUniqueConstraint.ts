import { MigrationInterface, QueryRunner } from "typeorm";

export class FixClientUniqueConstraint1234567890 { // O número será gerado automaticamente
    public async up(query_runner: QueryRunner): Promise<void> {
        // 1. Remove a restrição de unicidade antiga apenas do CNPJ
        // Nota: Verifique o nome real da constraint no seu banco (ex: UQ_cnpj_index)
        await query_runner.query(`ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "UQ_cnpj_unique"`);

        // 2. Cria o novo índice composto único
        await query_runner.query(`CREATE UNIQUE INDEX "IDX_client_cnpj_empresa" ON "clients" ("cnpj", "empresa_faturamento")`);
    }

    public async down(query_runner: QueryRunner): Promise<void> {
        await query_runner.query(`DROP INDEX "IDX_client_cnpj_empresa"`);
        await query_runner.query(`ALTER TABLE "clients" ADD CONSTRAINT "UQ_cnpj_unique" UNIQUE ("cnpj")`);
    }
}