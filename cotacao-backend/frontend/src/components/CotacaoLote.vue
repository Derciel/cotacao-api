<script setup lang="ts">
import { ref, computed } from 'vue';
import { safeFetch } from '../utils/api-utils';

interface BatchResult {
    id?: number;
    cnpj?: string;
    client?: string;
    carrier?: string;
    valorProdutos?: number;
    valorIpi?: number;
    valorFrete?: number;
    valorTotalNota?: number;
    status: 'SUCCESS' | 'ERROR' | 'MANUAL_REQUIRED';
    message?: string;
    prazo?: number;
}

interface BatchProduct {
    productId: number;
    nome: string;
    caixas: number;
    unidadesCaixa: number;
    valorUnitario: number;
    ipi: number;
    total: number;
}

const cnpjs = ref("");
const isProcessing = ref(false);
const results = ref<BatchResult[]>([]);
const isProductModalOpen = ref(false);
const productSearch = ref("");
const productList = ref<any[]>([]);
const selectedProducts = ref<BatchProduct[]>([
    {
        productId: 279,
        nome: "TAMPA E BASE WAFFLE 225UND",
        caixas: 1,
        unidadesCaixa: 225,
        valorUnitario: 1.5,
        ipi: 3.25,
        total: 348.47
    },
    {
        productId: 261,
        nome: "POTE 240 ML - COPA",
        caixas: 1,
        unidadesCaixa: 400,
        valorUnitario: 0.39344,
        ipi: 6.75,
        total: 168.00
    },
    {
        productId: 260,
        nome: "POTE 500 ML - COPA 600 UND",
        caixas: 1,
        unidadesCaixa: 600,
        valorUnitario: 0.44964,
        ipi: 6.75,
        total: 287.99
    },
    {
        productId: 255,
        nome: "POTE 500 ML - COPA",
        caixas: 1,
        unidadesCaixa: 400,
        valorUnitario: 0.44964,
        ipi: 6.75,
        total: 192.00
    }
]);
const isSearching = ref(false);
const isAdmin = computed(() => {
    try {
        const raw = localStorage.getItem('user_info');
        return raw ? JSON.parse(raw).role === 'ADMIN' : false;
    } catch {
        return false;
    }
});

const cnpjList = computed(() => cnpjs.value.split('\n').map(c => c.trim()).filter(c => c.length > 0));
const cnpjCount = computed(() => cnpjList.value.length);
const totalPedido = computed(() => selectedProducts.value.reduce((acc, item) => acc + item.total, 0));
const totalLote = computed(() => totalPedido.value * cnpjCount.value);

const addProduct = () => {
    isProductModalOpen.value = true;
    fetchProducts("");
};

const fetchProducts = async (term: string) => {
    isSearching.value = true;
    try {
        const res = await safeFetch(`/api/products?search=${encodeURIComponent(term)}`);
        if (res.ok) {
            const rawList = res.data.data || (Array.isArray(res.data) ? res.data : []);
            productList.value = rawList.filter((p: any) => p.nome && p.nome.trim() !== "");
        }
    } catch (e) {
        console.error("Erro busca produtos", e);
    } finally {
        isSearching.value = false;
    }
};

const selectProduct = (p: any) => {
    const item: BatchProduct = {
        productId: p.id,
        nome: p.nome,
        caixas: 1,
        unidadesCaixa: Number(p.unidades_caixa) || 1,
        valorUnitario: Number(p.valor_unitario) || 0,
        ipi: getDefaultIpi(p),
        total: 0
    };
    selectedProducts.value.push(item);
    calcRow(selectedProducts.value.length - 1);
    isProductModalOpen.value = false;
};

const removeProduct = (idx: number) => {
    selectedProducts.value.splice(idx, 1);
};

const getDefaultIpi = (p: any) => {
    const nome = String(p.nome || '').toUpperCase();
    const categoria = String(p.categoria || '').toUpperCase();

    if (nome.includes('SERIGRAFIA') || nome.includes('TAMPA')) return 0;
    if (categoria === 'POTE' || nome.includes('POTE') || nome.includes('COPO')) return 6.75;
    return 3.25;
};

const calcRow = (idx: number) => {
    const item = selectedProducts.value[idx];
    if (!item) return;

    const caixas = Number(item.caixas) || 0;
    const quantidade = caixas * item.unidadesCaixa;
    const valorUnitario = Number(item.valorUnitario) || 0;
    const ipi = Number(item.ipi) || 0;
    const baseTotal = quantidade * valorUnitario;
    item.total = Number((baseTotal + (baseTotal * (ipi / 100))).toFixed(2));
};

const processBatch = async () => {
    const list = cnpjList.value;
    if (list.length === 0) return window.showToast("Insira ao menos um CNPJ.", "warning");
    if (selectedProducts.value.length === 0) return window.showToast("Selecione ao menos um produto.", "warning");
    if (totalPedido.value <= 0) return window.showToast("Informe quantidade e valor unitário dos produtos.", "warning");

    isProcessing.value = true;
    results.value = [];

    try {
        const payload = {
            requests: list.map(cnpj => ({
                cnpj: cnpj.replace(/\D/g, ''),
                items: selectedProducts.value.map(p => ({
                    productId: p.productId,
                    quantidade: (Number(p.caixas) || 0) * p.unidadesCaixa,
                    valorUnitario: (Number(p.valorUnitario) || 0) * (1 + ((Number(p.ipi) || 0) / 100)),
                    percentualIpi: Number(p.ipi) || 0
                }))
            }))
        };

        const res = await safeFetch('/api/quotations/batch', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            results.value = res.data;
            window.showToast("Processamento em lote concluído!", "success");
        } else {
            throw new Error("Erro ao processar lote");
        }
    } catch (e: any) {
        window.showToast(e.message, "error");
    } finally {
        isProcessing.value = false;
    }
};

const downloadZip = async () => {
    const ids = results.value.filter(r => r.status === 'SUCCESS').map(r => r.id);
    if (ids.length === 0) return window.showToast("Nenhuma cotação de sucesso para baixar.", "warning");

    try {
        const res = await fetch(`${window.PUBLIC_API_URL || ''}/api/quotations/batch/zip`, {
            method: 'POST',
            body: JSON.stringify({ ids }),
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cotacoes_lote_${new Date().getTime()}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        }
    } catch (e) {
        window.showToast("Erro ao baixar ZIP", "error");
    }
};

const formatCNPJ = (v: string) => v?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') || v;
const formatCurrency = (val?: number) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

</script>

<template>
    <div class="batch-container">
        <div class="glass-card mb-20">
            <div class="card-title">
                <span><i class="fas fa-layer-group"></i> CONFIGURAÇÃO DO LOTE</span>
            </div>
            
            <div class="grid-2 mt-20">
                <div class="input-section">
                    <label class="section-label">1. Lista de CNPJs (um por linha)</label>
                    <textarea 
                        v-model="cnpjs" 
                        placeholder="00.000.000/0001-00&#10;11.111.111/0001-11"
                        class="pill-textarea"
                        rows="8"
                    ></textarea>
                </div>

                <div class="summary-panel">
                    <label class="section-label">Resumo do lote</label>
                    <div class="summary-grid">
                        <div class="summary-card">
                            <span>CNPJs</span>
                            <strong>{{ cnpjCount }}</strong>
                        </div>
                        <div class="summary-card">
                            <span>Produtos</span>
                            <strong>{{ selectedProducts.length }}</strong>
                        </div>
                        <div class="summary-card wide">
                            <span>Total por pedido</span>
                            <strong>{{ formatCurrency(totalPedido) }}</strong>
                        </div>
                        <div class="summary-card wide accent">
                            <span>Saldo total do lote</span>
                            <strong>{{ formatCurrency(totalLote) }}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div class="product-section mt-20">
                <div class="section-heading">
                    <label class="section-label">2. Produtos do lote</label>
                    <button @click="addProduct" class="btn-add-p compact">
                        <i class="fas fa-plus"></i>
                        <span>Adicionar Produto</span>
                    </button>
                </div>

                <div class="table-scroll">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th width="30%">Produto</th>
                                <th width="12%">Qtd/Caixa</th>
                                <th width="12%">Caixas</th>
                                <th width="16%">Valor Unitário</th>
                                <th width="10%">IPI %</th>
                                <th width="16%">Valor Total</th>
                                <th width="4%"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="selectedProducts.length === 0">
                                <td colspan="7" class="empty-row">Nenhum produto adicionado.</td>
                            </tr>
                            <tr v-for="(p, idx) in selectedProducts" :key="`${p.productId}-${idx}`">
                                <td>
                                    <div class="product-name">{{ p.nome }}</div>
                                </td>
                                <td style="text-align: center; color: var(--text-muted); font-weight: 700;">
                                    {{ p.unidadesCaixa }} un
                                </td>
                                <td>
                                    <input type="number" min="0" step="1" v-model.number="p.caixas" @input="calcRow(idx)" class="table-input center">
                                </td>
                                <td>
                                    <input type="number" min="0" step="0.01" v-model.number="p.valorUnitario" @input="calcRow(idx)" class="table-input money">
                                </td>
                                <td>
                                    <input type="number" min="0" step="0.01" v-model.number="p.ipi" @input="calcRow(idx)" :readonly="!isAdmin" :class="['table-input', 'center', { locked: !isAdmin }]">
                                </td>
                                <td class="total-col">{{ formatCurrency(p.total) }}</td>
                                <td>
                                    <button @click="removeProduct(idx)" class="btn-remove-p" title="Remover produto">×</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="action-bar mt-20">
                <button @click="processBatch" class="btn-giant" :disabled="isProcessing">
                    <span v-if="isProcessing" class="btn-spinner"></span>
                    {{ isProcessing ? 'PROCESSANDO LOTE...' : 'GERAR COTAÇÕES EM LOTE' }}
                </button>
            </div>
        </div>

        <div v-if="results.length > 0" class="glass-card mt-20 fade-in">
            <div class="card-title flex-between">
                <span><i class="fas fa-list-check"></i> RESULTADOS</span>
                <button @click="downloadZip" class="btn-zip">
                    <i class="fas fa-file-archive"></i> BAIXAR TUDO (ZIP)
                </button>
            </div>

            <div class="results-table-wrapper mt-10">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>CNPJ / CLIENTE</th>
                            <th>STATUS</th>
                            <th>MELHOR ENVIO</th>
                            <th>FRETE</th>
                            <th>PRAZO</th>
                            <th>TOTAL PEDIDO</th>
                            <th>MENSAGEM</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(r, idx) in results" :key="idx" :class="r.status">
                            <td>
                                <strong>{{ r.cnpj ? formatCNPJ(r.cnpj) : '---' }}</strong>
                                <div class="client-name">{{ r.client || '---' }}</div>
                            </td>
                            <td>
                                <span class="status-badge" :class="r.status">{{ r.status }}</span>
                            </td>
                            <td>{{ r.carrier || '---' }}</td>
                            <td>{{ r.valorFrete !== undefined ? formatCurrency(r.valorFrete) : '---' }}</td>
                            <td>{{ r.prazo !== undefined ? `${r.prazo} dias` : '---' }}</td>
                            <td><strong>{{ r.valorTotalNota !== undefined ? formatCurrency(r.valorTotalNota) : formatCurrency(totalPedido) }}</strong></td>
                            <td><small>{{ r.message || '-' }}</small></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal Busca de Produtos -->
        <div v-if="isProductModalOpen" class="modal-overlay" @click.self="isProductModalOpen = false">
            <div class="modal-box">
                <div class="modal-header">
                    <div>
                        <h3>Selecionar Produto</h3>
                        <p>Escolha os itens que farao parte do lote.</p>
                    </div>
                    <button @click="isProductModalOpen = false" class="modal-close" title="Fechar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="input-wrapper">
                    <input v-model="productSearch" @input="fetchProducts(productSearch)" placeholder="Buscar produto..." class="pill-input full-width" autofocus>
                    <span v-if="isSearching" class="spinner"></span>
                </div>
                <div class="results-list">
                    <div v-for="p in productList" :key="p.id" class="result-item" @click="selectProduct(p)">
                        <div class="result-info">
                            <strong>{{ p.nome }}</strong>
                            <small>R$ {{ p.valor_unitario }}</small>
                        </div>
                        <i class="fas fa-chevron-right text-light"></i>
                    </div>
                    <div v-if="!isSearching && productList.length === 0" class="empty-msg">Nenhum produto encontrado.</div>
                </div>
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

.grid-2 {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 25px;
    align-items: stretch;
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

.flex-between {
    justify-content: space-between;
}

.mt-10 { margin-top: 10px; }
.mt-20 { margin-top: 20px; }
.mb-20 { margin-bottom: 20px; }

.input-section,
.product-section {
    min-width: 0;
}

.product-section {
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 18px;
}

.summary-panel {
    min-width: 0;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.summary-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px;
    min-height: 86px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 7px;
}

.summary-card span {
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
}

.summary-card strong {
    color: var(--text-main);
    font-size: 1.35rem;
    font-weight: 900;
}

.summary-card.wide {
    grid-column: span 2;
}

.summary-card.accent {
    border-color: rgba(0, 74, 153, 0.24);
    background: rgba(0, 74, 153, 0.06);
}

.summary-card.accent strong {
    color: var(--primary);
}

.section-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
}

.section-heading .section-label {
    margin-bottom: 0;
}

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

.selected-products {
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 15px;
    min-height: 210px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.product-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    padding: 14px 16px;
    border-radius: 12px;
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
}

.p-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
}

.p-info strong {
    font-size: 0.95rem;
    line-height: 1.3;
    color: var(--text-main);
}

.p-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: 700;
}

.mini-input {
    width: 72px;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    text-align: center;
    font-weight: 800;
    background: var(--bg-input);
    color: var(--text-main);
}

.btn-remove-p {
    flex: 0 0 auto;
    background: var(--status-cancelado-bg);
    color: var(--status-cancelado-text);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 1.1rem;
    font-weight: 900;
    transition: 0.2s;
}

.btn-remove-p:hover {
    transform: translateY(-1px);
    filter: brightness(0.96);
}

.btn-add-p {
    width: 100%;
    min-height: 44px;
    margin-top: auto;
    padding: 11px 16px;
    border: 2px dashed var(--border);
    background: transparent;
    border-radius: 12px;
    color: var(--text-muted);
    cursor: pointer;
    font-weight: 800;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    transition: 0.3s;
}

.btn-add-p.compact {
    width: auto;
    min-height: 40px;
    margin-top: 0;
    padding: 9px 14px;
    background: var(--bg-surface);
}

.btn-add-p:hover {
    background: var(--bg-surface);
    border-color: var(--primary);
    color: var(--primary);
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

.btn-spinner,
.spinner {
    display: inline-block;
    border-radius: 999px;
    animation: spin 0.8s linear infinite;
}

.btn-spinner {
    width: 18px;
    height: 18px;
    border: 3px solid rgba(255, 255, 255, 0.35);
    border-top-color: white;
}

.spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--border);
    border-top-color: var(--primary);
}

.btn-zip {
    background: #059669;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-zip:hover {
    background: #047857;
    transform: translateY(-1px);
}

.table-scroll {
    overflow-x: auto;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 16px;
}

.items-table {
    width: 100%;
    min-width: 820px;
    border-collapse: collapse;
}

.items-table th {
    text-align: left;
    padding: 14px 16px;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    border-bottom: 2px solid var(--border);
    background: var(--bg-input);
}

.items-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
}

.items-table tbody tr:last-child td {
    border-bottom: none;
}

.product-name {
    font-weight: 850;
    color: var(--text-main);
    line-height: 1.35;
}

.table-input {
    width: 100%;
    background: var(--bg-input);
    border: 1px solid var(--border);
    padding: 10px;
    border-radius: 8px;
    color: var(--text-main);
    font-weight: 800;
}

.table-input:focus {
    border-color: var(--primary);
}

.table-input.center {
    text-align: center;
}

.table-input.money {
    color: var(--primary);
}

.table-input.locked {
    opacity: 0.65;
    cursor: not-allowed;
}

.total-col {
    color: var(--text-main);
    font-weight: 900;
    white-space: nowrap;
}

.empty-row {
    padding: 28px !important;
    text-align: center;
    color: var(--text-muted);
    font-weight: 800;
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
.status-badge.MANUAL_REQUIRED { background: #fef9c3; color: #a16207; }

tr.ERROR { background: rgba(239, 68, 68, 0.02); }

.modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.58);
    backdrop-filter: blur(10px);
}

.modal-box {
    width: min(620px, 100%);
    max-height: 88vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 30px;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.26);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    padding-bottom: 18px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--border);
}

.modal-header h3 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 900;
    color: var(--text-main);
}

.modal-header p {
    margin: 5px 0 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 600;
}

.modal-close {
    width: 40px;
    height: 40px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-input);
    color: var(--text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: 0.2s;
}

.modal-close:hover {
    color: var(--text-main);
    background: var(--border);
}

.input-wrapper {
    position: relative;
}

.input-wrapper .spinner {
    position: absolute;
    right: 18px;
    top: calc(50% - 9px);
}

.pill-input {
    width: 100%;
    padding: 15px 20px;
    border-radius: 12px;
    border: 2px solid var(--border);
    background: var(--bg-input);
    font-size: 1rem;
    color: var(--text-main);
    font-weight: 600;
    transition: 0.3s;
}

.pill-input:focus {
    border-color: var(--primary);
    background: var(--bg-surface);
    box-shadow: 0 0 0 4px rgba(0, 74, 153, 0.1);
}

.full-width {
    width: 100%;
}

.results-list {
    margin-top: 20px;
    overflow-y: auto;
    max-height: 420px;
    border: 1px solid var(--border);
    border-radius: 16px;
}

.result-item {
    padding: 15px 18px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    transition: 0.2s;
}

.result-item:last-child {
    border-bottom: none;
}

.result-item:hover {
    background: var(--bg-input);
}

.result-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 4px;
}

.result-info strong {
    color: var(--text-main);
    font-size: 0.95rem;
    line-height: 1.35;
}

.result-info small,
.text-light {
    color: var(--text-muted);
}

.empty-msg {
    padding: 28px;
    text-align: center;
    color: var(--text-muted);
    font-weight: 700;
}

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

@media (max-width: 768px) {
    .batch-container {
        padding: 10px;
    }

    .grid-2 {
        grid-template-columns: 1fr;
        gap: 15px;
    }

    .glass-card {
        padding: 18px;
        border-radius: 20px;
    }

    .card-title,
    .flex-between {
        align-items: flex-start;
        flex-direction: column;
        gap: 12px;
    }

    .btn-zip,
    .btn-giant {
        width: 100%;
    }

    .section-heading {
        align-items: stretch;
        flex-direction: column;
    }

    .btn-add-p.compact {
        width: 100%;
    }

    .summary-card strong {
        font-size: 1.1rem;
    }

    .btn-giant {
        min-width: 0;
        padding: 15px;
        font-size: 0.95rem;
    }

    .modal-box {
        padding: 20px;
        border-radius: 20px;
    }

    .modal-header h3 {
        font-size: 1.15rem;
    }
}
</style>
