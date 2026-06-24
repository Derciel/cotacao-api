<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { safeFetch, getAuthToken } from '../utils/api-utils';

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
const isManualFreightModalOpen = ref(false);
const isQuickMode = ref(false);
const quickOriginCep = ref("86087350");
const quickDestCep = ref("");
const isAdmin = ref(false);
if (typeof window !== 'undefined') {
    try {
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        isAdmin.value = userInfo.role?.toUpperCase() === 'ADMIN';
    } catch (e) {
        console.error("Erro ao ler user_info", e);
    }
}

const isIpiUnlocked = ref(false);
const ipiPassword = 'nicopel@ipi';

const toggleIpiLock = () => {
    if (isAdmin.value) return; // Admins sempre podem editar
    if (isIpiUnlocked.value) {
        isIpiUnlocked.value = false;
        showToastLocal("Edição de IPI bloqueada.", "info");
    } else {
        const password = prompt("Digite a senha para desbloquear a edição do IPI:");
        if (password === ipiPassword) {
            isIpiUnlocked.value = true;
            showToastLocal("Edição de IPI liberada!", "success");
        } else if (password !== null) {
            showToastLocal("Senha incorreta!", "error");
        }
    }
};
let searchTimeout: ReturnType<typeof setTimeout>;

// --- DADOS PARA EDIÇÃO RÁPIDA ---
const isEditClientModalOpen = ref(false);
const editClientData = reactive({
    id: 0,
    razao_social: '',
    fantasia: '',
    cnpj: '',
    cidade: '',
    estado: '',
    cep: ''
});
const isSavingClient = ref(false);

const openEditClientModal = (client: Client) => {
    if (!client.id) return window.showToast("Cliente sem ID, selecione novamente.", "warning");
    editClientData.id = client.id;
    editClientData.razao_social = client.razao_social;
    editClientData.fantasia = client.fantasia || '';
    editClientData.cnpj = client.cnpj || '';
    editClientData.cidade = client.cidade || '';
    editClientData.estado = client.estado || '';
    editClientData.cep = client.cep || '';
    isEditClientModalOpen.value = true;
};

const saveClientEdit = async () => {
    if (!editClientData.razao_social) return window.showToast("Razão Social é obrigatória.", "warning");
    isSavingClient.value = true;
    try {
        const payload = {
            razao_social: editClientData.razao_social,
            fantasia: editClientData.fantasia,
            cnpj: editClientData.cnpj.replace(/\D/g, ''),
            cidade: editClientData.cidade,
            estado: editClientData.estado,
            cep: editClientData.cep.replace(/\D/g, '')
        };
        const res = await safeFetch(`/api/clients/${editClientData.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error("Erro ao salvar o cliente.");
        
        // Atualiza a view
        if (dest.id === editClientData.id) {
            dest.razao_social = editClientData.razao_social;
            dest.fantasia = editClientData.fantasia;
            dest.cnpj = editClientData.cnpj;
            dest.cidade = editClientData.cidade;
            dest.estado = editClientData.estado;
            dest.cep = editClientData.cep;
        } else if (origin.id === editClientData.id) {
            origin.razao_social = editClientData.razao_social;
            origin.fantasia = editClientData.fantasia;
            origin.cnpj = editClientData.cnpj;
            origin.cidade = editClientData.cidade;
            origin.estado = editClientData.estado;
            origin.cep = editClientData.cep;
        }
        
        window.showToast("Cliente atualizado com sucesso!", "success");
        isEditClientModalOpen.value = false;
    } catch (e: any) {
        window.showToast(e.message || "Erro ao salvar", "error");
    } finally {
        isSavingClient.value = false;
    }
};

// --- REGRAS DE NEGÓCIO ---
const isFreightExempt = computed(() => {
    if (originCompany.value !== 'NICOPEL') return false;
    const r = (dest.razao_social || '').toUpperCase();
    const f = (dest.fantasia || '').toUpperCase();
    const grupos = ['THE BEST', 'GELA BOCA', 'BARONE', 'SANTA PIZZA', 'PIMENTA ROSA', 'FRATELLO', 'GMEL'];
    return grupos.some(g => r.includes(g) || f.includes(g));
});


// Dados da Cotação
const origin = reactive<Client>({ razao_social: '', cnpj: '', cidade: '', estado: '', cep: '' });
const dest = reactive<Client>({ razao_social: '', cnpj: '', cidade: '', estado: '', cep: '' });

const fixedOrigins = [
  { razao_social: 'NICOPEL EMBALAGENS', cnpj: '10815855000124', cidade: 'Londrina', estado: 'PR', cep: '86087350' },
  { razao_social: 'L.LOG', cnpj: '47558990000141', cidade: 'Londrina', estado: 'PR', cep: '86087350' },
  { razao_social: 'FLEXOBOX EMBALAGENS', cnpj: '08683056000590', cidade: 'Londrina', estado: 'PR', cep: '86087350' }
];

// Build fix: v1.0.1

const items = ref([{ productId: 0, search: '', units: 1, qty: 1, height: 0, width: 0, length: 0, weight: 0, unitValue: 0, ipi: 0, total: 0 }]);

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
    const res = await safeFetch(`/api/clients?search=${encodeURIComponent(term)}&limit=10`);
    if (res.ok) {
      const data = res.data;
      modalClients.value = data.data || (Array.isArray(data) ? data : []);
    }
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
  
  if (target === 'ori') {
    modalClients.value = fixedOrigins;
  } else {
    fetchClients();
  }
};

const selectClient = async (client: any) => {
  const target = activePrefix.value === 'ori' ? origin : dest;
  if (client.isExternal) {
    try {
      window.showToast("Registrando cliente da Brasil API...", "info");
      const res = await safeFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          razao_social: client.razao_social,
          cnpj: client.cnpj || '',
          cep: client.cep || '',
          cidade: client.cidade || '',
          estado: client.estado || '',
          empresa_faturamento: originCompany.value
        }),
        headers: { 
            'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error(res.data.message || res.data.error || "Falha ao registrar cliente");
      client.id = res.data.id;
    } catch (e: any) {
      console.error("Erro ao registrar cliente externo:", e);
      return window.showToast("Erro ao registrar cliente externo: " + e.message, "error");
    }
  }
  if (!client.isExternal && client.cnpj) {
    try {
      window.showToast("Verificando dados cadastrais...", "info");
      const res = await safeFetch(`/api/clients/cnpj/${client.cnpj}`);
      if (res.ok) {
        const details = res.data.data || res.data;
        const updatedFields: any = {};
        let needsUpdate = false;

        const cleanClientCep = (client.cep || '').replace(/\D/g, '');
        const cleanDetailsCep = (details.cep || '').replace(/\D/g, '');
        if (cleanClientCep !== cleanDetailsCep && details.cep) {
            client.cep = cleanDetailsCep;
            updatedFields.cep = cleanDetailsCep;
            needsUpdate = true;
        }

        const cleanClientCidade = (client.cidade || '').trim().toUpperCase();
        const cleanDetailsCidade = (details.cidade || '').trim().toUpperCase();
        if (cleanClientCidade !== cleanDetailsCidade && details.cidade) {
            client.cidade = details.cidade.trim();
            updatedFields.cidade = details.cidade.trim();
            needsUpdate = true;
        }

        const cleanClientEstado = (client.estado || '').trim().toUpperCase();
        const cleanDetailsEstado = (details.estado || '').trim().toUpperCase();
        if (cleanClientEstado !== cleanDetailsEstado && details.estado) {
            client.estado = details.estado.trim().toUpperCase();
            updatedFields.estado = details.estado.trim().toUpperCase();
            needsUpdate = true;
        }

        const cleanClientFantasia = (client.fantasia || '').trim().toUpperCase();
        const cleanDetailsFantasia = (details.fantasia || '').trim().toUpperCase();
        if (cleanClientFantasia !== cleanDetailsFantasia && details.fantasia) {
            client.fantasia = details.fantasia.trim();
            updatedFields.fantasia = details.fantasia.trim();
            needsUpdate = true;
        }

        if (needsUpdate && client.id) {
           try {
               await safeFetch(`/api/clients/${client.id}`, {
                   method: 'PATCH',
                   body: JSON.stringify(updatedFields),
                   headers: { 'Content-Type': 'application/json' }
               });
           } catch (e) {
               console.warn("Falha ao salvar enriquecimento de dados no BD:", e);
           }
        }
      }
    } catch (e) {
      console.warn("Falha ao enriquecer dados:", e);
    }
  }
  target.id = client.id;
  target.razao_social = client.razao_social;
  target.fantasia = client.fantasia || '';
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
    const res = await safeFetch(`/api/products-proxy?search=${encodeURIComponent(query)}`);
    if (res.ok) {
        const allProducts = res.data.data || res.data;
    const products = Array.isArray(allProducts) ? allProducts.filter(p => p.nome && p.nome.trim() !== "") : [];
    if (products?.[0]) fillProductData(idx, products[0]);
    }
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
    const res = await safeFetch(`/api/products?search=${encodeURIComponent(term)}`);
    if (res.ok) {
      const rawList = res.data.data || (Array.isArray(res.data) ? res.data : []);
    productList.value = rawList.filter((p: any) => p.nome && p.nome.trim() !== "");
    }
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
    // Parse mais flexível: pega apenas números separados por x
    const d = String(p.medida_cm).toLowerCase().split('x').map(v => parseFloat(v.replace(/[^0-9.]/g, '')));
    if (d.length === 3 && d.every(v => !isNaN(v))) {
      item.height = d[0]; 
      item.width = d[1]; 
      item.length = d[2];
    } else {
      console.warn("[NovaCotacao] Formato de medida_cm inválido:", p.medida_cm);
    }
  }
  console.log(`[NovaCotacao] Produto selecionado #${idx}:`, item);
  
  // Detecção automática de IPI (Regra Nicopel)
  if (originCompany.value === 'NICOPEL') {
      const nome = p.nome.toUpperCase();
      const categoria = (p.categoria || '').toUpperCase();
      if (nome.includes('SERIGRAFIA') || nome.includes('TAMPA')) {
          item.ipi = 0;
      } else if (categoria === 'POTE' || nome.includes('POTE') || nome.includes('COPO')) {
          item.ipi = 6.75;
      } else {
          item.ipi = 3.25;
      }
  } else {
      item.ipi = 0;
  }

  calcRow(idx);
};

// --- BUSCA CEP RAPIDA ---
const searchCep = async (cep: string, target: 'ori' | 'dest') => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
            const client = target === 'ori' ? origin : dest;
            client.cidade = data.localidade;
            client.estado = data.uf;
            client.cep = cleanCep;
            if (target === 'ori') {
                client.razao_social = "REMETENTE CONSULTA";
                client.cnpj = "00000000000000";
            } else {
                client.razao_social = "DESTINATÁRIO CONSULTA";
            }
        }
    } catch (e) {
        console.error("Erro ao buscar CEP:", e);
    }
};

const toggleQuickMode = () => {
    isQuickMode.value = !isQuickMode.value;
    resetFlow();
    if (isQuickMode.value) {
        origin.cep = "86087350";
        searchCep("86087350", 'ori');
    }
};

// --- CÁLCULO ---
const calculateFreight = async () => {
  if (!isQuickMode.value && (!origin.cnpj || !dest.id)) return window.showToast("Selecione um Destinatário válido.", "warning");
  if (isQuickMode.value && (!origin.cep || !dest.cep)) return window.showToast("Informe os CEPs de origem e destino.", "warning");
  if (!dest.cep) return window.showToast("O destinatário selecionado não possui CEP cadastrado.", "warning");
  if (totalValue.value <= 0) return window.showToast("Adicione valor aos itens da carga.", "warning");
  const validItems = items.value.filter(i => i.productId > 0);
  if (validItems.length === 0) return window.showToast("Selecione ao menos um produto válido.", "warning");
  isCalculating.value = true;
  try {
    const quotationPayload = {
      clientId: isQuickMode.value ? null : dest.id,
      isTest: isQuickMode.value,
      originCep: origin.cep,
      destCep: dest.cep,
      empresaFaturamento: originCompany.value,
      items: validItems.map(i => ({
        productId: i.productId,
        quantidade: Math.ceil(i.qty * i.units),
        valorUnitario: i.unitValue * (1 + (i.ipi / 100))
      }))
    };
    console.log("[NovaCotacao] Enviando Payload de Cotação:", JSON.stringify(quotationPayload, null, 2));
    const resQuo = await safeFetch('/api/quotations', {
      method: 'POST',
      body: JSON.stringify(quotationPayload),
      headers: { 
          'Content-Type': 'application/json'
      }
    });

    if (!resQuo.ok) {
        throw new Error(resQuo.data.message || resQuo.data.error || "Erro ao gerar cotação base");
    }
    const quoData = resQuo.data;
    lastQuotationId.value = quoData.id;

    const resFreight = await safeFetch(`/api/quotations/${quoData.id}/calculate-freight`, {
      method: 'POST',
      body: JSON.stringify({ quotationId: quoData.id }),
      headers: { 
          'Content-Type': 'application/json'
      }
    });

    if (!resFreight.ok) {
        throw new Error(resFreight.data.error || "Erro no cálculo de frete da API");
    }
    const freightData = resFreight.data;
    console.log("[NovaCotacao] Resposta da API de Frete:", freightData);
    freightResults.value = Array.isArray(freightData) ? freightData : (freightData.data || []);
    if (freightResults.value.length === 0) {
        window.showToast("Frenet não retornou opções de frete. Verifique o CEP e as dimensões.", "warning");
    }
    isResultOpen.value = true;
  } catch (e: any) {
    console.error("Erro no fluxo de frete", e);
    window.showToast(e.message || "Erro ao calcular frete", "error");
  } finally {
    isCalculating.value = false;
  }
};

const isCompletionModalOpen = ref(false);
const completionData = reactive({
    orderNumber: '',
    freightType: 'CIF',
    collectionDate: '',
    nf: '',
    obs: '',
    exibirFreteIsento: false
});

// --- FRETE MANUAL ---
const manualFreightData = reactive({
    carrier: '',
    price: 0,
    deadline: ''
});

const openManualFreightModal = () => {
    isResultOpen.value = false;
    isManualFreightModalOpen.value = true;
    // Removido o zeramento forçado para isentos para que o valor possa ser salvo no histórico
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
            numeroPedidoManual: completionData.orderNumber,
            obs: completionData.obs,
            exibirFreteIsento: completionData.exibirFreteIsento
        };
        const res = await safeFetch(`/api/quotations/${lastQuotationId.value}/finalize`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
            headers: { 
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) throw new Error("Erro ao finalizar cotação");
        setTimeout(() => {
            isFinishing.value = false;
            isFinished.value = true;
        }, 1200);
    } catch (e: any) {
        window.showToast(e.message, 'error');
        isFinishing.value = false;
    }
};

const pdfLink = computed(() => {
    if (!lastQuotationId.value) return '#';
    const token = getAuthToken();
    return `/api/quotations/${lastQuotationId.value}/pdf?token=${token}`;
});

const resetFlow = () => {
    const mode = isQuickMode.value;
    isFinished.value = false;
    isResultOpen.value = false;
    origin.razao_social = ''; origin.cnpj = ''; origin.cidade = ''; origin.estado = ''; origin.cep = '';
    dest.razao_social = ''; dest.cnpj = ''; dest.cidade = ''; dest.estado = ''; dest.cep = '';
    items.value = [{ productId: 0, search: '', units: 1, qty: 1, height: 0, width: 0, length: 0, weight: 0, unitValue: 0, total: 0 }];
    freightResults.value = [];
    lastQuotationId.value = null;
    selectedCarrier.value = null;
    completionData.orderNumber = '';
    completionData.nf = '';
    completionData.obs = '';
    completionData.collectionDate = '';
    completionData.exibirFreteIsento = false;
    if (mode) {
        origin.cep = "86087350";
        searchCep("86087350", 'ori');
    }
};

// --- UTILS ---
const addItem = () => items.value.push({ productId: 0, search: '', units: 1, qty: 1, height: 0, width: 0, length: 0, weight: 0, unitValue: 0, ipi: 0, total: 0 });
const removeItem = (i: number) => items.value.splice(i, 1);
const calcRow = (i: number) => { 
    const item = items.value[i];
    const baseTotal = item.qty * item.units * item.unitValue;
    const ipiValue = baseTotal * (item.ipi / 100);
    item.total = Number((baseTotal + ipiValue).toFixed(2)); 
};
const formatCNPJ = (v: string) => v?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') || '';
const formatCurrency = (val: number) => val?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
const showToastLocal = (msg: string, type: any = 'info') => { if(window && window.showToast) window.showToast(msg, type); };
</script>

<template>
  <div class="cotacao-container" :style="{ '--brand-color': companyBranding.color }">
    <div class="quick-mode-header mb-20">
        <div class="mode-selector">
            <button @click="isQuickMode = false; resetFlow()" class="btn-mode" :class="{ active: !isQuickMode }">
                <i class="fas fa-file-contract"></i> Cotação Oficial
            </button>
            <button @click="toggleQuickMode" class="btn-mode" :class="{ active: isQuickMode }">
                <i class="fas fa-search-dollar"></i> Consulta Rápida
            </button>
        </div>
    </div>

    <div class="grid-2">
      <div class="glass-card">
        <div class="card-title" :style="{ color: companyBranding.color }">
          <span><i class="fas fa-map-marker-alt"></i> ORIGEM</span>
        </div>
        <div v-if="!isQuickMode">
            <div class="input-with-button">
                <input v-model="origin.razao_social" @click="openModal('ori')" placeholder="Buscar Remetente..." class="pill-input search-input" readonly>
                <button v-if="origin.id && origin.cnpj !== '10815855000124'" @click="openEditClientModal(origin)" class="btn-edit-client" title="Editar Cliente">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="info-tags">
                <span class="tag" :style="{ background: companyBranding.highlight, color: companyBranding.color }">{{ formatCNPJ(origin.cnpj) || 'CNPJ' }}</span>
                <span class="tag" :style="{ background: companyBranding.highlight, color: companyBranding.color }">{{ origin.cidade || 'CIDADE' }}</span>
            </div>
        </div>
        <div v-else class="quick-inputs">
            <div class="input-field">
                <label>CEP ORIGEM</label>
                <input v-model="origin.cep" @input="searchCep(origin.cep, 'ori')" placeholder="00000-000" class="pill-input-small">
            </div>
            <div class="info-display mt-10">
                <span class="city-info">{{ origin.cidade }} / {{ origin.estado }}</span>
            </div>
        </div>
        <div v-if="originCompany === 'L_LOG' && !isQuickMode" class="wa-warning-inline mt-10">
            <i class="fab fa-whatsapp"></i> Cotação oficial via WhatsApp
        </div>
      </div>

      <div class="glass-card">
        <div class="card-title flex-between" style="margin-bottom: 20px;">
           <div style="display: flex; align-items: center; gap: 10px;">
             <i class="fas fa-flag-checkered"></i> DESTINO
           </div>
           <span v-if="isFreightExempt" class="badge-exempt"><i class="fas fa-star"></i> Isento de Frete</span>
        </div>
        <div v-if="!isQuickMode">
            <div class="input-with-button">
                <input v-model="dest.razao_social" @click="openModal('dest')" placeholder="Buscar Destinatário..." class="pill-input search-input" readonly>
                <button v-if="dest.id" @click="openEditClientModal(dest)" class="btn-edit-client" title="Editar Cliente">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="info-tags">
                <span class="tag">{{ formatCNPJ(dest.cnpj) || 'CNPJ' }}</span>
                <span class="tag">{{ dest.cidade || 'CIDADE' }}</span>
            </div>
        </div>
        <div v-else class="quick-inputs">
            <div class="input-field">
                <label>CEP DESTINO</label>
                <input v-model="dest.cep" @input="searchCep(dest.cep, 'dest')" placeholder="00000-000" class="pill-input-small" autofocus>
            </div>
            <div class="info-display mt-10">
                <span class="city-info">{{ dest.cidade }} / {{ dest.estado }}</span>
            </div>
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
                <thead><tr><th width="28%">Produto</th><th width="8%">Emb</th><th width="8%">Qtd</th><th width="20%">Medidas (Alt x Lar x Com)</th><th width="12%">Vl. Unit</th><th width="12%">IPI %</th><th width="10%">Total</th><th width="2%"></th></tr></thead>
                <tbody>
                    <tr v-for="(item, idx) in items" :key="idx">
                        <td>
                            <input v-model="item.search" @change="findProduct(idx)" @keydown.space.prevent="openProductSearch(idx)" placeholder="Espaço para buscar..." class="table-input">
                        </td>
                        <td><input type="number" v-model="item.units" class="table-input center" @input="calcRow(idx)"></td>
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
                        <td><input type="number" v-model="item.unitValue" @input="calcRow(idx)" class="table-input money" step="0.01"></td>
                        <td>
                            <div class="ipi-input-container">
                                <input type="number" v-model="item.ipi" :readonly="!isAdmin && !isIpiUnlocked" :class="['table-input', 'center', { locked: !isAdmin && !isIpiUnlocked }]" @input="calcRow(idx)">
                                <button v-if="!isAdmin" @click="toggleIpiLock" class="btn-lock" :title="isIpiUnlocked ? 'Bloquear edição de IPI' : 'Desbloquear edição de IPI com senha'">
                                    <i :class="isIpiUnlocked ? 'fas fa-lock-open' : 'fas fa-lock'"></i>
                                </button>
                            </div>
                        </td>
                        <td class="total-col">R$ {{ item.total.toFixed(2) }}</td>
                        <td><button @click="removeItem(idx)" class="btn-del">×</button></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <button @click="addItem" class="btn-add">+ Item</button>
    </div>
    
    <div class="action-bar">
       <button @click="calculateFreight" class="btn-giant" :disabled="isCalculating">
           <span v-if="isCalculating" class="btn-spinner"></span>
           {{ isCalculating ? 'CALCULANDO FRETE...' : 'CALCULAR FRETE' }}
       </button>
    </div>

    <!-- Modal: Busca de Clientes -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="isModalOpen = false">
        <div class="modal-box">
            <h3>Buscar {{ activePrefix === 'ori' ? 'Remetente' : 'Destinatário' }}</h3>
            <div class="input-wrapper" v-if="activePrefix === 'dest'">
                <input v-model="modalSearch" @input="handleSearchInput" placeholder="Nome ou CNPJ..." class="pill-input full-width" autofocus>
                <span v-if="isSearching" class="spinner"></span>
            </div>
            <div class="input-wrapper" v-else>
                <p class="modal-instruction">Selecione a empresa de origem abaixo:</p>
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
               <div v-if="isQuickMode" class="header-actions">
                   <button @click="resetFlow" class="btn-reset-quick">
                       <i class="fas fa-redo"></i> NOVA CONSULTA
                   </button>
               </div>
           </div>
           
            <div class="modal-scroll-area">
               <div v-if="freightResults.length > 0" class="freight-modern-grid">
                   <div v-for="(opt, i) in freightResults" :key="i" class="freight-modern-card" :class="opt.recommendation">
                        <div class="card-brand">
                            <i class="fas fa-truck-moving brand-icon"></i>
                            <h4>{{ opt.carrier }}</h4>
                            <span v-if="opt.service_description && opt.service_description !== opt.carrier" class="service-name">{{ opt.service_description }}</span>
                        </div>
                        
                        <div class="card-pricing">
                            <div class="main-price">R$ {{ Number(opt.price || 0).toFixed(2) }}</div>
                            <div v-if="opt.percentage !== undefined" class="perc-badge">{{ opt.percentage }}%</div>
                        </div>

                        <div class="card-meta">
                            <span class="delivery-days"><i class="fas fa-clock"></i> {{ opt.deadline || '---' }} Dias</span>
                        </div>
                        
                        <div v-if="!isQuickMode" class="card-actions">
                             <div v-if="opt.recommendation === 'suggest_whatsapp'" class="wa-btn" @click="openManualFreightModal">
                                 <i class="fab fa-whatsapp"></i> CONSULTAR
                             </div>
                             <div v-else-if="opt.recommendation === 'manual_quote'" class="wa-btn manual-btn" @click="isResultOpen = false; showToastLocal('Solicite a cotação ao departamento de logística.', 'info')">
                                 <i class="fas fa-exclamation-circle"></i> FALAR COM LOGÍSTICA
                             </div>
                             <button v-if="opt.recommendation !== 'manual_quote'" class="btn-select-modern" @click="selectCarrier(opt)">SELECIONAR</button>
                        </div>
                   </div>
               </div>
               
               <div v-if="isQuickMode && freightResults.length > 0" class="modal-footer-center mt-30">
                   <button @click="resetFlow" class="btn-giant">
                       <i class="fas fa-sync-alt"></i> FAZER NOVA CONSULTA
                   </button>
               </div>

               <div v-else-if="freightResults.length === 0" class="empty-freight-msg">
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
                <div class="form-field" style="grid-column: span 2;">
                    <label><i class="fas fa-comment-alt"></i> OBSERVAÇÕES</label>
                    <textarea v-model="completionData.obs" class="table-input" placeholder="Alguma observação adicional?" rows="3" style="resize: none;"></textarea>
                </div>
                <div v-if="isFreightExempt" class="form-field" style="grid-column: span 2; display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                    <input v-model="completionData.exibirFreteIsento" type="checkbox" id="exibir-frete-isento" style="width: 20px; height: 20px; cursor: pointer;">
                    <label for="exibir-frete-isento" style="cursor: pointer; margin-bottom: 0; font-weight: 600; color: #f59e0b;">
                        Exibir valor do frete no PDF (mesmo sendo isento)
                    </label>
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
                    <label>
                        <i class="fas fa-dollar-sign"></i> Valor do Frete (R$)
                        <span v-if="isFreightExempt" style="color: #f59e0b; font-size: 0.75rem; margin-left: 5px;">(ISENTO NO PDF)</span>
                    </label>
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

    <!-- Modal Edição Rápida de Cliente -->
    <div v-if="isEditClientModalOpen" class="modal-overlay" @click.self="isEditClientModalOpen = false">
        <div class="modal-box shadow-lg">
            <h3><i class="fas fa-user-edit" style="color: var(--primary)"></i> Editar Cliente Cadastrado</h3>
            <p style="margin-bottom: 20px; font-size: 0.85rem; color: var(--text-muted)">Altere os campos que desejar para corrigir os dados do cliente.</p>
            
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-field" style="grid-column: span 2;">
                    <label>Razão Social</label>
                    <input v-model="editClientData.razao_social" class="table-input" placeholder="Obrigatório">
                </div>
                <div class="form-field">
                    <label>Nome Fantasia</label>
                    <input v-model="editClientData.fantasia" class="table-input" placeholder="Opcional">
                </div>
                <div class="form-field">
                    <label>CNPJ</label>
                    <input v-model="editClientData.cnpj" class="table-input" placeholder="00.000.000/0000-00">
                </div>
                <div class="form-field">
                    <label>CEP</label>
                    <input v-model="editClientData.cep" class="table-input" placeholder="00000-000">
                </div>
                <div class="form-field">
                    <label>Cidade</label>
                    <input v-model="editClientData.cidade" class="table-input" placeholder="Ex: Londrina">
                </div>
                <div class="form-field">
                    <label>Estado (UF)</label>
                    <input v-model="editClientData.estado" class="table-input" placeholder="Ex: PR" maxlength="2">
                </div>
            </div>

            <div class="modal-actions-grid mt-30">
                <button @click="isEditClientModalOpen = false" class="btn-secondary">Cancelar</button>
                <button @click="saveClientEdit" class="btn-primary" :disabled="isSavingClient">
                    <i v-if="isSavingClient" class="fas fa-spinner fa-spin"></i>
                    {{ isSavingClient ? 'Salvando...' : 'Salvar Alterações' }}
                </button>
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
.cotacao-container { font-family: 'Inter', sans-serif; padding: 20px; max-width: 1250px; margin: 0 auto; color: var(--text-main); }
.quick-mode-header { display: flex; justify-content: center; }
.modal-header { display: flex; justify-content: space-between; align-items: flex-start; }
.btn-reset-quick { background: var(--bg-input); border: 1px solid var(--border); padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer; color: var(--text-muted); transition: 0.3s; }
.btn-reset-quick:hover { background: var(--border); color: var(--text-main); }
.modal-footer-center { display: flex; justify-content: center; padding-bottom: 20px; }

.mode-selector { background: var(--bg-input); padding: 5px; border-radius: 16px; display: flex; gap: 5px; border: 1px solid var(--border); }
.btn-mode { padding: 10px 20px; border-radius: 12px; border: none; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.3s; background: transparent; color: var(--text-muted); display: flex; align-items: center; gap: 8px; }
.btn-mode.active { background: var(--primary); color: white; box-shadow: 0 4px 12px rgba(0, 74, 153, 0.2); }
.mb-20 { margin-bottom: 20px; }
.city-info { font-weight: 800; color: var(--primary); font-size: 0.9rem; }
.test-badge-result { background: var(--bg-input); color: var(--text-muted); padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }

.glass-card { 
    background: var(--bg-surface); 
    padding: 30px; 
    border-radius: 24px; 
    border: 1px solid var(--border); 
    box-shadow: var(--shadow-card); 
    transition: transform 0.3s ease;
}

.card-title { 
    font-weight: 850; 
    margin-bottom: 20px; 
    display: flex; 
    align-items: center; 
    gap: 10px; 
    font-size: 1rem;
    color: var(--primary);
    text-transform: uppercase;
    letter-spacing: 1px;
}

.pill-input { 
    width: 100%; 
    padding: 15px 20px; 
    border-radius: 12px; 
    border: 2px solid var(--border); 
    background: var(--bg-input); 
    font-size: 1rem; 
    color: var(--text-main); 
    transition: 0.3s;
    font-weight: 600;
}

.search-input { cursor: pointer; }
.search-input:hover { border-color: var(--primary); background: var(--white); }

.info-tags { display: flex; gap: 10px; margin-top: 15px; }
.tag { padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 800; background: var(--bg-input); color: var(--text-muted); }

.flex-between { display: flex; justify-content: space-between; align-items: center; }
.badge { background: var(--primary); color: white; padding: 4px 12px; border-radius: 99px; font-size: 0.8rem; font-weight: 800; }

.table-scroll { overflow-x: auto; margin-top: 15px; }
.items-table { width: 100%; border-collapse: collapse; }
.items-table th { text-align: left; padding: 12px; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; border-bottom: 2px solid var(--border); }
.items-table td { padding: 12px; border-bottom: 1px solid var(--border); }

.table-input { 
    width: 100%; 
    background: var(--bg-input); 
    border: 1px solid var(--border); 
    padding: 10px; 
    border-radius: 8px; 
    color: var(--text-main); 
    font-weight: 700;
}

.table-input:focus { border-color: var(--primary); outline: none; }
.center { text-align: center; }
.locked { background: var(--border); opacity: 0.6; cursor: not-allowed; }
.money { color: var(--primary); }

.dim-group { display: flex; align-items: center; gap: 4px; }
.dim-input { width: 60px; padding: 8px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; text-align: center; font-weight: 700; }
.dim-sep { font-size: 0.8rem; color: var(--text-muted); font-weight: 800; }

.total-col { font-weight: 900; color: var(--text-main); }
.btn-del { color: #ef4444; background: none; border: none; font-size: 1.5rem; cursor: pointer; opacity: 0.6; transition: 0.2s; }
.btn-del:hover { opacity: 1; transform: scale(1.2); }

.btn-add { 
    margin-top: 15px; 
    background: var(--bg-input); 
    border: 2px dashed var(--border); 
    color: var(--text-muted); 
    padding: 10px 20px; 
    border-radius: 12px; 
    font-weight: 700; 
    cursor: pointer; 
    width: 100%;
    transition: 0.3s;
}
.btn-add:hover { border-color: var(--primary); color: var(--primary); background: var(--white); }

.action-bar { margin-top: 30px; text-align: center; }
.btn-giant { 
    background: var(--primary); 
    color: white; 
    border: none; 
    padding: 20px 60px; 
    border-radius: 18px; 
    font-size: 1.2rem; 
    font-weight: 900; 
    cursor: pointer; 
    transition: 0.3s ease;
    box-shadow: 0 10px 20px rgba(0, 74, 153, 0.2);
}
.btn-giant:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(0, 74, 153, 0.3); }
.btn-giant:disabled { opacity: 0.7; cursor: not-allowed; }

/* Modal Styles */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal-box { 
    background: var(--bg-surface); 
    border-radius: 24px; 
    padding: 40px; 
    width: 100%; 
    max-width: 600px; 
    box-shadow: var(--shadow-card); 
    border: 1px solid var(--border); 
    max-height: 90vh;
    overflow-y: auto;
}
.modal-box.giant { max-width: 1000px; }

.results-list { margin-top: 20px; max-height: 400px; overflow-y: auto; }
.result-item { padding: 15px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
.result-item:hover { background: var(--bg-input); }

.mt-20 { margin-top: 20px; }
.mt-10 { margin-top: 10px; }
.mt-30 { margin-top: 30px; }

@media (max-width: 768px) {
  .grid-2 { grid-template-columns: 1fr; gap: 15px; }
  .cotacao-container { padding: 10px; }
  .glass-card { padding: 15px; }
  
  .card-title { font-size: 0.9rem; }
  .pill-input { padding: 10px 15px; font-size: 0.9rem; }
  
  .items-table thead { display: none; }
  .items-table, .items-table tbody, .items-table tr, .items-table td { display: block; width: 100%; }
  .items-table tr { margin-bottom: 20px; padding: 15px; border: 1px solid var(--border); border-radius: 15px; background: var(--bg-input); position: relative; }
  .items-table td { padding: 5px 0; border: none; }
  
  .items-table td:not(:last-child)::before { content: attr(placeholder) "" ; font-weight: 800; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 2px; }
  
  .btn-del { position: absolute; top: 10px; right: 10px; }
  .dim-group { justify-content: space-between; padding: 10px; }
  .dim-input { width: 30%; }
  
  .modal-box { padding: 20px; width: 98%; }
  .modal-actions-grid { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: 1fr; gap: 15px; }
  
  .freight-modern-grid { grid-template-columns: 1fr; }
  .action-buttons-final { flex-direction: column; }
  .btn-giant { padding: 15px; font-size: 1rem; }
}

@keyframes spin { to { transform: rotate(360deg); } }
.animate-pop { animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes pop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

.wa-warning-inline { 
    background: #f0fdf4; 
    border: 1px solid #bbfcce; 
    color: #166534; 
    padding: 10px; 
    border-radius: 12px; 
    font-size: 0.8rem; 
    font-weight: 700; 
    display: flex; 
    align-items: center; 
    gap: 8px; 
}

/* --- FREIGHT RESULTS PREMIUM STYLES --- */
.modal-header { margin-bottom: 25px; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
.header-titles h3 { font-size: 1.4rem; font-weight: 900; color: var(--text-main); margin: 0; }
.modal-subtitle { font-size: 0.9rem; color: var(--text-muted); font-weight: 600; margin-top: 4px; }

.modal-scroll-area { max-height: 65vh; overflow-y: auto; padding-right: 10px; }

/* --- LOADING & SUCCESS STATES --- */
.finishing-state, .finished-state { padding: 40px 20px; }
.spinner-big { 
    width: 60px; height: 60px; 
    border: 5px solid var(--border); 
    border-top: 5px solid var(--primary); 
    border-radius: 50%; 
    animation: spin 1s linear infinite; 
    margin: 0 auto 20px; 
}
.success-icon { font-size: 4rem; color: #10b981; margin-bottom: 20px; }
.action-buttons-final { display: flex; gap: 15px; justify-content: center; margin-top: 25px; }

.text-center { text-align: center; }
.full-width { width: 100%; }
.mt-15 { margin-top: 15px; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.form-field { display: flex; flex-direction: column; gap: 8px; }
.form-field label { font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; }

.modal-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.btn-primary { background: var(--primary); color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; }
.btn-primary:hover { filter: brightness(1.1); transform: translateY(-2px); }
.btn-secondary { background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border); padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; }
.btn-secondary:hover { background: var(--border); }

/* Estilo Moderno de Resultados de Frete (Grid de Cards) */
.freight-modern-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
    padding: 10px;
}

.freight-modern-card {
    background: var(--bg-surface);
    border: 2px solid var(--border);
    border-radius: 20px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
}

.freight-modern-card:hover {
    transform: translateY(-5px);
    border-color: var(--primary);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.freight-modern-card.best_option {
    border-color: var(--primary);
    background: rgba(37, 99, 235, 0.02);
}

.freight-modern-card.best_option::before {
    content: 'MELHOR OPÇÃO';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: var(--primary);
    color: white;
    font-size: 0.65rem;
    font-weight: 900;
    padding: 4px;
    letter-spacing: 1px;
}

.freight-modern-card.manual_quote {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.02);
}

.freight-modern-card.manual_quote::before {
    content: 'AÇÃO REQUERIDA';
    position: absolute;
    top: 0; left: 0; right: 0;
    background: #f59e0b;
    color: white;
    font-size: 0.65rem;
    font-weight: 900;
    padding: 4px;
    letter-spacing: 1px;
}

.manual-btn {
    background: #f59e0b !important;
}

.brand-icon {
    font-size: 1.5rem;
    color: var(--primary);
    margin-bottom: 12px;
}

.card-brand h4 {
    font-size: 1.1rem;
    font-weight: 850;
    margin: 0;
    color: var(--text-main);
    text-transform: uppercase;
}

.modal-instruction {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-align: center;
    margin-bottom: 10px;
}

.input-with-button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.btn-edit-client {
    background: var(--bg-input);
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 12px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    flex-shrink: 0;
}

.btn-edit-client:hover {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.badge-exempt {
    background: #fef3c7;
    color: #d97706;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 800;
    border: 1px solid #fde68a;
    display: flex;
    align-items: center;
    gap: 4px;
}

.service-name {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 600;
    margin-top: 4px;
}

.card-pricing {
    margin: 15px 0;
    padding: 12px;
    background: var(--bg-input);
    border-radius: 12px;
    width: 100%;
}

.main-price {
    font-size: 1.4rem;
    font-weight: 900;
    color: var(--primary);
}

.perc-badge {
    font-size: 0.7rem;
    font-weight: 800;
    color: var(--text-muted);
}

.card-meta {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 20px;
}

.delivery-days i {
    color: var(--primary);
    margin-right: 4px;
}

.card-actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.btn-select-modern {
    width: 100%;
    padding: 12px;
    border-radius: 10px;
    background: var(--primary);
    color: white;
    border: none;
    font-weight: 800;
    font-size: 0.85rem;
    cursor: pointer;
    transition: 0.2s;
}

.btn-select-modern:hover {
    filter: brightness(1.1);
    transform: scale(1.02);
}

.wa-btn {
    width: 100%;
    padding: 8px;
    border-radius: 10px;
    background: #25d366;
    color: white;
    font-size: 0.75rem;
    font-weight: 900;
    cursor: pointer;
    transition: 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.wa-btn:hover {
    filter: brightness(1.1);
}

.spinner {
    width: 20px; height: 20px;
    border: 3px solid rgba(0,0,0,0.1);
    border-top: 3px solid var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.btn-spinner {
    display: inline-block;
    width: 20px; height: 20px;
    border: 3px solid rgba(255,255,255,0.3);
    border-top: 3px solid white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 10px;
    vertical-align: middle;
}

.ipi-input-container {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
}

.btn-lock {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 0.85rem;
    transition: color 0.2s;
    display: inline-flex;
    align-items: center;
}

.btn-lock:hover {
    color: var(--primary);
}

.btn-lock i {
    font-size: 0.85rem;
}
</style>
