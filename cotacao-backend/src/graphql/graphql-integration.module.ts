import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { IntegrationResolver } from './integration.resolver.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quotation } from '../quotations/entities/quotation.entity.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

@Module({
    imports: [
        TypeOrmModule.forFeature([Quotation]),
        GraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            autoSchemaFile: join(__dirname, 'schema.gql'),
            playground: true, // Habilita o Playground no desenvolvimento
            path: '/graphql', // Endpoint onde rodará o GraphQL
            context: ({ req }) => ({ req }), // Mapeia o request express para termos acesso aos headers no Guard/Resolver
        }),
    ],
    providers: [IntegrationResolver],
})
export class GraphQLIntegrationModule {}
