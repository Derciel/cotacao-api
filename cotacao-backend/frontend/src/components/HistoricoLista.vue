<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { safeFetch, getAuthToken, getAuthenticatedBlobUrl } from '../utils/api-utils';

const quotations = ref<any[]>([]);
const isLoading = ref(true);
const searchTerm = ref("");

const user = ref<any>(null);
const isAdmin = computed(() => user.value?.role === 'ADMIN');

// Password and Delete states
const isDeleteModalOpen = ref(false);
const quotationToDelete = ref<number | null>(null);
const adminPassword = ref("");
const CORRECT_PASSWORD = "123"; // Senha simples solicitada

// Status states
const isStatusModalOpen = ref(false);
const quotationToUpdate = ref<any>(null);
const selectedStatus = ref("");
const editNf = ref("");
const editCarrier = ref("");
const editFreightValue = ref(0);
const editDeadline = ref("");
const editFreightType = ref("CIF");
const isPdfPreviewOpen = ref(false);
const pdfPreviewUrl = ref("");
const isPdfLoading = ref(false);
const currentCarrierLogo = ref("");



const fetchQuotations = async () => {
    isLoading.value = true;
    try {
        const res = await safeFetch('/api/quotations');
        if (res.ok) {
            const data = res.data;
            quotations.value = Array.isArray(data) ? data : (data.data || []);
            currentPage.value = 1;
        }
    } catch (e) {
        console.error("Erro ao listar cotações", e);
    } finally {
        isLoading.value = false;
    }
};

const currentPage = ref(1);
const itemsPerPage = 10;

const paginatedQuotations = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredQuotations.value.slice(start, end);
});

const totalPages = computed(() => Math.ceil(filteredQuotations.value.length / itemsPerPage));

const nextPage = () => {
    if (currentPage.value < totalPages.value) currentPage.value++;
};

const prevPage = () => {
    if (currentPage.value > 1) currentPage.value--;
};

const openDeleteModal = (id: number) => {
    quotationToDelete.value = id;
    adminPassword.value = "";
    isDeleteModalOpen.value = true;
};

const confirmDelete = async () => {
    if (adminPassword.value.trim() !== CORRECT_PASSWORD) {
        return window.showToast('Senha administrativa incorreta!', 'error');
    }

    try {
        const res = await safeFetch(`/api/quotations/${quotationToDelete.value}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            window.showToast('Cotação removida com sucesso.', 'success');
            fetchQuotations();
            isDeleteModalOpen.value = false;
        } else {
            window.showToast('Erro ao remover cotação.', 'error');
        }
    } catch (e) {
        window.showToast('Falha na comunicação com o servidor.', 'error');
    }
};

const openStatusModal = (item: any) => {
    quotationToUpdate.value = item;
    selectedStatus.value = item.status || 'PENDENTE';
    editNf.value = item.nf || "";
    editCarrier.value = item.transportadora_escolhida || "";
    editFreightValue.value = item.valor_frete || 0;
    editDeadline.value = item.dias_para_entrega || "";
    editFreightType.value = item.tipo_frete || "CIF";
    isStatusModalOpen.value = true;
};

const updateStatus = async () => {
    try {
        // Consolidado em uma única chamada para evitar erros de concorrência e simplificar
        const resQuo = await safeFetch(`/api/quotations/${quotationToUpdate.value.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ 
                status: selectedStatus.value,
                nf: editNf.value,
                transportadora_escolhida: editCarrier.value,
                valor_frete: editFreightValue.value,
                dias_para_entrega: editDeadline.value,
                tipo_frete: editFreightType.value
            }),
            headers: { 
                'Content-Type': 'application/json'
            }
        });

        if (resQuo.ok) {
            window.showToast('Dados atualizados com sucesso!', 'success');
            fetchQuotations();
            isStatusModalOpen.value = false;
        } else {
            window.showToast('Erro ao atualizar dados.', 'error');
        }
    } catch (e) {
        window.showToast('Falha ao atualizar dados.', 'error');
    }
};

const auditQuote = async (id: number) => {
    try {
        const res = await safeFetch(`/api/audit/${id}`, { method: 'POST' });
        if (res.ok) {
            window.showToast('Auditoria realizada com sucesso!', 'success');
            // Opcional: Atualizar a lista ou ir para a página de conferência
        } else {
            window.showToast(res.data?.message || 'Erro ao realizar auditoria', 'error');
        }
    } catch (error) {
        window.showToast('Erro de conexão com o servidor', 'error');
    }
};

const filteredQuotations = computed(() => {
    if (!searchTerm.value) return quotations.value;
    const term = searchTerm.value.toLowerCase();
    return quotations.value.filter(q => 
        q.id.toString().includes(term) || 
        q.client?.razao_social?.toLowerCase().includes(term) ||
        q.transportadoraEscolhida?.toLowerCase().includes(term)
    );
});

const formatCurrency = (val: number) => {
    return val?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '---';
    return new Date(dateStr).toLocaleDateString('pt-BR');
};

const getPdfLink = (id: number) => {
    const token = getAuthToken();
    return `/api/quotations/${id}/pdf?token=${token}`;
};

const openPdfPreview = async (item: any) => {
    const url = `/api/quotations/${item.id}/pdf`;
    
    isPdfLoading.value = true;
    isPdfPreviewOpen.value = true;

    try {
        const blobUrl = await getAuthenticatedBlobUrl(url);
        pdfPreviewUrl.value = blobUrl;
    } catch (e) {
        console.error(e);
        window.showToast('Erro ao carregar PDF', 'error');
        isPdfPreviewOpen.value = false;
    }
    
    // Identifica a transportadora para o fundo adaptativo
    const carrier = item.transportadora_escolhida?.toUpperCase() || "";
    if (carrier.includes("RODONAVES") || carrier.includes("TEX CARGO") || carrier.includes("ENVIA") || carrier.includes("SUDOESTE")) {
        currentCarrierLogo.value = "white"; // Logos brancas pedem fundo preto
    } else {
        currentCarrierLogo.value = "dark"; // Logos escuras pedem fundo branco
    }
};

const onPdfLoaded = () => {
    isPdfLoading.value = false;
};

onMounted(() => {
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
        user.value = JSON.parse(userInfo);
    }
    fetchQuotations();
});
</script>

<template>
    <div class="history-list-wrapper">
        <header class="page-header">
            <div class="header-left">
                <h1>Histórico</h1>
                <p>Gerenciamento completo de cotações e documentos.</p>
            </div>
            
            <div class="header-right">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input v-model="searchTerm" type="text" placeholder="Buscar cliente ou cotação...">
                </div>
            </div>
        </header>

        <div class="glass-card table-card animate-fade-in shadow-lg">
            <div v-if="isLoading" class="loading-state">
                <div class="spinner-blue"></div>
                <p>Carregando histórico...</p>
            </div>

            <div v-else-if="filteredQuotations.length > 0" class="table-scroll">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>FRENET</th>
                            <th>Cliente</th>
                            <th>Usuário</th>
                            <th>Data</th>
                            <th>Transportadora</th>
                            <th>Vl. Frete</th>
                            <th>Valor Total</th>
                            <th>Status</th>
                            <th class="text-center">Audit</th>
                            <th class="actions-th text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in paginatedQuotations" :key="item.id">
                            <td class="id-col" data-label="ID">#{{ item.numero_pedido_manual || item.id }}</td>
                            <td class="client-col" data-label="Cliente">
                                <strong>{{ item.client?.razao_social || 'Desconhecido' }}</strong>
                            </td>
                            <td class="user-col" data-label="Usuário">
                                <span class="user-badge">{{ item.user?.username || 'Sistema' }}</span>
                            </td>
                            <td class="date-col" data-label="Data">{{ formatDate(item.created_at) }}</td>
                            <td class="transp-col" data-label="Transportadora">
                                <span class="transp-badge" :class="{ empty: !item.transportadora_escolhida }">
                                    {{ item.transportadora_escolhida || '---' }}
                                </span>
                            </td>
                            <td class="freight-col" data-label="Vl. Frete">{{ formatCurrency(item.valor_frete) }}</td>
                            <td class="value-col" data-label="Valor Total">{{ formatCurrency(item.valor_total_nota || item.valor_total_produtos) }}</td>
                            <td class="status-col" data-label="Status">
                                <span 
                                    @click="isAdmin ? openStatusModal(item) : null" 
                                    class="status-pill" 
                                    :class="[item.status?.toLowerCase() || 'pendente', { interactive: isAdmin }]"
                                >
                                    {{ item.status || 'PENDENTE' }}
                                    <i v-if="isAdmin" class="fas fa-edit ms-1"></i>
                                </span>
                            </td>
                            <td class="text-center">
                                <button v-if="item.nf" @click="auditQuote(item.id)" class="btn-audit-mini" title="Realizar Auditoria SIEG">
                                    <i class="fas fa-search-dollar"></i>
                                </button>
                                <span v-else class="no-nf">-</span>
                            </td>
                            <td class="actions-col">
                                <div class="btn-group justify-center">
                                    <button @click="openPdfPreview(item)" class="btn-icon view" title="Ver PDF">
                                        <i class="fas fa-file-pdf"></i>
                                    </button>
                                    <button v-if="isAdmin" class="btn-icon delete" title="Remover" @click="openDeleteModal(item.id)">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="pagination-controls" v-if="totalPages > 1">
                <button @click="prevPage" :disabled="currentPage === 1" class="btn-page"><i class="fas fa-chevron-left"></i></button>
                <span>Página {{ currentPage }} de {{ totalPages }}</span>
                <button @click="nextPage" :disabled="currentPage === totalPages" class="btn-page"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div v-if="!isLoading && filteredQuotations.length === 0" class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>Nenhuma cotação encontrada.</p>
            </div>
        </div>

        <!-- Modal Deletar -->
        <div v-if="isDeleteModalOpen" class="modal-overlay" @click.self="isDeleteModalOpen = false">
            <div class="modal-box small text-center animate-pop">
                <div class="warning-icon"><i class="fas fa-exclamation-circle"></i></div>
                <h3>Remover Cotação</h3>
                <p>Esta ação é irreversível. Por favor, digite a senha administrativa para confirmar.</p>
                <input v-model="adminPassword" type="password" placeholder="Senha..." class="pill-input mt-15" @keyup.enter="confirmDelete" autofocus>
                <div class="modal-actions-grid mt-20">
                    <button @click="isDeleteModalOpen = false" class="btn-cancel-modal">Cancelar</button>
                    <button @click="confirmDelete" class="btn-confirm-delete">Confirmar Exclusão</button>
                </div>
            </div>
        </div>

        <!-- Modal Status -->
        <div v-if="isStatusModalOpen" class="modal-overlay" @click.self="isStatusModalOpen = false">
            <div class="modal-box small animate-pop">
                <h3>Atualizar Status</h3>
                <p>Selecione o novo status para a cotação #{{ quotationToUpdate.id }}</p>
                <div class="status-options-list mt-15">
                    <button v-for="s in ['PENDENTE', 'APROVADO', 'AGUARDANDO COLETA', 'ENVIADO', 'CANCELADO']" 
                            :key="s" 
                            @click="selectedStatus = s"
                            class="status-option-btn"
                            :class="[s.toLowerCase(), { active: selectedStatus === s }]">
                        {{ s }}
                        <i v-if="selectedStatus === s" class="fas fa-check"></i>
                    </button>
                </div>
                <div class="nf-field mt-20">
                    <label class="field-label">Informações de Frete</label>
                    <div class="form-grid-small">
                        <div class="form-item">
                            <label>Transportadora</label>
                            <input v-model="editCarrier" type="text" placeholder="Ex: Rodonaves" class="pill-input-small">
                        </div>
                        <div class="form-item">
                            <label>Valor R$</label>
                            <input v-model="editFreightValue" type="number" step="0.01" class="pill-input-small">
                        </div>
                        <div class="form-item">
                            <label>Prazo (Dias)</label>
                            <input v-model="editDeadline" type="number" class="pill-input-small">
                        </div>
                        <div class="form-item">
                            <label>Tipo</label>
                            <select v-model="editFreightType" class="pill-input-small">
                                <option value="CIF">CIF</option>
                                <option value="FOB">FOB</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="nf-field mt-15">
                    <label class="field-label">Nº Nota Fiscal (NF)</label>
                    <input v-model="editNf" type="text" placeholder="Digite o número da NF..." class="pill-input-small">
                </div>
                <div class="modal-actions-grid mt-30">
                    <button @click="isStatusModalOpen = false" class="btn-cancel-modal">Fechar</button>
                    <button @click="updateStatus" class="btn-confirm-status">Salvar Alteração</button>
                </div>
            </div>
        </div>

        <!-- Visualizador de PDF Modal -->
        <div v-if="isPdfPreviewOpen" class="modal-overlay pdf-modal" @click.self="isPdfPreviewOpen = false">
            <div class="pdf-container animate-pop" :class="{ 'bg-black': currentCarrierLogo === 'white', 'bg-white': currentCarrierLogo === 'dark' }">
                <div class="pdf-header">
                    <div class="pdf-titles">
                        <h3>Visualizando Cotação</h3>
                        <p>Documento gerado pelo sistema</p>
                    </div>
                    <button class="btn-close-pdf" @click="isPdfPreviewOpen = false">×</button>
                </div>
                
                <div class="pdf-content">
                    <div v-if="isPdfLoading" class="pdf-loading">
                        <div class="spinner-blue"></div>
                        <p>Aguarde, carregando documento...</p>
                    </div>
                    <iframe 
                        :src="pdfPreviewUrl" 
                        class="pdf-frame" 
                        @load="onPdfLoaded"
                        frameborder="0"
                    ></iframe>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.interactive { cursor: pointer; transition: 0.2s; }
.interactive:hover { transform: scale(1.05); filter: brightness(1.1); }
.ms-1 { margin-left: 5px; opacity: 0.5; font-size: 0.7rem; }
.text-center { text-align: center; }
.justify-center { justify-content: center; }

/* Page Header Integration */
.page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; gap: 30px; flex-wrap: wrap; }
.header-left h1 { font-size: 2.2rem; font-weight: 800; color: var(--primary); margin: 0; letter-spacing: -1px; }
.header-left p { color: var(--text-muted); font-size: 1.1rem; margin-top: 5px; }

.search-bar { position: relative; width: 300px; }
.search-bar i { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
.search-bar input { width: 100%; padding: 12px 15px 12px 45px; border-radius: 12px; border: 1px solid var(--border); outline: none; background: var(--bg-surface); color: var(--text-main); font-size: 0.9rem; transition: 0.2s; }
.search-bar input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(0, 74, 153, 0.1); }

/* Table Styles */
.table-card { padding: 0 !important; overflow: hidden; background: var(--bg-surface); border-radius: 20px; border: 1px solid var(--border); }
.table-scroll { overflow-x: auto; }
.premium-table { width: 100%; border-collapse: collapse; min-width: 900px; }
.premium-table th { text-align: left; padding: 18px 25px; background: var(--bg-input); color: var(--text-muted); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid var(--border); }
.premium-table td { padding: 15px 25px; border-bottom: 1px solid var(--border); vertical-align: middle; font-size: 0.95rem; color: var(--text-main); }
.premium-table tr:hover { background-color: var(--bg-input); opacity: 0.8; }

.id-col { color: var(--primary); font-weight: 800; font-family: monospace; font-size: 1rem; }
.client-col strong { color: var(--text-main); font-weight: 700; }
.date-col { color: var(--text-muted); font-size: 0.85rem; }
.value-col { font-weight: 800; color: var(--text-main); }

.user-badge {
    background: var(--bg-input);
    color: var(--text-muted);
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
}

.transp-badge { background: rgba(0, 74, 153, 0.1); color: var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
.transp-badge.empty { background: var(--bg-input); color: var(--text-muted); }

.status-pill { padding: 6px 14px; border-radius: 99px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; display: inline-flex; align-items: center; white-space: nowrap; }
.status-pill.aprovado { background: var(--status-aprovado-bg); color: var(--status-aprovado-text); }
.status-pill.pendente { background: var(--status-pendente-bg); color: var(--status-pendente-text); }
.status-pill.enviado { background: var(--status-enviado-bg); color: var(--status-enviado-text); }
.status-pill.enviado { background: var(--status-enviado-bg); color: var(--status-enviado-text); }
.status-pill.cancelado { background: var(--status-cancelado-bg); color: var(--status-cancelado-text); }
.status-pill.aguardando.coleta { background: #e0e7ff; color: #4338ca; }

.pagination-controls { display: flex; align-items: center; justify-content: center; gap: 20px; padding: 20px; border-top: 1px solid var(--border); }
.btn-page { width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-input); color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.btn-page:hover:not(:disabled) { background: var(--primary); color: white; border-color: var(--primary); }
.btn-page:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-group { display: flex; gap: 10px; }
.btn-icon { width: 38px; height: 38px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.btn-icon.view:hover { background: var(--primary); color: white; border-color: var(--primary); transform: scale(1.1); }
.btn-icon.delete:hover { background: #ef4444; color: white; border-color: #ef4444; transform: scale(1.1); }

/* Modals */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 9000; display: flex; align-items: center; justify-content: center; }
.modal-box { background: var(--bg-surface); padding: 30px; border-radius: 24px; width: 90%; max-width: 400px; box-shadow: var(--shadow-card); border: 1px solid var(--border); }
.modal-box h3 { font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 5px; }
.modal-box p { color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; }

.warning-icon { font-size: 3rem; color: #f59e0b; margin-bottom: 15px; }

.pill-input { width: 100%; padding: 14px 20px; border-radius: 12px; border: 2px solid var(--border); outline: none; transition: 0.2s; font-size: 1rem; text-align: center; font-weight: 700; letter-spacing: 5px; background: var(--bg-input); color: var(--text-main); }
.pill-input:focus { border-color: #ef4444; background: var(--bg-surface); }

.modal-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.btn-cancel-modal { padding: 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-input); font-weight: 700; color: var(--text-muted); cursor: pointer; transition: 0.2s; }
.btn-cancel-modal:hover { background: var(--bg-surface); color: var(--text-main); }
.btn-confirm-delete { padding: 12px; border-radius: 12px; border: none; background: #ef4444; color: white; font-weight: 800; cursor: pointer; transition: 0.2s; }
.btn-confirm-delete:hover { background: #dc2626; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.4); }

.status-options-list { display: flex; flex-direction: column; gap: 8px; }
.status-option-btn { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-radius: 12px; border: 1.5px solid var(--border); font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: 0.2s; background: var(--bg-input); color: var(--text-main); }
.status-option-btn.active { border-width: 3px; }
.status-option-btn.pendente.active { border-color: var(--status-pendente-text); background: var(--status-pendente-bg); }
.status-option-btn.aprovado.active { border-color: var(--status-aprovado-text); background: var(--status-aprovado-bg); }
.status-option-btn.enviado.active { border-color: var(--status-enviado-text); background: var(--status-enviado-bg); }
.status-option-btn.enviado.active { border-color: var(--status-enviado-text); background: var(--status-enviado-bg); }
.status-option-btn.cancelado.active { border-color: var(--status-cancelado-text); background: var(--status-cancelado-bg); }
.status-option-btn.aguardando.coleta.active { border-color: #4338ca; background: #e0e7ff; }

.btn-confirm-status { padding: 12px; border-radius: 12px; border: none; background: var(--primary); color: white; font-weight: 800; cursor: pointer; transition: 0.2s; }
.btn-confirm-status:hover { background: var(--primary-dark); transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 74, 153, 0.3); }

/* PDF Preview Modal */
.pdf-modal { background: rgba(0,0,0,0.85); z-index: 10000; }
.pdf-container { width: 95%; height: 90vh; max-width: 1000px; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }
.pdf-container.bg-black { background: #111; color: white; }
.pdf-container.bg-white { background: #fff; color: #111; }

.pdf-header { padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(128,128,128,0.2); }
.pdf-titles h3 { margin: 0; font-size: 1.2rem; font-weight: 850; }
.pdf-titles p { margin: 0; font-size: 0.8rem; opacity: 0.7; }

.btn-close-pdf { background: none; border: none; font-size: 2rem; color: inherit; cursor: pointer; opacity: 0.6; transition: 0.2s; }
.btn-close-pdf:hover { opacity: 1; transform: rotate(90deg); }

.pdf-content { flex: 1; position: relative; }
.pdf-frame { width: 100%; height: 100%; }
.pdf-loading { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: inherit; z-index: 10; }

.freight-col { font-weight: 700; color: var(--primary); }

.animate-pop { animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes pop { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

.loading-state, .empty-state { padding: 60px; text-align: center; color: #94a3b8; }
.spinner-blue { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #004a99; border-radius: 50%; margin: 0 auto 15px; animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.mt-20 { margin-top: 20px; }
.mt-30 { margin-top: 30px; }
.mt-15 { margin-top: 15px; }

.field-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 800;
    color: var(--text-muted);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.pill-input-small {
    width: 100%;
    padding: 12px 18px;
    border-radius: 12px;
    border: 1px solid var(--border);
    outline: none;
    transition: 0.2s;
    font-size: 0.95rem;
    background: var(--bg-input);
    color: var(--text-main);
}
.pill-input-small:focus {
    border-color: var(--primary);
    background: var(--bg-surface);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.form-grid-small {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    background: var(--bg-input);
    padding: 15px;
    border-radius: 12px;
    border: 1px solid var(--border);
}
.form-item label {
    font-size: 0.65rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    display: block;
    margin-bottom: 4px;
}
select.pill-input-small {
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 1em;
    padding-right: 30px;
}


.btn-audit-mini {
    background: var(--primary);
    color: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    cursor: pointer;
    transition: 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.btn-audit-mini:hover { 
    transform: scale(1.1); 
    box-shadow: 0 4px 12px rgba(0, 74, 153, 0.3);
    background: var(--primary-dark);
}
.no-nf { color: var(--text-muted); font-size: 0.8rem; opacity: 0.5; }
.text-right { text-align: right; }

@media (max-width: 1024px) {
    .page-header { flex-direction: column; align-items: flex-start; gap: 20px; }
    .search-bar { width: 100%; }
}

@media (max-width: 768px) {
    .header-left h1 { font-size: 1.8rem; }
    .premium-table thead { display: none; }
    .premium-table, .premium-table tbody, .premium-table tr, .premium-table td { display: block; width: 100%; }
    .premium-table tr { padding: 20px; border-bottom: 8px solid var(--bg-input); position: relative; }
    .premium-table td { padding: 8px 0; border: none; font-size: 0.9rem; }
    .premium-table td::before { content: attr(data-label); font-weight: 800; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 2px; }
    
    .id-col { font-size: 1.1rem; }
    .actions-col { position: absolute; top: 15px; right: 15px; background: none !important; }
    .btn-group { flex-direction: column; gap: 5px; }
    .btn-icon { width: 32px; height: 32px; }
    
    .status-pill { width: 100%; justify-content: center; padding: 10px; font-size: 0.8rem; }
    .pagination-controls { flex-direction: column; gap: 15px; }
}
</style>
