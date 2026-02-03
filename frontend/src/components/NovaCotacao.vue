<script setup lang="ts">
import { ref, reactive, computed } from 'vue';

declare global {
  interface Window {
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  }
}

// --- TIPOS ---
interface Client {
  id?: number;
  razao_social: string;
  fantasia?: string;
  cnpj: string;
  cidade: string;
  estado?: string;
  cep?: string;
}

// --- ESTADO ---
const isModalOpen = ref(false);
const isProductModalOpen = ref(false);
const isResultOpen = ref(false);
const isCalculating = ref(false);
const activePrefix = ref<'ori' | 'dest'>('ori');
const modalSearch = ref("");
const productSearch = ref("");
const modalClients = ref<Client[]>([]);
const productList = ref<any[]>([]);
const activeItemIndex = ref(-1);
const isSearching = ref(false);
const freightResults = ref<any[]>([]);
const lastQuotationId = ref<number | null>(null);
const isFinishing = ref(false);
const isFinished = ref(false);
const selectedCarrier = ref<any>(null);
const pdfLink = ref("");
let searchTimeout: ReturnType<typeof setTimeout>;

// Dados da Cotação
const origin = reactive<Client>({ razao_social: '', cnpj: '', cidade: '', estado: '', cep: '' });
const dest = reactive<Client>({ razao_social: '', cnpj: '', cidade: '', estado: '', cep: '' });

const items = ref([{ productId: 0, search: '', units: 1, qty: 1, height: 0, width: 0, length: 0, weight: 0, unitValue: 0, total: 0 }]);

const totalValue = computed(() => items.value.reduce((acc, i) => acc + i.total, 0));
const totalItems = computed(() => items.value.reduce((sum, item) => sum + (item.qty * item.units), 0));

// --- BUSCA INTELIGENTE (DEBOUNCE) ---
const handleSearchInput = () => {
  clearTimeout(searchTimeout);
  isSearching.value = true;
  searchTimeout = setTimeout(() => {
    fetchClients();
  }, 500);
};

const fetchClients = async () => {
  try {
    const term = modalSearch.value.trim();
    // Aumentado para 10 como pedido, mas permitindo busca vazia para o preview
    const res = await fetch(`/api/clients?search=${encodeURIComponent(term)}&limit=10`);
    const data = await res.json();
    modalClients.value = data.data || (Array.isArray(data) ? data : []);
  } catch (e) {
    console.error("Erro busca clientes", e);
    modalClients.value = [];
  } finally {
    isSearching.value = false;
  }
};

const openModal = (target: 'ori' | 'dest') => {
  activePrefix.value = target;
  isModalOpen.value = true;
  modalSearch.value = "";
  // Não limpamos modalClients aqui para manter o que estava, 
  // mas fetchClients vai atualizar com o "vazio" (preview geral)
  fetchClients();
};

const selectClient = async (client: any) => {
  const target = activePrefix.value === 'ori' ? origin : dest;
  if (client.isExternal) {
    try {
      window.showToast("Registrando cliente da Brasil API...", "info");
      const res = await fetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          razao_social: client.razao_social,
          cnpj: client.cnpj || '',
          cep: client.cep || '',
          cidade: client.cidade || '',
          estado: client.estado || '',
          empresa_faturamento: originCompany.value
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Falha ao registrar cliente");
      client.id = data.id;
    } catch (e: any) {
      console.error("Erro ao registrar cliente externo:", e);
      return window.showToast("Erro ao registrar cliente externo: " + e.message, "error");
    }
  }
  if (!client.isExternal && (!client.cep || !client.cidade || !client.estado) && client.cnpj) {
    try {
      window.showToast("Completando dados cadastrais...", "info");
      const enrichRes = await fetch(`/api/clients/cnpj/${client.cnpj}`);
      if (enrichRes.ok) {
        const enrichData = await enrichRes.json();
        const details = enrichData.data || enrichData;
        client.cep = client.cep || details.cep;
        client.cidade = client.cidade || details.cidade;
        client.estado = client.estado || details.estado;
        if (!client.fantasia) client.fantasia = details.fantasia;
      }
    } catch (e) {
      console.warn("Falha ao enriquecer dados:", e);
    }
  }
  target.id = client.id;
  target.razao_social = client.razao_social;
  target.cnpj = client.cnpj || '';
  target.cidade = client.cidade;
  target.estado = client.estado || '';
  target.cep = client.cep || '';
  isModalOpen.value = false;
};

// --- PRODUTOS ---
const findProduct = async (idx: number) => {
  const query = items.value[idx].search;
  if (query.length < 3) return;
  try {
    const res = await fetch(`/api/products-proxy?search=${encodeURIComponent(query)}`);
    const data = await res.json();
    const allProducts = data.data || data;
    const products = Array.isArray(allProducts) ? allProducts.filter(p => p.nome && p.nome.trim() !== "") : [];
    if (products?.[0]) fillProductData(idx, products[0]);
  } catch (e) { console.error("Erro produto", e); }
};

const openProductSearch = (idx: number) => {
  activeItemIndex.value = idx;
  productSearch.value = items.value[idx].search;
  isProductModalOpen.value = true;
  fetchProducts(productSearch.value);
};

const fetchProducts = async (term: string) => {
  isSearching.value = true;
  try {
    const res = await fetch(`/api/products?search=${encodeURIComponent(term)}`);
    const data = await res.json();
    const rawList = data.data || (Array.isArray(data) ? data : []);
    productList.value = rawList.filter((p: any) => p.nome && p.nome.trim() !== "");
  } catch (e) {
    console.error("Erro busca produtos", e);
    productList.value = [];
  } finally {
    isSearching.value = false;
  }
};

const handleProductSearchInput = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchProducts(productSearch.value);
  }, 500);
};

const selectProduct = (p: any) => {
  fillProductData(activeItemIndex.value, p);
  isProductModalOpen.value = false;
};

const fillProductData = (idx: number, p: any) => {
  const item = items.value[idx];
  item.productId = p.id;
  item.search = p.nome;
  item.weight = Number(p.peso_caixa_kg) || 0;
  item.units = Number(p.unidades_caixa) || 1;
  item.unitValue = Number(p.valor_unitario) || 0;
  if (p.medida_cm) {
    const cleanDim = String(p.medida_cm).toLowerCase().replace(/[^0-9x]/g, '');
    const d = cleanDim.split('x');
    if (d.length === 3) {
      item.height = Number(d[0]) || 0; 
      item.width = Number(d[1]) || 0; 
      item.length = Number(d[2]) || 0;
    }
  }
  calcRow(idx);
};

// --- CÁLCULO ---
const calculateFreight = async () => {
  if (!origin.cnpj || !dest.id) return window.showToast("Selecione um Destinatário válido.", "warning");
  if (!dest.cep) return window.showToast("O destinatário selecionado não possui CEP cadastrado.", "warning");
  if (totalValue.value <= 0) return window.showToast("Adicione valor aos itens da carga.", "warning");
  const validItems = items.value.filter(i => i.productId > 0);
  if (validItems.length === 0) return window.showToast("Selecione ao menos um produto válido.", "warning");
  isCalculating.value = true;
  try {
    const quotationPayload = {
      clientId: dest.id,
      empresaFaturamento: originCompany.value,
      items: validItems.map(i => ({
        productId: i.productId,
        quantidade: i.qty * i.units,
        valorUnitario: i.unitValue
      }))
    };
    const resQuo = await fetch('/api/quotations', {
      method: 'POST',
      body: JSON.stringify(quotationPayload),
      headers: { 'Content-Type': 'application/json' }
    });
    if (!resQuo.ok) {
        const err = await resQuo.json();
        throw new Error(err.error || "Erro ao gerar cotação base");
    }
    const quoData = await resQuo.json();
    lastQuotationId.value = quoData.id;
    const resFreight = await fetch(`/api/quotations/${quoData.id}/calculate-freight`, {
      method: 'POST',
      body: JSON.stringify({ quotationId: quoData.id }),
      headers: { 'Content-Type': 'application/json' }
    });
    if (!resFreight.ok) {
        const err = await resFreight.json();
        throw new Error(err.error || "Erro no cálculo de frete da API");
    }
    const freightData = await resFreight.json();
    freightResults.value = Array.isArray(freightData) ? freightData : (freightData.data || []);
    if (freightResults.value.length === 0) {
        window.showToast("Frenet não retornou opções de frete. Verifique o CEP e as dimensões.", "warning");
    }
    isResultOpen.value = true;
  } catch (e: any) {
    console.error("Erro no fluxo de frete", e);
    alert(e.message);
  } finally {
    isCalculating.value = false;
  }
};

const isCompletionModalOpen = ref(false);
const completionData = reactive({
    orderNumber: '',
    freightType: 'CIF',
    collectionDate: new Date().toISOString().split('T')[0],
    nf: ''
});

// --- FRETE MANUAL ---
const isManualFreightModalOpen = ref(false);
const manualFreightData = reactive({
    carrier: '',
    price: 0,
    deadline: ''
});

const openManualFreightModal = () => {
    isResultOpen.value = false;
    isManualFreightModalOpen.value = true;
};

const selectManualFreight = () => {
    selectedCarrier.value = {
        carrier: manualFreightData.carrier,
        price: manualFreightData.price,
        deadline: manualFreightData.deadline,
        recommendation: 'suggest_whatsapp'
    };
    isManualFreightModalOpen.value = false;
    isCompletionModalOpen.value = true;
};

const originCompany = computed(() => {
    const cnpj = origin.cnpj?.replace(/\D/g, '');
    if (cnpj === '10815855000124') return 'NICOPEL';
    if (cnpj === '47558990000141') return 'L_LOG';
    const razao = (origin.razao_social || '').toUpperCase();
    if (razao.includes('FLEXOBOX')) return 'FLEXOBOX';
    if (razao.includes('L.LOG') || razao.includes('L LOG')) return 'L_LOG';
    if (razao.includes('NICOPEL')) return 'NICOPEL';
    return 'NICOPEL';
});

const companyBranding = computed(() => {
    const brands: Record<string, { logo: string, color: string, highlight: string }> = {
        'NICOPEL': { 
            logo: 'https://i.ibb.co/zWJstk81/logo-nicopel-8.png', 
            color: '#004a99',
            highlight: '#eef6ff'
        },
        'L_LOG': { 
            logo: 'https://i.ibb.co/HLh2RFHP/logo-l-log.png', 
            color: '#64748b',
            highlight: '#f1f5f9'
        },
        'FLEXOBOX': { 
            logo: 'https://i.ibb.co/WtrW9Qf/FLEXOBOX.png', 
            color: '#059669',
            highlight: '#BDD7EE'
        }
    };
    return brands[originCompany.value] || brands['NICOPEL'];
});

const selectCarrier = (opt: any) => {
    selectedCarrier.value = opt;
    isResultOpen.value = false;
    if (originCompany.value === 'L_LOG') {
        window.showToast("Para L.LOG, a cotação oficial deve ser feita via WhatsApp. Gerando cotação para edição...", "info");
    }
    isCompletionModalOpen.value = true;
};

const confirmFinalization = async () => {
    isCompletionModalOpen.value = false;
    isFinishing.value = true;
    try {
        const payload = {
            transportadoraEscolhida: selectedCarrier.value.carrier,
            valorFrete: Number(selectedCarrier.value.price) || 0,
            diasParaEntrega: parseInt(selectedCarrier.value.deadline?.toString()) || 0,
            nf: completionData.nf,
            dataColeta: completionData.collectionDate,
            tipoFrete: completionData.freightType,
            numeroPedidoManual: completionData.orderNumber
        };
        const res = await fetch(`/api/quotations/${lastQuotationId.value}/finalize`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error("Erro ao finalizar cotação");
        pdfLink.value = `/api/quotations/${lastQuotationId.value}/pdf`;
        setTimeout(() => {
            isFinishing.value = false;
            isFinished.value = true;
        }, 1200);
    } catch (e: any) {
        window.showToast(e.message, 'error');
        isFinishing.value = false;
    }
};

const resetFlow = () => {
    isFinished.value = false;
    isResultOpen.value = false;
    location.reload(); 
};

// --- UTILS ---
const addItem = () => items.value.push({ productId: 0, search: '', units: 1, qty: 1, height: 0, width: 0, length: 0, weight: 0, unitValue: 0, total: 0 });
const removeItem = (i: number) => items.value.splice(i, 1);
const calcRow = (i: number) => { items.value[i].total = Number((items.value[i].qty * items.value[i].units * items.value[i].unitValue).toFixed(2)); };
const formatCNPJ = (v: string) => v?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') || '';
const formatCurrency = (val: number) => val?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
</script>

<template>
  <div class="cotacao-container" :style="{ '--brand-color': companyBranding.color }">
    <div class="grid-2">
      <div class="glass-card">
        <div class="card-title" :style="{ color: companyBranding.color }">
          <span><i class="fas fa-map-marker-alt"></i> ORIGEM</span>
        </div>
        <input v-model="origin.razao_social" @click="openModal('ori')" placeholder="Buscar Remetente..." class="pill-input search-input" readonly>
        <div class="info-tags">
            <span class="tag" :style="{ background: companyBranding.highlight, color: companyBranding.color }">{{ formatCNPJ(origin.cnpj) || 'CNPJ' }}</span>
            <span class="tag" :style="{ background: companyBranding.highlight, color: companyBranding.color }">{{ origin.cidade || 'CIDADE' }}</span>
        </div>
        <div v-if="originCompany === 'L_LOG'" class="wa-warning-inline mt-10">
            <i class="fab fa-whatsapp"></i> Cotação oficial via WhatsApp
        </div>
      </div>
      <div class="glass-card">
        <div class="card-title"><i class="fas fa-flag-checkered"></i> DESTINO</div>
        <input v-model="dest.razao_social" @click="openModal('dest')" placeholder="Buscar Destinatário..." class="pill-input search-input" readonly>
        <div class="info-tags">
            <span class="tag">{{ formatCNPJ(dest.cnpj) || 'CNPJ' }}</span>
            <span class="tag">{{ dest.cidade || 'CIDADE' }}</span>
        </div>
      </div>
    </div>

    <div class="glass-card mt-20">
        <div class="card-title flex-between">
            <span><i class="fas fa-boxes"></i> ITENS DA CARGA</span>
            <span class="badge">{{ totalItems }} Vol.</span>
        </div>
        <div class="table-scroll">
            <table class="items-table">
                <thead><tr><th width="35%">Produto</th><th width="8%">Emb</th><th width="8%">Qtd</th><th width="22%">Medidas (Alt x Lar x Com)</th><th width="12%">Vl. Unit</th><th width="10%">Total</th><th width="5%"></th></tr></thead>
                <tbody>
                    <tr v-for="(item, idx) in items" :key="idx">
                        <td>
                            <input v-model="item.search" @change="findProduct(idx)" @keydown.space.prevent="openProductSearch(idx)" placeholder="Espaço para buscar..." class="table-input">
                        </td>
                        <td><input v-model="item.units" readonly class="table-input center locked"></td>
                        <td><input type="number" v-model="item.qty" @input="calcRow(idx)" class="table-input center"></td>
                        <td>
                            <div class="dim-group">
                                <input type="number" v-model="item.height" placeholder="A" class="dim-input">
                                <span class="dim-sep">x</span>
                                <input type="number" v-model="item.width" placeholder="L" class="dim-input">
                                <span class="dim-sep">x</span>
                                <input type="number" v-model="item.length" placeholder="C" class="dim-input">
                            </div>
                        </td>
                        <td><input type="number" v-model="item.unitValue" @input="calcRow(idx)" class="table-input money"></td>
                        <td class="total-col">R$ {{ item.total.toFixed(2) }}</td>
                        <td><button @click="removeItem(idx)" class="btn-del">×</button></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <button @click="addItem" class="btn-add">+ Item</button>
    </div>
    
    <div class="action-bar">
       <button @click="calculateFreight" class="btn-giant" :disabled="isCalculating">{{ isCalculating ? 'Processando...' : 'CALCULAR FRETE' }}</button>
    </div>

    <!-- Modal: Busca de Clientes -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="isModalOpen = false">
        <div class="modal-box">
            <h3>Buscar {{ activePrefix === 'ori' ? 'Remetente' : 'Destinatário' }}</h3>
            <div class="input-wrapper">
                <input v-model="modalSearch" @input="handleSearchInput" placeholder="Nome ou CNPJ..." class="pill-input full-width" autofocus>
                <span v-if="isSearching" class="spinner"></span>
            </div>
            <div class="results-list">
                <div v-if="modalClients.length > 0">
                    <div v-for="c in modalClients" :key="c.cnpj" class="result-item" @click="selectClient(c)">
                        <div class="result-info">
                            <div class="title-with-badge">
                                <strong>{{ c.fantasia || c.razao_social }}</strong>
                                <span v-if="(c as any).isExternal" class="external-badge">Brasil API</span>
                            </div>
                            <small v-if="c.fantasia && c.razao_social !== c.fantasia">{{ c.razao_social }}</small>
                            <small>CNPJ: {{ formatCNPJ(c.cnpj) }} | {{ c.cidade }}/{{ c.estado }}</small>
                        </div>
                        <i class="fas fa-chevron-right text-light"></i>
                    </div>
                </div>
                <div v-else-if="!isSearching" class="empty-msg">Nenhum cliente disponível.</div>
            </div>
        </div>
    </div>

    <!-- Modal Busca de Produtos -->
    <div v-if="isProductModalOpen" class="modal-overlay" @click.self="isProductModalOpen = false">
        <div class="modal-box">
            <h3>Selecionar Produto</h3>
            <div class="input-wrapper">
                <input v-model="productSearch" @input="handleProductSearchInput" placeholder="Buscar produto..." class="pill-input full-width" autofocus>
                <span v-if="isSearching" class="spinner"></span>
            </div>
            <div class="results-list">
                <div v-if="productList.length > 0">
                    <div v-for="p in productList" :key="p.id" class="result-item" @click="selectProduct(p)">
                        <div class="result-info">
                            <strong>{{ p.nome }}</strong>
                            <small>Emb: {{ p.unidades_caixa }} un | Categoria: {{ p.categoria }}</small>
                        </div>
                    </div>
                </div>
                <div v-else-if="!isSearching && productSearch.length > 1" class="empty-msg">Nenhum produto cadastrado.</div>
            </div>
        </div>
    </div>

    <!-- Modal Resultados Frete -->
    <div v-if="isResultOpen" class="modal-overlay" @click.self="isResultOpen = false">
       <div class="modal-box giant">
           <div class="modal-header">
               <div class="header-titles">
                   <h3>Opções de Frete Disponíveis</h3>
                   <p class="modal-subtitle">Total Produtos: {{ formatCurrency(totalValue) }}</p>
               </div>
           </div>
           
           <div class="modal-scroll-area">
               <div v-if="freightResults.length > 0" class="freight-grid">
                   <div v-for="(opt, i) in freightResults" :key="i" class="freight-card compact" :class="opt.recommendation">
                       <div class="card-main">
                            <div class="carrier-brand">
                                <h4>{{ opt.carrier }}</h4>
                                 <span v-if="opt.service_description && opt.service_description !== opt.carrier" class="service-tag">{{ opt.service_description }}</span>
                            </div>
                            <div class="carrier-values">
                                <div class="preco">R$ {{ Number(opt.price || 0).toFixed(2) }}</div>
                                <div v-if="opt.percentage !== undefined" class="percentage-badge">
                                    {{ opt.percentage }}% do valor
                                </div>
                                <div class="prazo"><i class="fas fa-calendar-alt"></i> {{ opt.deadline || '---' }} Dias</div>
                            </div>
                       </div>
                       
                        <div class="card-footer">
                             <div class="footer-left" v-if="opt.recommendation">
                                 <div v-if="opt.recommendation === 'best_option'" class="rec-badge best">MELHOR ESCOLHA</div>
                                 <div v-else-if="opt.recommendation === 'suggest_whatsapp'" class="rec-badge wa clickable" @click="openManualFreightModal">CONSULTAR WHATSAPP</div>
                             </div>
                             <button class="btn-select-compact" @click="selectCarrier(opt)">SELECIONAR E FINALIZAR</button>
                        </div>
                   </div>
               </div>
               <div v-else class="empty-freight-msg">
                   <i class="fas fa-exclamation-triangle"></i>
                   <p>Nenhuma opção de frete encontrada para este destino e peso.</p>
                   <button @click="isResultOpen = false" class="btn-secondary mt-15">Tentar Novamente</button>
               </div>
           </div>
       </div>
    </div>

    <!-- Modal de Dados do Pedido / Finalização -->
    <div v-if="isCompletionModalOpen" class="modal-overlay">
        <div class="modal-box animate-pop">
            <h2 :style="{ color: companyBranding.color }">Detalhes do Pedido</h2>
            <p>Complete as informações para finalizar a cotação.</p>
            
            <div class="form-grid mt-20">
                <div class="form-field">
                    <label><i class="fas fa-hashtag"></i> Nº PEDIDO</label>
                    <input v-model="completionData.orderNumber" type="text" class="table-input" placeholder="Digite o número">
                </div>
                <div class="form-field">
                    <label><i class="fas fa-truck-loading"></i> TIPO DE FRETE</label>
                    <select v-model="completionData.freightType" class="table-input">
                        <option value="CIF">CIF (Emitente)</option>
                        <option value="FOB">FOB (Destinatário)</option>
                    </select>
                </div>
                <div class="form-field">
                    <label><i class="fas fa-calendar-alt"></i> DATA DA COLETA</label>
                    <input v-model="completionData.collectionDate" type="date" class="table-input">
                </div>
                <div class="form-field">
                    <label><i class="fas fa-file-invoice-dollar"></i> Nº NF</label>
                    <input v-model="completionData.nf" type="text" class="table-input" placeholder="Opcional">
                </div>
            </div>

            <div class="modal-actions-grid mt-30">
                <button @click="isCompletionModalOpen = false" class="btn-secondary">Voltar</button>
                <button @click="confirmFinalization" class="btn-primary" :style="{ background: companyBranding.color }">Confirmar e Gerar PDF</button>
            </div>
        </div>
    </div>

    <!-- Modal de Frete Manual -->
    <div v-if="isManualFreightModalOpen" class="modal-overlay">
        <div class="modal-box animate-pop">
            <h2 style="color: #25d366">Frete Manual (WhatsApp)</h2>
            <p>Insira os dados combinados via WhatsApp para prosseguir.</p>
            
            <div class="form-grid mt-20">
                <div class="form-field" style="grid-column: span 2;">
                    <label><i class="fas fa-truck"></i> Nome da Transportadora</label>
                    <input v-model="manualFreightData.carrier" type="text" class="table-input" placeholder="Ex: Rodonaves, Jamef...">
                </div>
                <div class="form-field">
                    <label><i class="fas fa-dollar-sign"></i> Valor do Frete (R$)</label>
                    <input v-model="manualFreightData.price" type="number" class="table-input" step="0.01">
                </div>
                <div class="form-field">
                    <label><i class="fas fa-clock"></i> Prazo de Entrega</label>
                    <input v-model="manualFreightData.deadline" type="text" class="table-input" placeholder="Ex: 3 Dias">
                </div>
            </div>

            <div class="modal-actions-grid mt-30">
                <button @click="isManualFreightModalOpen = false" class="btn-secondary">Cancelar</button>
                <button @click="selectManualFreight" class="btn-primary" style="background: #25d366">Salvar e Continuar</button>
            </div>
        </div>
    </div>

    <!-- Overlay de Finalização -->
    <div v-if="isFinishing || isFinished" class="modal-overlay">
        <div class="modal-box text-center">
            <div v-if="isFinishing" class="finishing-state">
                <div class="spinner-big"></div>
                <h2>Finalizando Cotação...</h2>
                <p>Estamos gerando o documento e salvando as opções.</p>
            </div>
            
            <div v-if="isFinished" class="finished-state animate-pop">
                <div class="success-icon"><i class="fas fa-check-circle"></i></div>
                <h2>Cotação Concluída!</h2>
                <p>A transportadora <strong>{{ selectedCarrier?.carrier }}</strong> foi selecionada.</p>
                <div class="action-buttons-final">
                    <a :href="pdfLink" target="_blank" class="btn-primary">
                        <i class="fas fa-file-pdf"></i> Visualizar PDF
                    </a>
                    <button @click="resetFlow" class="btn-secondary">Nova Cotação</button>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.cotacao-container { font-family: 'Inter', sans-serif; padding: 20px; max-width: 1250px; margin: 0 auto; color: #1e293b; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
 
@media (max-width: 768px) {
  .grid-2 { grid-template-columns: 1fr; }
  .cotacao-container { padding: 10px; }
  .glass-card { padding: 15px; }
}
.glass-card { background: #fff; border-radius: 20px; padding: 25px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
.card-title { font-weight: 800; color: #1e293b; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
.pill-input { width: 100%; padding: 12px 20px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; font-size: 1rem; outline: none; transition: 0.2s; }
.pill-input:focus { border-color: var(--brand-color); background: #fff; }
.search-input { cursor: pointer; background: #f8fafc url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>') no-repeat right 15px center; }
.info-tags { display: flex; gap: 10px; margin-top: 15px; }
.tag { padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; background: #f1f5f9; color: #475569; }

.items-table { width: 100%; border-collapse: separate; border-spacing: 0 10px; margin-top: -10px; }
.items-table th { text-align: left; color: #64748b; font-size: 0.75rem; text-transform: uppercase; padding: 0 10px; }
.items-table td { padding: 0; }
.table-input { width: 100%; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px; font-size: 0.9rem; outline: none; transition: 0.2s; background: #f8fafc; }
.table-input:focus { border-color: var(--brand-color); background: #fff; }
.table-input.center { text-align: center; }
.table-input.locked { background: #f1f5f9; cursor: not-allowed; }

.dim-group { display: flex; align-items: center; gap: 5px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 2px 5px; }
.dim-input { width: 45px; border: none; background: transparent; text-align: center; font-size: 0.9rem; outline: none; padding: 8px 0; }
.dim-sep { color: #cbd5e1; font-weight: 800; font-size: 0.8rem; }

.btn-giant { width: 100%; background: var(--brand-color); color: #fff; border: none; padding: 18px; border-radius: 15px; font-weight: 800; font-size: 1.1rem; cursor: pointer; transition: 0.3s; margin-top: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
.btn-giant:hover { transform: translateY(-3px); filter: brightness(1.1); box-shadow: 0 15px 35px rgba(0,0,0,0.15); }

.mt-30 { margin-top: 30px; }
.modal-actions-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 15px; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left; }
 
@media (max-width: 640px) {
  .form-grid { grid-template-columns: 1fr; gap: 10px; }
  .modal-actions-grid { grid-template-columns: 1fr; }
}
 
.form-field { display: flex; flex-direction: column; gap: 8px; }
.form-field label { font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }

.btn-add { background: #f1f5f9; color: #475569; border: 1px dashed #cbd5e1; padding: 8px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; margin-top: 15px; transition: 0.2s; }
.btn-add:hover { background: #e2e8f0; color: #1e293b; }
.btn-del { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #fee2e2; background: #fff; color: #ef4444; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.btn-del:hover { background: #fee2e2; }

.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 3000; }
.modal-box { background: #fff; border-radius: 25px; padding: 35px; width: 95%; max-width: 550px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); display: flex; flex-direction: column; max-height: 90vh; }
.modal-box.giant { max-width: 1000px; width: 95%; }
 
@media (max-width: 640px) {
  .modal-box { padding: 20px; border-radius: 20px; }
  .modal-box h3 { font-size: 1.2rem; }
}
.modal-scroll-area { overflow-y: auto; flex: 1; padding-right: 10px; margin-top: 15px; }
/* Personaliza scrollbar */
.modal-scroll-area::-webkit-scrollbar { width: 8px; }
.modal-scroll-area::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
.modal-scroll-area::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.modal-scroll-area::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

.results-list { max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 15px; background: #fff; margin-top: 15px; }
.result-item { padding: 15px 20px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: 0.2s; display: flex; justify-content: space-between; align-items: center; }
.result-item:hover { background: #f0f9ff; }
.result-info { display: flex; flex-direction: column; gap: 2px; }
.result-info strong { color: #1e293b; font-size: 0.95rem; }
.result-info small { color: #64748b; font-size: 0.8rem; }
.title-with-badge { display: flex; align-items: center; gap: 8px; }
.external-badge { background: #dcfce7; color: #166534; font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; font-weight: 800; }

.freight-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 20px; }
.freight-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 20px; transition: 0.3s; display: flex; flex-direction: column; position: relative; }
.freight-card:hover { transform: translateY(-5px); border-color: var(--brand-color); box-shadow: 0 10px 30px rgba(0,0,0,0.05); }

.best_option { border: 2px solid #22c55e !important; background: #f0fdf4 !important; }

.card-main { flex: 1; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.carrier-brand h4 { font-weight: 800; color: #1e293b; margin: 0; }
.service-tag { font-size: 0.7rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
.carrier-values { text-align: right; }
.preco { font-size: 1.25rem; font-weight: 900; color: #1e293b; }
.prazo { font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 4px; }

.card-footer { border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; flex-direction: column; gap: 12px; }
.rec-badge { font-size: 0.7rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; text-align: center; }
.rec-badge.best { background: #22c55e; color: #fff; }
.rec-badge.wa { background: #25d366; color: #fff; cursor: pointer; }

.btn-select-compact { width: 100%; padding: 12px; border-radius: 10px; border: none; background: #f1f5f9; color: #475569; font-weight: 700; cursor: pointer; transition: 0.2s; }
.btn-select-compact:hover { background: var(--brand-color); color: #fff; }

.btn-primary { background: var(--brand-color); color: #fff; border: none; padding: 14px 25px; border-radius: 12px; font-weight: 700; cursor: pointer; }
.btn-secondary { background: #f1f5f9; color: #475569; border: none; padding: 14px 25px; border-radius: 12px; font-weight: 700; cursor: pointer; }

.success-icon { font-size: 4rem; color: #22c55e; margin-bottom: 20px; }
.text-center { text-align: center; }
.action-buttons-final { display: flex; gap: 15px; margin-top: 30px; justify-content: center; align-items: center; }
.spinner-big { width: 60px; height: 60px; border: 5px solid #f1f5f9; border-top: 5px solid var(--brand-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }

@keyframes spin { to { transform: rotate(360deg); } }
.animate-pop { animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes pop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

.wa-warning-inline { background: #f0fdf4; border: 1px solid #bbfcce; color: #166534; padding: 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
 
@media (max-width: 768px) {
  .items-table th:nth-child(4), .items-table td:nth-child(4) { display: none; } /* Ocultar medidas no mob para caber */
  .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -15px; padding: 0 15px; }
  .items-table { min-width: 500px; }
}
</style>
