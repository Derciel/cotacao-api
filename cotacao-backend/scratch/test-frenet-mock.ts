import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { FrenetService } from '../src/freight/frenet.service.js';
import { QuotationsService } from '../src/quotations/quotations.service.js';
import { Quotation } from '../src/quotations/entities/quotation.entity.js';
import { Client } from '../src/clients/entities/client.entity.js';
import { Product } from '../src/products/entities/product.entity.js';
import { DataSource } from 'typeorm';

async function bootstrap() {
  console.log('Iniciando bootstrap do NestJS...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const frenetService = app.get(FrenetService);
  const quotationsService = app.get(QuotationsService);
  const dataSource = app.get(DataSource);
  
  try {
    console.log('\n--- 1. TESTE DE SIMULAÇÃO INDIVIDUAL (simulateDeadline) ---');
    const options = await frenetService.simulateDeadline('86200000', 'Ibiporã');
    console.log('Opções de frete retornadas:');
    options.forEach(opt => {
        console.log(`- Carrier: "${opt.carrier}" | Preço: R$ ${opt.price} | Prazo: ${opt.deadline} dias | Rec: ${opt.recommendation}`);
    });
    
    const hasTex = options.some(opt => opt.carrier === 'TEX ENCOMENDAS');
    console.log('Tex Encomendas presente no resultado da simulação individual?', hasTex ? 'SIM' : 'NÃO');

    console.log('\n--- 2. TESTE DE COTAÇÃO EM LOTE COM ESCOLHA AUTOMÁTICA (createBatch) ---');
    
    // Obter um cliente e um produto válidos da base de dados local
    const dbClient = await dataSource.getRepository(Client).findOne({ where: {} });
    const dbProduct = await dataSource.getRepository(Product).findOne({ where: {} });
    
    if (!dbClient || !dbProduct) {
        throw new Error('Não foi possível obter um cliente ou produto do banco de dados para o teste em lote.');
    }
    
    console.log(`Usando Cliente: "${dbClient.razao_social}" (CNPJ: ${dbClient.cnpj})`);
    console.log(`Usando Produto: "${dbProduct.nome}" (ID: ${dbProduct.id})`);

    const batchPayload = {
      requests: [{
        cnpj: dbClient.cnpj,
        originCep: '86087350',
        empresaFaturamento: dbClient.empresa_faturamento || 'NICOPEL',
        items: [{
            productId: dbProduct.id,
            quantidade: 10
        }]
      }]
    };
    
    console.log(`Disparando cotação em lote para o CNPJ ${dbClient.cnpj} com mock da Tex ativo...`);
    const batchResults = await quotationsService.createBatch(batchPayload as any, { userId: 1, role: 'ADMIN' });
    console.log('Resultados da Cotação em Lote:');
    console.log(JSON.stringify(batchResults, null, 2));
    
    if (batchResults.length > 0 && batchResults[0].status === 'SUCCESS') {
        const quotationId = batchResults[0].id;
        console.log(`\nCotação #${quotationId} gerada com sucesso!`);
        
        // Buscar a cotação no banco para auditar os valores salvos
        const q = await quotationsService.findOne(quotationId);
        console.log('--- AUDITORIA DE VALORES DA COTAÇÃO FINALIZADA ---');
        console.log(`- ID Cotação: #${q.id}`);
        console.log(`- Cliente: ${q.client?.razao_social}`);
        console.log(`- Transportadora Escolhida: "${q.transportadora_escolhida}"`);
        console.log(`- Valor Frete Salvo: R$ ${q.valor_frete}`);
        console.log(`- Dias para Entrega: ${q.dias_para_entrega} dias`);
        console.log(`- Valor Total Produtos (Base): R$ ${q.valor_total_produtos}`);
        console.log(`- Valor IPI: R$ ${q.valor_ipi}`);
        console.log(`- Valor Total Nota (Produtos + IPI + Frete): R$ ${q.valor_total_nota}`);
        
        const expectedTotal = Number((Number(q.valor_total_produtos) + Number(q.valor_ipi) + Number(q.valor_frete)).toFixed(2));
        console.log(`- Soma Calculada: R$ ${expectedTotal}`);
        console.log(`- Total da Nota confere com a soma dos itens e frete?`, q.valor_total_nota === expectedTotal ? 'SIM' : 'NÃO');

        // Limpar a cotação de teste gerada para manter o banco limpo
        console.log('\nRemovendo cotação de teste do banco de dados...');
        await quotationsService.remove(quotationId);
        console.log('Cotação de teste removida.');
    } else {
        console.warn('Cotação em lote falhou ou necessitou de cotação manual:', batchResults);
    }
    
  } catch (error) {
    console.error('Erro durante a execução do teste:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
