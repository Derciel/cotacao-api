import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { Client } from '../src/clients/entities/client.entity.js';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Client],
  ssl: {
    rejectUnauthorized: false,
  },
  synchronize: false,
});

async function run() {
  await dataSource.initialize();
  console.log("Banco conectado!");

  const repository = dataSource.getRepository(Client);

  const testCnpj = '99999999000199';
  const testEmpresa = 'NICOPEL';

  // Remove se já existir
  await repository.delete({ cnpj: testCnpj, empresa_faturamento: testEmpresa });

  try {
    console.log("Tentando cadastrar cliente de teste...");
    const client = repository.create({
      razao_social: 'Cliente Teste Ltda',
      fantasia: 'Cliente Teste',
      cnpj: testCnpj,
      cep: '86000000',
      cidade: 'Londrina',
      estado: 'PR',
      empresa_faturamento: testEmpresa,
    });

    const saved = await repository.save(client);
    console.log("Cliente salvo com sucesso:", saved);

    // Limpa o teste
    await repository.delete({ id: saved.id });
    console.log("Cliente de teste removido.");

  } catch (error: any) {
    console.error("ERRO AO SALVAR CLIENTE:", error);
  } finally {
    await dataSource.destroy();
  }
}

run().catch(console.error);
