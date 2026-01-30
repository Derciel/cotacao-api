const API_BASE_URL = "/api";

export const apiService = {
    // Busca clientes tratando a paginação do NestJS
    async getClients(query = "") {
        const url = query
            ? `${API_BASE_URL}/clients?search=${encodeURIComponent(query)}`
            : `${API_BASE_URL}/clients`;

        const res = await fetch(url);
        const result = await res.json();
        return result.data || result; // Retorna sempre a lista de clientes
    },

    async getProducts() {
        const res = await fetch(`${API_BASE_URL}/products`);
        const result = await res.json();
        const data = result.data || result;
        return Array.isArray(data) ? data : [];
    },

    async createQuotation(payload) {
        const res = await fetch(`${API_BASE_URL}/quotations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return res.json();
    }
};