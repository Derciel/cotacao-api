<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { safeFetch, getAuthToken } from '../utils/api-utils';

const coletas = ref<any[]>([]);
const loading = ref(true);

// State for PDF Modal
const isPdfModalOpen = ref(false);
const currentPdfUrl = ref('');

const openPdfModal = (id: number) => {
    currentPdfUrl.value = getPdfLink(id);
    isPdfModalOpen.value = true;
};

const closePdfModal = () => {
    isPdfModalOpen.value = false;
    currentPdfUrl.value = '';
};

const fetchCollections = async () => {
    loading.value = true;
    try {
        const res = await safeFetch('/api/quotations/collections');
        if (res.ok) {
            coletas.value = res.data;
        }
    } catch (e) {
        console.error('Erro ao buscar coletas', e);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchCollections);

const getStatusClass = (status: string) => {
    switch(status.toLowerCase()) {
        case 'agendada': return 'status-agendada';
        case 'concluída': return 'status-concluida';
        case 'cancelada': return 'status-cancelada';
        case 'aguardando coleta': return 'status-aguardando';
        default: return '';
    }
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '---';
    return new Date(dateStr).toLocaleDateString('pt-BR');
};

const getPdfLink = (id: number) => {
    const token = getAuthToken();
    return `/api/quotations/${id}/pdf?token=${token}`;
};

const revertStatus = async (id: number) => {
    if (!confirm('Deseja retornar esta cotação para o histórico (Status: APROVADO)?')) return;
    
    try {
        const res = await safeFetch(`/api/quotations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'APROVADO' })
        });
        
        if (res.ok) {
            window.showToast('Cotação retornada ao histórico.', 'success');
            fetchCollections();
        } else {
            window.showToast('Erro ao atualizar status.', 'error');
        }
    } catch (e) {
        window.showToast('Falha na comunicação.', 'error');
    }
};

const getCarrierLogo = (name: string) => {
    const n = name.toUpperCase();
    if (n.includes('RODONAVES') || n.includes('RODOR')) return 'https://i.ibb.co/nnvt26n/logo-header-1.png';
    if (n.includes('VIP')) return 'https://i.ibb.co/hsvJymp/Vip-Logo03-1.png';
    if (n.includes('ALFA')) return 'https://i.ibb.co/PFwh475/alfa.png';
    if (n.includes('COOPEX')) return 'https://i.ibb.co/YbYTcHq/coopex.png';
    if (n.includes('TEX')) return 'https://i.ibb.co/cLsYLPh/logo-white-tex.png';
    if (n.includes('ENVIA')) return 'https://i.ibb.co/FJCV12Y/envia-rapido.png';
    if (n.includes('SUDOESTE')) return 'https://i.ibb.co/LXWDvvB9/logo-sudoeste-transportes.png';
    if (n.includes('LATAM')) return 'https://img.icons8.com/color/96/latam-airlines.png';
    if (n.includes('AZUL')) return 'https://img.icons8.com/color/96/azul-brazilian-airlines.png';
    return null;
};
</script>

<template>
  <div class="collections-container">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Buscando cargas para coleta...</p>
    </div>

    <div v-else-if="coletas.length === 0" class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>Nenhuma coleta pendente encontrada.</p>
    </div>

    <div v-else class="carrier-grid">
      <div v-for="group in coletas" :key="group.transportadora" class="carrier-card animate-fade-in">
        <header class="card-header">
            <div class="carrier-info">
                <div class="logo-wrapper">
                    <img 
                        v-if="getCarrierLogo(group.transportadora)" 
                        :src="getCarrierLogo(group.transportadora)" 
                        :alt="group.transportadora" 
                        class="carrier-logo"
                        onerror="this.src='/logo-npcargo.jpg'; this.style.opacity='0.5';"
                    >
                    <i v-else class="fas fa-truck carrier-placeholder"></i>
                </div>
                <div>
                    <h3>{{ group.transportadora }}</h3>
                    <span class="count-badge">{{ group.quotations.length }} cotações</span>
                </div>
            </div>
            <div class="carrier-totals-summary">
                <div class="total-badge">
                    <i class="fas fa-boxes"></i>
                    <span><strong>{{ group.totalVolumes }}</strong> vols</span>
                </div>
                <div class="total-badge weight">
                    <i class="fas fa-weight-hanging"></i>
                    <span><strong>{{ group.totalWeight.toFixed(1) }}</strong> kg</span>
                </div>
            </div>
        </header>

        <div class="card-body">
            <table class="minimal-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Volumes</th>
                        <th>Peso</th>
                        <th class="text-right">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="c in group.quotations" :key="c.id" class="item-row">
                        <td class="id-cell" data-label="ID">#{{ c.id }}</td>
                        <td class="date-cell" data-label="Data">{{ formatDate(c.date) }}</td>
                        <td class="client-cell" data-label="Cliente">
                            <strong>{{ c.client }}</strong>
                        </td>
                        <td data-label="Volumes">{{ c.volumes }}</td>
                        <td data-label="Peso">{{ c.weight.toFixed(1) }}kg</td>
                        <td class="text-right actions-td">
                            <div class="action-btns">
                                <button @click="openPdfModal(c.id)" class="btn-tiny view" title="Ver PDF">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button @click="revertStatus(c.id)" class="btn-tiny revert" title="Voltar ao Histórico">
                                    <i class="fas fa-undo"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
      </div>
    </div>

    <!-- PDF Preview Modal -->
    <div v-if="isPdfModalOpen" class="modal-overlay" @click.self="closePdfModal">
        <div class="modal-box pdf-modal-box animate-pop">
            <header class="modal-header-simple">
                <h3>Visualização da Cotação</h3>
                <button @click="closePdfModal" class="btn-close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </header>
            <div class="modal-content-pdf">
                <iframe :src="currentPdfUrl" class="pdf-iframe"></iframe>
            </div>
            <footer class="modal-footer-simple">
                <button @click="closePdfModal" class="btn-secondary-modal">Fechar</button>
                <a :href="currentPdfUrl" target="_blank" class="btn-primary-modal">
                    <i class="fas fa-external-link-alt"></i> Abrir em Nova Aba
                </a>
            </footer>
        </div>
    </div>
  </div>
</template>

<style scoped>
.collections-container { padding: 5px; }

.carrier-grid {
    display: flex;
    flex-direction: column;
    gap: 25px;
}

.carrier-card {
    background: var(--bg-surface);
    border-radius: 20px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    transition: transform 0.3s;
}

.carrier-card:hover {
    transform: translateY(-2px);
}

.card-header {
    background: var(--bg-input);
    padding: 15px 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
}

.carrier-info {
    display: flex;
    align-items: center;
    gap: 20px;
}

.logo-wrapper {
    width: 60px;
    height: 60px;
    background: #111827;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border: 1px solid var(--border);
    overflow: hidden;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
}

.carrier-logo {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.carrier-placeholder {
    font-size: 1.5rem;
    color: var(--primary);
}

.carrier-info h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--text-main);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.count-badge {
    background: rgba(0, 74, 153, 0.1);
    color: var(--primary);
    padding: 2px 10px;
    border-radius: 99px;
    font-size: 0.75rem;
    font-weight: 700;
}

.carrier-totals-summary {
    display: flex;
    gap: 15px;
}

.total-badge {
    background: var(--bg-surface);
    padding: 10px 18px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--border);
    color: var(--text-muted);
}

.total-badge i { color: var(--primary); }
.total-badge strong { color: var(--text-main); font-size: 1.1rem; }

.card-body { padding: 0; }

.minimal-table {
    width: 100%;
    border-collapse: collapse;
}

.minimal-table th {
    text-align: left;
    padding: 12px 25px;
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    font-weight: 800;
    background: rgba(0,0,0,0.02);
}

.minimal-table td {
    padding: 12px 25px;
    border-bottom: 1px solid var(--border);
    font-size: 0.9rem;
}

.item-row:hover { background: rgba(0, 74, 153, 0.02); }

.id-cell { font-family: monospace; font-weight: 700; color: var(--primary); }
.client-cell strong { color: var(--text-main); }
.text-right { text-align: right; }

.action-btns {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.btn-tiny {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: 0.2s;
    text-decoration: none;
}

.btn-tiny:hover {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
    transform: scale(1.1);
}

.btn-tiny.revert:hover {
    background: #f59e0b;
    border-color: #f59e0b;
}

.loading-state, .empty-state {
    padding: 80px;
    text-align: center;
    color: var(--text-muted);
}

.empty-state i { font-size: 3rem; margin-bottom: 15px; opacity: 0.5; }

.spinner {
    width: 40px; height: 40px;
    border: 3px solid var(--bg-input);
    border-top: 3px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px;
}


@keyframes spin { to { transform: rotate(360deg); } }

/* RESPONSIVIDADE */
@media (max-width: 768px) {
    .card-header { flex-direction: column; align-items: flex-start; gap: 15px; padding: 20px; }
    .carrier-totals-summary { width: 100%; justify-content: space-between; }
    .total-badge { flex: 1; justify-content: center; padding: 10px; }
    
    .minimal-table thead { display: none; }
    .minimal-table, .minimal-table tbody, .minimal-table tr, .minimal-table td { display: block; width: 100%; }
    .minimal-table tr { padding: 15px; border-bottom: 2px solid var(--border); position: relative; }
    .minimal-table td { padding: 6px 0; border: none; font-size: 0.85rem; }
    .minimal-table td::before { content: attr(data-label); font-weight: 800; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 2px; }
    
    .actions-td { position: absolute; top: 15px; right: 15px; text-align: right; }
    .action-btns { flex-direction: column; gap: 5px; }
    
    .logo-wrapper { width: 50px; height: 50px; }
    .carrier-info h3 { font-size: 1rem; }
}

/* Modal Styles */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
}

.pdf-modal-box {
    background: var(--bg-surface);
    width: 95%;
    max-width: 1000px;
    height: 90vh;
    border-radius: 24px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid var(--border);
}

.modal-header-simple {
    padding: 20px 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
    background: var(--bg-input);
}

.modal-header-simple h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 850;
    color: var(--text-main);
}

.btn-close-modal {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 1.5rem;
    cursor: pointer;
    transition: 0.2s;
}

.btn-close-modal:hover {
    color: #ef4444;
}

.modal-content-pdf {
    flex: 1;
    background: #525659; /* Cor padrão visualizadores PDF */
}

.pdf-iframe {
    width: 100%;
    height: 100%;
    border: none;
}

.modal-footer-simple {
    padding: 15px 30px;
    display: flex;
    justify-content: flex-end;
    gap: 15px;
    border-top: 1px solid var(--border);
    background: var(--bg-input);
}

.btn-secondary-modal {
    padding: 10px 25px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text-main);
    font-weight: 700;
    cursor: pointer;
    transition: 0.2s;
}

.btn-primary-modal {
    padding: 10px 25px;
    border-radius: 12px;
    border: none;
    background: var(--primary);
    color: white;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: 0.2s;
}

.btn-primary-modal:hover {
    filter: brightness(1.1);
    transform: translateY(-2px);
}

@keyframes pop {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

.animate-pop {
    animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
</style>
