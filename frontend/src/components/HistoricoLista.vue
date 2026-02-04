<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

const quotations = ref<any[]>([]);
const isLoading = ref(true);
const searchTerm = ref("");

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

const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const fetchQuotations = async () => {
    isLoading.value = true;
    try {
        const res = await fetch('/api/quotations', {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        quotations.value = Array.isArray(data) ? data : (data.data || []);
    } catch (e) {
        console.error("Erro ao listar cotações", e);
    } finally {
        isLoading.value = false;
    }
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
        const res = await fetch(`/api/quotations/${quotationToDelete.value}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
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
        const resQuo = await fetch(`/api/quotations/${quotationToUpdate.value.id}`, {
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
                'Content-Type': 'application/json',
                ...getAuthHeaders()
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

const getPdfUrl = (id: number) => `/api/quotations/${id}/pdf`;
const viewPdf = (id: number) => window.open(getPdfUrl(id), '_blank');

onMounted(fetchQuotations);
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
                            <th>Data</th>
                            <th>Transportadora</th>
                            <th>Valor Total</th>
                            <th>Status</th>
                            <th class="actions-th text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in filteredQuotations" :key="item.id">
                            <td class="id-col">#{{ item.numero_pedido_manual || item.id }}</td>
                            <td class="client-col">
                                <strong>{{ item.client?.razao_social || 'Desconhecido' }}</strong>
                            </td>
                            <td class="date-col">{{ formatDate(item.created_at) }}</td>
                            <td class="transp-col">
                                <span class="transp-badge" :class="{ empty: !item.transportadora_escolhida }">
                                    {{ item.transportadora_escolhida || '---' }}
                                </span>
                            </td>
                            <td class="value-col">{{ formatCurrency(item.valor_total_nota || item.valor_total_produtos) }}</td>
                            <td class="status-col">
                                <span @click="openStatusModal(item)" class="status-pill interactive" :class="item.status?.toLowerCase() || 'pendente'">
                                    {{ item.status || 'PENDENTE' }}
                                    <i class="fas fa-edit ms-1"></i>
                                </span>
                            </td>
                            <td class="actions-col">
                                <div class="btn-group justify-center">
                                    <button class="btn-icon view" title="Ver PDF" @click="viewPdf(item.id)">
                                        <i class="fas fa-file-pdf"></i>
                                    </button>
                                    <button class="btn-icon delete" title="Remover" @click="openDeleteModal(item.id)">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-else class="empty-state">
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
                    <button v-for="s in ['PENDENTE', 'APROVADO', 'ENVIADO', 'CANCELADO']" 
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
.header-left h1 { font-size: 2.2rem; font-weight: 800; color: #004a99; margin: 0; letter-spacing: -1px; }
.header-left p { color: #64748b; font-size: 1.1rem; margin-top: 5px; }

.search-bar { position: relative; width: 300px; }
.search-bar i { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
.search-bar input { width: 100%; padding: 12px 15px 12px 45px; border-radius: 12px; border: 1px solid #e2e8f0; outline: none; background: white; font-size: 0.9rem; transition: 0.2s; }
.search-bar input:focus { border-color: #004a99; box-shadow: 0 0 0 4px rgba(0, 74, 153, 0.1); }

/* Table Styles */
.table-card { padding: 0 !important; overflow: hidden; background: white; border-radius: 20px; border: 1px solid #e2e8f0; }
.table-scroll { overflow-x: auto; }
.premium-table { width: 100%; border-collapse: collapse; min-width: 900px; }
.premium-table th { text-align: left; padding: 18px 25px; background: #f8fafc; color: #64748b; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9; }
.premium-table td { padding: 15px 25px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; font-size: 0.95rem; }
.premium-table tr:hover { background-color: #fcfdfe; }

.id-col { color: #004a99; font-weight: 800; font-family: monospace; font-size: 1rem; }
.client-col strong { color: #1e293b; font-weight: 700; }
.date-col { color: #64748b; font-size: 0.85rem; }
.value-col { font-weight: 800; color: #1e293b; }

.transp-badge { background: #eef6ff; color: #004a99; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
.transp-badge.empty { background: #f1f5f9; color: #94a3b8; }

.status-pill { padding: 6px 14px; border-radius: 99px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; display: inline-flex; align-items: center; }
.status-pill.aprovado { background: #dcfce7; color: #166534; }
.status-pill.pendente { background: #fef9c3; color: #854d0e; }
.status-pill.enviado { background: #dbeafe; color: #1e40af; }
.status-pill.cancelado { background: #fee2e2; color: #991b1b; }

.btn-group { display: flex; gap: 10px; }
.btn-icon { width: 38px; height: 38px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.btn-icon.view:hover { background: #004a99; color: white; border-color: #004a99; transform: scale(1.1); }
.btn-icon.delete:hover { background: #ef4444; color: white; border-color: #ef4444; transform: scale(1.1); }

/* Modals */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 9000; display: flex; align-items: center; justify-content: center; }
.modal-box { background: white; padding: 30px; border-radius: 24px; width: 90%; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
.modal-box h3 { font-size: 1.5rem; font-weight: 800; color: #1e293b; margin-bottom: 5px; }
.modal-box p { color: #64748b; font-size: 0.95rem; line-height: 1.5; }

.warning-icon { font-size: 3rem; color: #f59e0b; margin-bottom: 15px; }

.pill-input { width: 100%; padding: 14px 20px; border-radius: 12px; border: 2px solid #e2e8f0; outline: none; transition: 0.2s; font-size: 1rem; text-align: center; font-weight: 700; letter-spacing: 5px; }
.pill-input:focus { border-color: #ef4444; background: #fff1f2; }

.modal-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.btn-cancel-modal { padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 700; color: #64748b; cursor: pointer; transition: 0.2s; }
.btn-cancel-modal:hover { background: #f1f5f9; color: #1e293b; }
.btn-confirm-delete { padding: 12px; border-radius: 12px; border: none; background: #ef4444; color: white; font-weight: 800; cursor: pointer; transition: 0.2s; }
.btn-confirm-delete:hover { background: #dc2626; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.4); }

.status-options-list { display: flex; flex-direction: column; gap: 8px; }
.status-option-btn { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-radius: 12px; border: 1.5px solid #e2e8f0; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: 0.2s; }
.status-option-btn.active { border-width: 3px; }
.status-option-btn.pendente.active { border-color: #f59e0b; background: #fffbeb; }
.status-option-btn.aprovado.active { border-color: #10b981; background: #f0fdf4; }
.status-option-btn.enviado.active { border-color: #3b82f6; background: #eff6ff; }
.status-option-btn.cancelado.active { border-color: #ef4444; background: #fef2f2; }

.btn-confirm-status { padding: 12px; border-radius: 12px; border: none; background: #004a99; color: white; font-weight: 800; cursor: pointer; transition: 0.2s; }
.btn-confirm-status:hover { background: #1e40af; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 74, 153, 0.3); }

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
    color: #64748b;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.pill-input-small {
    width: 100%;
    padding: 12px 18px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    outline: none;
    transition: 0.2s;
    font-size: 0.95rem;
    background: #f8fafc;
}
.pill-input-small:focus {
    border-color: #004a99;
    background: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.form-grid-small {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    background: #f8fafc;
    padding: 15px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
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

@media (max-width: 1024px) {
    .page-header { flex-direction: column; align-items: flex-start; }
}
</style>
