import { safeFetch } from '../utils/api-utils';

const API_BASE_URL = "/api";

export const apiService = {
    // Busca clientes tratando a paginação do NestJS
    async getClients(query = "") {
        const url = query
            ? `${API_BASE_URL}/clients?search=${encodeURIComponent(query)}`
            : `${API_BASE_URL}/clients`;

        const res = await safeFetch(url);
        if (res.ok) {
            return res.data.data || res.data;
        }
        throw new Error(res.data?.message || 'Erro ao buscar clientes');
    },

    async getProducts() {
        const res = await safeFetch(`${API_BASE_URL}/products`);
        if (res.ok) {
            const data = res.data.data || res.data;
            return Array.isArray(data) ? data : [];
        }
        return [];
    },

    async createQuotation(payload: any) {
        const res = await safeFetch(`${API_BASE_URL}/quotations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return res.data;
    }
};