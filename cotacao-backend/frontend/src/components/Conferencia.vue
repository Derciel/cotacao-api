<template>
  <div class="conferencia-container animate-fade-in">
    <!-- Header Premium -->
    <div class="glass-card header-card">
      <div class="header-main">
        <div class="header-info">
          <div class="icon-circle">
            <i class="fas fa-file-invoice-dollar"></i>
          </div>
          <div>
            <h1 class="page-title">Módulo de Conferência</h1>
            <p class="page-subtitle">Auditoria de fretes, pesos e volumes integrados ao SIEG</p>
          </div>
        </div>
        <div class="header-actions">
          <button @click="loadData" class="btn-primary-outline" :disabled="loading">
            <i :class="['fas fa-sync-alt', { 'fa-spin': loading }]"></i>
            <span>Sincronizar Dados</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Dashboard de Resumo -->
    <div v-if="summary && Object.keys(summary).length > 0" class="summary-row">
      <div v-for="(data, carrier) in summary" :key="carrier" class="summary-box glass-premium">
        <div class="box-top">
          <span class="carrier-tag">{{ carrier }}</span>
          <span class="count-tag">{{ data.count }} Audits</span>
        </div>
        <div class="box-values">
          <div class="val-group">
            <span class="val-label">Economia</span>
            <span class="val-number text-success">R$ {{ formatNumber(data.gains) }}</span>
          </div>
          <div class="val-group">
            <span class="val-label">Perda/Divergência</span>
            <span class="val-number text-danger">R$ {{ formatNumber(data.losses) }}</span>
          </div>
        </div>
        <div class="box-progress">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: getProgressWidth(data), background: getProgressColor(data) }"></div>
          </div>
          <div class="progress-labels">
            <span>{{ getProgressPercentage(data) }}% OK</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Lista de Auditorias -->
    <div class="glass-card table-card">
      <div class="card-header-inner">
        <h3>Histórico de Conferências</h3>
        <div class="filters">
            <!-- Espaço para filtros futuros -->
        </div>
      </div>

      <div class="table-wrapper">
        <table v-if="!loading && audits.length > 0" class="premium-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Transportadora</th>
              <th>Cotação</th>
              <th>Real (SIEG)</th>
              <th>Divergência</th>
              <th>Status</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="audit in audits" :key="audit.id" :class="{ 'row-warning': audit.status === 'DIVERGENTE' }">
              <td>
                <div class="doc-cell">
                  <div class="nf-badge">NF {{ audit.nfe_number }}</div>
                  <div class="cte-info">CT-e {{ audit.cte_number || 'Pendente' }}</div>
                </div>
              </td>
              <td>
                <span class="carrier-name-cell">{{ audit.transportadora }}</span>
              </td>
              <td>
                <span class="currency">R$</span> {{ formatNumber(audit.valor_frete_cotado) }}
              </td>
              <td>
                <span class="currency">R$</span> {{ formatNumber(audit.valor_frete_sieg) }}
              </td>
              <td>
                <span :class="['diff-tag', getDiffClass(audit.divergencia_valor)]">
                  R$ {{ formatNumber(audit.divergencia_valor) }}
                </span>
              </td>
              <td>
                <div :class="['status-indicator', audit.status.toLowerCase()]">
                  <span class="dot"></span>
                  {{ audit.status }}
                </div>
              </td>
              <td class="text-right">
                <div class="btn-group">
                  <button v-if="audit.status === 'DIVERGENTE'" @click="handleCheck(audit.id)" class="btn-action success" title="Aprovar">
                    <i class="fas fa-check"></i>
                  </button>
                  <button v-if="audit.xml_content" @click="openXmlModal(audit)" class="btn-action info" title="Ver XML">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button v-if="audit.xml_content" @click="downloadXml(audit.id)" class="btn-action secondary" title="Download XML">
                    <i class="fas fa-download"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- State Empty -->
        <div v-else-if="!loading && audits.length === 0" class="empty-state-lux">
          <div class="empty-icon">
            <i class="fas fa-clipboard-check"></i>
          </div>
          <h4>Nenhuma auditoria encontrada</h4>
          <p>As conferências realizadas via SIEG aparecerão aqui.</p>
        </div>

        <!-- State Loading -->
        <div v-if="loading" class="loading-overlay">
          <div class="loader-premium"></div>
          <span>Processando dados fiscais...</span>
        </div>
      </div>
    </div>

    <!-- Modal Visualizador XML -->
    <div v-if="selectedXmlAudit" class="modal-overlay" @click.self="selectedXmlAudit = null">
      <div class="modal-box xml-viewer-modal animate-pop">
        <div class="modal-header">
          <div>
            <h3>Visualizador de XML</h3>
            <p>Auditoria NF {{ selectedXmlAudit.nfe_number }} | {{ selectedXmlAudit.xml_filename }}</p>
          </div>
          <button @click="selectedXmlAudit = null" class="btn-close">&times;</button>
        </div>
        <div class="xml-content-area">
          <pre><code>{{ selectedXmlAudit.xml_content }}</code></pre>
        </div>
        <div class="modal-footer">
          <button @click="downloadXml(selectedXmlAudit.id)" class="btn-primary">
            <i class="fas fa-download"></i> Download Arquivo
          </button>
          <button @click="selectedXmlAudit = null" class="btn-secondary">Fechar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const audits = ref([]);
const summary = ref(null);
const loading = ref(false);
const selectedXmlAudit = ref(null);

const formatNumber = (val) => {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getDiffClass = (val) => {
  if (val > 0.5) return 'is-loss';
  if (val < -0.5) return 'is-gain';
  return 'is-neutral';
};

const getProgressWidth = (data) => {
  const total = data.gains + data.losses;
  if (total === 0) return '0%';
  const perc = (data.gains / total) * 100;
  return `${perc}%`;
};

const getProgressPercentage = (data) => {
    const total = data.gains + data.losses;
    if (total === 0) return '0';
    return ((data.gains / total) * 100).toFixed(0);
};

const getProgressColor = (data) => {
  const perc = (data.gains / (data.gains + data.losses || 1)) * 100;
  if (perc > 90) return 'var(--primary)';
  if (perc > 70) return '#10b981';
  return '#f59e0b';
};

const loadData = async () => {
  if (loading.value) return;
  loading.value = true;
  try {
    const [resAudits, resSummary] = await Promise.all([
      window.safeFetch('/api/audit'),
      window.safeFetch('/api/audit/summary')
    ]);

    if (resAudits.ok) audits.value = resAudits.data;
    if (resSummary.ok) summary.value = resSummary.data;
  } catch (error) {
    console.error('Audit Error:', error);
    if (window.showToast) window.showToast('Erro ao carregar dados de auditoria', 'error');
  } finally {
    loading.value = false;
  }
};

const handleCheck = async (id) => {
    if (!confirm('Deseja marcar esta divergência como conferida?')) return;
    try {
        const res = await window.safeFetch(`/api/audit/${id}/check`, { method: 'POST' });
        if (res.ok) {
            if (window.showToast) window.showToast('Auditado com sucesso', 'success');
            loadData();
        }
    } catch (e) {
        console.error(e);
    }
};

const openXmlModal = (audit) => {
  selectedXmlAudit.value = audit;
};

const downloadXml = async (auditId) => {
  try {
    const res = await window.safeFetch(`/api/audit/${auditId}/xml`);
    if (res.ok) {
      const { xml, filename } = res.data;
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `audit_${auditId}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      if (window.showToast) window.showToast('Erro ao baixar XML', 'error');
    }
  } catch (e) {
    console.error('Download Error:', e);
    if (window.showToast) window.showToast('Falha na conexão', 'error');
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.conferencia-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Glass Cards */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  padding: 24px;
}

/* Header */
.header-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.icon-circle {
  width: 56px;
  height: 56px;
  background: var(--primary);
  color: white;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  box-shadow: 0 8px 16px rgba(0, 74, 153, 0.2);
}

.page-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  letter-spacing: -0.02em;
}

.page-subtitle {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin: 4px 0 0;
}

/* Buttons */
.btn-primary-outline {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  background: white;
  border: 2px solid var(--primary);
  color: var(--primary);
  border-radius: var(--radius-pill);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary-outline:hover:not(:disabled) {
  background: var(--primary);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 74, 153, 0.15);
}

/* Summary Row */
.summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.summary-box {
  padding: 24px;
  border-radius: 24px;
  background: white;
  border: 1px solid var(--border);
  transition: transform 0.3s;
}

.summary-box:hover {
  transform: translateY(-5px);
}

.box-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.carrier-tag {
  background: #f1f5f9;
  color: var(--primary);
  padding: 4px 12px;
  border-radius: 8px;
  font-weight: 800;
  font-size: 0.85rem;
  text-transform: uppercase;
}

.count-tag {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}

.box-values {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.val-group {
  display: flex;
  flex-direction: column;
}

.val-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.val-number {
  font-size: 1.25rem;
  font-weight: 800;
  margin-top: 4px;
}

.text-success { color: #10b981; }
.text-danger { color: #ef4444; }

.progress-track {
  height: 8px;
  background: #f1f5f9;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-labels {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-align: right;
}

/* Table Card */
.table-card {
  padding: 0;
  overflow: hidden;
}

.card-header-inner {
  padding: 24px 30px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header-inner h3 {
  font-size: 1.1rem;
  font-weight: 800;
  margin: 0;
}

.table-wrapper {
  position: relative;
  min-height: 200px;
  overflow-x: auto;
}

.premium-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.premium-table th {
  padding: 16px 30px;
  background: rgba(241, 245, 249, 0.5);
  text-align: left;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
}

.premium-table td {
  padding: 16px 30px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  font-size: 0.95rem;
  color: var(--text-main);
}

.premium-table tr:last-child td {
  border-bottom: none;
}

.premium-table tr:hover {
  background: rgba(0, 74, 153, 0.02);
}

.doc-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nf-badge {
  font-weight: 800;
  color: var(--primary);
  font-size: 0.9rem;
}

.cte-info {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
}

.carrier-name-cell {
  font-weight: 700;
  color: var(--text-main);
}

.currency {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-right: 2px;
}

.diff-tag {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 800;
}

.is-loss { background: #fee2e2; color: #991b1b; }
.is-gain { background: #dcfce7; color: #166534; }
.is-neutral { background: #f1f5f9; color: #475569; }

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 6px 12px;
  border-radius: 99px;
  background: white;
  border: 1px solid var(--border);
}

.status-indicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-indicator.ok .dot { background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2); }
.status-indicator.divergente .dot { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2); }
.status-indicator.conferido .dot { background: var(--primary); box-shadow: 0 0 0 3px rgba(0, 74, 153, 0.2); }

.row-warning {
  background: rgba(245, 158, 11, 0.03) !important;
}

/* Actions */
.btn-group {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.btn-action {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: 0.2s;
  font-size: 0.85rem;
}

.btn-action.success { background: #10b981; color: white; }
.btn-action.info { background: #f1f5f9; color: var(--primary); }
.btn-action.secondary { background: #f1f5f9; color: var(--text-muted); }

.btn-action:hover {
  transform: scale(1.1);
  filter: brightness(0.9);
}

/* Empty State */
.empty-state-lux {
  padding: 60px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--text-light);
  margin-bottom: 20px;
}

.empty-state-lux h4 { margin: 0; font-size: 1.25rem; font-weight: 800; }
.empty-state-lux p { color: var(--text-muted); margin-top: 8px; }

/* Loading */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(4px);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.loader-premium {
  width: 40px;
  height: 40px;
  border: 4px solid #f1f5f9;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }


/* Modal XML */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.xml-viewer-modal {
  width: 100%;
  max-width: 900px;
  max-height: 85vh;
  background: white;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border);
  overflow: hidden;
}

.modal-header {
  padding: 24px 30px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 850;
  color: var(--primary);
}

.modal-header p {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: 0.2s;
}

.btn-close:hover {
  color: #ef4444;
  transform: rotate(90deg);
}

.xml-content-area {
  flex: 1;
  overflow: auto;
  padding: 20px 30px;
  background: #f8fafc;
}

.xml-content-area pre {
  margin: 0;
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #1e293b;
}

.modal-footer {
  padding: 20px 30px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: white;
}

.animate-pop {
  animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes pop {
  from { opacity: 0; transform: scale(0.9) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.btn-primary {
  background: var(--primary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-secondary {
  background: #f1f5f9;
  color: var(--text-main);
  border: 1px solid var(--border);
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 768px) {
  .header-main { flex-direction: column; align-items: flex-start; gap: 20px; }
  .summary-row { grid-template-columns: 1fr; }
  .premium-table th:nth-child(3), .premium-table td:nth-child(3),
  .premium-table th:nth-child(4), .premium-table td:nth-child(4) {
    display: none;
  }
}
</style>
