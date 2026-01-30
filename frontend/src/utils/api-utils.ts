export const getBackendUrl = () => {
    return import.meta.env.PUBLIC_API_URL || 'https://cotacao-api-ppiy.onrender.com';
};

export const safeFetch = async (url: string, options: RequestInit = {}) => {
    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type');

        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { message: text || 'Resposta vazia do servidor' };
        }

        return {
            ok: response.ok,
            status: response.status,
            data
        };
    } catch (error: any) {
        console.error(`Fetch error at ${url}:`, error);
        return {
            ok: false,
            status: 500,
            data: { message: 'Erro de conexão com o servidor', error: error.message }
        };
    }
};
