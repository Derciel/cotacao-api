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
            <th>Usuário</th>
            <th>Transportadora</th>
            <th>Data</th>
            <th class="text-right">Valor Total</th>
            <th class="text-center">Status</th>
            <th class="text-center">Audit</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="quote in recentQuotes" :key="quote.id" class="table-row">
            <td class="id-cell">#{{ quote.numero_pedido_manual || quote.id }}</td>
            <td class="client-cell">{{ quote.client?.fantasia || quote.client?.razao_social || 'Cliente não identificado' }}</td>
            <td class="user-cell">
              <span class="user-name-tag">{{ quote.user?.username || '---' }}</span>
            </td>
            <td class="carrier-cell">{{ quote.transportadora_escolhida || '---' }}</td>
            <td class="date-cell">{{ formatDate(quote.created_at || quote.data_cotacao) }}</td>
            <td class="value-cell text-right">{{ formatCurrency(quote.valor_total_nota || quote.valor_total_produtos) }}</td>
            <td class="status-cell text-center">
              <span :class="['status-badge', (quote.status || 'PENDENTE').toLowerCase()]">
                {{ quote.status || 'PENDENTE' }}
              </span>
            </td>
            <td class="text-center">
                <button v-if="quote.nf" @click="auditQuote(quote.id)" class="btn-audit-mini" title="Realizar Auditoria SIEG">
                    <i class="fas fa-search-dollar"></i>
                </button>
                <span v-else class="no-nf">-</span>
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

const auditQuote = async (id) => {
    try {
        const res = await safeFetch(`/api/audit/${id}`, { method: 'POST' });
        if (res.ok) {
            window.showToast('Auditoria realizada com sucesso!', 'success');
        } else {
            window.showToast(res.data?.message || 'Erro ao realizar auditoria', 'error');
        }
    } catch (error) {
        window.showToast('Erro de conexão com o servidor', 'error');
    }
};

onMounted(() => {
  fetchRecent();
});
</script>

<style scoped>
  .recent-card {
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    border: 1px solid var(--border);
    padding: 24px;
    box-shadow: var(--shadow-card);
    height: 100%;
    transition: background 0.3s ease, border 0.3s ease;
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
    color: var(--text-main);
    margin: 0;
  }

  .view-all-btn {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
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
    color: var(--text-muted);
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
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 12px 10px;
    border-bottom: 2px solid var(--border);
  }

  .table-row {
    transition: all 0.2s;
  }

  .table-row:hover {
    background: rgba(37, 99, 235, 0.03);
  }

  .table-row td {
    padding: 16px 10px;
    border-bottom: 1px solid var(--border);
    font-size: 0.95rem;
    color: var(--text-main);
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
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .carrier-cell {
    font-weight: 500;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .value-cell {
    font-weight: 800;
    color: #2563eb;
  }

  .text-right { text-align: right; }
  .text-center { text-align: center; }

  .user-name-tag {
    font-size: 0.75rem;
    color: var(--text-muted);
    background: var(--bg-input);
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

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

  .btn-audit-mini {
    background: var(--primary);
    color: white;
    border: none;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    cursor: pointer;
    transition: 0.2s;
  }
  .btn-audit-mini:hover { transform: scale(1.1); box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3); }
  .no-nf { color: var(--text-muted); font-size: 0.8rem; }

  @media (max-width: 768px) {
    .recent-card { padding: 15px; }
    .card-header h3 { font-size: 1rem; }
    .header-title i { font-size: 1rem; }
    
    .modern-table th:nth-child(3), .modern-table td:nth-child(3),
    .modern-table th:nth-child(5), .modern-table td:nth-child(5) {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .modern-table th:nth-child(1), .modern-table td:nth-child(1),
    .modern-table th:nth-child(6), .modern-table td:nth-child(6) {
      display: none;
    }
    .client-cell { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
</style>
