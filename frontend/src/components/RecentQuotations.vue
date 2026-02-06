<template>
  <div class="recent-card glass-premium">
    <div class="card-header">
      <div class="header-title">
        <i class="fas fa-history icon-blue"></i>
        <h3>Cotações Recentes</h3>
      </div>
      <a href="/historico" class="view-all-btn">Ver todas <i class="fas fa-chevron-right"></i></a>
    </div>

    <div class="table-container">
      <div v-if="loading" class="loading-state">
        <i class="fas fa-circle-notch fa-spin"></i> Carregando cotações...
      </div>
      
      <div v-else-if="recentQuotes.length === 0" class="empty-state">
        Nenhuma cotação encontrada.
      </div>

      <table v-else class="modern-table">
        <thead>
          <tr>
            <th width="80">FRENET</th>
            <th>Cliente</th>
            <th>Transportadora</th>
            <th>Data</th>
            <th class="text-right">Valor Total</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="quote in recentQuotes" :key="quote.id" class="table-row">
            <td class="id-cell">#{{ quote.numero_pedido_manual || quote.id }}</td>
            <td class="client-cell">{{ quote.client?.fantasia || quote.client?.razao_social || 'Cliente não identificado' }}</td>
            <td class="carrier-cell">{{ quote.transportadora_escolhida || '---' }}</td>
            <td class="date-cell">{{ formatDate(quote.created_at || quote.data_cotacao) }}</td>
            <td class="value-cell text-right">{{ formatCurrency(quote.valor_total_nota || quote.valor_total_produtos) }}</td>
            <td class="status-cell text-center">
              <span :class="['status-badge', (quote.status || 'PENDENTE').toLowerCase()]">
                {{ quote.status || 'PENDENTE' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { safeFetch } from '../utils/api-utils';

const loading = ref(true);
const recentQuotes = ref([]);

const formatDate = (dateString) => {
  if (!dateString) return '---';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const fetchRecent = async () => {
  try {
    const res = await safeFetch('/api/quotations/dashboard/recent?limit=5');
    if (res.ok) {
      recentQuotes.value = res.data;
    }
  } catch (error) {
    console.error('Erro ao buscar cotações recentes:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchRecent();
});
</script>

<style scoped>
  .recent-card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.8);
    padding: 24px;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.03);
    height: 100%;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-title i {
    font-size: 1.2rem;
    color: #2563eb;
  }

  .header-title h3 {
    font-size: 1.1rem;
    font-weight: 800;
    color: #111827;
    margin: 0;
  }

  .view-all-btn {
    font-size: 0.85rem;
    font-weight: 600;
    color: #6b7280;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
  }

  .view-all-btn:hover {
    color: #2563eb;
    transform: translateX(3px);
  }

  .table-container {
    overflow-x: auto;
  }

  .loading-state, .empty-state {
    padding: 40px;
    text-align: center;
    color: #6b7280;
    font-style: italic;
  }

  .modern-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  .modern-table th {
    text-align: left;
    font-size: 0.75rem;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 12px 10px;
    border-bottom: 2px solid #f1f5f9;
  }

  .table-row {
    transition: all 0.2s;
  }

  .table-row:hover {
    background: rgba(37, 99, 235, 0.03);
  }

  .table-row td {
    padding: 16px 10px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.95rem;
    color: #111827;
  }

  .id-cell {
    font-family: 'monospace';
    font-weight: 600;
    color: #2563eb;
  }

  .client-cell {
    font-weight: 700;
  }

  .date-cell {
    color: #6b7280;
    font-size: 0.85rem;
  }

  .carrier-cell {
    font-weight: 500;
    color: #475569;
    font-size: 0.9rem;
  }

  .value-cell {
    font-weight: 800;
    color: #2563eb;
  }

  .text-right { text-align: right; }
  .text-center { text-align: center; }

  .status-badge {
    padding: 6px 12px;
    border-radius: 99px;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .status-badge.aprovado {
    background: #dcfce7;
    color: #166534;
  }

  .status-badge.pendente {
    background: #fef9c3;
    color: #854d0e;
  }

  .status-badge.enviado {
    background: #dbeafe;
    color: #1e40af;
  }

  @media (max-width: 640px) {
    .modern-table th:nth-child(1),
    .modern-table td:nth-child(1),
    .modern-table th:nth-child(3),
    .modern-table td:nth-child(3) {
      display: none;
    }
  }
</style>
