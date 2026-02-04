<template>
  <div class="ai-dashboard-section animate-fade-in">
    <div class="ai-banner glass-card">
      <div class="ai-badge">
        <i class="fas fa-robot"></i> IA INSIGHTS
      </div>
      <h2>Otimizações Recomendadas</h2>
      
      <div class="insights-container">
        <div v-if="loading" class="insight-loading">
          <i class="fas fa-circle-notch fa-spin"></i> Analisando estatísticas semanais...
        </div>
        
        <template v-else>
          <!-- Recommendation Cards -->
          <div class="recommendations-row">
            <div v-for="(insight, index) in insights" :key="index" class="rec-card" :style="{ animationDelay: (index * 0.1) + 's' }">
              <div class="rec-icon">
                <i v-if="insight.type === 'Oportunidade'" class="fas fa-lightbulb"></i>
                <i v-else-if="insight.type === 'Alerta'" class="fas fa-exclamation-triangle"></i>
                <i v-else class="fas fa-info-circle"></i>
              </div>
              <div class="rec-text">
                <strong>{{ insight.type }}:</strong> {{ insight.text }}
              </div>
            </div>
          </div>

          <!-- Carrier Metrics Table -->
          <div v-if="isAdmin" class="carrier-analysis-box">
            <div class="box-header">
              <h3><i class="fas fa-chart-pie"></i> Gasto por Transportadora (Últimos 7 dias)</h3>
              <button @click="fetchInsights" class="btn-refresh-ai" :disabled="loading">
                <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i> Atualizar Análise
              </button>
            </div>
            
            <div class="metrics-grid">
              <div v-for="carrier in carrierMetrics" :key="carrier.name" class="metric-item">
                <div class="m-info">
                  <span class="m-name">{{ carrier.name }}</span>
                  <span class="m-count">{{ carrier.count }} envios</span>
                </div>
                <div class="m-value">{{ formatCurrency(carrier.value) }}</div>
                <div class="m-progress-bg">
                  <div class="m-progress-fill" :style="{ width: getWidth(carrier.value) }"></div>
                </div>
              </div>
              <div v-if="carrierMetrics.length === 0" class="empty-metrics">
                Aguardando primeiros envios para análise de custos.
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getAuthToken } from '../utils/api-utils';

const insights = ref([]);
const carrierMetrics = ref([]);
const loading = ref(true);
const isAdmin = ref(false);

const formatCurrency = (val) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getWidth = (val) => {
    if (carrierMetrics.value.length === 0) return '0%';
    const max = Math.max(...carrierMetrics.value.map(c => c.value), 1);
    return `${(val / max) * 100}%`;
};

const fetchInsights = async () => {
    loading.value = true;
    try {
        const token = getAuthToken();
        const response = await fetch('/api/ai/insights', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await response.json();
        if (response.ok) {
            insights.value = data.insights || [];
            carrierMetrics.value = data.carrierMetrics || [];
        }
    } catch (error) {
        console.error('Erro ao buscar insights:', error);
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
        const user = JSON.parse(userInfo);
        isAdmin.value = user.role === 'ADMIN';
    }
    fetchInsights();
});
</script>

<style scoped>
.ai-dashboard-section { margin-top: 40px; }

.ai-banner {
    background: #fffcf4; /* Laranja bem clarinho como no print */
    border: 1px solid #ffe9b1;
    border-radius: 25px;
    padding: 40px;
    position: relative;
    box-shadow: 0 10px 30px rgba(0,0,0,0.02);
}

.ai-badge {
    position: absolute;
    top: 25px;
    left: 40px;
    background: #1e293b;
    color: #fff;
    padding: 6px 14px;
    border-radius: 99px;
    font-size: 0.75rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.5px;
}

.ai-banner h2 {
    margin: 25px 0 35px;
    font-size: 1.5rem;
    font-weight: 850;
    color: #1e293b;
}

.recommendations-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 40px;
}

.rec-card {
    background: #fff;
    border: 1px solid #f1f5f9;
    padding: 25px;
    border-radius: 20px;
    display: flex;
    gap: 20px;
    align-items: center;
    transition: 0.3s;
}
.rec-card:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }

.rec-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
}
.rec-icon .fa-lightbulb { color: #f59e0b; background: #fffcf0; }
.rec-icon .fa-exclamation-triangle { color: #ef4444; background: #fff1f1; }
.rec-icon .fa-info-circle { color: #3b82f6; background: #eff6ff; }

.rec-text { font-size: 0.95rem; color: #475569; line-height: 1.5; }
.rec-text strong { color: #1e293b; }

/* Metrics Box */
.carrier-analysis-box {
    background: rgba(255,255,255,0.6);
    border: 1px dashed #cbd5e1;
    border-radius: 20px;
    padding: 30px;
    margin-top: 20px;
}

.box-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
.box-header h3 { font-size: 1.1rem; font-weight: 800; color: #334155; margin: 0; display: flex; align-items: center; gap: 10px; }

.btn-refresh-ai {
    background: #1e293b;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.8rem;
    cursor: pointer;
    transition: 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
}
.btn-refresh-ai:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.2); }

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
}

.metric-item {
    background: #fff;
    padding: 20px;
    border-radius: 15px;
    border: 1px solid #e2e8f0;
}

.m-info { display: flex; justify-content: space-between; margin-bottom: 10px; }
.m-name { font-weight: 800; color: #1e293b; font-size: 0.9rem; }
.m-count { font-size: 0.75rem; color: #64748b; font-weight: 700; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; }

.m-value { font-size: 1.4rem; font-weight: 900; color: #1e293b; margin-bottom: 12px; }

.m-progress-bg { height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
.m-progress-fill { height: 100%; background: #3b82f6; border-radius: 10px; transition: 1s cubic-bezier(0.165, 0.84, 0.44, 1); }

.insight-loading { padding: 60px; text-align: center; color: #64748b; font-style: italic; }
.empty-metrics { grid-column: 1 / -1; text-align: center; padding: 30px; color: #94a3b8; font-style: italic; }

@media (max-width: 900px) {
    .recommendations-row { grid-template-columns: 1fr; }
    .ai-banner { padding: 30px 20px; }
    .ai-badge { left: 20px; }
}
</style>
