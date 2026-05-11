<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { safeFetch } from '../utils/api-utils';

interface BatchResult {
    id?: number;
    cnpj?: string;
    client?: string;
    carrier?: string;
    status: 'SUCCESS' | 'ERROR' | 'MANUAL_REQUIRED';
    message?: string;
}

const cnpjs = ref("");
const isProcessing = ref(false);
const results = ref<BatchResult[]>([]);
const isProductModalOpen = ref(false);
const productSearch = ref("");
const productList = ref<any[]>([]);
const selectedProducts = ref<any[]>([]);
const isSearching = ref(false);

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
    selectedProducts.value.push({
        productId: p.id,
        nome: p.nome,
        quantidade: 1,
        valorUnitario: p.valor_unitario
    });
    isProductModalOpen.value = false;
};

const removeProduct = (idx: number) => {
    selectedProducts.value.splice(idx, 1);
};

const processBatch = async () => {
    const list = cnpjs.value.split('\n').map(c => c.trim()).filter(c => c.length > 0);
    if (list.length === 0) return window.showToast("Insira ao menos um CNPJ.", "warning");
    if (selectedProducts.value.length === 0) return window.showToast("Selecione ao menos um produto.", "warning");

    isProcessing.value = true;
    results.value = [];

    try {
        const payload = {
            requests: list.map(cnpj => ({
                cnpj: cnpj.replace(/\D/g, ''),
                items: selectedProducts.value.map(p => ({
                    productId: p.productId,
                    quantidade: p.quantidade,
                    valorUnitario: p.valorUnitario
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

                <div class="product-section">
                    <label class="section-label">2. Produtos do Lote</label>
                    <div class="selected-products">
                        <div v-for="(p, idx) in selectedProducts" :key="idx" class="product-item">
                            <div class="p-info">
                                <strong>{{ p.nome }}</strong>
                                <div class="p-controls">
                                    <input type="number" v-model="p.quantidade" class="mini-input" title="Quantidade">
                                    <span>un</span>
                                </div>
                            </div>
                            <button @click="removeProduct(idx)" class="btn-remove-p">×</button>
                        </div>
                        <button @click="addProduct" class="btn-add-p">+ Adicionar Produto</button>
                    </div>
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
                            <td><small>{{ r.message || '-' }}</small></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal Busca de Produtos -->
        <div v-if="isProductModalOpen" class="modal-overlay" @click.self="isProductModalOpen = false">
            <div class="modal-box">
                <h3>Selecionar Produto</h3>
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
}

.section-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 10px;
    text-transform: uppercase;
}

.pill-textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    padding: 15px;
    font-family: monospace;
    font-size: 0.95rem;
    resize: none;
    transition: all 0.3s;
}

.pill-textarea:focus {
    outline: none;
    border-color: var(--brand-color, #004a99);
    background: white;
    box-shadow: 0 0 0 4px rgba(0, 74, 153, 0.1);
}

.selected-products {
    background: rgba(0, 0, 0, 0.03);
    border-radius: 12px;
    padding: 15px;
    min-height: 200px;
}

.product-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    padding: 10px 15px;
    border-radius: 8px;
    margin-bottom: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.p-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.p-controls {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    color: #64748b;
}

.mini-input {
    width: 50px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 2px 5px;
    text-align: center;
}

.btn-remove-p {
    background: #fee2e2;
    color: #ef4444;
    border: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
}

.btn-add-p {
    width: 100%;
    padding: 10px;
    border: 2px dashed #cbd5e1;
    background: transparent;
    border-radius: 8px;
    color: #64748b;
    cursor: pointer;
    font-weight: 500;
}

.btn-add-p:hover {
    background: rgba(255, 255, 255, 0.5);
    border-color: #94a3b8;
}

.btn-zip {
    background: #059669;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
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

.modern-table {
    width: 100%;
    border-collapse: collapse;
}

.modern-table th {
    text-align: left;
    padding: 12px;
    border-bottom: 2px solid #e2e8f0;
    color: #64748b;
    font-size: 0.8rem;
    text-transform: uppercase;
}

.modern-table td {
    padding: 12px;
    border-bottom: 1px solid #f1f5f9;
}

.client-name {
    font-size: 0.8rem;
    color: #64748b;
}

.status-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
}

.status-badge.SUCCESS { background: #dcfce7; color: #15803d; }
.status-badge.ERROR { background: #fee2e2; color: #b91c1c; }
.status-badge.MANUAL_REQUIRED { background: #fef9c3; color: #a16207; }

tr.ERROR { background: rgba(239, 68, 68, 0.02); }

.fade-in {
    animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
