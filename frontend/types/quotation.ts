export interface Client {
    id?: number;
    razao_social: string;
    cnpj: string;
    cidade?: string;
    estado?: string;
}

export interface Product {
    nome: string;
    peso_caixa_kg: number | string;
    unidades_caixa: number;
    medida_cm: string;
    preco_venda?: number;
}

// Novos tipos para o Cálculo de Frete
export interface FreightOption {
    transportadora: string;
    servico: string; // Ex: Rodoviário, Expresso
    prazo_dias: number;
    valor_frete: number;
    percentual_cotacao?: number; // Para verificar se está na margem
    melhor_preco?: boolean;
}