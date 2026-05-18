<script setup lang="ts">
import { ref, computed } from 'vue';
import { safeFetch } from '../utils/api-utils';

interface PrazoResult {
    cnpj: string;
    razaoSocial: string;
    cidade: string;
    uf: string;
    cep: string;
    status: 'SUCCESS' | 'ERROR' | 'LOADING';
    message?: string;
    options: {
        carrier: string;
        price: number;
        deadline: number;
    }[];
}

const cnpjs = ref("");
const isProcessing = ref(false);
const results = ref<PrazoResult[]>([]);

const cnpjList = computed(() => cnpjs.value.split('\n').map(c => c.trim()).filter(c => c.length > 0));

const getBestDeadline = (options: any[]) => {
    if (!options || options.length === 0) return '---';
    const sorted = [...options].sort((a, b) => a.deadline - b.deadline);
    const best = sorted.find(o => o.deadline > 0) || sorted[0];
    return `${best.deadline} dias (${best.carrier})`;
};

const processList = async () => {
    const list = cnpjList.value;
    if (list.length === 0) return window.showToast("Insira ao menos um CNPJ.", "warning");

    isProcessing.value = true;
    results.value = list.map(cnpj => ({
        cnpj: cnpj.replace(/\D/g, ''),
        razaoSocial: '---',
        cidade: '---',
        uf: '---',
        cep: '---',
        status: 'LOADING',
        options: []
    }));

    try {
        for (let i = 0; i < results.value.length; i++) {
            const item = results.value[i];
            try {
                // 1. Fetch Brasil API
                const resBrasil = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${item.cnpj}`);
                if (!resBrasil.ok) throw new Error("CNPJ não encontrado");
                
                const dataBrasil = await resBrasil.json();
                item.razaoSocial = dataBrasil.nome_fantasia || dataBrasil.razao_social;
                item.cidade = dataBrasil.municipio;
                item.uf = dataBrasil.uf;
                item.cep = dataBrasil.cep;

                // 2. Fetch simulate
                const resSimulate = await safeFetch('/api/freight/simulate', {
                    method: 'POST',
                    body: JSON.stringify({ cep: item.cep, cidade: item.cidade }),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (resSimulate.ok && Array.isArray(resSimulate.data)) {
                    item.options = resSimulate.data;
                    item.status = 'SUCCESS';
                } else {
                    throw new Error("Erro ao simular prazo");
                }
            } catch (err: any) {
                item.status = 'ERROR';
                item.message = err.message;
            }
        }
    } finally {
        isProcessing.value = false;
        window.showToast("Consulta concluída!", "success");
    }
};

const formatCNPJ = (v: string) => v?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') || v;

</script>

<template>
    <div class="batch-container">
        <div class="glass-card mb-20">
            <div class="card-title">
                <span><i class="fas fa-truck-fast"></i> CONSULTA RÁPIDA DE PRAZOS</span>
            </div>
            
            <div class="mt-20">
                <div class="input-section">
                    <label class="section-label">Lista de CNPJs (um por linha)</label>
                    <textarea 
                        v-model="cnpjs" 
                        placeholder="00.000.000/0001-00&#10;11.111.111/0001-11"
                        class="pill-textarea"
                        rows="8"
                    ></textarea>
                </div>
            </div>

            <div class="action-bar mt-20">
                <button @click="processList" class="btn-giant" :disabled="isProcessing">
                    <span v-if="isProcessing" class="btn-spinner"></span>
                    {{ isProcessing ? 'CONSULTANDO...' : 'BUSCAR CIDADES E PRAZOS' }}
                </button>
            </div>
        </div>

        <div v-if="results.length > 0" class="glass-card mt-20 fade-in">
            <div class="card-title">
                <span><i class="fas fa-list-check"></i> RESULTADOS</span>
            </div>

            <div class="results-table-wrapper mt-10">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>CNPJ / CLIENTE</th>
                            <th>CIDADE / UF</th>
                            <th>CEP</th>
                            <th>MELHOR PRAZO</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(r, idx) in results" :key="idx" :class="r.status">
                            <td>
                                <strong>{{ formatCNPJ(r.cnpj) }}</strong>
                                <div class="client-name">{{ r.razaoSocial }}</div>
                            </td>
                            <td>{{ r.cidade !== '---' ? `${r.cidade} / ${r.uf}` : '---' }}</td>
                            <td>{{ r.cep }}</td>
                            <td>
                                <strong>{{ r.status === 'LOADING' ? '...' : getBestDeadline(r.options) }}</strong>
                            </td>
                            <td>
                                <span class="status-badge" :class="r.status">{{ r.status === 'LOADING' ? 'Buscando...' : (r.status === 'SUCCESS' ? 'OK' : 'Erro') }}</span>
                                <div v-if="r.message" class="error-msg"><small>{{ r.message }}</small></div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<style scoped>
.batch-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    color: var(--text-main);
}

.glass-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 24px;
    box-shadow: var(--shadow-card);
    padding: 30px;
}

.card-title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--primary);
    font-size: 1rem;
    font-weight: 850;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 20px;
}

.mt-10 { margin-top: 10px; }
.mt-20 { margin-top: 20px; }
.mb-20 { margin-bottom: 20px; }

.section-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 800;
    color: var(--text-muted);
    margin-bottom: 10px;
    text-transform: uppercase;
}

.pill-textarea {
    width: 100%;
    min-height: 210px;
    background: var(--bg-input);
    border: 2px solid var(--border);
    border-radius: 12px;
    padding: 15px;
    font-family: monospace;
    font-size: 0.95rem;
    color: var(--text-main);
    resize: none;
    transition: 0.3s;
}

.pill-textarea:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--bg-surface);
    box-shadow: 0 0 0 4px rgba(0, 74, 153, 0.1);
}

.action-bar {
    display: flex;
    justify-content: center;
}

.btn-giant {
    background: var(--primary);
    color: white;
    border: none;
    min-width: 280px;
    padding: 18px 42px;
    border-radius: 18px;
    font-size: 1rem;
    font-weight: 900;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 10px 20px rgba(0, 74, 153, 0.2);
    transition: 0.3s ease;
}

.btn-giant:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 15px 30px rgba(0, 74, 153, 0.3);
}

.btn-giant:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.btn-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 3px solid rgba(255, 255, 255, 0.35);
    border-top-color: white;
    border-radius: 999px;
    animation: spin 0.8s linear infinite;
}

.results-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 16px;
}

.modern-table {
    width: 100%;
    border-collapse: collapse;
}

.modern-table th {
    text-align: left;
    padding: 14px 16px;
    border-bottom: 2px solid var(--border);
    color: var(--text-muted);
    font-size: 0.8rem;
    text-transform: uppercase;
    background: var(--bg-input);
}

.modern-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
}

.modern-table tbody tr:last-child td {
    border-bottom: none;
}

.client-name {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 3px;
}

.status-badge {
    padding: 5px 10px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 800;
}

.status-badge.SUCCESS { background: #dcfce7; color: #15803d; }
.status-badge.ERROR { background: #fee2e2; color: #b91c1c; }
.status-badge.LOADING { background: #e0f2fe; color: #0369a1; }

.error-msg {
    color: #b91c1c;
    margin-top: 4px;
}

tr.ERROR { background: rgba(239, 68, 68, 0.02); }

.fade-in {
    animation: fadeIn 0.4s ease-out;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
