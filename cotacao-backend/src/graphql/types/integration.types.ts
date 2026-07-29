import { Field, ObjectType, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class UserType {
    @Field(() => ID)
    id!: number;

    @Field()
    username!: string;

    @Field()
    role!: string;
}

@ObjectType()
export class ClientType {
    @Field(() => ID)
    id!: number;

    @Field()
    razao_social!: string;

    @Field({ nullable: true })
    fantasia?: string;

    @Field()
    cnpj!: string;

    @Field()
    cep!: string;

    @Field()
    cidade!: string;

    @Field()
    estado!: string;
}

@ObjectType()
export class ProductType {
    @Field(() => ID)
    id!: number;

    @Field()
    nome!: string;

    @Field()
    sku!: string;

    @Field(() => Float, { nullable: true })
    preco?: number;
}

@ObjectType()
export class QuotationItemType {
    @Field(() => ID)
    id!: number;

    @Field()
    descricao!: string;

    @Field(() => Float)
    preco_unitario!: number;

    @Field(() => Int)
    quantidade!: number;
}

@ObjectType()
export class QuotationType {
    @Field(() => ID)
    id!: number;

    @Field({ nullable: true })
    numero_pedido_manual?: string;

    @Field(() => ClientType)
    client!: ClientType;

    @Field(() => UserType, { nullable: true })
    user?: UserType;

    @Field(() => [QuotationItemType])
    items!: QuotationItemType[];

    @Field()
    data_cotacao!: string;

    @Field(() => Float)
    valor_total_produtos!: number;

    @Field({ nullable: true })
    transportadora_escolhida?: string;

    @Field(() => Float, { nullable: true })
    valor_frete?: number;

    @Field({ nullable: true })
    tipo_frete?: string;

    @Field()
    status!: string;

    @Field(() => Float, { nullable: true })
    valor_total_nota?: number;
}
