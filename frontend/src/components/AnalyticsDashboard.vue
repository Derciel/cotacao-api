<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const period = ref('30'); // 7, 15, 30
const metrics = ref({
    totalSpend: 0,
    totalSavings: 0,
    freightCount: 0,
    avgLeadTime: 0,
    dailyData: [] as { date: string, value: number, count: number }[],
    topCarriers: [] as { name: string, count: number, value: number }[]
});
const aiInsights = ref<any[]>([]);
const isLoading = ref(true);
const carrierMetricType = ref<'count' | 'value'>('count');
const selectedDay = ref<any>(null);

const fetchAiInsights = async () => {
    try {
        const res = await fetch('/api/ai/insights');
        const data = await res.json();
        aiInsights.value = data.insights || [];
    } catch (e) {
        console.error("Erro ao buscar AI insights", e);
    }
};

const fetchAnalytics = async () => {
    isLoading.value = true;
    try {
        const res = await fetch(`/api/quotations/analytics?days=${period.value}`);
        const data = await res.json();
        metrics.value = data;
    } catch (e) {
        console.error("Erro ao carregar analytics", e);
    } finally {
        isLoading.value = false;
    }
};

onMounted(() => {
    fetchAnalytics();
    fetchAiInsights();
});

const handleBarClick = (day: any) => {
    selectedDay.value = selectedDay.value?.date === day.date ? null : day;
};

watch(period, () => {
    fetchAnalytics();
    selectedDay.value = null;
});

const formatCurrency = (val: number) => {
    return val?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
};

const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// Cálculo de porcentagem de largura para as barras do ranking
const getCarrierWidth = (carrier: any) => {
    if (!metrics.value.topCarriers || metrics.value.topCarriers.length === 0) return '0%';
    const max = Math.max(...metrics.value.topCarriers.map(c => carrierMetricType.value === 'count' ? c.count : c.value), 1);
    const current = carrierMetricType.value === 'count' ? carrier.count : carrier.value;
    return `${(current / max) * 100}%`;
};

// Cálculo simples para as barras do gráfico (SVG)
const getChartHeight = (value: number) => {
    if (!metrics.value.dailyData || metrics.value.dailyData.length === 0) return '4px';
    const max = Math.max(...metrics.value.dailyData.map(d => d.value), 1);
    return `${(value / max) * 80}%`;
};
</script>

<template>
    <div class="analytics-container animate-fade-in">
        <header class="analytics-header">
            <div class="header-left">
                <h1>Analytics</h1>
                <p>Insights estratégicos e performance da sua operação logística.</p>
            </div>
            
            <div class="header-right selectors">
                <select v-model="period" class="period-select">
                    <option value="7">Últimos 7 dias</option>
                    <option value="15">Últimos 15 dias</option>
                    <option value="30">Últimos 30 dias</option>
                </select>
                <button @click="fetchAnalytics" class="refresh-btn" :disabled="isLoading">
                    <i class="fas fa-sync" :class="{ 'fa-spin': isLoading }"></i>
                </button>
            </div>
        </header>

        <!-- KPI Grid -->
        <div class="kpi-grid">
            <div class="kpi-card glass-glow">
                <div class="kpi-icon blue"><i class="fas fa-wallet"></i></div>
                <div class="kpi-content">
                    <small>GASTO TOTAL</small>
                    <h2>{{ formatCurrency(metrics.totalSpend) }}</h2>
                </div>
            </div>

            <div class="kpi-card glass-glow">
                <div class="kpi-icon green"><i class="fas fa-piggy-bank"></i></div>
                <div class="kpi-content">
                    <small>ECONOMIA GERADA</small>
                    <h2>{{ formatCurrency(metrics.totalSavings) }}</h2>
                </div>
            </div>

            <div class="kpi-card glass-glow">
                <div class="kpi-icon purple"><i class="fas fa-box-open"></i></div>
                <div class="kpi-content">
                    <small>FRETES REALIZADOS</small>
                    <h2>{{ metrics.freightCount }}</h2>
                </div>
            </div>

            <div class="kpi-card glass-glow">
                <div class="kpi-icon orange"><i class="fas fa-shipping-fast"></i></div>
                <div class="kpi-content">
                    <small>LEAD TIME MÉDIO</small>
                    <h2>{{ metrics.avgLeadTime }} dias</h2>
                </div>
            </div>
        </div>

        <div class="charts-section">
            <div class="glass-card performance-chart">
                <div class="card-header">
                    <h3>Desempenho no Período</h3>
                    <p>Consolidado por dia de coleta</p>
                </div>
                
                <div class="chart-viewport" v-if="!isLoading">
                    <div v-if="metrics.dailyData.length > 0" class="bar-chart">
                        <div v-for="d in metrics.dailyData" :key="d.date" 
                             class="bar-container" 
                             :class="{ active: selectedDay?.date === d.date }"
                             @click="handleBarClick(d)">
                            <div class="bar-value">{{ formatCurrency(d.value) }}</div>
                            <div class="bar-pill" :style="{ height: getChartHeight(d.value) }"></div>
                            <div class="bar-label">{{ formatDateShort(d.date) }}</div>
                        </div>
                    </div>
                    <div v-else class="empty-chart">
                        <i class="fas fa-chart-bar"></i>
                        <p>Ainda não há dados aprovados para este período.</p>
                    </div>
                </div>
                <div v-else class="chart-loading">
                    <div class="skeleton-bar" v-for="n in 7" :key="n"></div>
                </div>

                <!-- Day Detail Overlay -->
                <transition name="slide-up">
                    <div v-if="selectedDay" class="day-detail-box">
                        <div class="detail-header">
                            <strong>{{ formatDateShort(selectedDay.date) }}</strong>
                            <button @click="selectedDay = null" class="close-detail">&times;</button>
                        </div>
                        <div class="detail-stats">
                            <div class="d-stat">
                                <small>Volume</small>
                                <span>{{ selectedDay.count }} fretes</span>
                            </div>
                            <div class="d-stat">
                                <small>Faturamento</small>
                                <span>{{ formatCurrency(selectedDay.value) }}</span>
                            </div>
                        </div>
                    </div>
                </transition>
            </div>

            <div class="glass-card top-carriers">
                <div class="card-header">
                    <h3>Top Transportadoras</h3>
                    <div class="toggle-metrics">
                        <button @click="carrierMetricType = 'count'" :class="{ active: carrierMetricType === 'count' }">Volume</button>
                        <button @click="carrierMetricType = 'value'" :class="{ active: carrierMetricType === 'value' }">Financeiro</button>
                    </div>
                </div>

                <div class="carrier-list" v-if="!isLoading">
                    <div v-for="c in metrics.topCarriers" :key="c.name" class="carrier-row">
                        <div class="row-info">
                            <strong>{{ c.name }}</strong>
                            <span>{{ carrierMetricType === 'count' ? c.count + ' envios' : formatCurrency(c.value) }}</span>
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar" :style="{ width: getCarrierWidth(c) }"></div>
                        </div>
                    </div>
                    <div v-if="metrics.topCarriers.length === 0" class="empty-list">
                        Nenhum envio realizado.
                    </div>
                </div>
                <div v-else class="list-loading">
                    <div class="skeleton-row" v-for="n in 5" :key="n"></div>
                </div>
            </div>
        </div>

        <!-- Dynamic AI Insights -->
        <div class="ai-insights-section animate-fade-in" v-if="aiInsights.length > 0">
            <div class="ai-header">
                <div class="ai-badge-premium"><i class="fas fa-robot"></i> IA Insights</div>
                <h3>Otimizações Recomendadas</h3>
            </div>
            <div class="insight-cards">
                <div v-for="(insight, idx) in aiInsights" :key="idx" class="insight-card-item">
                    <div class="insight-icon" :class="insight.type.toLowerCase()">
                        <i v-if="insight.type === 'Oportunidade'" class="fas fa-lightbulb"></i>
                        <i v-else-if="insight.type === 'Alerta'" class="fas fa-exclamation-triangle"></i>
                        <i v-else class="fas fa-info-circle"></i>
                    </div>
                    <div class="insight-text">
                        <strong>{{ insight.type }}:</strong> {{ insight.text }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.analytics-container { padding: 10px; }

.analytics-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; }
.header-left h1 { font-size: 2.5rem; font-weight: 800; color: #004a99; margin: 0; letter-spacing: -1px; }
.header-left p { color: #64748b; font-size: 1.1rem; margin-top: 5px; }

.selectors { display: flex; gap: 10px; align-items: center; }
.period-select { padding: 12px 15px; border-radius: 12px; border: 1.5px solid #e2e8f0; font-weight: 700; color: #1e293b; background: white; cursor: pointer; outline: none; }
.period-select:focus { border-color: #004a99; box-shadow: 0 0 0 4px rgba(0, 74, 153, 0.1); }

.refresh-btn { width: 48px; height: 48px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: white; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
.refresh-btn:hover:not(:disabled) { border-color: #004a99; color: #004a99; transform: rotate(30deg); background: #f0f9ff; }

.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
.kpi-card { background: white; padding: 25px; border-radius: 24px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 20px; transition: 0.3s; }
.kpi-card:hover { transform: translateY(-5px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }

.kpi-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
.kpi-icon.blue { background: #eef6ff; color: #3b82f6; }
.kpi-icon.green { background: #f0fdf4; color: #10b981; }
.kpi-icon.purple { background: #f5f3ff; color: #8b5cf6; }
.kpi-icon.orange { background: #fff7ed; color: #f59e0b; }

.kpi-content small { font-weight: 800; color: #94a3b8; font-size: 0.7rem; letter-spacing: 0.8px; text-transform: uppercase; display: block; margin-bottom: 4px; }
.kpi-content h2 { font-size: 1.6rem; color: #1e293b; font-weight: 800; margin: 0; }

.charts-section { display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; }
.glass-card { background: white; padding: 30px; border-radius: 28px; border: 1px solid #e2e8f0; position: relative; }

.card-header h3 { font-size: 1.3rem; font-weight: 800; color: #1e293b; margin: 0; }
.card-header p { color: #94a3b8; font-size: 0.95rem; margin: 5px 0 0; }

.toggle-metrics { display: flex; background: #f1f5f9; padding: 4px; border-radius: 10px; gap: 4px; }
.toggle-metrics button { border: none; background: transparent; padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 700; color: #64748b; cursor: pointer; transition: 0.2s; }
.toggle-metrics button.active { background: white; color: #004a99; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

.chart-viewport { height: 260px; margin-top: 30px; display: flex; align-items: flex-end; }
.bar-chart { display: flex; justify-content: space-around; align-items: flex-end; width: 100%; height: 100%; gap: 10px; }

.bar-container { display: flex; flex-direction: column; align-items: center; gap: 10px; flex: 1; height: 100%; justify-content: flex-end; }
.bar-pill { width: 100%; max-width: 40px; background: #f1f5f9; border-radius: 8px 8px 4px 4px; transition: 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275); min-height: 4px; cursor: help; }
.bar-container:hover .bar-pill { background: #3b82f6; transform: scaleX(1.1); box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3); }
.bar-container:nth-last-child(1) .bar-pill { background: #004a99; }

.bar-value { font-size: 0.7rem; font-weight: 800; color: #3b82f6; opacity: 0; transition: 0.2s; position: absolute; transform: translateY(-25px); }
.bar-container:hover .bar-value { opacity: 1; }

.bar-label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; }

.carrier-list { margin-top: 30px; display: flex; flex-direction: column; gap: 20px; }
.carrier-row { display: flex; flex-direction: column; gap: 10px; }
.row-info { display: flex; justify-content: space-between; font-size: 0.95rem; }
.row-info strong { color: #1e293b; }
.row-info span { color: #64748b; font-weight: 700; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; }

.progress-container { height: 10px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
.progress-bar { height: 100%; background: linear-gradient(90deg, #3b82f6, #004a99); border-radius: 99px; transition: 1.5s cubic-bezier(0.165, 0.84, 0.44, 1); }

.empty-chart, .empty-list { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; gap: 15px; text-align: center; }
.empty-chart i { font-size: 3.5rem; opacity: 0.3; }

/* Day Detail Styling */
.day-detail-box {
    position: absolute; bottom: 30px; left: 30px; right: 30px; background: #1e293b; color: white; border-radius: 16px; padding: 15px 25px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 10;
}
.detail-header { display: flex; align-items: center; gap: 15px; }
.detail-header strong { font-size: 1.1rem; border-right: 1px solid rgba(255,255,255,0.2); padding-right: 15px; }
.close-detail { background: transparent; border: none; color: rgba(255,255,255,0.5); font-size: 1.5rem; cursor: pointer; transition: 0.2s; }
.close-detail:hover { color: white; }
.detail-stats { display: flex; gap: 30px; }
.d-stat { display: flex; flex-direction: column; }
.d-stat small { font-size: 0.65rem; color: rgba(255,255,255,0.6); font-weight: 800; text-transform: uppercase; }
.d-stat span { font-size: 1.1rem; font-weight: 850; color: #3b82f6; }

/* AI Insights Section Integration */
.ai-insights-section { margin-top: 40px; background: #fffcf4; border: 1.5px solid #ffe9b1; border-radius: 28px; padding: 35px; }
.ai-header { display: flex; align-items: center; gap: 20px; margin-bottom: 25px; }
.ai-badge-premium { background: #1e293b; color: white; padding: 6px 14px; border-radius: 99px; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.ai-header h3 { font-size: 1.5rem; font-weight: 850; color: #1e293b; margin: 0; }
.insight-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.insight-card-item { background: white; border: 1px solid #f1f5f9; padding: 25px; border-radius: 20px; display: flex; gap: 20px; align-items: center; transition: 0.3s; }
.insight-card-item:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
.insight-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
.insight-icon.oportunidade { color: #f59e0b; background: #fffcf0; }
.insight-icon.alerta { color: #ef4444; background: #fff1f1; }
.insight-icon.dica { color: #3b82f6; background: #eff6ff; }
.insight-text { font-size: 0.95rem; color: #475569; line-height: 1.5; }
.insight-text strong { color: #1e293b; }

/* Skeletons & Transitions */
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(15px); }

.bar-container.active .bar-pill { background: #004a99; transform: scaleX(1.1); box-shadow: 0 5px 15px rgba(0,74,153,0.3); }

.chart-loading { display: flex; align-items: flex-end; justify-content: space-around; height: 260px; margin-top: 30px; width: 100%; }
.skeleton-bar { width: 30px; background: #f1f5f9; border-radius: 8px; animation: pulse 1.5s infinite; }
.skeleton-bar:nth-child(n) { height: 40%; }
.skeleton-bar:nth-child(2n) { height: 70%; }
.skeleton-bar:nth-child(3n) { height: 50%; }

.list-loading { margin-top: 30px; display: flex; flex-direction: column; gap: 20px; }
.skeleton-row { height: 40px; background: #f1f5f9; border-radius: 12px; animation: pulse 1.5s infinite; }

@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fade-in 0.5s ease-out; }

@media (max-width: 1200px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .charts-section { grid-template-columns: 1fr; }
    .insight-cards { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
    .kpi-grid { grid-template-columns: 1fr; }
    .analytics-header { flex-direction: column; align-items: flex-start; gap: 20px; }
    .day-detail-box { flex-direction: column; align-items: flex-start; gap: 10px; }
}
</style>
