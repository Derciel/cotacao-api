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
import { ref, onMounted } from 'vue';

const loading = ref(true);
const isAdmin = ref(false);
const stats = ref([
  { label: 'Cotações Hoje', value: '0', icon: 'fas fa-file-invoice', color: 'blue' },
  { label: 'Valor Total', value: 'R$ 0,00', icon: 'fas fa-dollar-sign', color: 'green' },
  { label: 'Aguardando', value: '0', icon: 'fas fa-clock', color: 'orange' },
  { label: 'Taxa de Conv.', value: '0%', icon: 'fas fa-chart-line', color: 'purple' }
]);

import { computed } from 'vue';

const filteredStats = computed(() => {
  if (isAdmin.value) return stats.value;
  return stats.value.filter(s => s.label !== 'Valor Total');
});

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const fetchStats = async () => {
  try {
    const response = await fetch('/api/quotations/dashboard/stats');
    const data = await response.json();
    
    if (response.ok) {
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
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(8px);
    padding: 24px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    gap: 18px;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.03), 0 4px 6px -2px rgba(0,0,0,0.02);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: default;
  }

  .stat-card:hover {
    transform: translateY(-5px);
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.04);
    border-color: #2563eb;
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
    color: #6b7280;
  }
  
  .value { 
    font-size: 1.6rem; 
    font-weight: 850; 
    letter-spacing: -0.02em;
    line-height: 1;
    color: #111827;
  }

  @media (max-width: 640px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
</style>
