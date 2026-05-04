<template>
  <div class="conferencia-container animate-pop">
    <div class="glass-card">
      <div class="card-header">
        <div class="header-content">
          <div class="icon-box">
            <i class="fas fa-file-invoice-dollar"></i>
          </div>
          <div class="titles">
            <h2 class="card-title">Módulo de Conferência (SIEG)</h2>
            <p class="card-subtitle">Auditoria de fretes, pesos e volumes em tempo real</p>
          </div>
        </div>
        <div class="header-actions">
            <button @click="loadAudits" class="btn-refresh" :disabled="loading">
                <i :class="['fas fa-sync-alt', { 'fa-spin': loading }]"></i> Atualizar
            </button>
        </div>
      </div>

      <!-- Resumo de Ganhos/Perdas -->
      <div class="summary-grid mt-20" v-if="summary">
        <div v-for="(data, carrier) in summary" :key="carrier" class="summary-card">
            <div class="carrier-name">{{ carrier }}</div>
            <div class="stats">
                <div class="stat-item">
                    <span class="label">Economia (Ganhos)</span>
                    <span class="value gain">R$ {{ data.gains.toFixed(2) }}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Divergência (Perdas)</span>
                    <span class="value loss">R$ {{ data.losses.toFixed(2) }}</span>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress" :style="{ width: getProgressWidth(data), background: getProgressColor(data) }"></div>
            </div>
        </div>
      </div>

      <!-- Tabela de Auditoria -->
      <div class="table-scroll mt-30">
        <table class="items-table">
          <thead>
            <tr>
              <th>NF / CT-e</th>
              <th>Transportadora</th>
              <th>Valor Cotado</th>
              <th>Valor Real (SIEG)</th>
              <th>Divergência</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="audit in audits" :key="audit.id" :class="{ 'row-divergent': audit.status === 'DIVERGENTE' }">
              <td>
                <div class="nf-info">
                    <span class="nf-label">NF: {{ audit.nfe_number }}</span>
                    <span class="cte-label">CTE: {{ audit.cte_number }}</span>
                </div>
              </td>
              <td class="font-bold">{{ audit.transportadora }}</td>
              <td>R$ {{ Number(audit.valor_frete_cotado).toFixed(2) }}</td>
              <td>R$ {{ Number(audit.valor_frete_sieg).toFixed(2) }}</td>
              <td :class="['diff-value', { 'text-red': audit.divergencia_valor > 0.5, 'text-green': audit.divergencia_valor <= 0.5 }]">
                R$ {{ Number(audit.divergencia_valor).toFixed(2) }}
              </td>
              <td>
                <span :class="['status-pill', audit.status.toLowerCase()]">
                  {{ audit.status }}
                </span>
              </td>
              <td>
                <div class="action-btns">
                    <button v-if="audit.status === 'DIVERGENTE'" @click="checkManual(audit.id)" class="btn-check" title="Aprovar Manualmente">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-download" title="Baixar XML">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
              </td>
            </tr>
            <tr v-if="audits.length === 0">
                <td colspan="7" class="empty-state">Nenhuma auditoria realizada ainda.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const audits = ref([]);
const summary = ref(null);
const loading = ref(false);

const loadAudits = async () => {
    loading.ref = true;
    try {
        const [resAudits, resSummary] = await Promise.all([
            axios.get('/api/audit'),
            axios.get('/api/audit/summary')
        ]);
        audits.value = resAudits.data;
        summary.value = resSummary.data;
    } catch (error) {
        console.error('Erro ao carregar auditorias:', error);
    } finally {
        loading.value = false;
    }
};

const checkManual = async (id) => {
    if(!confirm('Deseja aprovar esta divergência manualmente?')) return;
    try {
        await axios.post(`/api/audit/${id}/check`);
        loadAudits();
    } catch (error) {
        alert('Erro ao processar check manual');
    }
};

const getProgressWidth = (data) => {
    const total = data.gains + data.losses;
    if (total === 0) return '0%';
    return (data.gains / total * 100) + '%';
};

const getProgressColor = (data) => {
    return data.losses > data.gains ? '#ef4444' : '#10b981';
};

onMounted(loadAudits);
</script>

<style scoped>
.conferencia-container { max-width: 1200px; margin: 0 auto; }

.summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
.summary-card { background: var(--bg-surface); padding: 20px; border-radius: 20px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); }
.carrier-name { font-weight: 900; font-size: 1.1rem; margin-bottom: 15px; color: var(--primary); }
.stats { display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; }
.stat-item { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; }
.value.gain { color: #10b981; }
.value.loss { color: #ef4444; }

.progress-bar { height: 8px; background: var(--bg-input); border-radius: 4px; overflow: hidden; }
.progress { height: 100%; transition: width 0.3s ease; }

.nf-info { display: flex; flex-direction: column; gap: 4px; }
.nf-label { font-weight: 800; font-size: 0.8rem; color: var(--text-main); }
.cte-label { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; }

.status-pill { padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 900; text-transform: uppercase; }
.status-pill.ok { background: #dcfce7; color: #166534; }
.status-pill.divergente { background: #fee2e2; color: #991b1b; }
.status-pill.conferido { background: #dbeafe; color: #1e40af; }

.diff-value { font-weight: 900; }
.text-red { color: #ef4444; }
.text-green { color: #10b981; }

.action-btns { display: flex; gap: 8px; }
.btn-check, .btn-download { width: 32px; height: 32px; border-radius: 10px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.btn-check { background: #10b981; color: white; }
.btn-download { background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border); }
.btn-check:hover { transform: scale(1.1); }

.row-divergent { background: rgba(239, 68, 68, 0.05); }
.empty-state { padding: 40px; text-align: center; color: var(--text-muted); font-weight: 700; }

.btn-refresh { background: var(--bg-surface); border: 1px solid var(--border); padding: 8px 16px; border-radius: 12px; font-weight: 700; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
.btn-refresh:hover { background: var(--bg-input); }
</style>
