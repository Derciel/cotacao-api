<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { safeFetch } from '../utils/api-utils';
import * as XLSX from 'xlsx';

declare global {
  interface Window {
    L: any;
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  }
}

// Interfaces
interface ClientStop {
  id?: number;
  razao_social: string;
  cnpj: string;
  cep: string;
  cidade: string;
  estado: string;
  sequence: number;
  lat?: number;
  lon?: number;
}

// Estados
const activeTab = ref<'simple' | 'excel'>('simple');
const clients = ref<any[]>([]);
const selectedClientId = ref<number | null>(null);

// Parâmetros Logísticos
const originCep = ref('86087-350'); // CEP padrão Londrina/PR
const truckConsumo = ref(3.5); // km/l padrão
const fuelType = ref<'dieselS10' | 'gasolina' | 'etanol'>('dieselS10');
const fuelPrice = ref(5.88); // Valor médio padrão para PR
const vehicleType = ref<'driving-car' | 'driving-hgv'>('driving-car');
const truckHeight = ref(4.4); // Altura padrão do caminhão em metros
const truckAxles = ref(6); // Número de eixos (para multiplicador de pedágio)
const manualStops = ref<ClientStop[]>([]);

// Planilha Modo Excel
const excelFile = ref<File | null>(null);
const excelRows = ref<any[]>([]);
const isExcelLoaded = ref(false);
const cnpjsToResolve = ref<string[]>([]);
const isResolvingClients = ref(false);
const resolvedExcelStops = ref<ClientStop[]>([]);
const excelRowsByCnpj = ref<Record<string, any[]>>({});

// Estados Globais de Processamento
const isSearching = ref(false);
const routeCalculated = ref(false);

const routeDetails = ref({
  distance: 0,
  duration: '',
  liters: 0,
  cost: 0,
  tollsCount: 0
});

// Paradas ordenadas finais da rota atual
const finalRouteStops = ref<ClientStop[]>([]);

// Cache local de preços de combustíveis por UF
const fuelPricesCache = ref<any>(null);

// Leaflet Map e Camadas
const map = ref<any>(null);
const routeLayer = ref<any>(null);
const markers = ref<any[]>([]);

onMounted(async () => {
  await fetchClients();
  await fetchFuelPrices();
  initMap();
});

const fetchClients = async () => {
  try {
    const res = await safeFetch('/api/clients?limit=200');
    if (res.ok && res.data) {
      clients.value = Array.isArray(res.data) ? res.data : (res.data.data || []);
    }
  } catch (e) {
    console.error('Erro ao buscar clientes:', e);
  }
};

// Estados dos Modais de Cliente
const showRegisterModal = ref(false);
const showViewClientModal = ref(false);
const viewClientSearch = ref('');
const inspectedClient = ref<any>(null);

const isSearchingCNPJ = ref(false);
const isSavingClient = ref(false);

const newClientForm = ref({
  cnpj: '',
  razao_social: '',
  fantasia: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  estado: '',
  inscricao_estadual: '',
  telefone: '',
  empresa_faturamento: 'NICOPEL'
});

// Ações do Modal de Cadastro
const openRegisterClientModal = () => {
  newClientForm.value = {
    cnpj: '', razao_social: '', fantasia: '', cep: '',
    logradouro: '', numero: '', bairro: '', cidade: '',
    estado: '', inscricao_estadual: '', telefone: '',
    empresa_faturamento: 'NICOPEL'
  };
  showRegisterModal.value = true;
};

const lookupNewClientCNPJ = async () => {
  const cnpjClean = newClientForm.value.cnpj.replace(/\D/g, '');
  if (cnpjClean.length !== 14 && cnpjClean.length !== 11) {
    return window.showToast('Digite um CNPJ válido com 14 dígitos ou CPF com 11 dígitos.', 'warning');
  }

  isSearchingCNPJ.value = true;
  try {
    const res = await safeFetch(`/api/clients/cnpj/${cnpjClean}`);
    if (res.ok && res.data && res.data.data) {
      const d = res.data.data;
      newClientForm.value.razao_social = d.razao_social || '';
      newClientForm.value.fantasia = d.fantasia || '';
      newClientForm.value.cep = d.cep || '';
      newClientForm.value.cidade = d.cidade || '';
      newClientForm.value.estado = d.estado || '';
      
      if (res.data.isAlreadyRegistered) {
        window.showToast('Este cliente já está cadastrado no sistema.', 'info');
      } else {
        window.showToast('Dados da empresa localizados na Receita!', 'success');
      }
      
      if (newClientForm.value.cep) lookupNewClientCEP();
    } else {
      window.showToast('CNPJ não localizado na busca externa. Preencha os dados manualmente.', 'warning');
    }
  } catch (e) {
    window.showToast('Erro ao consultar CNPJ.', 'error');
  } finally {
    isSearchingCNPJ.value = false;
  }
};

const lookupNewClientCEP = async () => {
  const cepClean = newClientForm.value.cep.replace(/\D/g, '');
  if (cepClean.length !== 8) return;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepClean}`);
    const d = await res.json();
    if (res.ok) {
      newClientForm.value.logradouro = d.street || '';
      newClientForm.value.bairro = d.neighborhood || '';
      newClientForm.value.cidade = d.city || '';
      newClientForm.value.estado = d.state || '';
    }
  } catch (e) {
    console.error("Erro CEP:", e);
  }
};

const saveNewClient = async (e: Event) => {
  e.preventDefault();
  const cnpjClean = newClientForm.value.cnpj.replace(/\D/g, '');
  const cepClean = newClientForm.value.cep.replace(/\D/g, '');

  if (!cnpjClean || (cnpjClean.length !== 14 && cnpjClean.length !== 11)) {
    return window.showToast('Digite um CNPJ/CPF válido.', 'warning');
  }
  if (!newClientForm.value.razao_social.trim()) {
    return window.showToast('Preencha a Razão Social.', 'warning');
  }
  if (!cepClean || cepClean.length !== 8) {
    return window.showToast('Digite um CEP válido com 8 dígitos.', 'warning');
  }
  if (!newClientForm.value.cidade.trim() || !newClientForm.value.estado) {
    return window.showToast('Preencha Cidade e Estado.', 'warning');
  }

  isSavingClient.value = true;
  try {
    const res = await safeFetch('/api/clients', {
      method: 'POST',
      body: JSON.stringify({
        ...newClientForm.value,
        cnpj: cnpjClean,
        cep: cepClean
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok && res.data) {
      window.showToast('Cliente cadastrado com sucesso no banco de dados!', 'success');
      await fetchClients();
      const createdId = res.data.id || (clients.value.find(c => c.cnpj === cnpjClean)?.id);
      if (createdId) {
        selectedClientId.value = createdId;
      }
      showRegisterModal.value = false;
    } else {
      window.showToast(res.data?.message || 'Erro ao salvar cliente.', 'error');
    }
  } catch (e) {
    window.showToast('Erro na comunicação com o servidor.', 'error');
  } finally {
    isSavingClient.value = false;
  }
};

// Ações do Modal de Visualização / Consulta de Clientes
const openViewClientModal = () => {
  viewClientSearch.value = '';
  if (selectedClientId.value) {
    inspectedClient.value = clients.value.find(c => c.id === selectedClientId.value) || null;
  } else {
    inspectedClient.value = null;
  }
  showViewClientModal.value = true;
};

const selectClientFromModal = (client: any) => {
  selectedClientId.value = client.id;
  showViewClientModal.value = false;
  window.showToast(`Cliente "${client.razao_social}" selecionado.`, 'info');
};

const filteredModalClients = computed(() => {
  const q = viewClientSearch.value.toLowerCase().trim();
  if (!q) return clients.value;
  return clients.value.filter(c => 
    (c.razao_social && c.razao_social.toLowerCase().includes(q)) ||
    (c.cnpj && c.cnpj.includes(q)) ||
    (c.cidade && c.cidade.toLowerCase().includes(q)) ||
    (c.estado && c.estado.toLowerCase().includes(q)) ||
    (c.fantasia && c.fantasia.toLowerCase().includes(q))
  );
});

const fetchFuelPrices = async () => {
  try {
    const res = await safeFetch('/api/fuels/average');
    if (res.ok && res.data) {
      fuelPricesCache.value = res.data;
    }
  } catch (e) {
    console.error('Erro ao buscar preços de combustível:', e);
  }
};

// Inicialização do Mapa Leaflet
const initMap = () => {
  if (typeof window === 'undefined' || !window.L) return;

  const L = window.L;
  
  // Londrina/PR por padrão
  map.value = L.map('map-container').setView([-23.3106, -51.1628], 12);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const tileUrl = isDark 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  L.tileLayer(tileUrl, {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map.value);
};

// Observar mudança de tema para atualizar o mapa dinamicamente
if (typeof window !== 'undefined') {
  const observer = new MutationObserver(() => {
    if (!map.value || !window.L) return;
    const L = window.L;
    
    map.value.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) {
        map.value.removeLayer(layer);
      }
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const tileUrl = isDark 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map.value);
  });

  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

// Observa o tipo de combustível
watch(fuelType, () => {
  updateFuelPrice();
});

const updateFuelPrice = () => {
  if (manualStops.value.length > 0 && fuelPricesCache.value) {
    // Pega o estado da primeira parada para ajustar o preço
    const uf = (manualStops.value[0].estado || 'PR').toUpperCase();
    const prices = fuelPricesCache.value[uf] || { dieselS10: 6.05, gasolina: 5.90, etanol: 3.98 };
    fuelPrice.value = Number(prices[fuelType.value]);
  }
};

// --- GEOCÓDIGO RESILIENTE DE 3 CAMADAS (Sem erros de CEP!) ---
const geocodeText = async (text: string): Promise<[number, number] | null> => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    }
  } catch (e) {
    // Silenciado
  }
  return null;
};

const geocodeCepResilient = async (cep: string, cidade?: string, estado?: string): Promise<[number, number]> => {
  const clean = cep.replace(/\D/g, '');
  const city = (cidade || '').trim();
  const uf = (estado || '').trim().toUpperCase();

  // 1. Tentar Brasil API v2 (Coordenadas Geográficas Diretas do CEP)
  if (clean.length === 8) {
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
      if (res.ok) {
        const data = await res.json();
        if (data.location && data.location.coordinates) {
          const lat = parseFloat(data.location.coordinates.latitude);
          const lon = parseFloat(data.location.coordinates.longitude);
          if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
            return [lat, lon];
          }
        }
      }
    } catch (e) {
      // Falhou silenciosamente, vai para a camada 2
    }
  }

  // 2. Tentar ViaCEP + Nominatim (Rua + Bairro + Cidade)
  let rua = '';
  let bairro = '';
  let resolvedCity = city;
  let resolvedUf = uf;

  if (clean.length === 8) {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (data && !data.erro) {
          rua = data.logradouro || '';
          bairro = data.bairro || '';
          resolvedCity = data.localidade || resolvedCity;
          resolvedUf = data.uf || resolvedUf;
        }
      }
    } catch (e) {
      // Falhou silenciosamente
    }
  }

  // Se temos Cidade e Estado, podemos geocodificar por texto de forma precisa
  if (resolvedCity && resolvedUf) {
    // 2.1 Tentar Rua, Cidade, Estado
    if (rua) {
      const q = `${rua}, ${resolvedCity} - ${resolvedUf}, Brazil`;
      const coords = await geocodeText(q);
      if (coords) return coords;
    }

    // 2.2 Tentar Bairro, Cidade, Estado
    if (bairro) {
      const q = `${bairro}, ${resolvedCity} - ${resolvedUf}, Brazil`;
      const coords = await geocodeText(q);
      if (coords) return coords;
    }

    // 2.3 Tentar Cidade, Estado
    const q = `${resolvedCity} - ${resolvedUf}, Brazil`;
    const coords = await geocodeText(q);
    if (coords) return coords;
  }

  // 3. Fallback absoluto baseado no Estado (Evita que o mapa quebre em CEPs inexistentes/novos/rurais)
  const fallbacksByUf: Record<string, [number, number]> = {
    'AC': [-9.974, -67.807], 'AL': [-9.665, -35.735], 'AP': [0.034, -51.069], 'AM': [-3.119, -60.021],
    'BA': [-12.971, -38.51], 'CE': [-3.717, -38.543], 'DF': [-15.793, -47.882], 'ES': [-20.315, -40.312],
    'GO': [-16.686, -49.264], 'MA': [-2.53, -44.302], 'MT': [-15.601, -56.097], 'MS': [-20.442, -54.646],
    'MG': [-19.92, -43.937], 'PA': [-1.455, -48.502], 'PB': [-7.115, -34.863], 'PR': [-25.428, -49.273],
    'PE': [-8.053, -34.881], 'PI': [-5.089, -42.801], 'RJ': [-22.906, -43.178], 'RN': [-5.794, -35.211],
    'RS': [-30.034, -51.217], 'RO': [-8.761, -63.903], 'RR': [2.819, -60.673], 'SC': [-27.595, -48.548],
    'SP': [-23.55, -46.633], 'SE': [-10.911, -37.073], 'TO': [-10.167, -48.331]
  };

  return fallbacksByUf[resolvedUf.toUpperCase()] || [-23.55, -46.633]; // Fallback final (São Paulo/SP)
};

// Formatar duração da viagem
const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h e ${m}min`;
  }
  return `${m} min`;
};

// Limpar elementos antigos do mapa
const clearMap = () => {
  if (!map.value || !window.L) return;
  const L = window.L;

  if (routeLayer.value) {
    map.value.removeLayer(routeLayer.value);
    routeLayer.value = null;
  }

  markers.value.forEach(m => map.value.removeLayer(m));
  markers.value = [];
};

// MÉTODOS MODO SIMPLES (Multi-Clientes Manual)
const addClientToRoute = () => {
  if (!selectedClientId.value) {
    return window.showToast('Selecione um cliente para adicionar.', 'warning');
  }

  const client = clients.value.find(c => c.id === selectedClientId.value);
  if (client) {
    const alreadyExists = manualStops.value.some(s => s.cnpj === client.cnpj);
    if (alreadyExists) {
      return window.showToast('Este cliente já está adicionado na rota.', 'info');
    }

    manualStops.value.push({
      id: client.id,
      razao_social: client.razao_social,
      cnpj: client.cnpj,
      cep: client.cep,
      cidade: client.cidade,
      estado: client.estado,
      sequence: manualStops.value.length + 1
    });

    selectedClientId.value = null;
    updateFuelPrice();
    window.showToast('Parada adicionada com sucesso!', 'success');
  }
};

const removeStop = (index: number) => {
  manualStops.value.splice(index, 1);
  // Reordena sequências
  manualStops.value.forEach((stop, i) => {
    stop.sequence = i + 1;
  });
  window.showToast('Parada removida.', 'info');
};

const moveStopUp = (index: number) => {
  if (index === 0) return;
  const temp = manualStops.value[index];
  manualStops.value[index] = manualStops.value[index - 1];
  manualStops.value[index - 1] = temp;
  
  // Atualiza sequences
  manualStops.value.forEach((stop, i) => {
    stop.sequence = i + 1;
  });
};

const moveStopDown = (index: number) => {
  if (index === manualStops.value.length - 1) return;
  const temp = manualStops.value[index];
  manualStops.value[index] = manualStops.value[index + 1];
  manualStops.value[index + 1] = temp;

  // Atualiza sequences
  manualStops.value.forEach((stop, i) => {
    stop.sequence = i + 1;
  });
};

// MÉTODOS MODO EXCEL (Upload e Processamento)
const handleExcelDrop = (e: DragEvent) => {
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    processExcelFile(files[0]);
  }
};

const handleExcelUpload = (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    processExcelFile(files[0]);
  }
};

const processExcelFile = (file: File) => {
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return window.showToast('Por favor, carregue um arquivo Excel válido (.xlsx ou .xls).', 'error');
  }

  excelFile.value = file;
  isExcelLoaded.value = false;
  excelRows.value = [];
  cnpjsToResolve.value = [];
  excelRowsByCnpj.value = {};

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];

      if (rows.length === 0) {
        return window.showToast('A planilha carregada está vazia.', 'warning');
      }

      excelRows.value = rows;
      isExcelLoaded.value = true;

      // Localizar coluna do CNPJ do destinatário
      const sampleRow = rows[0];
      const cnpjKey = Object.keys(sampleRow).find(key => 
        /cnpjdest|cnpj|cnpj\/cpf|cpf\/cnpj/gi.test(key)
      );

      if (cnpjKey) {
        // Agrupar linhas da planilha pelo CNPJ normalizado com zeros à esquerda
        const rowsMap: Record<string, any[]> = {};
        rows.forEach(r => {
          const cnpjRaw = String(r[cnpjKey] || '').replace(/\D/g, '');
          if (cnpjRaw) {
            const cnpj = cnpjRaw.padStart(14, '0');
            if (!rowsMap[cnpj]) rowsMap[cnpj] = [];
            rowsMap[cnpj].push(r);
          }
        });

        excelRowsByCnpj.value = rowsMap;
        cnpjsToResolve.value = Object.keys(rowsMap);
        window.showToast(`Planilha processada! Encontrados ${rows.length} pedidos e ${cnpjsToResolve.value.length} CNPJs únicos.`, 'success');
      } else {
        window.showToast('Coluna de CNPJ do destinatário não encontrada no arquivo Excel. Mapeamento manual de clientes necessário.', 'warning');
      }
    } catch (err: any) {
      console.error(err);
      window.showToast('Erro ao ler a planilha Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
};

// RESOLVER CLIENTES E CADASTRAR AUTOMATICAMENTE VIA BACKEND
const resolveBatchClients = async () => {
  if (cnpjsToResolve.value.length === 0) {
    return window.showToast('Nenhum CNPJ válido para processar.', 'warning');
  }

  isResolvingClients.value = true;
  resolvedExcelStops.value = [];

  try {
    const res = await safeFetch('/api/clients/resolve-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpjs: cnpjsToResolve.value })
    });

    if (res.ok && Array.isArray(res.data)) {
      const apiClients = res.data;
      
      // Mapear clientes retornados para ClientStop vinculando seus respectivos pedidos e itens da planilha
      resolvedExcelStops.value = apiClients.map((c: any, index: number) => {
        const items = excelRowsByCnpj.value[c.cnpj] || [];
        const pedidos = Array.from(new Set(items.map(it => it['PEDIDO'] || it['Pedido'] || ''))).filter(Boolean);
        return {
          id: c.id,
          razao_social: c.razao_social,
          cnpj: c.cnpj,
          cep: c.cep,
          cidade: c.cidade,
          estado: c.estado,
          sequence: index + 1,
          pedidosList: pedidos.map(p => String(p)),
          itemsList: items
        };
      });

      window.showToast(`Sucesso! ${resolvedExcelStops.value.length} clientes resolvidos e cadastrados no banco de dados local!`, 'success');
    } else {
      window.showToast('Erro ao processar clientes no backend.', 'error');
    }
  } catch (e: any) {
    console.error(e);
    window.showToast('Erro na requisição em lote para o backend: ' + e.message, 'error');
  } finally {
    isResolvingClients.value = false;
  }
};

// CÁLCULO GERAL E TRAÇADO DA ROTA (Simples ou Lote)
const processAndCalculateRoute = async () => {
  // Pega as paradas iniciais dependendo do modo
  let stopsToProcess: ClientStop[] = [];
  if (activeTab.value === 'simple') {
    stopsToProcess = [...manualStops.value];
  } else {
    stopsToProcess = [...resolvedExcelStops.value];
  }

  if (stopsToProcess.length === 0) {
    return window.showToast('Nenhuma parada de cliente definida para a rota.', 'warning');
  }

  if (!originCep.value) {
    return window.showToast('Informe o CEP de Origem.', 'warning');
  }

  isSearching.value = true;
  routeCalculated.value = false;
  clearMap();

  try {
    // 1. Geocodificar Origem
    const originCoords = await geocodeText(`Londrina - PR, 86087-350, Brazil`); // CEP Origem de fallback se der erro
    const actualOriginCoords = await geocodeCepResilient(originCep.value, 'Londrina', 'PR');
    const finalOrigin = actualOriginCoords || originCoords;

    if (!finalOrigin) {
      isSearching.value = false;
      return window.showToast('Erro ao geocodificar o CEP de Origem.', 'error');
    }

    // 2. Geocodificar todos os Destinos
    window.showToast('Geocodificando endereços de forma ultra-resiliente...', 'info');
    const geocodedStops: ClientStop[] = [];

    for (const stop of stopsToProcess) {
      try {
        const coords = await geocodeCepResilient(stop.cep, stop.cidade, stop.estado);
        geocodedStops.push({
          ...stop,
          lat: coords[0],
          lon: coords[1]
        });
      } catch (err) {
        console.warn(`Erro na geocodificação do cliente ${stop.razao_social}:`, err);
      }
    }

    if (geocodedStops.length === 0) {
      isSearching.value = false;
      return window.showToast('Nenhum endereço de entrega pôde ser localizado.', 'error');
    }

    // 3. Otimização de Rota (Algoritmo do Vizinho Mais Próximo - TSP) se for planilha
    let orderedStops: ClientStop[] = [];
    
    // Configurações do OpenRouteService
    const apiKey = import.meta.env.VITE_ORS_API_KEY || '';
    
    if (activeTab.value === 'excel') {
      window.showToast('Otimizando circuito de entregas...', 'info');
      
      const unvisited = [...geocodedStops];
      
      // Tentativa de Otimização Profissional via OpenRouteService (VROOM)
      let optimizationSuccess = false;
      
      if (apiKey) {
        try {
          const optPayload = {
            jobs: unvisited.map((stop, index) => ({
              id: index + 1,
              service: 300, // 5 minutos por entrega
              location: [stop.lon, stop.lat]
            })),
            vehicles: [
              {
                id: 1,
                profile: vehicleType.value,
                start: [finalOrigin[1], finalOrigin[0]]
              }
            ]
          };

          const optRes = await fetch('https://api.openrouteservice.org/optimization', {
            method: 'POST',
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(optPayload)
          });

          if (optRes.ok) {
            const optData = await optRes.json();
            if (optData.routes && optData.routes.length > 0 && optData.routes[0].steps) {
              const steps = optData.routes[0].steps;
              
              // Reconstrói a ordem baseada na resposta da API
              orderedStops = steps
                .filter((step: any) => step.type === 'job')
                .map((step: any) => {
                  const jobIndex = step.job - 1; // o id era index + 1
                  return unvisited[jobIndex];
                });
                
              optimizationSuccess = true;
              console.log('[Roteirização] Otimizada com sucesso via VROOM (ORS)!');
            }
          } else {
             console.warn('[Roteirização] Falha na API de otimização ORS. Código:', optRes.status);
          }
        } catch (e) {
          console.warn('[Roteirização] Erro ao conectar com API de Otimização ORS.', e);
        }
      }

      // Fallback: Algoritmo Local (Vizinho Mais Próximo) caso ORS falhe ou sem chave
      if (!optimizationSuccess) {
        console.log('[Roteirização] Usando fallback local (Vizinho Mais Próximo).');
        orderedStops = [];
        let currentLat = finalOrigin[0];
        let currentLon = finalOrigin[1];

        while (unvisited.length > 0) {
          let nearestIndex = 0;
          let minDistance = Infinity;

          for (let i = 0; i < unvisited.length; i++) {
            const stop = unvisited[i];
            if (stop.lat && stop.lon) {
              const d = Math.sqrt(Math.pow(stop.lat - currentLat, 2) + Math.pow(stop.lon - currentLon, 2));
              if (d < minDistance) {
                minDistance = d;
                nearestIndex = i;
              }
            }
          }

          const nextStop = unvisited.splice(nearestIndex, 1)[0];
          currentLat = nextStop.lat!;
          currentLon = nextStop.lon!;
          orderedStops.push(nextStop);
        }
      }

      // Atualiza sequences
      orderedStops.forEach((stop, i) => {
        stop.sequence = i + 1;
      });
    } else {
      // No modo manual simples, mantém a ordem exata inserida pelo usuário
      orderedStops = [...geocodedStops];
    }

    finalRouteStops.value = orderedStops;

    // 4. Traçar a Rota Real nas Estradas
    let routeGeometry = null;
    let distanceKm = 0;
    let durationStr = '';

    if (apiKey) {
      // Traçado usando OpenRouteService (Suporta caminhões e perfil real)
      const coordinates = [
        [finalOrigin[1], finalOrigin[0]],
        ...orderedStops.map(s => [s.lon, s.lat])
      ];

      let options = {};
      if (vehicleType.value === 'driving-hgv') {
        options = {
          profile_params: {
            restrictions: {
              height: truckHeight.value,
              length: 15,
              weight: 20
            }
          }
        };
      }

      const payload = {
        coordinates: coordinates,
        ...options,
        elevation: false,
        instructions: false
      };

      const osrmUrl = `https://api.openrouteservice.org/v2/directions/${vehicleType.value}/geojson`;
      const resRoute = await fetch(osrmUrl, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!resRoute.ok) {
        isSearching.value = false;
        return window.showToast('Erro ao traçar rota real no OpenRouteService. Verifique os limites da chave.', 'error');
      }

      const routeData = await resRoute.json();
      if (!routeData.features || routeData.features.length === 0) {
        isSearching.value = false;
        return window.showToast('Nenhuma rota viária viável encontrada entre os pontos.', 'warning');
      }

      const route = routeData.features[0];
      distanceKm = route.properties.summary.distance / 1000; 
      durationStr = formatDuration(route.properties.summary.duration);
      routeGeometry = route.geometry;
    } else {
      // Fallback para OSRM público (Não suporta perfil de caminhão)
      const originSegment = `${finalOrigin[1]},${finalOrigin[0]}`;
      const stopsSegment = orderedStops.map(s => `${s.lon},${s.lat}`).join(';');
      const coordinatesUrl = `${originSegment};${stopsSegment}`;

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinatesUrl}?overview=full&geometries=geojson`;
      const resRoute = await fetch(osrmUrl);
      
      if (!resRoute.ok) {
        isSearching.value = false;
        return window.showToast('Erro ao traçar rota no servidor público OSRM.', 'error');
      }

      const routeData = await resRoute.json();
      if (!routeData.routes || routeData.routes.length === 0) {
        isSearching.value = false;
        return window.showToast('Nenhuma rota viária viável encontrada entre os pontos.', 'warning');
      }

      const route = routeData.routes[0];
      distanceKm = route.distance / 1000; 
      durationStr = formatDuration(route.duration);
      routeGeometry = route.geometry;
    }

    // 5. Cálculos Financeiros/Logísticos
    const totalLiters = distanceKm / truckConsumo.value;
    const totalCost = totalLiters * fuelPrice.value;

    routeDetails.value = {
      distance: Number(distanceKm.toFixed(1)),
      duration: durationStr,
      liters: Number(totalLiters.toFixed(1)),
      cost: Number(totalCost.toFixed(2))
    };

    // 6. Desenhar Rota no Leaflet
    const L = window.L;
    
    routeLayer.value = L.geoJSON(routeGeometry, {
      style: {
        color: '#10b981',
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }
    }).addTo(map.value);

    // Marcador de Origem (Partida)
    const iconOrigem = L.divIcon({
      html: '<div class="marker-pin pin-origin"><i class="fas fa-play"></i></div>',
      className: 'custom-div-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });

    const markerOrigem = L.marker(finalOrigin, { icon: iconOrigem })
      .bindPopup(`<strong>Origem (Partida)</strong><br>CEP: ${originCep.value}`)
      .addTo(map.value);
    
    markers.value.push(markerOrigem);

    // Marcadores de Paradas (Entregas)
    orderedStops.forEach((stop, i) => {
      const iconStop = L.divIcon({
        html: `<div class="marker-pin pin-dest"><span>${stop.sequence}</span></div>`,
        className: 'custom-div-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });

      const markerStop = L.marker([stop.lat!, stop.lon!], { icon: iconStop })
        .bindPopup(`<strong>Parada ${stop.sequence}</strong><br>Cliente: ${stop.razao_social}<br>Cidade: ${stop.cidade} - ${stop.estado}<br>CEP: ${stop.cep}`)
        .addTo(map.value);

      markers.value.push(markerStop);
    });

    // Enquadramento
    const allCoords = [finalOrigin, ...orderedStops.map(s => [s.lat!, s.lon!] as [number, number])];
    const bounds = L.latLngBounds(allCoords);
    map.value.fitBounds(bounds, { padding: [50, 50] });

    // 7. Identificar Praças de Pedágio e Custo Total na Rota
    await fetchGoogleTollCosts(allCoords); // Busca custo Google
    await fetchAndDrawTolls(routeGeometry, allCoords); // Busca praças no mapa (visual)

    routeCalculated.value = true;
    window.showToast('Circuito logístico completo calculado com sucesso!', 'success');
  } catch (err: any) {
    console.error(err);
    window.showToast('Erro interno ao traçar circuito logístico pelas estradas: ' + err.message, 'error');
  } finally {
    isSearching.value = false;
  }
};

// CHAMADA AO GOOGLE MAPS PARA CALCULAR CUSTO DO PEDÁGIO
const fetchGoogleTollCosts = async (allCoords: [number, number][]) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey || allCoords.length < 2) {
    routeDetails.value.tollCost = 0;
    return;
  }

  try {
    const origin = allCoords[0];
    const destination = allCoords[allCoords.length - 1];
    const waypoints = allCoords.slice(1, -1).map(coord => ({
      location: { latLng: { latitude: coord[0], longitude: coord[1] } }
    }));

    const payload = {
      origin: { location: { latLng: { latitude: origin[0], longitude: origin[1] } } },
      destination: { location: { latLng: { latitude: destination[0], longitude: destination[1] } } },
      intermediates: waypoints,
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      extraComputations: ["TOLLS"]
    };

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.travelAdvisory.tollInfo'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn('Erro ao consultar pedágio no Google Maps', await res.text());
      routeDetails.value.tollCost = 0;
      return;
    }

    const data = await res.json();
    let baseTollCost = 0;

    if (data.routes && data.routes[0] && data.routes[0].travelAdvisory && data.routes[0].travelAdvisory.tollInfo) {
      const estimatedPrices = data.routes[0].travelAdvisory.tollInfo.estimatedPrice || [];
      if (estimatedPrices.length > 0) {
        const priceObj = estimatedPrices[0];
        if (priceObj.units) {
          baseTollCost = parseFloat(priceObj.units) + (priceObj.nanos ? priceObj.nanos / 1e9 : 0);
        }
      }
    }

    // MULTIPLICADOR DE EIXOS
    const multiplier = vehicleType.value === 'driving-hgv' ? (truckAxles.value || 2) : 1;
    routeDetails.value.tollCost = baseTollCost * multiplier;
    routeDetails.value.cost += routeDetails.value.tollCost; // Soma o pedágio ao custo total (combustível)
    
  } catch (err) {
    console.error('Erro na requisição ao Google Maps Tolls:', err);
    routeDetails.value.tollCost = 0;
  }
};

// BUSCA E DESENHO DE PRAÇAS DE PEDÁGIO (ANTT / OVERPASS API)
const fetchAndDrawTolls = async (routeGeometry: any, allCoords: [number, number][]) => {
  if (!map.value || !window.L) return;
  const L = window.L;

  let routeLineCoords: [number, number][] = [];
  if (routeGeometry && routeGeometry.coordinates) {
    if (Array.isArray(routeGeometry.coordinates[0])) {
      routeLineCoords = routeGeometry.coordinates.map((c: any) => [c[1], c[0]]);
    }
  }
  if (routeLineCoords.length === 0) {
    routeLineCoords = allCoords;
  }

  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  routeLineCoords.forEach(([lat, lon]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  });

  minLat -= 0.04; maxLat += 0.04;
  minLon -= 0.04; maxLon += 0.04;

  try {
    const query = `[out:json][timeout:15];
(
  node["barrier"="toll_booth"](${minLat.toFixed(4)},${minLon.toFixed(4)},${maxLat.toFixed(4)},${maxLon.toFixed(4)});
  node["highway"="toll_gantry"](${minLat.toFixed(4)},${minLon.toFixed(4)},${maxLat.toFixed(4)},${maxLon.toFixed(4)});
);
out body;`;

    const overpassUrls = [
      'https://lz4.overpass-api.de/api/interpreter',
      'https://z.overpass-api.de/api/interpreter',
      'https://overpass-api.de/api/interpreter'
    ];

    let res = null;
    for (const url of overpassUrls) {
      try {
        res = await fetch(url, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (res.ok) break;
      } catch (e) {
        console.warn(`Falha no servidor Overpass: ${url}`);
      }
    }

    if (!res || !res.ok) {
      console.warn('Todos os servidores Overpass falharam ou deram Timeout.');
      routeDetails.value.tollsCount = 0;
      return;
    }

    const data = await res.json();
    if (!data.elements || data.elements.length === 0) {
      routeDetails.value.tollsCount = 0;
      return;
    }

    let count = 0;
    const tollMarkersToBind: any[] = [];

    data.elements.forEach((node: any) => {
      const tLat = node.lat || (node.center && node.center.lat);
      const tLon = node.lon || (node.center && node.center.lon);
      if (!tLat || !tLon) return;

      const tags = node.tags || {};

      let isNear = false;
      for (const [rLat, rLon] of routeLineCoords) {
        const dLat = (tLat - rLat) * 111.32;
        const dLon = (tLon - rLon) * 111.32 * Math.cos(rLat * (Math.PI / 180));
        if (Math.hypot(dLat, dLon) <= 1.2) {
          isNear = true;
          break;
        }
      }

      if (isNear) {
        count++;
        const isFreeFlow = tags.highway === 'toll_gantry' || tags['toll:type'] === 'free_flow' || tags['payment:free_flow'] === 'yes' || (tags.name && tags.name.toLowerCase().includes('free flow'));
        const name = tags.name || tags.operator || tags.ref || (isFreeFlow ? `Pórtico Free Flow ${count}` : `Praça de Pedágio ${count}`);
        const highway = tags.ref || tags.via || 'Rodovia Concedida';
        const operator = tags.operator ? `<br><b>Concessionária:</b> ${tags.operator}` : '';

        const badgeHtml = isFreeFlow 
          ? '<span style="display:inline-block; margin-top:6px; font-size:11px; background:#dbeafe; color:#1e40af; padding:2px 6px; border-radius:4px; font-weight:700;"><i class="fas fa-bolt"></i> Pórtico Free Flow (Sem Cancela)</span>'
          : '<span style="display:inline-block; margin-top:6px; font-size:11px; background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:600;">Praça de Pedágio Convencional</span>';

        tollMarkersToBind.push({ lat: tLat, lon: tLon, name, highway, operator, isFreeFlow, badgeHtml });
      }
    });

    routeDetails.value.tollsCount = count;

    // Fallback de pedágio se a API do Google não retornou valores ou não há chave configurada
    const multiplier = vehicleType.value === 'driving-hgv' ? (truckAxles.value || 2) : 1;
    const baseTollPerPlaza = 11.50; // Tarifa média estimada por eixo em praças concessionadas

    if (routeDetails.value.tollCost <= 0 && count > 0) {
      routeDetails.value.tollCost = count * (baseTollPerPlaza * multiplier);
      routeDetails.value.cost += routeDetails.value.tollCost;
    }

    // Calcula valor médio de cada pedágio baseado no custo total do Google ou Fallback
    const avgPrice = count > 0 ? (routeDetails.value.tollCost / count) : 0;
    
    const avgPriceStr = avgPrice > 0 
      ? `<div style="margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1; font-size:13px; color:#1e293b;"><b>Valor Estimado (Média):</b> ${avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>`
      : '';

    // Renderiza os marcadores no mapa com os dados consolidados (incluindo lat, lon e valor)
    tollMarkersToBind.forEach(tm => {
      const iconToll = L.divIcon({
        html: `<div class="marker-pin ${tm.isFreeFlow ? 'pin-toll-freeflow' : 'pin-toll'}" title="${tm.name}"><i class="fas ${tm.isFreeFlow ? 'fa-bolt' : 'fa-hand-holding-usd'}"></i></div>`,
        className: 'custom-div-icon',
        iconSize: [34, 34],
        iconAnchor: [17, 34]
      });

      const priceText = avgPrice > 0 
        ? avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : 'R$ 0,00 (Não informado)';

      const markerToll = L.marker([tm.lat, tm.lon], { icon: iconToll })
        .bindPopup(`
          <div style="font-family: sans-serif; padding: 4px; min-width: 200px;">
            <strong style="color: ${tm.isFreeFlow ? '#2563eb' : '#d97706'}; font-size: 14px;"><i class="fas ${tm.isFreeFlow ? 'fa-bolt' : 'fa-hand-holding-usd'}"></i> ${tm.name}</strong><br>
            <small style="color: #475569;"><b>ANTT/DNIT:</b> ${tm.highway}${tm.operator}</small><br>
            <small style="color: #475569;"><b>Coordenadas:</b> Lat ${tm.lat.toFixed(6)}, Lon ${tm.lon.toFixed(6)}</small><br>
            ${tm.badgeHtml}
            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1; font-size:13px; color:#1e293b; font-weight: bold;">
              <b>Valor Estimado:</b> ${priceText}
            </div>
          </div>
        `)
        .addTo(map.value);

      markers.value.push(markerToll);
    });
    if (count > 0) {
      window.showToast(`Identificadas ${count} praça(s) de pedágio/free flow no percurso!`, 'info');
    } else {
      routeDetails.value.tollsCount = 0;
    }
  } catch (e) {
    console.error('Erro ao buscar pedágios na rota:', e);
  }
};

// EXPORTAÇÃO DA ROTA OTIMIZADA PARA EXCEL
const exportOptimizedRoute = () => {
  if (finalRouteStops.value.length === 0) {
    return window.showToast('Nenhuma rota calculada para exportar.', 'warning');
  }

  try {
    const dataToExport: any[] = [];
    finalRouteStops.value.forEach(stop => {
      if (stop.itemsList && stop.itemsList.length > 0) {
        stop.itemsList.forEach((it: any) => {
          dataToExport.push({
            'Parada': stop.sequence,
            'Razão Social': stop.razao_social,
            'CNPJ': stop.cnpj,
            'CEP': stop.cep,
            'Cidade': stop.cidade,
            'Estado': stop.estado,
            'Pedido ERP': it['PEDIDO'] || it['Pedido'] || '',
            'Item / Produto': it['ITEM'] || it['Item'] || '',
            'Quantidade': it['Quantidade'] || it['quantidade'] || it['QTDE'] || 1,
            'Endereço': it['ENDEREÇO'] || it['Endereço'] || '',
            'Número': it['NÚMERO'] || it['Número'] || '',
            'Assinatura Recebedor': ''
          });
        });
      } else {
        dataToExport.push({
          'Parada': stop.sequence,
          'Razão Social': stop.razao_social,
          'CNPJ': stop.cnpj,
          'CEP': stop.cep,
          'Cidade': stop.cidade,
          'Estado': stop.estado,
          'Pedido ERP': '',
          'Item / Produto': 'Entrega Geral',
          'Quantidade': 1,
          'Endereço': '',
          'Número': '',
          'Assinatura Recebedor': ''
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Roteiro de Entregas');

    // Estilização simples de colunas
    const max_width = dataToExport.reduce((w, r) => Math.max(w, String(r['Razão Social'] || '').length), 15);
    const max_item_width = dataToExport.reduce((w, r) => Math.max(w, String(r['Item / Produto'] || '').length), 15);
    worksheet['!cols'] = [
      { wch: 8 }, 
      { wch: max_width + 5 }, 
      { wch: 18 }, 
      { wch: 12 }, 
      { wch: 18 }, 
      { wch: 8 },
      { wch: 15 },
      { wch: max_item_width + 5 },
      { wch: 12 },
      { wch: 25 },
      { wch: 10 },
      { wch: 25 }
    ];

    XLSX.writeFile(workbook, `Roteiro_Entregas_Londrina_${new Date().toISOString().split('T')[0]}.xlsx`);
    window.showToast('Relatório de Roteiro exportado com sucesso!', 'success');
  } catch (e: any) {
    console.error(e);
    window.showToast('Erro ao exportar planilha Excel: ' + e.message, 'error');
  }
};
</script>

<template>
  <div class="router-dashboard-wrapper">
    <header class="page-header">
      <div class="header-left">
        <h1>Programação de Rota</h1>
        <p>Mapeamento de rotas reais pelas estradas, roteirização inteligente multi-paradas e otimização por planilha Excel.</p>
      </div>
    </header>

    <!-- ABAS PRINCIPAIS -->
    <div class="tabs-container mt-15">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'simple' }" 
        @click="activeTab = 'simple'; routeCalculated = false; clearMap();"
      >
        <i class="fas fa-route"></i> Rota Simples (Multi-Clientes Manual)
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'excel' }" 
        @click="activeTab = 'excel'; routeCalculated = false; clearMap();"
      >
        <i class="fas fa-file-excel"></i> Roteirização por Planilha (Lote)
      </button>
    </div>

    <div class="routing-grid mt-20">
      <!-- Painel Esquerdo: Parametrização -->
      <div class="glass-card panel-card animate-fade-in">
        <h3 class="panel-title"><i class="fas fa-sliders-h"></i> Parâmetros da Viagem</h3>
        <p class="panel-desc">Defina o CEP de partida e configure a cubagem, tipo de veículo e combustível.</p>

        <!-- CONFIGURAÇÕES DE VIAGEM COMUNS -->
        <div class="form-container mt-15">
          <div class="form-row">
            <div class="form-group flex-1">
              <label>CEP de Origem (Partida)</label>
              <input type="text" v-model="originCep" placeholder="86087-350" class="premium-input" />
            </div>
          </div>

          <div class="form-row mt-10">
            <div class="form-group flex-1">
              <label>Consumo Veículo (km/L)</label>
              <input type="number" step="0.1" v-model="truckConsumo" class="premium-input" />
            </div>
            <div class="form-group flex-1">
              <label>Combustível</label>
              <select v-model="fuelType" class="premium-select">
                <option value="dieselS10">Diesel S10</option>
                <option value="gasolina">Gasolina Comum</option>
                <option value="etanol">Etanol</option>
              </select>
            </div>
          </div>

          <div class="form-row mt-10">
            <div class="form-group flex-1">
              <label>Tipo de Veículo (Rotas)</label>
              <select v-model="vehicleType" class="premium-select">
                <option value="driving-car">Carro / Van</option>
                <option value="driving-hgv">Caminhão Pesado (HGV)</option>
              </select>
            </div>
            <div class="form-group flex-1" v-if="vehicleType === 'driving-hgv'">
              <label>Altura do Caminhão (Metros)</label>
              <input type="number" step="0.1" v-model="truckHeight" class="premium-input" title="Evitará pontilhões baixos (Ex: 4.4m)" />
            </div>
            <div class="form-group flex-1" v-if="vehicleType === 'driving-hgv'">
              <label>Número de Eixos</label>
              <select v-model="truckAxles" class="premium-select">
                <option :value="2">2 Eixos (Toco)</option>
                <option :value="3">3 Eixos (Truck)</option>
                <option :value="4">4 Eixos (Bi-truck)</option>
                <option :value="5">5 Eixos (Carreta)</option>
                <option :value="6">6 Eixos (Carreta LS)</option>
                <option :value="7">7 Eixos (Rodotrem)</option>
                <option :value="9">9 Eixos (Bitrem 9)</option>
              </select>
            </div>
          </div>

          <div class="form-group mt-10 mb-15">
            <label>Preço Combustível (R$/Litro)</label>
            <div class="price-input-wrapper">
              <span class="currency-prefix">R$</span>
              <input type="number" step="0.01" v-model="fuelPrice" class="premium-input pl-30" />
              <span class="uf-tag">ANP</span>
            </div>
          </div>

          <hr class="divider-dashed" />

          <!-- MODO 1: ROTA SIMPLES COM MÚLTIPLOS CLIENTES MANUAIS -->
          <div v-if="activeTab === 'simple'" class="mode-section mt-10 animate-fade-in">
            <h4 class="section-subtitle"><i class="fas fa-plus-circle"></i> Adicionar Paradas de Clientes</h4>
            
            <div class="form-group mt-10">
              <label>Selecione o Cliente</label>
              <div class="add-stop-row">
                <select v-model="selectedClientId" class="premium-select select-flex">
                  <option :value="null" disabled>Selecione um cliente para adicionar...</option>
                  <option v-for="client in clients" :key="client.id" :value="client.id">
                    {{ client.razao_social }} ({{ client.cidade }} - {{ client.estado }})
                  </option>
                </select>
                <button type="button" @click="addClientToRoute" class="btn-add-stop" title="Adicionar à Rota">
                  <i class="fas fa-plus"></i> Add
                </button>
                <button type="button" @click="openViewClientModal" class="btn-add-stop info" title="Verificar Dados do Cliente no Banco">
                  <i class="fas fa-eye"></i>
                </button>
                <button type="button" @click="openRegisterClientModal" class="btn-add-stop success" title="Cadastrar Novo Cliente no Banco">
                  <i class="fas fa-user-plus"></i>
                </button>
              </div>
            </div>

            <!-- Lista de Paradas Manuais Adicionadas -->
            <div class="stops-list-wrapper mt-15">
              <label class="stops-list-label">Sequência de Paradas Manuais ({{ manualStops.length }})</label>
              
              <div v-if="manualStops.length === 0" class="no-stops-info mt-5">
                <i class="fas fa-info-circle"></i> Nenhuma parada adicionada. Adicione clientes acima.
              </div>

              <div v-else class="stops-scroll-area mt-5">
                <div v-for="(stop, index) in manualStops" :key="stop.cnpj" class="stop-item-card">
                  <div class="stop-number">{{ stop.sequence }}</div>
                  <div class="stop-details">
                    <strong class="stop-name">{{ stop.razao_social }}</strong>
                    <span class="stop-sub">{{ stop.cidade }} - {{ stop.estado }} | CEP: {{ stop.cep }}</span>
                  </div>
                  <div class="stop-actions">
                    <button type="button" @click="moveStopUp(index)" class="stop-action-btn" :disabled="index === 0" title="Subir Parada">
                      <i class="fas fa-chevron-up"></i>
                    </button>
                    <button type="button" @click="moveStopDown(index)" class="stop-action-btn" :disabled="index === manualStops.length - 1" title="Descer Parada">
                      <i class="fas fa-chevron-down"></i>
                    </button>
                    <button type="button" @click="removeStop(index)" class="stop-action-btn delete" title="Remover Parada">
                      <i class="fas fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button type="button" @click="processAndCalculateRoute" class="btn-calculate mt-20" :disabled="isSearching || manualStops.length === 0">
              <i class="fas fa-route" :class="{ 'fa-spin': isSearching }" v-if="!isSearching"></i>
              <span v-else class="spinner-mini"></span>
              <span>{{ isSearching ? 'Processando Circuito...' : 'Calcular Rota Logística' }}</span>
            </button>
          </div>

          <!-- MODO 2: ROTEIRIZAÇÃO INTELIGENTE POR PLANILHA -->
          <div v-else class="mode-section mt-10 animate-fade-in">
            <h4 class="section-subtitle"><i class="fas fa-cloud-arrow-up"></i> Carregar Planilha de Pedidos</h4>
            
            <!-- Drag and Drop Area -->
            <div 
              class="drag-drop-area mt-10" 
              @dragover.prevent 
              @drop.prevent="handleExcelDrop"
              @click="$refs.fileInput.click()"
            >
              <input 
                type="file" 
                ref="fileInput" 
                @change="handleExcelUpload" 
                style="display: none;" 
                accept=".xlsx, .xls" 
              />
              <i class="fas fa-file-excel excel-icon"></i>
              <strong v-if="!excelFile">Clique ou arraste a planilha Excel aqui</strong>
              <strong v-else class="text-primary">{{ excelFile.name }}</strong>
              <span>Suporta planilhas de pedidos com coluna de CNPJ</span>
            </div>

            <!-- Ações Pós-Upload -->
            <div v-if="isExcelLoaded" class="excel-actions mt-15 animate-fade-in">
              <div class="excel-summary-badge">
                <span>Pedidos Lidos: <strong>{{ excelRows.length }}</strong></span>
                <span>CNPJs Únicos: <strong>{{ cnpjsToResolve.length }}</strong></span>
              </div>

              <!-- Resolver e Cadastrar Automaticamente -->
              <button 
                type="button" 
                @click="resolveBatchClients" 
                class="btn-resolve-batch mt-10"
                :disabled="isResolvingClients || cnpjsToResolve.length === 0"
              >
                <i class="fas fa-network-wired" :class="{ 'fa-spin': isResolvingClients }" v-if="!isResolvingClients"></i>
                <span v-else class="spinner-mini"></span>
                <span>{{ isResolvingClients ? 'Buscando e Cadastrando Clientes...' : 'Verificar/Cadastrar Clientes via Brasil API' }}</span>
              </button>

              <!-- Lista de Clientes Resolvidos e Prontos -->
              <div v-if="resolvedExcelStops.length > 0" class="resolved-stops-wrapper mt-15">
                <label class="stops-list-label">Clientes Prontos para Entrega ({{ resolvedExcelStops.length }})</label>
                <div class="stops-scroll-area mt-5 small-height">
                  <div v-for="stop in resolvedExcelStops" :key="stop.cnpj" class="stop-item-card readonly">
                    <div class="stop-number">{{ stop.sequence }}</div>
                    <div class="stop-details">
                      <div class="stop-name-row">
                        <strong class="stop-name">{{ stop.razao_social }}</strong>
                        <span class="items-count-badge" v-if="stop.itemsList && stop.itemsList.length > 0">
                          {{ stop.itemsList.length }} itens
                        </span>
                      </div>
                      <span class="stop-sub">
                        {{ stop.cidade }} - {{ stop.estado }} | CEP: {{ stop.cep }}
                        <span v-if="stop.pedidosList && stop.pedidosList.length > 0">
                          | Pedidos: {{ stop.pedidosList.join(', ') }}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <button type="button" @click="processAndCalculateRoute" class="btn-calculate mt-15" :disabled="isSearching">
                  <i class="fas fa-compass" :class="{ 'fa-spin': isSearching }" v-if="!isSearching"></i>
                  <span v-else class="spinner-mini"></span>
                  <span>{{ isSearching ? 'Geocodificando & Roteirizando...' : 'Otimizar Circuito de Entregas' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Indicadores Premium de Resultado -->
        <div v-if="routeCalculated" class="indicators-section mt-20 animate-slide-up">
          <h4 class="indicators-title"><i class="fas fa-calculator"></i> Estimativas do Circuito</h4>
          <div class="indicators-grid mt-10">
            <div class="indicator-card">
              <span class="ind-label"><i class="fas fa-road"></i> Circuito Total</span>
              <span class="ind-value">{{ routeDetails.distance }} km</span>
            </div>
            <div class="indicator-card">
              <span class="ind-label"><i class="fas fa-clock"></i> Tempo Condução</span>
              <span class="ind-value">{{ routeDetails.duration }}</span>
            </div>
            <div class="indicator-card">
              <span class="ind-label"><i class="fas fa-gas-pump"></i> Combustível</span>
              <span class="ind-value">{{ routeDetails.liters }} Litros</span>
            </div>
            <div class="indicator-card glow-green">
              <span class="ind-label"><i class="fas fa-dollar-sign"></i> Custo Total (Comb + Ped)</span>
              <span class="ind-value highlight">{{ routeDetails.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}</span>
            </div>
            <div class="indicator-card" style="border-left: 3px solid #f59e0b;">
              <span class="ind-label text-amber"><i class="fas fa-hand-holding-usd"></i> Pedágios (ANTT/Custo)</span>
              <span class="ind-value">
                {{ routeDetails.tollsCount || 0 }} praças
                <span v-if="routeDetails.tollCost > 0" class="text-amber"><br>{{ routeDetails.tollCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Painel Direito: Mapa Interativo Leaflet -->
      <div class="glass-card map-card">
        <div class="map-header">
          <div class="header-details">
            <i class="fas fa-map-marked-alt text-primary"></i>
            <h3>Mapa Logístico do Circuito</h3>
            <span class="badge" :class="routeCalculated ? 'badge-success' : 'badge-neutral'">
              {{ routeCalculated ? 'Circuito Traçado' : 'Aguardando Seleção' }}
            </span>
          </div>
        </div>
        <div id="map-container" class="map-view"></div>
        <div v-if="isSearching" class="map-overlay">
          <div class="spinner-blue"></div>
          <p class="mt-10">Geocodificando de forma resiliente e roteirizando circuito no OSRM...</p>
        </div>
      </div>
    </div>

    <!-- TABELA DE PARADAS DA ROTA OTIMIZADA -->
    <div v-if="routeCalculated" class="glass-card mt-25 animate-fade-in mb-30">
      <div class="card-table-header">
        <h3><i class="fas fa-list-ol"></i> Sequência Otimizada de Entregas</h3>
        <button type="button" @click="exportOptimizedRoute" class="btn-export-route">
          <i class="fas fa-file-excel"></i> Exportar Roteiro Otimizado (Excel)
        </button>
      </div>

      <div class="table-container mt-15">
        <table class="route-stops-table">
          <thead>
            <tr>
              <th class="text-center" style="width: 80px;">Sequência</th>
              <th>Cliente / Razão Social</th>
              <th>CNPJ</th>
              <th>CEP</th>
              <th>Cidade / UF</th>
              <th class="text-center">Coordenadas</th>
              <th class="text-center">Situação</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="stop in finalRouteStops" :key="stop.cnpj">
              <tr>
                <td class="text-center">
                  <span class="sequence-badge">{{ stop.sequence }}</span>
                </td>
                <td>
                  <div class="client-name-cell">
                    <strong>{{ stop.razao_social }}</strong>
                    <span class="sub-items-desc" v-if="stop.itemsList && stop.itemsList.length > 0">
                      ({{ stop.itemsList.length }} itens logísticos cadastrados)
                    </span>
                  </div>
                </td>
                <td><code>{{ stop.cnpj }}</code></td>
                <td>{{ stop.cep }}</td>
                <td>{{ stop.cidade }} - {{ stop.estado }}</td>
                <td class="text-center text-muted text-xs">
                  <code>{{ stop.lat?.toFixed(5) }}, {{ stop.lon?.toFixed(5) }}</code>
                </td>
                <td class="text-center">
                  <span class="badge-resolved"><i class="fas fa-check-double"></i> Localizado</span>
                </td>
              </tr>
              
              <!-- Linha com os detalhes dos itens daquele cliente -->
              <tr v-if="stop.itemsList && stop.itemsList.length > 0" class="items-detail-row">
                <td colspan="7" class="items-detail-td">
                  <div class="stop-items-accordion">
                    <div class="accordion-header">
                      <i class="fas fa-boxes-packing text-primary"></i> Itens para Entrega nesta parada:
                    </div>
                    <div class="accordion-items-grid">
                      <div v-for="(it, idx) in stop.itemsList" :key="idx" class="accordion-item-pill">
                        <span class="item-pill-desc" :title="it['ITEM'] || it['Item']">{{ it['ITEM'] || it['Item'] || 'Item Geral' }}</span>
                        <span class="item-pill-qty">Qtd: <strong>{{ it['Quantidade'] || it['quantidade'] || it['QTDE'] || 1 }}</strong></span>
                        <span class="item-pill-order" v-if="it['PEDIDO'] || it['Pedido']">Pedido: #{{ it['PEDIDO'] || it['Pedido'] }}</span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- MODAL DE CADASTRO DE NOVO CLIENTE NO BANCO -->
  <div v-if="showRegisterModal" class="client-modal-overlay fade-in" @click.self="showRegisterModal = false">
    <div class="client-modal-card">
      <div class="client-modal-header">
        <h3><i class="fas fa-user-plus text-success"></i> Cadastrar Novo Cliente no Banco</h3>
        <button @click="showRegisterModal = false" class="btn-close-modal"><i class="fas fa-times"></i></button>
      </div>
      
      <form @submit="saveNewClient" class="client-form-grid">
        <div class="form-group full-width">
          <label>CNPJ / CPF</label>
          <div class="input-with-button">
            <input 
              v-model="newClientForm.cnpj" 
              type="text" 
              class="glass-input" 
              placeholder="Digite o CNPJ (ex: 00.000.000/0000-00)" 
              required 
            />
            <button type="button" @click="lookupNewClientCNPJ" class="btn-lookup" :disabled="isSearchingCNPJ">
              <i class="fas" :class="isSearchingCNPJ ? 'fa-spinner fa-spin' : 'fa-search'"></i> Buscar CNPJ
            </button>
          </div>
        </div>

        <div class="form-group span-2">
          <label>Razão Social / Nome *</label>
          <input v-model="newClientForm.razao_social" type="text" class="glass-input" placeholder="Razão Social" required />
        </div>

        <div class="form-group">
          <label>Nome Fantasia</label>
          <input v-model="newClientForm.fantasia" type="text" class="glass-input" placeholder="Nome Fantasia" />
        </div>

        <div class="form-group">
          <label>CEP *</label>
          <input v-model="newClientForm.cep" @blur="lookupNewClientCEP" type="text" class="glass-input" placeholder="86000-000" required />
        </div>

        <div class="form-group span-2">
          <label>Logradouro / Endereço</label>
          <input v-model="newClientForm.logradouro" type="text" class="glass-input" placeholder="Rua, Av..." />
        </div>

        <div class="form-group">
          <label>Número</label>
          <input v-model="newClientForm.numero" type="text" class="glass-input" placeholder="123" />
        </div>

        <div class="form-group">
          <label>Bairro</label>
          <input v-model="newClientForm.bairro" type="text" class="glass-input" placeholder="Bairro" />
        </div>

        <div class="form-group">
          <label>Cidade *</label>
          <input v-model="newClientForm.cidade" type="text" class="glass-input" placeholder="Londrina" required />
        </div>

        <div class="form-group">
          <label>Estado (UF) *</label>
          <select v-model="newClientForm.estado" class="glass-input" required>
            <option value="" disabled>UF</option>
            <option v-for="uf in ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']" :key="uf" :value="uf">{{ uf }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>Telefone / Contato</label>
          <input v-model="newClientForm.telefone" type="text" class="glass-input" placeholder="(43) 99999-9999" />
        </div>

        <div class="form-group">
          <label>Inscrição Estadual</label>
          <input v-model="newClientForm.inscricao_estadual" type="text" class="glass-input" placeholder="Isento ou Nº IE" />
        </div>

        <div class="form-group span-2">
          <label>Empresa de Faturamento</label>
          <select v-model="newClientForm.empresa_faturamento" class="glass-input">
            <option value="NICOPEL">NICOPEL</option>
            <option value="FLEXOBOX">FLEXOBOX</option>
          </select>
        </div>

        <div class="client-modal-actions full-width mt-15">
          <button type="button" @click="showRegisterModal = false" class="btn-modal-cancel">Cancelar</button>
          <button type="submit" class="btn-modal-save" :disabled="isSavingClient">
            <i class="fas" :class="isSavingClient ? 'fa-spinner fa-spin' : 'fa-save'"></i> Salvar Cliente no Banco
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL DE VERIFICAÇÃO / DADOS DO CLIENTE CADASTRADO NO BANCO -->
  <div v-if="showViewClientModal" class="client-modal-overlay fade-in" @click.self="showViewClientModal = false">
    <div class="client-modal-card wide">
      <div class="client-modal-header">
        <h3><i class="fas fa-database text-info"></i> Clientes Cadastrados no Banco de Dados</h3>
        <button @click="showViewClientModal = false" class="btn-close-modal"><i class="fas fa-times"></i></button>
      </div>

      <!-- VISUALIZAÇÃO DE DETALHES DE UM CLIENTE ESPECÍFICO -->
      <div v-if="inspectedClient" class="client-details-view fade-in">
        <div class="details-top-bar">
          <button @click="inspectedClient = null" class="btn-back-link">
            <i class="fas fa-arrow-left"></i> Voltar à Lista de Clientes
          </button>
          <span class="badge-db"><i class="fas fa-check-circle"></i> Dados Registrados no Banco</span>
        </div>

        <div class="client-details-card">
          <div class="details-header-info">
            <h4>{{ inspectedClient.razao_social }}</h4>
            <p v-if="inspectedClient.fantasia" class="text-muted"><i class="fas fa-building"></i> {{ inspectedClient.fantasia }}</p>
          </div>

          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">ID Banco</span>
              <span class="detail-value">#{{ inspectedClient.id }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">CNPJ / CPF</span>
              <span class="detail-value highlight">{{ inspectedClient.cnpj }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Inscrição Estadual</span>
              <span class="detail-value">{{ inspectedClient.inscricao_estadual || 'Isento' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Empresa Faturamento</span>
              <span class="detail-value">{{ inspectedClient.empresa_faturamento || 'NICOPEL' }}</span>
            </div>
            <div class="detail-item span-2">
              <span class="detail-label">Endereço Completo</span>
              <span class="detail-value">
                {{ inspectedClient.logradouro || 'Não informado' }}
                <template v-if="inspectedClient.numero">, nº {{ inspectedClient.numero }}</template>
                <template v-if="inspectedClient.bairro"> - {{ inspectedClient.bairro }}</template>
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">CEP</span>
              <span class="detail-value">{{ inspectedClient.cep }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Cidade / UF</span>
              <span class="detail-value strong">{{ inspectedClient.cidade }} / {{ inspectedClient.estado }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Telefone / Contato</span>
              <span class="detail-value">{{ inspectedClient.telefone || 'Não cadastrado' }}</span>
            </div>
            <div class="detail-item" v-if="inspectedClient.latitude && inspectedClient.longitude">
              <span class="detail-label">Coordenadas GPS</span>
              <span class="detail-value text-success">{{ inspectedClient.latitude }}, {{ inspectedClient.longitude }}</span>
            </div>
          </div>

          <div class="details-actions mt-20">
            <button @click="selectClientFromModal(inspectedClient)" class="btn-modal-save">
              <i class="fas fa-check"></i> Selecionar Este Cliente para a Rota
            </button>
          </div>
        </div>
      </div>

      <!-- LISTA DE CLIENTES CADASTRADOS COM BUSCA -->
      <div v-else class="client-list-view">
        <div class="search-bar-modal mb-15">
          <div class="input-with-icon">
            <i class="fas fa-search search-icon"></i>
            <input 
              v-model="viewClientSearch" 
              type="text" 
              class="glass-input full-width" 
              placeholder="Pesquisar por CNPJ, Razão Social, Cidade ou Estado..." 
              autofocus
            />
          </div>
        </div>

        <div class="clients-table-scroll glass-scroll">
          <div v-if="filteredModalClients.length === 0" class="empty-state">
            Nenhum cliente cadastrado foi localizado com esta pesquisa.
          </div>
          
          <div 
            v-for="client in filteredModalClients" 
            :key="client.id" 
            class="client-row-item"
            :class="{ active: selectedClientId === client.id }"
          >
            <div class="client-row-main">
              <strong>{{ client.razao_social }}</strong>
              <div class="client-row-sub">
                <span><i class="fas fa-id-card"></i> {{ client.cnpj }}</span>
                <span><i class="fas fa-map-marker-alt"></i> {{ client.cidade }}/{{ client.estado }}</span>
                <span v-if="client.telefone"><i class="fas fa-phone"></i> {{ client.telefone }}</span>
              </div>
            </div>
            <div class="client-row-btns">
              <button @click="inspectedClient = client" class="btn-sm-action info" title="Verificar Dados Completos">
                <i class="fas fa-eye"></i> Dados
              </button>
              <button @click="selectClientFromModal(client)" class="btn-sm-action primary" title="Selecionar para a Rota">
                <i class="fas fa-check"></i> Usar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.routing-grid {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 25px;
  min-height: 680px;
}

.panel-card {
  padding: 25px;
  display: flex;
  flex-direction: column;
}

.panel-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-title i {
  color: var(--primary);
}

.panel-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.4;
  margin-top: 5px;
}

/* Abas */
.tabs-container {
  display: flex;
  gap: 10px;
  border-bottom: 2px solid var(--border);
  padding-bottom: 5px;
}

.tab-btn {
  padding: 12px 20px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 10px 10px 0 0;
  border-bottom: 3px solid transparent;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  background: rgba(59, 130, 246, 0.05);
}

/* Divisores */
.divider-dashed {
  border: none;
  border-top: 1px dashed var(--border);
  margin: 15px 0;
}

/* Seções de Modos */
.section-subtitle {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--text-main);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.add-stop-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.select-flex {
  flex: 1;
}

.btn-add-stop {
  padding: 12px 18px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  box-shadow: 0 6px 12px rgba(59, 130, 246, 0.35);
}

/* Lista de Paradas */
.stops-list-wrapper {
  display: flex;
  flex-direction: column;
}

.stops-list-label {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
}

.no-stops-info {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border);
  padding: 15px;
  border-radius: 10px;
  text-align: center;
}

.stops-scroll-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 230px;
  overflow-y: auto;
  padding-right: 5px;
}

.stops-scroll-area.small-height {
  max-height: 150px;
}

.stop-item-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.stop-item-card:hover {
  border-color: var(--primary);
}

.stop-item-card.readonly {
  padding: 8px 10px;
}

.stop-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
}

.stop-details {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.stop-name {
  font-size: 0.8rem;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stop-sub {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.stop-actions {
  display: flex;
  gap: 4px;
}

.stop-action-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  transition: all 0.2s ease;
}

.stop-action-btn:hover:not(:disabled) {
  color: var(--text-main);
  border-color: var(--text-main);
}

.stop-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.stop-action-btn.delete:hover {
  background: rgba(ef, 68, 68, 0.1);
  color: #ef4444;
  border-color: #ef4444;
}

/* Área Drag & Drop Excel */
.drag-drop-area {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 25px;
  text-align: center;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.01);
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.drag-drop-area:hover {
  border-color: var(--primary);
  background: rgba(59, 130, 246, 0.02);
}

.excel-icon {
  font-size: 2.2rem;
  color: #10b981;
}

.drag-drop-area strong {
  font-size: 0.85rem;
  color: var(--text-main);
}

.drag-drop-area span {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.excel-summary-badge {
  display: flex;
  gap: 15px;
  background: rgba(255,255,255,0.02);
  border: 1px dashed var(--border);
  padding: 10px 15px;
  border-radius: 8px;
  justify-content: space-around;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.excel-summary-badge strong {
  color: var(--text-main);
}

.btn-resolve-batch {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
  transition: all 0.2s ease;
  font-size: 0.85rem;
}

.btn-resolve-batch:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(16, 185, 129, 0.35);
}

.btn-resolve-batch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Inputs Premium */
.form-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.flex-1 { flex: 1; }
.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.premium-input, .premium-select {
  width: 100%;
  padding: 12px 15px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-main);
  outline: none;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.premium-input:focus, .premium-select:focus {
  border-color: var(--primary);
  background: var(--bg-surface);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.price-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-prefix {
  position: absolute;
  left: 12px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
}

.pl-30 {
  padding-left: 32px !important;
}

.uf-tag {
  position: absolute;
  right: 12px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 800;
}

.btn-calculate {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  transition: all 0.2s ease;
}

.btn-calculate:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.35);
}

.btn-calculate:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner-mini {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Indicadores */
.indicators-section {
  margin-top: 15px;
  border-top: 1px dashed var(--border);
  padding-top: 15px;
}

.indicators-title {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--text-main);
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
}

.indicators-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.indicator-card {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ind-label {
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 5px;
}

.ind-value {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-main);
}

.glow-green {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.05);
}

.glow-green .ind-label {
  color: #10b981;
}

.ind-value.highlight {
  color: #10b981;
  font-size: 1.15rem;
}

/* Mapa */
.map-card {
  padding: 0 !important;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.map-header {
  padding: 18px 24px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  z-index: 10;
}

.header-details {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-details h3 {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
}

.text-primary {
  color: var(--primary);
}

.badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  margin-left: auto;
}

.badge-neutral {
  background: var(--bg-input);
  color: var(--text-muted);
}

.badge-success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.map-view {
  width: 100%;
  flex: 1;
  min-height: 540px;
}

.map-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(2px);
  z-index: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 0.95rem;
}

.spinner-blue {
  width: 36px;
  height: 36px;
  border: 4px solid rgba(255,255,255,0.3);
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Tabela de Paradas */
.card-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-table-header h3 {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-export-route {
  padding: 10px 20px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
  transition: all 0.2s ease;
}

.btn-export-route:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(16, 185, 129, 0.35);
}

.route-stops-table {
  width: 100%;
  border-collapse: collapse;
}

.route-stops-table th {
  padding: 14px;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  border-bottom: 2px solid var(--border);
}

.route-stops-table td {
  padding: 14px;
  font-size: 0.85rem;
  color: var(--text-main);
  border-bottom: 1px solid var(--border);
}

.sequence-badge {
  background: var(--primary);
  color: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 0.8rem;
}

.badge-resolved {
  background: rgba(16,185,129,0.08);
  color: #10b981;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
}

.text-xs { font-size: 0.75rem; }
.text-muted { color: var(--text-muted); }

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}

.animate-slide-up {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.mt-15 { margin-top: 15px; }
.mt-20 { margin-top: 20px; }
.mt-25 { margin-top: 25px; }
.mb-30 { margin-bottom: 30px; }

/* Custom Pins no Leaflet */
:deep(.custom-div-icon) {
  background: none;
  border: none;
}

:deep(.marker-pin) {
  width: 36px;
  height: 36px;
  border-radius: 50% 50% 50% 0;
  background: #3b82f6;
  position: absolute;
  transform: rotate(-45deg);
  left: 50%;
  top: 50%;
  margin: -18px 0 0 -18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  border: 2px solid white;
}

:deep(.marker-pin i) {
  transform: rotate(45deg);
  color: white;
  font-size: 0.85rem;
}

:deep(.marker-pin span) {
  transform: rotate(45deg);
  color: white;
  font-size: 0.85rem;
  font-weight: 800;
}

:deep(.pin-origin) {
  background: #3b82f6;
}

:deep(.pin-dest) {
  background: #10b981;
}

@media (max-width: 1024px) {
  .routing-grid {
    grid-template-columns: 1fr;
  }
}

/* Estilos Adicionais para Detalhamento de Itens */
.items-count-badge {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 800;
  margin-left: 8px;
  text-transform: uppercase;
}

.stop-name-row {
  display: flex;
  align-items: center;
}

.client-name-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sub-items-desc {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
}

.items-detail-row {
  background: rgba(255, 255, 255, 0.01);
}

.items-detail-td {
  padding: 0 14px 14px 14px !important;
  border-bottom: 1px solid var(--border);
}

.stop-items-accordion {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.accordion-header {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.accordion-items-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.accordion-item-pill {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 5px 12px;
  font-size: 0.78rem;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
}

.item-pill-desc {
  color: var(--text-main);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.item-pill-qty {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.item-pill-qty strong {
  color: #10b981;
}

.item-pill-order {
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 0.65rem;
  font-weight: 800;
}

:deep(.pin-toll) { background: #f59e0b; border-color: #ffffff; width: 34px; height: 34px; }
:deep(.pin-toll i) { transform: rotate(45deg); color: #ffffff; font-size: 0.85rem; }
:deep(.pin-toll-freeflow) { background: #2563eb; border-color: #ffffff; width: 34px; height: 34px; }
:deep(.pin-toll-freeflow i) { transform: rotate(45deg); color: #ffffff; font-size: 0.85rem; }

.icon-amber { color: #f59e0b; }
.text-amber { color: #f59e0b; }
.highlight-toll { background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); }
</style>
