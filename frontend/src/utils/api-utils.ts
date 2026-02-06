export const getBackendUrl = () => {
    return import.meta.env.PUBLIC_API_URL || 'https://cotacao.nicopel.com.br';
};

export const getAuthToken = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('auth_token');
    }
    return null;
};

export const safeFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const headers = new Headers(options.headers || {});

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const finalOptions = {
        ...options,
        headers
    };

    try {
        const response = await fetch(getBackendUrl() + url, finalOptions);
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
