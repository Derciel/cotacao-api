<template>
  <div class="stats-grid">
    <div v-for="stat in filteredStats" :key="stat.label" class="stat-card glass-premium">
      <div :class="['icon-wrapper', `bg-${stat.color}`]">
        <i :class="stat.icon"></i>
      </div>
      <div class="stat-info">
        <span class="label text-muted">{{ stat.label }}</span>
        <strong class="value text-main">{{ loading ? '---' : stat.value }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { safeFetch } from '../utils/api-utils';

const loading = ref(true);
const isAdmin = ref(false);
const stats = ref([
  { label: 'Cotações Hoje', value: '0', icon: 'fas fa-file-invoice', color: 'blue' },
  { label: 'Valor Total', value: 'R$ 0,00', icon: 'fas fa-dollar-sign', color: 'green' },
  { label: 'Aguardando', value: '0', icon: 'fas fa-clock', color: 'orange' },
  { label: 'Taxa de Conv.', value: '0%', icon: 'fas fa-chart-line', color: 'purple' }
]);

const filteredStats = computed(() => {
  if (isAdmin.value) return stats.value;
  return stats.value.filter(s => s.label !== 'Valor Total');
});

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const fetchStats = async () => {
  try {
    const res = await safeFetch('/api/quotations/dashboard/stats');
    
    if (res.ok) {
      const data = res.data;
      stats.value[0].value = data.quotationsToday.toString();
      stats.value[1].value = formatCurrency(data.totalValue);
      stats.value[2].value = data.pendingCount.toString();
      stats.value[3].value = `${data.conversionRate}%`;
    }
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
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
  fetchStats();
});
</script>

<style scoped>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 30px;
    margin-bottom: 50px;
  }

  .stat-card {
    background: var(--glass-bg);
    backdrop-filter: blur(8px);
    padding: 24px;
    border-radius: 20px;
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 18px;
    box-shadow: var(--shadow-card);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: default;
  }

  .stat-card:hover {
    transform: translateY(-5px);
    background: var(--bg-surface);
    border-color: var(--primary);
  }

  .icon-wrapper {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 8px 16px -4px rgba(0,0,0,0.1);
  }

  .bg-blue { background: linear-gradient(135deg, #3b82f6, #2563eb); }
  .bg-green { background: linear-gradient(135deg, #10b981, #059669); }
  .bg-orange { background: linear-gradient(135deg, #f59e0b, #d97706); }
  .bg-purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }

  .stat-info { 
    display: flex; 
    flex-direction: column; 
    gap: 2px;
  }
  
  .label { 
    font-size: 0.85rem; 
    font-weight: 600; 
    letter-spacing: -0.01em;
    color: var(--text-muted);
  }
  
  .value { 
    font-size: 1.6rem; 
    font-weight: 850; 
    letter-spacing: -0.02em;
    line-height: 1;
    color: var(--text-main);
  }

  @media (max-width: 768px) {
    .stats-grid { gap: 15px; margin-bottom: 30px; }
    .stat-card { padding: 16px; gap: 12px; }
    .icon-wrapper { width: 44px; height: 44px; font-size: 1.2rem; }
    .value { font-size: 1.3rem; }
    .label { font-size: 0.75rem; }
  }

  @media (max-width: 480px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
</style>
