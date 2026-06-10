<script setup lang="ts">
import { ref, computed } from 'vue';
import { safeFetch, getBackendUrl } from '../utils/api-utils';

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
const isDownloadingZip = ref(false);
const results = ref<BatchResult[]>([]);

// Variáveis para rastreamento de progresso do lote
const currentProgressIndex = ref(0);
const totalProgressCount = ref(0);
const estimatedTimeRemaining = ref("");
const startTime = ref<number | null>(null);

const formatTime = (seconds: number): string => {
    if (seconds <= 0) return "0s";
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m > 0) {
        return `${m}m ${s}s`;
    }
    return `${s}s`;
};
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

const isIpiUnlocked = ref(false);
const ipiPassword = 'nicopel@ipi';

const toggleIpiLock = () => {
    if (isAdmin.value) return; // Admins sempre podem editar
    if (isIpiUnlocked.value) {
        isIpiUnlocked.value = false;
        window.showToast("Edição de IPI bloqueada.", "info");
    } else {
        const password = prompt("Digite a senha para desbloquear a edição do IPI:");
        if (password === ipiPassword) {
            isIpiUnlocked.value = true;
            window.showToast("Edição de IPI liberada!", "success");
        } else if (password !== null) {
            window.showToast("Senha incorreta!", "error");
        }
    }
};

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
    currentProgressIndex.value = 0;
    totalProgressCount.value = list.length;
    estimatedTimeRemaining.value = "Calculando...";
    startTime.value = Date.now();

    try {
        for (let i = 0; i < list.length; i++) {
            const cnpj = list[i];
            currentProgressIndex.value = i;
            
            // Estima o tempo restante
            if (i > 0 && startTime.value) {
                const elapsedMs = Date.now() - startTime.value;
                const avgTimePerCnpj = elapsedMs / i; // ms por CNPJ
                const remainingCnpjs = list.length - i;
                const remainingMs = avgTimePerCnpj * remainingCnpjs;
                estimatedTimeRemaining.value = formatTime(remainingMs / 1000);
            }

            const payload = {
                requests: [{
                    cnpj: cnpj.replace(/\D/g, ''),
                    items: selectedProducts.value.map(p => ({
                        productId: p.productId,
                        quantidade: (Number(p.caixas) || 0) * p.unidadesCaixa,
                        valorUnitario: (Number(p.valorUnitario) || 0) * (1 + ((Number(p.ipi) || 0) / 100)),
                        percentualIpi: Number(p.ipi) || 0
                    }))
                }]
            };

            try {
                const res = await safeFetch('/api/quotations/batch', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
                    results.value.push(res.data[0]);
                } else {
                    results.value.push({
                        cnpj: cnpj,
                        status: 'ERROR',
                        message: res.data?.message || 'Erro na resposta do processamento individual'
                    });
                }
            } catch (err: any) {
                results.value.push({
                    cnpj: cnpj,
                    status: 'ERROR',
                    message: err.message || 'Erro de conexão'
                });
            }
        }
        
        currentProgressIndex.value = list.length;
        estimatedTimeRemaining.value = "Concluído";
        window.showToast("Processamento em lote concluído!", "success");
    } catch (e: any) {
        window.showToast(e.message, "error");
    } finally {
        isProcessing.value = false;
    }
};

const downloadZip = async () => {
    const ids = results.value.filter(r => r.status === 'SUCCESS').map(r => r.id);
    if (ids.length === 0) return window.showToast("Nenhuma cotação de sucesso para baixar.", "warning");

    isDownloadingZip.value = true;
    try {
        const res = await fetch(getBackendUrl() + '/api/quotations/batch/zip', {
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
            window.showToast("Download do ZIP iniciado com sucesso!", "success");
        } else {
            const errorText = await res.text();
            window.showToast(`Erro ao gerar ZIP no servidor (${res.status}): ${errorText || res.statusText}`, "error");
        }
    } catch (e: any) {
        console.error("Erro ao baixar ZIP:", e);
        window.showToast("Erro ao baixar ZIP: " + e.message, "error");
    } finally {
        isDownloadingZip.value = false;
    }
};

const formatCNPJ = (v: string) => v?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') || v;
const formatCurrency = (val?: number) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const isPrintModalOpen = ref(false);
const printPdfUrl = ref('');

const openPrintModal = () => {
    const successIds = results.value.filter(r => r.status === 'SUCCESS').map(r => r.id);
    if (successIds.length === 0) return window.showToast("Nenhuma cotação de sucesso para imprimir.", "warning");
    
    const token = localStorage.getItem('auth_token');
    printPdfUrl.value = `${getBackendUrl()}/api/quotations/batch/pdf?ids=${successIds.join(',')}&token=${token}`;
    isPrintModalOpen.value = true;
};

const closePrintModal = () => {
    isPrintModalOpen.value = false;
    printPdfUrl.value = '';
};

const printBatch = () => {
    const iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }
};

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
                                     <div class="ipi-input-container">
                                         <input type="number" min="0" step="0.01" v-model.number="p.ipi" @input="calcRow(idx)" :readonly="!isAdmin && !isIpiUnlocked" :class="['table-input', 'center', { locked: !isAdmin && !isIpiUnlocked }]">
                                         <button v-if="!isAdmin" @click="toggleIpiLock" class="btn-lock" :title="isIpiUnlocked ? 'Bloquear edição de IPI' : 'Desbloquear edição de IPI com senha'">
                                             <i :class="isIpiUnlocked ? 'fas fa-lock-open' : 'fas fa-lock'"></i>
                                         </button>
                                     </div>
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

            <div v-if="isProcessing || (results.length > 0 && currentProgressIndex < totalProgressCount)" class="progress-panel mt-20">
                <div class="progress-info flex-between mb-10">
                    <span>
                        <i class="fas fa-spinner fa-spin mr-5"></i>
                        Processando lote: <strong>{{ currentProgressIndex }} de {{ totalProgressCount }}</strong>
                    </span>
                    <span>
                        Tempo Restante Estimado: <strong>{{ estimatedTimeRemaining }}</strong>
                    </span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" :style="{ width: `${(currentProgressIndex / totalProgressCount) * 100}%` }"></div>
                </div>
                <div class="progress-stats mt-10 flex-between">
                    <small>Pendentes: <strong>{{ totalProgressCount - currentProgressIndex }}</strong></small>
                    <small>Sucessos: <strong>{{ results.filter(r => r.status === 'SUCCESS').length }}</strong></small>
                    <small>Atenção Manual: <strong>{{ results.filter(r => r.status === 'MANUAL_REQUIRED').length }}</strong></small>
                    <small>Erros: <strong>{{ results.filter(r => r.status === 'ERROR').length }}</strong></small>
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
                <div class="action-buttons-group">
                    <button @click="downloadZip" class="btn-zip" :disabled="isDownloadingZip || isProcessing" style="margin-bottom: 0;">
                        <span v-if="isDownloadingZip" class="btn-spinner"></span>
                        <i v-else class="fas fa-file-archive"></i> 
                        {{ isDownloadingZip ? 'ZIP...' : `ZIP (${results.filter(r => r.status === 'SUCCESS').length})` }}
                    </button>
                    <button @click="openPrintModal" class="btn-print-all" :disabled="isProcessing || results.filter(r => r.status === 'SUCCESS').length === 0">
                        <i class="fas fa-print"></i>
                        VISUALIZAR / IMPRIMIR TODOS
                    </button>
                </div>
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

        <!-- Modal Visualização e Impressão de Lote -->
        <div v-if="isPrintModalOpen" class="modal-overlay" @click.self="closePrintModal">
            <div class="modal-box pdf-modal-box animate-pop">
                <div class="modal-header">
                    <div>
                        <h3>Visualizar Cotações em Lote</h3>
                        <p>Total de {{ results.filter(r => r.status === 'SUCCESS').length }} cotações consolidadas no arquivo de impressão.</p>
                    </div>
                    <button @click="closePrintModal" class="modal-close" title="Fechar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-content-pdf">
                    <iframe id="print-iframe" :src="printPdfUrl" class="pdf-iframe"></iframe>
                </div>

                <div class="modal-actions-pdf mt-20">
                    <button @click="closePrintModal" class="btn-secondary-modal">Fechar</button>
                    <div class="right-actions">
                        <a :href="printPdfUrl" target="_blank" class="btn-primary-modal btn-download">
                            <i class="fas fa-download"></i> Baixar PDF Unificado
                        </a>
                        <button @click="printBatch" class="btn-primary-modal">
                            <i class="fas fa-print"></i> Imprimir Todas
                        </button>
                    </div>
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

.progress-panel {
    background: rgba(0, 74, 153, 0.05);
    border: 1px solid rgba(0, 74, 153, 0.15);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 20px;
}

.progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
    color: var(--text-main);
}

.progress-info strong {
    color: var(--primary);
}

.progress-bar-bg {
    width: 100%;
    height: 10px;
    background: var(--bg-input);
    border-radius: 999px;
    overflow: hidden;
    margin-top: 8px;
}

.progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary), #00a8ff);
    border-radius: 999px;
    transition: width 0.4s ease;
}

.progress-stats {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-muted);
}

.progress-stats strong {
    color: var(--text-main);
}

.mr-5 {
    margin-right: 5px;
}

.action-buttons-group {
    display: flex;
    align-items: center;
    gap: 12px;
}

.btn-print-all {
    background: var(--primary);
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
    box-shadow: 0 4px 10px rgba(0, 74, 153, 0.15);
}

.btn-print-all:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 14px rgba(0, 74, 153, 0.25);
    filter: brightness(1.1);
}

.btn-print-all:disabled {
    opacity: 0.65;
    cursor: not-allowed;
}

.pdf-modal-box {
    width: min(1000px, 95%) !important;
    height: 90vh;
}

.modal-content-pdf {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-top: 15px;
    background: #525659;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border);
    min-height: 50vh;
}

.pdf-iframe {
    width: 100%;
    height: 100%;
    border: none;
}

.modal-actions-pdf {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.right-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.btn-primary-modal {
    background: var(--primary);
    color: white;
    border: none;
    padding: 11px 22px;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 800;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    text-decoration: none;
    box-shadow: 0 4px 10px rgba(0, 74, 153, 0.15);
}

.btn-primary-modal:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
}

.btn-primary-modal.btn-download {
    background: #059669;
    box-shadow: 0 4px 10px rgba(5, 150, 105, 0.15);
}

.btn-primary-modal.btn-download:hover {
    background: #047857;
}

.btn-secondary-modal {
    background: var(--bg-input);
    color: var(--text-main);
    border: 1px solid var(--border);
    padding: 11px 22px;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary-modal:hover {
    background: var(--border);
}

.animate-pop {
    animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes popIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

.ipi-input-container {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
}

.btn-lock {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 0.85rem;
    transition: color 0.2s;
    display: inline-flex;
    align-items: center;
}

.btn-lock:hover {
    color: var(--primary);
}

.btn-lock i {
    font-size: 0.85rem;
}
</style>
