import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncClientsTable1234567890 { // O número final é gerado automaticamente
    public async up(query_runner: QueryRunner): Promise<void> {
        // 1. Adiciona a coluna faltante de Empresa
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "empresa_faturamento" VARCHAR(50)`);

        // 2. Garante que a coluna createdAt existe
        await query_runner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // 3. Remove restrições antigas de CNPJ único para aplicar a nova lógica
        await query_runner.query(`ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "UQ_cnpj_unique"`);

        // 4. Cria o Índice Composto (CNPJ + Empresa)
        // Isso permite o mesmo CPF/CNPJ em empresas diferentes
        await query_runner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cnpj_empresa" ON "clients" ("cnpj", "empresa_faturamento")`);
    }

    public async down(query_runner: QueryRunner): Promise<void> {
        await query_runner.query(`DROP INDEX "IDX_cnpj_empresa"`);
        await query_runner.query(`ALTER TABLE "clients" DROP COLUMN "empresa_faturamento"`);
    }
}