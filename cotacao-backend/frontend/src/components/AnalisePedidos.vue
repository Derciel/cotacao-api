<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// --- ESTADOS DO COMPONENTE ---
const isLoading = ref(false);
const downloadProgress = ref(0);
const rawOrders = ref<any[]>([]);
const productsList = ref<any[]>([]);
const manualMappings = ref<Record<string, { unidades_caixa: number; peso_caixa_kg: number }>>({});

// Filtros
const filterDate = ref('');
const filterClient = ref('');
const filterStatus = ref('');

// --- LÓGICA DE CACHE INDEXEDDB (22.7 MB JSON) ---
const DB_NAME = 'AnalisePedidosDB';
const STORE_NAME = 'pedidos_store';
const CACHE_KEY = 'pedidos_json_data';
const TIMESTAMP_KEY = 'pedidos_timestamp';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos em milissegundos

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getCachedData(): Promise<any[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const reqVal = store.get(CACHE_KEY);
      reqVal.onsuccess = () => {
        const reqTime = store.get(TIMESTAMP_KEY);
        reqTime.onsuccess = () => {
          const timestamp = reqTime.result;
          const data = reqVal.result;
          if (data && timestamp && (Date.now() - timestamp < CACHE_DURATION)) {
            resolve(data);
          } else {
            resolve(null);
          }
        };
        reqTime.onerror = () => resolve(null);
      };
      reqVal.onerror = () => resolve(null);
    });
  } catch (err) {
    console.error('Erro ao ler do IndexedDB:', err);
    return null;
  }
}

async function setCachedData(data: any[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(data, CACHE_KEY);
      store.put(Date.now(), TIMESTAMP_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.error('Erro ao escrever no IndexedDB:', err);
  }
}

// --- BUSCA DE DADOS ---
const loadData = async (forceRefresh = false) => {
  isLoading.value = true;
  downloadProgress.value = 10;
  
  try {
    // 1. Carrega produtos locais para cruzamento inteligente
    const prodRes = await (window as any).safeFetch('/api/products');
    if (prodRes.ok) {
      productsList.value = prodRes.data || [];
    }
    downloadProgress.value = 30;

    // 2. Tenta ler do cache do IndexedDB
    if (!forceRefresh) {
      const cached = await getCachedData();
      if (cached && cached.length > 0) {
        rawOrders.value = cached;
        isLoading.value = false;
        (window as any).showToast('Dados de pedidos carregados do cache local!', 'success');
        return;
      }
    }

    // 3. Busca da API externa caso não tenha cache ou forceRefresh
    downloadProgress.value = 45;
    const url = 'https://nicopel.dgagraphics.net/dga_buider/api/json.php?token=9f602d98e26e542db3fc0694dca5ec469cbf847e1bfdc51a10012431f18bda599733846887e96df8562a87f9099158ca3a80557b136270cc7f21421e91d35697&token2=CBCFDC22A469F51DF9C5F0DC0141DC1EAADAC29950F5ABEA15E39A4803CC60FD3DCB7F529758BC0FB7F7E85775E9CF2AC6B196BA116C684E4328D81BD07D1D1B';
    
    // Usamos XMLHttpRequest para rastrear o progresso do download de 22MB
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    
    xhr.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 50) + 40;
        downloadProgress.value = Math.min(percent, 95);
      }
    };
    
    xhr.onload = async () => {
      if (xhr.status === 200) {
        try {
          const resObj = JSON.parse(xhr.responseText);
          if (resObj.success && Array.isArray(resObj.dados)) {
            rawOrders.value = resObj.dados;
            await setCachedData(resObj.dados);
            downloadProgress.value = 100;
            setTimeout(() => {
              isLoading.value = false;
              (window as any).showToast('Pedidos sincronizados com sucesso!', 'success');
            }, 300);
          } else {
            throw new Error('Formato de resposta inválido');
          }
        } catch (e: any) {
          console.error(e);
          (window as any).showToast('Erro ao processar JSON de pedidos.', 'error');
          isLoading.value = false;
        }
      } else {
        (window as any).showToast(`Erro na requisição externa: ${xhr.statusText}`, 'error');
        isLoading.value = false;
      }
    };
    
    xhr.onerror = () => {
      (window as any).showToast('Erro de conexão ao baixar planilha de pedidos.', 'error');
      isLoading.value = false;
    };
    
    xhr.send();

  } catch (err: any) {
    console.error(err);
    (window as any).showToast('Falha na sincronização dos pedidos.', 'error');
    isLoading.value = false;
  }
};

// --- CRUZA PRODUTO E PEGA PESOS E VOLUMES ---
function getProductSpecs(description: string, category: string, qtde = 1) {
  if (!description) return { unidades_caixa: 1, peso_caixa_kg: 0.1, source: 'default' };

  // Se o usuário já ajustou manualmente nesta sessão, respeitamos o ajuste
  if (manualMappings.value[description]) {
    return { ...manualMappings.value[description], source: 'manual' };
  }

  const descUpper = description.toUpperCase().trim();

  // 1. Regra Especial para PETIT GATEAU + WAFFLE (Tampa, Base e Embalagens de Cartão)
  if (descUpper.includes('PETIT GATEAU') && descUpper.includes('WAFFLE')) {
    return {
      unidades_caixa: qtde > 0 ? qtde : 1, // volume fixo = 1
      peso_caixa_kg: 6.4,
      source: 'intelligent'
    };
  }

  // 2. Regra Especial para Potes / Sorvete / Açaí 500ML THE BEST
  if (descUpper.includes('THE BEST') && descUpper.includes('500ML')) {
    if (qtde <= 400) {
      return {
        unidades_caixa: 400,
        peso_caixa_kg: (descUpper.includes('SORVETE') || descUpper.includes('AÇAI')) ? 5.0 : 5.2,
        source: 'intelligent'
      };
    } else {
      return {
        unidades_caixa: 600,
        peso_caixa_kg: 7.6,
        source: 'intelligent'
      };
    }
  }

  // 3. Regra Especial para Potes / Sorvete / Açaí 240ML THE BEST
  if (descUpper.includes('THE BEST') && descUpper.includes('240ML')) {
    if (qtde <= 200) {
      return {
        unidades_caixa: 200,
        peso_caixa_kg: (descUpper.includes('SORVETE') || descUpper.includes('AÇAI')) ? 1.7 : 1.79,
        source: 'intelligent'
      };
    } else {
      return {
        unidades_caixa: 400,
        peso_caixa_kg: 3.37,
        source: 'intelligent'
      };
    }
  }

  // 4. Busca exata ou parcial de produto cadastrado no banco local
  const desc = description.toLowerCase();
  let bestMatch: any = null;
  let maxScore = 0;

  for (const prod of productsList.value) {
    const prodName = prod.nome.toLowerCase();
    if (desc.includes(prodName)) {
      const score = prodName.length;
      if (score > maxScore) {
        maxScore = score;
        bestMatch = prod;
      }
    }
  }

  if (bestMatch) {
    return {
      unidades_caixa: Number(bestMatch.unidades_caixa) || 1,
      peso_caixa_kg: Number(bestMatch.peso_caixa_kg) || 0.1,
      source: 'database'
    };
  }

  // 5. Fallbacks inteligentes baseados em texto e categoria
  const cat = (category || '').toLowerCase();
  if (desc.includes('copo') || cat.includes('copo')) {
    return { unidades_caixa: 1000, peso_caixa_kg: 3.5, source: 'intelligent' };
  }
  if (desc.includes('tampa') || cat.includes('tampa')) {
    return { unidades_caixa: 2000, peso_caixa_kg: 2.0, source: 'intelligent' };
  }
  if (desc.includes('base') || desc.includes('caixa') || cat.includes('caixa')) {
    return { unidades_caixa: 100, peso_caixa_kg: 5.0, source: 'intelligent' };
  }

  return { unidades_caixa: 1, peso_caixa_kg: 0.1, source: 'default' };
}

// Atualização manual em tempo real
const updateItemSpecs = (description: string, field: 'unidades_caixa' | 'peso_caixa_kg', value: number) => {
  if (!description) return;
  
  if (!manualMappings.value[description]) {
    const current = getProductSpecs(description, '', 1);
    manualMappings.value[description] = {
      unidades_caixa: current.unidades_caixa,
      peso_caixa_kg: current.peso_caixa_kg
    };
  }

  manualMappings.value[description][field] = Number(value) || 0;
};

// --- DATASET FILTRADO E CONSOLIDADO ---
const processedOrders = computed(() => {
  if (rawOrders.value.length === 0) return [];

  // 1. Aplica filtros básicos
  return rawOrders.value.filter(item => {
    // Filtro por Data
    if (filterDate.value) {
      const inclusaoDate = item.vw_pedidos_data_inclusao?.split(' ')[0]; // Extrai YYYY-MM-DD
      const entregaDate = item.vw_pedidos_data_entrega;
      if (inclusaoDate !== filterDate.value && entregaDate !== filterDate.value) {
        return false;
      }
    }

    // Filtro por Cliente
    if (filterClient.value) {
      const term = filterClient.value.toLowerCase();
      const razao = (item.vw_pedidos_completos_razao_cliente || '').toLowerCase();
      const fantasia = (item.vw_pedidos_completos_fantasia_cliente || '').toLowerCase();
      const cnpj = (item.vw_pedidos_completos_cnpj_cliente || '').toLowerCase();
      if (!razao.includes(term) && !fantasia.includes(term) && !cnpj.includes(term)) {
        return false;
      }
    }

    // Filtro por Situação
    if (filterStatus.value) {
      if (item.vw_pedidos_situacao_pedidos !== filterStatus.value) {
        return false;
      }
    }

    return true;
  });
});

// Agrupamento por Cliente para renderizar na tela
const groupedByClient = computed(() => {
  const clientsMap: Record<string, {
    razao: string;
    fantasia: string;
    cnpj: string;
    cidade: string;
    estado: string;
    totalItens: number;
    totalVol: number;
    totalWeight: number;
    totalValue: number;
    totalFreight: number;
    orders: Record<string, {
      idPedido: number;
      data: string;
      dataEntrega: string;
      situacao: string;
      frete: number;
      items: any[];
    }>;
  }> = {};

  processedOrders.value.forEach(item => {
    const clientKey = item.vw_pedidos_completos_cnpj_cliente || item.vw_pedidos_completos_razao_cliente;
    if (!clientKey) return;

    if (!clientsMap[clientKey]) {
      clientsMap[clientKey] = {
        razao: item.vw_pedidos_completos_razao_cliente || 'NÃO INFORMADO',
        fantasia: item.vw_pedidos_completos_fantasia_cliente || 'NÃO INFORMADO',
        cnpj: item.vw_pedidos_completos_cnpj_cliente || '',
        cidade: item.vw_cad_end_cli_cidade || item.vw_pedidos_completos_cidade || '',
        estado: item.vw_cad_end_cli_estado || '',
        totalItens: 0,
        totalVol: 0,
        totalWeight: 0,
        totalValue: 0,
        totalFreight: 0,
        orders: {}
      };
    }

    const client = clientsMap[clientKey];

    // Identificação do Pedido
    const orderId = item.vw_pedidos_id_pedido;
    if (!client.orders[orderId]) {
      client.orders[orderId] = {
        idPedido: orderId,
        idFaturamento: item.vw_pedidos_id_faturamento || '',
        data: item.vw_pedidos_data_inclusao || '',
        dataEntrega: item.vw_pedidos_data_entrega || '',
        situacao: item.vw_pedidos_situacao_pedidos || '',
        frete: parseFloat(item.vw_pedidos_valor_frete) || 0,
        items: []
      };
    }

    const order = client.orders[orderId];

    // Calcula Peso e Volumes do Item com base nas specs cruzadas/manuais
    const qtde = parseFloat(item.vw_pedidos_completos_quantidade) || 0;
    const specs = getProductSpecs(item.vw_pedidos_completos_descricao_item_pedido, item.vw_pedidos_completos_descricao_categoria, qtde);
    
    const volumes = specs.unidades_caixa > 0 ? (qtde / specs.unidades_caixa) : 0;
    const peso = volumes * specs.peso_caixa_kg;
    const valorItem = parseFloat(item.vw_pedidos_completos_valor_total) || 0;

    order.items.push({
      ...item,
      qtde,
      unidades_caixa: specs.unidades_caixa,
      peso_caixa_kg: specs.peso_caixa_kg,
      volumes,
      peso,
      valorItem,
      source: specs.source
    });
  });

  // Converte o objeto agrupado em array e consolida os totais finais de cada cliente
  return Object.values(clientsMap).map(client => {
    let clientVol = 0;
    let clientWeight = 0;
    let clientValue = 0;
    let clientFreight = 0;
    let clientItens = 0;

    const ordersArray = Object.values(client.orders);

    ordersArray.forEach((order: any) => {
      clientFreight += order.frete;
      order.items.forEach((it: any) => {
        clientVol += it.volumes;
        clientWeight += it.peso;
        clientValue += it.valorItem;
        clientItens += it.qtde;
      });
    });

    client.totalVol = clientVol;
    client.totalWeight = clientWeight;
    client.totalValue = clientValue;
    client.totalFreight = clientFreight;
    client.totalItens = clientItens;

    return {
      ...client,
      orders: ordersArray
    };
  });
});

// --- TOTAIS GERAIS CONSOLIDADOS ---
const globalTotals = computed(() => {
  let ordersCount = new Set<number>();
  let clientsCount = new Set<string>();
  let vol = 0;
  let weight = 0;
  let value = 0;
  let freight = 0;

  processedOrders.value.forEach(item => {
    if (item.vw_pedidos_id_pedido) ordersCount.add(item.vw_pedidos_id_pedido);
    if (item.vw_pedidos_completos_cnpj_cliente) clientsCount.add(item.vw_pedidos_completos_cnpj_cliente);

    const qtde = parseFloat(item.vw_pedidos_completos_quantidade) || 0;
    const specs = getProductSpecs(item.vw_pedidos_completos_descricao_item_pedido, item.vw_pedidos_completos_descricao_categoria, qtde);
    const volumes = specs.unidades_caixa > 0 ? (qtde / specs.unidades_caixa) : 0;
    const peso = volumes * specs.peso_caixa_kg;

    vol += volumes;
    weight += peso;
    value += parseFloat(item.vw_pedidos_completos_valor_total) || 0;
  });

  // Somatório único do frete de cada pedido distinto para não duplicar fretes de itens do mesmo pedido
  const processedOrdersFreight = new Set<number>();
  processedOrders.value.forEach(item => {
    const oId = item.vw_pedidos_id_pedido;
    if (oId && !processedOrdersFreight.has(oId)) {
      processedOrdersFreight.add(oId);
      freight += parseFloat(item.vw_pedidos_valor_frete) || 0;
    }
  });

  return {
    orders: ordersCount.size,
    clients: clientsCount.size,
    volume: vol,
    weight,
    value,
    freight
  };
});

// Controle de Expansão de Clientes na Tabela
const expandedClients = ref<Record<string, boolean>>({});
const toggleClient = (cnpj: string) => {
  expandedClients.value[cnpj] = !expandedClients.value[cnpj];
};

// --- EXPORTAÇÃO PARA EXCEL ---
const exportToExcel = () => {
  if (groupedByClient.value.length === 0) {
    (window as any).showToast('Nenhum dado filtrado para exportar.', 'warning');
    return;
  }

  const headers = [
    'CLIENTE (RAZÃO SOCIAL)',
    'FANTASIA',
    'CNPJ',
    'CIDADE',
    'ESTADO',
    'Nº PEDIDOS',
    'TOTAL VOLUMES (CXS)',
    'PESO TOTAL (KG)',
    'VALOR PRODUTOS R$',
    'VALOR FRETE R$'
  ];

  const rows = groupedByClient.value.map(c => [
    c.razao,
    c.fantasia,
    c.cnpj,
    c.cidade,
    c.estado,
    c.orders.length,
    Math.round(c.totalVol),
    c.totalWeight.toFixed(2),
    c.totalValue.toFixed(2),
    c.totalFreight.toFixed(2)
  ].join('\t'));

  const tsv = [headers.join('\t'), ...rows].join('\n');
  navigator.clipboard.writeText(tsv).then(() => {
    (window as any).showToast('Planilha consolidada copiada! Cole direto no Excel (Ctrl+V).', 'success');
  }).catch(() => {
    (window as any).showToast('Erro ao copiar dados para a área de transferência.', 'error');
  });
};

// Inicialização
onMounted(() => {
  loadData();
});

const formatCurrency = (v: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
};

const formatCNPJ = (v: string) => {
  return v?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') || v;
};
</script>

<template>
  <div class="analise-container">
    <!-- BARRA DE PROGRESSO DE DOWNLOAD -->
    <div v-if="isLoading" class="glass-card loading-section animate-fade-in">
      <div class="spinner-container">
        <div class="premium-spinner"></div>
      </div>
      <h3 class="loading-title">Sincronizando Banco de Pedidos com a API</h3>
      <p class="loading-subtitle">Carregando planilha de romaneio (22.7 MB) externa...</p>
      
      <div class="progress-bar-wrapper">
        <div class="progress-bar-fill" :style="{ width: downloadProgress + '%' }"></div>
      </div>
      <span class="progress-percentage">{{ downloadProgress }}%</span>
    </div>

    <div v-else class="content-wrapper">
      <!-- PAINEL DE FILTROS -->
      <div class="glass-card mb-20 animate-fade-in">
        <div class="card-title">
          <span><i class="fas fa-filter"></i> FILTROS DE PESQUISA</span>
          <button @click="loadData(true)" class="btn-refresh" title="Sincronizar dados da API externa">
            <i class="fas fa-rotate"></i> Atualizar API
          </button>
        </div>

        <div class="filter-grid mt-20">
          <div class="filter-item">
            <label class="filter-label">Data Específica (Inclusão ou Entrega)</label>
            <input v-model="filterDate" type="date" class="pill-input" />
          </div>

          <div class="filter-item">
            <label class="filter-label">Buscar Cliente (Razão, Fantasia ou CNPJ)</label>
            <input 
              v-model="filterClient" 
              type="text" 
              placeholder="Digite o cliente para filtrar..." 
              class="pill-input"
            />
          </div>

          <div class="filter-item">
            <label class="filter-label">Situação do Pedido</label>
            <select v-model="filterStatus" class="pill-select">
              <option value="">Todas as Situações</option>
              <option value="Aberto">Aberto</option>
              <option value="Faturado">Faturado</option>
              <option value="Fechado">Fechado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      <!-- CARDS LOGÍSTICOS DE TOTAIS CONSOLIDADOS -->
      <div class="totals-grid mb-20 animate-fade-in">
        <div class="total-card green">
          <div class="total-icon"><i class="fas fa-boxes-stacked"></i></div>
          <div class="total-info">
            <span class="total-label">Volume Total (Caixas)</span>
            <span class="total-value">{{ Math.round(globalTotals.volume) }} cx</span>
          </div>
        </div>

        <div class="total-card blue">
          <div class="total-icon"><i class="fas fa-weight-hanging"></i></div>
          <div class="total-info">
            <span class="total-label">Peso Total Consolidado</span>
            <span class="total-value">{{ globalTotals.weight.toFixed(2) }} kg</span>
          </div>
        </div>

        <div class="total-card orange">
          <div class="total-icon"><i class="fas fa-dollar-sign"></i></div>
          <div class="total-info">
            <span class="total-label">Valor de Produtos</span>
            <span class="total-value">{{ formatCurrency(globalTotals.value) }}</span>
          </div>
        </div>

        <div class="total-card purple">
          <div class="total-icon"><i class="fas fa-truck"></i></div>
          <div class="total-info">
            <span class="total-label">Custo Total Fretes</span>
            <span class="total-value">{{ formatCurrency(globalTotals.freight) }}</span>
          </div>
        </div>
      </div>

      <!-- TABELA DE RESULTADOS CONSOLIDADOS -->
      <div class="glass-card animate-fade-in">
        <div class="card-title justify-between">
          <span class="results-count">
            <i class="fas fa-list-check"></i> 
            DADOS CONSOLIDADOS LOGÍSTICOS ({{ groupedByClient.length }} clientes, {{ globalTotals.orders }} pedidos)
          </span>
          <button @click="exportToExcel" class="btn-export">
            <i class="fas fa-file-excel"></i> COPIAR PLANILHA PARA EXCEL
          </button>
        </div>

        <div class="table-wrapper mt-20">
          <table class="premium-table">
            <thead>
              <tr>
                <th style="width: 40px;"></th>
                <th>Cliente (Razão Social / Fantasia)</th>
                <th>CNPJ</th>
                <th>Cidade - UF</th>
                <th class="text-center">Nº Pedidos</th>
                <th class="text-center">Total Volumes</th>
                <th class="text-center">Peso Total</th>
                <th class="text-right">Valor Produtos</th>
                <th class="text-right">Valor Frete</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="client in groupedByClient" :key="client.cnpj || client.razao">
                <!-- Linha Principal do Cliente -->
                <tr class="client-row" :class="{ 'is-expanded': expandedClients[client.cnpj] }" @click="toggleClient(client.cnpj)">
                  <td class="text-center chevron-cell">
                    <i :class="expandedClients[client.cnpj] ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
                  </td>
                  <td>
                    <div class="client-names">
                      <strong class="razao-text">{{ client.razao }}</strong>
                      <span class="fantasia-text">{{ client.fantasia }}</span>
                    </div>
                  </td>
                  <td><code>{{ formatCNPJ(client.cnpj) }}</code></td>
                  <td>{{ client.cidade }} - {{ client.estado }}</td>
                  <td class="text-center"><strong>{{ client.orders.length }}</strong></td>
                  <td class="text-center highlight-blue"><strong>{{ Math.round(client.totalVol) }} cx</strong></td>
                  <td class="text-center highlight-green"><strong>{{ client.totalWeight.toFixed(2) }} kg</strong></td>
                  <td class="text-right"><strong>{{ formatCurrency(client.totalValue) }}</strong></td>
                  <td class="text-right"><strong>{{ formatCurrency(client.totalFreight) }}</strong></td>
                </tr>

                <!-- Sub-tabela Expandida dos Pedidos e Itens do Cliente -->
                <tr v-if="expandedClients[client.cnpj]" class="details-row">
                  <td colspan="9" class="details-container">
                    <div class="orders-accordion-wrapper">
                      <div v-for="order in client.orders" :key="order.idPedido" class="order-block mb-15">
                        <div class="order-header-info">
                          <span><i class="fas fa-file-invoice"></i> Pedido ERP: <strong>#{{ order.idPedido }}</strong></span>
                          <span>Faturamento ID: <strong>#{{ order.idFaturamento || order.idPedido }}</strong></span>
                          <span>Data Inclusão: <strong>{{ order.data }}</strong></span>
                          <span>Data Entrega: <strong>{{ order.dataEntrega || 'A combinar' }}</strong></span>
                          <span>Situação: <span class="badge-status" :class="order.situacao.toLowerCase()">{{ order.situacao }}</span></span>
                          <span>Frete: <strong class="color-primary">{{ formatCurrency(order.frete) }}</strong></span>
                        </div>

                        <!-- Itens do Pedido com Especificação de Unidades/Caixa e Peso -->
                        <table class="items-table mt-10">
                          <thead>
                            <tr>
                              <th>Item do Pedido (Descrição)</th>
                              <th class="text-center">Qtde (Unidades)</th>
                              <th class="text-center" style="width: 140px;">Unidades / Caixa</th>
                              <th class="text-center">Volume (Caixas)</th>
                              <th class="text-center" style="width: 140px;">Peso Caixa (KG)</th>
                              <th class="text-center">Peso Total</th>
                              <th class="text-right">Valor Total Item</th>
                              <th style="width: 120px;" class="text-center">Vínculo</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="item in order.items" :key="item.vw_pedidos_completos_descricao_item_pedido">
                              <td>
                                <div class="item-desc">
                                  <strong>{{ item.vw_pedidos_completos_descricao_item_pedido }}</strong>
                                  <span class="cat-text">{{ item.vw_pedidos_completos_descricao_categoria }}</span>
                                </div>
                              </td>
                              <td class="text-center">{{ Math.round(item.qtde) }}</td>
                              
                              <!-- Input Edição Unidades/Caixa -->
                              <td class="text-center">
                                <input 
                                  type="number" 
                                  :value="item.unidades_caixa"
                                  @input="updateItemSpecs(item.vw_pedidos_completos_descricao_item_pedido, 'unidades_caixa', ($event.target as HTMLInputElement).valueAsNumber)"
                                  class="table-editor-input"
                                />
                              </td>
                              
                              <td class="text-center highlight-blue">{{ Math.round(item.volumes) }} cx</td>
                              
                              <!-- Input Edição Peso Caixa -->
                              <td class="text-center">
                                <input 
                                  type="number" 
                                  step="0.01"
                                  :value="item.peso_caixa_kg"
                                  @input="updateItemSpecs(item.vw_pedidos_completos_descricao_item_pedido, 'peso_caixa_kg', ($event.target as HTMLInputElement).valueAsNumber)"
                                  class="table-editor-input"
                                />
                              </td>
                              
                              <td class="text-center highlight-green">{{ item.peso.toFixed(2) }} kg</td>
                              <td class="text-right">{{ formatCurrency(item.valorItem) }}</td>
                              
                              <!-- Status do cruzamento inteligente -->
                              <td class="text-center">
                                <span class="badge-source" :class="item.source">
                                  {{ item.source === 'database' ? 'Banco' : item.source === 'manual' ? 'Manual' : item.source === 'intelligent' ? 'Fuzzy' : 'Padrão' }}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              
              <tr v-if="groupedByClient.length === 0">
                <td colspan="9" class="text-center no-data-cell">
                  <i class="fas fa-folder-open"></i> Nenhum pedido faturado ou aberto localizado para os filtros informados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analise-container {
  width: 100%;
}

.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}

/* Glassmorphism Cards */
.glass-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
}

.card-title {
  display: flex;
  align-items: center;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-main);
  border-bottom: 1px solid var(--border);
  padding-bottom: 15px;
  gap: 10px;
}

.justify-between {
  justify-content: space-between;
}

/* Loading Section Premium */
.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  text-align: center;
}

.spinner-container {
  margin-bottom: 25px;
}

.premium-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 5px;
}

.loading-subtitle {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-bottom: 30px;
}

.progress-bar-wrapper {
  width: 100%;
  max-width: 400px;
  height: 8px;
  background: var(--bg-input);
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 10px;
  border: 1px solid var(--border);
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), #3b82f6);
  border-radius: 99px;
  transition: width 0.15s ease-out;
}

.progress-percentage {
  font-size: 1rem;
  font-weight: 700;
  color: var(--primary);
}

/* Filtros */
.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
}

.pill-input, .pill-select {
  height: 48px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0 16px;
  color: var(--text-main);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  outline: none;
  transition: 0.2s;
}

.pill-input:focus, .pill-select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

/* Grid de Totais */
.totals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}

.total-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  border-radius: 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
}

.total-icon {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.total-card.green .total-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.total-card.blue .total-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.total-card.orange .total-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.total-card.purple .total-icon { background: rgba(139, 92, 246, 0.1); color: #8b5aF6; }

.total-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.total-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.total-value {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: -0.5px;
}

/* Tabelas Premium */
.table-wrapper {
  overflow-x: auto;
  border-radius: 16px;
  border: 1px solid var(--border);
}

.premium-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.92rem;
}

.premium-table th {
  background: var(--bg-input);
  padding: 16px 20px;
  font-weight: 800;
  color: var(--text-muted);
  font-size: 0.82rem;
  text-transform: uppercase;
  border-bottom: 2px solid var(--border);
}

.premium-table td {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  color: var(--text-main);
}

.client-row {
  cursor: pointer;
  transition: 0.2s;
}

.client-row:hover {
  background: rgba(37, 99, 235, 0.03);
}

.client-row.is-expanded {
  background: rgba(37, 99, 235, 0.05);
}

.chevron-cell {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.client-names {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.razao-text {
  font-size: 0.95rem;
  color: var(--text-main);
}

.fantasia-text {
  font-size: 0.82rem;
  color: var(--text-muted);
  font-weight: 600;
}

code {
  font-family: monospace;
  background: var(--bg-input);
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.85rem;
  border: 1px solid var(--border);
}

.highlight-blue {
  color: var(--primary);
}

.highlight-green {
  color: #10b981;
}

/* Acordeão de Pedidos Internos */
.details-row {
  background: var(--bg-input);
}

.details-container {
  padding: 20px 30px !important;
}

.order-block {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.01);
}

.order-header-info {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  font-size: 0.88rem;
  color: var(--text-main);
}

.order-header-info i {
  color: var(--primary);
}

.badge-status {
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.badge-status.aberto { background: rgba(245, 158, 11, 0.15); color: #d97706; }
.badge-status.faturado { background: rgba(16, 185, 129, 0.15); color: #059669; }
.badge-status.fechado { background: rgba(59, 130, 246, 0.15); color: #1d4ed8; }
.badge-status.cancelado { background: rgba(239, 68, 68, 0.15); color: #b91c1c; }

/* Sub-tabela de Itens */
.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.items-table th {
  background: var(--bg-input);
  padding: 10px 14px;
  font-size: 0.78rem;
  font-weight: 700;
  border: 1px solid var(--border);
  text-transform: none;
}

.items-table td {
  padding: 10px 14px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
}

.item-desc {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cat-text {
  font-size: 0.76rem;
  color: var(--text-muted);
}

/* Input editor de tabela */
.table-editor-input {
  width: 90px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  text-align: center;
  font-weight: 700;
  color: var(--text-main);
  outline: none;
  font-family: inherit;
  font-size: 0.9rem;
  transition: 0.2s;
}

.table-editor-input:focus {
  border-color: var(--primary);
  background: var(--bg-surface);
}

/* Badges de cruzamento inteligente */
.badge-source {
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.75rem;
}

.badge-source.database { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.badge-source.manual { background: rgba(139, 92, 246, 0.1); color: #8b5af6; }
.badge-source.intelligent { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.badge-source.default { background: rgba(100, 116, 139, 0.1); color: #64748b; }

/* Botões */
.btn-refresh {
  background: var(--bg-input);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: 0.2s;
  margin-left: auto;
}

.btn-refresh:hover {
  background: var(--border);
  transform: translateY(-1px);
}

.btn-export {
  background: #10b981;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
  transition: 0.2s;
}

.btn-export:hover {
  background: #059669;
  transform: translateY(-1px);
}

.no-data-cell {
  padding: 40px !important;
  color: var(--text-muted);
  font-size: 1.05rem;
  font-weight: 600;
}

.no-data-cell i {
  font-size: 1.8rem;
  display: block;
  margin-bottom: 10px;
  color: var(--border);
}

.mb-15 { margin-bottom: 15px; }
.mb-20 { margin-bottom: 20px; }
.mt-10 { margin-top: 10px; }
.mt-20 { margin-top: 20px; }
.color-primary { color: var(--primary); }

.text-center { text-align: center; }
.text-right { text-align: right; }

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .card-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .btn-refresh {
    margin-left: 0;
  }
  .btn-export {
    width: 100%;
    justify-content: center;
  }
}
</style>
