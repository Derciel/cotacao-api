<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
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
  cost: 0
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
    // 1. Coordenadas Exatas da Matriz (Nicopel Embalagens - Parque Industrial Alicante)
    // Endereço (Plus Code PV72+7V): Rodovia Carlos João Strass 780, Jardim Alicante, Londrina - PR
    const finalOrigin: [number, number] = [-23.286812, -51.147812];


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
      .bindPopup(`<strong>Nicopel Embalagens (Matriz)</strong><br>Ponto de Partida Oficial<br>CEP: 86087-350`)
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

    routeCalculated.value = true;
    finalRouteStops.value = orderedStops;
    window.showToast('Circuito logístico completo calculado com sucesso!', 'success');
  } catch (err: any) {
    console.error(err);
    window.showToast('Erro interno ao traçar circuito logístico pelas estradas: ' + err.message, 'error');
  } finally {
    isSearching.value = false;
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
  <div class="roteirizador-pro">
    <!-- Map as absolute background -->
    <div id="map-container" class="map-bg"></div>

    <!-- Floating UI Overlay -->
    <div class="overlay-ui">
      <!-- Top Bar: Logo & Back -->
      <div class="top-bar">
        <a href="/" class="btn-back" title="Voltar ao Dashboard">
          <i class="fas fa-arrow-left"></i>
        </a>
        <div class="logo-box">
          <i class="fas fa-map-marked-alt text-primary"></i>
          <span>Nicopel <strong>Logística Pro</strong></span>
        </div>
        <div class="status-indicator">
          <span class="pulse-dot" :class="{ active: routeCalculated }"></span>
          {{ routeCalculated ? 'Circuito Otimizado' : 'Aguardando Configuração' }}
        </div>
      </div>

      <!-- Left Panel: Glassmorphism Configuration Panel -->
      <div class="glass-panel left-panel">
        <div class="panel-header">
          <h3><i class="fas fa-sliders-h"></i> Configurações de Rota</h3>
        </div>

        <div class="panel-content">
          <!-- Configurações Rápidas -->
          <div class="config-grid">
            <div class="config-item">
              <label><i class="fas fa-gas-pump"></i> Combustível</label>
              <select v-model="fuelType" class="glass-input">
                <option value="dieselS10">Diesel S10</option>
                <option value="gasolina">Gasolina Comum</option>
                <option value="etanol">Etanol</option>
              </select>
            </div>
            
            <div class="config-item">
              <label><i class="fas fa-money-bill-wave"></i> Preço/L (R$)</label>
              <input type="number" step="0.01" v-model="fuelPrice" class="glass-input" />
            </div>

            <div class="config-item">
              <label><i class="fas fa-truck"></i> Veículo</label>
              <select v-model="vehicleType" class="glass-input">
                <option value="driving-car">Carro / Van</option>
                <option value="driving-hgv">Caminhão (HGV)</option>
              </select>
            </div>

            <div class="config-item" v-if="vehicleType === 'driving-hgv'">
              <label><i class="fas fa-ruler-vertical"></i> Altura (m)</label>
              <input type="number" step="0.1" v-model="truckHeight" class="glass-input" />
            </div>
          </div>

          <hr class="glass-divider" />

          <!-- Abas Modernas -->
          <div class="glass-tabs">
            <button @click="activeTab = 'simple'" class="glass-tab" :class="{ active: activeTab === 'simple' }">
              <i class="fas fa-hand-pointer"></i> Manual
            </button>
            <button @click="activeTab = 'excel'" class="glass-tab" :class="{ active: activeTab === 'excel' }">
              <i class="fas fa-file-excel"></i> Planilha
            </button>
          </div>

          <!-- MODO MANUAL -->
          <div v-if="activeTab === 'simple'" class="tab-content fade-in">
            <div class="add-stop-row">
              <select v-model="selectedClientId" class="glass-input select-flex">
                <option :value="null" disabled>Selecione um cliente...</option>
                <option v-for="client in clients" :key="client.id" :value="client.id">
                  {{ client.razao_social }} ({{ client.cidade }} - {{ client.estado }})
                </option>
              </select>
              <button @click="addClientToRoute" class="btn-glass primary">
                <i class="fas fa-plus"></i>
              </button>
            </div>

            <div class="stops-list glass-scroll mt-15">
              <div v-if="manualStops.length === 0" class="empty-state">
                Nenhuma parada.
              </div>
              <div v-for="(stop, index) in manualStops" :key="stop.cnpj" class="stop-item">
                <div class="stop-idx">{{ stop.sequence }}</div>
                <div class="stop-info">
                  <strong>{{ stop.razao_social }}</strong>
                  <span>{{ stop.cidade }}/{{ stop.estado }}</span>
                </div>
                <div class="stop-actions">
                  <button @click="moveStopUp(index)" :disabled="index === 0"><i class="fas fa-chevron-up"></i></button>
                  <button @click="moveStopDown(index)" :disabled="index === manualStops.length - 1"><i class="fas fa-chevron-down"></i></button>
                  <button @click="removeStop(index)" class="text-danger"><i class="fas fa-trash"></i></button>
                </div>
              </div>
            </div>
          </div>

          <!-- MODO EXCEL -->
          <div v-if="activeTab === 'excel'" class="tab-content fade-in">
            <div class="drag-drop-zone" @dragover.prevent @drop.prevent="handleExcelDrop" @click="$refs.fileInput.click()">
              <input type="file" ref="fileInput" @change="handleExcelUpload" style="display: none;" accept=".xlsx, .xls" />
              <i class="fas fa-cloud-upload-alt upload-icon"></i>
              <span v-if="!excelFile">Solte ou clique para carregar .XLSX</span>
              <strong v-else>{{ excelFile.name }}</strong>
            </div>

            <div v-if="isExcelLoaded" class="mt-15">
              <div class="excel-stats">
                <span>{{ excelRows.length }} Pedidos</span>
                <span>{{ cnpjsToResolve.length }} CNPJs</span>
              </div>
              
              <button @click="resolveBatchClients" class="btn-glass secondary full-width mt-10" :disabled="isResolvingClients || cnpjsToResolve.length === 0">
                <i class="fas fa-sync" :class="{ 'fa-spin': isResolvingClients }"></i> 
                {{ isResolvingClients ? 'Processando...' : 'Resolver CNPJs' }}
              </button>

              <div class="stops-list glass-scroll mt-15" v-if="resolvedExcelStops.length > 0">
                <div v-for="stop in resolvedExcelStops" :key="stop.cnpj" class="stop-item readonly">
                  <div class="stop-idx">{{ stop.sequence }}</div>
                  <div class="stop-info">
                    <strong>{{ stop.razao_social }}</strong>
                    <span>{{ stop.pedidosList ? stop.pedidosList.length : 0 }} Pedidos</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <button @click="processAndCalculateRoute" class="btn-action-primary" :disabled="isSearching || (activeTab === 'simple' ? manualStops.length === 0 : resolvedExcelStops.length === 0)">
            <i class="fas fa-route" :class="{ 'fa-spin': isSearching }" v-if="!isSearching"></i>
            <span v-else class="spinner-mini"></span>
            {{ isSearching ? 'Otimizando...' : 'Otimizar Rota' }}
          </button>
        </div>
      </div>

      <!-- Bottom Floating Results Card -->
      <div class="floating-results" :class="{ 'visible': routeCalculated }">
        <div class="results-header">
          <h3>Resumo da Viagem</h3>
          <button @click="routeCalculated = false" class="btn-close-results"><i class="fas fa-times"></i></button>
        </div>
        <div class="results-grid">
          <div class="res-item">
            <i class="fas fa-road icon-blue"></i>
            <div>
              <span class="res-label">Distância</span>
              <span class="res-value">{{ routeDetails.distance }} km</span>
            </div>
          </div>
          <div class="res-item">
            <i class="fas fa-clock icon-orange"></i>
            <div>
              <span class="res-label">Tempo</span>
              <span class="res-value">{{ routeDetails.duration }}</span>
            </div>
          </div>
          <div class="res-item">
            <i class="fas fa-gas-pump icon-purple"></i>
            <div>
              <span class="res-label">Consumo</span>
              <span class="res-value">{{ routeDetails.liters }} L</span>
            </div>
          </div>
          <div class="res-item highlight">
            <i class="fas fa-dollar-sign icon-green"></i>
            <div>
              <span class="res-label">Custo Est.</span>
              <span class="res-value text-green">{{ routeDetails.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}</span>
            </div>
          </div>
        </div>
        <div class="export-actions" style="margin-top: 15px; text-align: right;">
          <button @click="exportOptimizedRoute" class="btn-action-primary" style="padding: 10px 20px; font-size: 0.9rem; width: auto; display: inline-flex; align-items: center; gap: 8px;">
            <i class="fas fa-file-excel"></i> Exportar Rota (Excel)
          </button>
        </div>
      </div>
      
      <!-- Fullscreen Overlay Loader -->
      <div v-if="isSearching" class="fullscreen-loader">
        <div class="loader-content">
          <div class="pulse-ring"></div>
          <h3>Calculando Rota...</h3>
          <p>Otimizando pontos via OpenRouteService</p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

.roteirizador-pro {
  font-family: 'Outfit', sans-serif;
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0f172a;
}

/* Map Background */
.map-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1;
}

/* UI Overlay Layer */
.overlay-ui {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 10;
  pointer-events: none; /* Let clicks pass through to map */
}

.overlay-ui > * {
  pointer-events: auto; /* Re-enable clicks for UI elements */
}

/* Top Bar */
.top-bar {
  position: absolute;
  top: 20px; left: 20px; right: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
}

.top-bar > * {
  pointer-events: auto;
}

.btn-back {
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(10px);
  color: white;
  width: 45px; height: 45px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  text-decoration: none;
  font-size: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s;
}
.btn-back:hover {
  background: rgba(59, 130, 246, 0.8);
  transform: translateY(-2px);
}

.logo-box {
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(10px);
  padding: 10px 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex; align-items: center; gap: 10px;
  color: white;
  font-size: 1.1rem;
}
.text-primary { color: #3b82f6; }

.status-indicator {
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(10px);
  padding: 10px 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  display: flex; align-items: center; gap: 10px;
  font-weight: 500;
  font-size: 0.9rem;
}

.pulse-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #f59e0b;
}
.pulse-dot.active {
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
}

/* Glass Panel (Left) */
.glass-panel {
  position: absolute;
  top: 85px; left: 20px; bottom: 20px;
  width: 360px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  display: flex; flex-direction: column;
  overflow: hidden;
  color: white;
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.panel-header h3 {
  margin: 0; font-size: 1.1rem; font-weight: 600;
  display: flex; align-items: center; gap: 10px;
}

.panel-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
.panel-content::-webkit-scrollbar { width: 6px; }
.panel-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.config-item label {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.75rem; color: #94a3b8; font-weight: 600; text-transform: uppercase;
  margin-bottom: 6px;
}

.glass-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px;
  color: white;
  font-family: inherit; font-size: 0.9rem;
  outline: none; transition: all 0.2s;
}
.glass-input:focus {
  border-color: #3b82f6;
  background: rgba(0, 0, 0, 0.5);
}
.glass-input option { background: #0f172a; color: white; }

.glass-divider {
  border: 0; height: 1px;
  background: rgba(255, 255, 255, 0.05);
  margin: 20px 0;
}

/* Tabs */
.glass-tabs {
  display: flex; gap: 10px; margin-bottom: 20px;
}
.glass-tab {
  flex: 1; padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px; color: #94a3b8;
  font-family: inherit; font-weight: 600; font-size: 0.85rem;
  cursor: pointer; transition: all 0.2s;
  display: flex; justify-content: center; align-items: center; gap: 8px;
}
.glass-tab:hover { background: rgba(255, 255, 255, 0.05); }
.glass-tab.active {
  background: #3b82f6; color: white; border-color: #3b82f6;
}

/* Simple Mode */
.add-stop-row {
  display: flex; gap: 8px;
}
.select-flex { flex: 1; }
.btn-glass {
  background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.1);
  color: white; border-radius: 8px; width: 40px;
  display: flex; justify-content: center; align-items: center;
  cursor: pointer; transition: all 0.2s;
}
.btn-glass.primary { background: #3b82f6; border-color: #3b82f6; }
.btn-glass:hover { transform: translateY(-2px); }

.glass-scroll {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 10px;
  max-height: 250px;
  overflow-y: auto;
}
.glass-scroll::-webkit-scrollbar { width: 4px; }
.glass-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

.empty-state { text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 20px; }

.stop-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px; margin-bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.02);
}
.stop-idx {
  background: #3b82f6; width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: bold; flex-shrink: 0;
}
.stop-info {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}
.stop-info strong { font-size: 0.85rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.stop-info span { font-size: 0.7rem; color: #94a3b8; }
.stop-actions { display: flex; gap: 5px; }
.stop-actions button {
  background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px;
}
.stop-actions button:hover { color: white; }
.stop-actions button.text-danger:hover { color: #ef4444; }

/* Excel Mode */
.drag-drop-zone {
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 12px; padding: 30px 20px;
  text-align: center; cursor: pointer;
  background: rgba(0, 0, 0, 0.2); transition: all 0.2s;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.drag-drop-zone:hover { border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
.upload-icon { font-size: 2rem; color: #3b82f6; }
.drag-drop-zone span { font-size: 0.85rem; color: #94a3b8; }

.excel-stats {
  display: flex; justify-content: space-around;
  background: rgba(0, 0, 0, 0.3); padding: 10px; border-radius: 8px;
  font-size: 0.85rem; font-weight: 600; color: #e2e8f0;
}
.full-width { width: 100%; padding: 12px; font-weight: 600; margin-top: 10px; }

/* Footer Action */
.panel-footer {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.btn-action-primary {
  width: 100%; padding: 15px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white; border: none; border-radius: 12px;
  font-family: inherit; font-weight: 700; font-size: 1rem;
  cursor: pointer; box-shadow: 0 10px 20px -10px rgba(59, 130, 246, 0.5);
  transition: all 0.3s;
}
.btn-action-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 15px 25px -10px rgba(59, 130, 246, 0.6);
}
.btn-action-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Floating Results */
.floating-results {
  position: absolute;
  bottom: 20px; right: 20px;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(16px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  padding: 20px; color: white;
  transform: translateY(150%);
  opacity: 0;
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.floating-results.visible {
  transform: translateY(0); opacity: 1;
}

.results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.results-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }
.btn-close-results { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1.1rem; }

.results-grid { display: flex; gap: 20px; }
.res-item {
  display: flex; align-items: center; gap: 12px;
  background: rgba(0,0,0,0.3); padding: 12px 15px; border-radius: 12px;
}
.res-item i { font-size: 1.4rem; }
.icon-blue { color: #3b82f6; }
.icon-orange { color: #f59e0b; }
.icon-purple { color: #8b5cf6; }
.icon-green { color: #10b981; }

.res-item div { display: flex; flex-direction: column; }
.res-label { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
.res-value { font-size: 1.1rem; font-weight: 800; }
.text-green { color: #10b981; }

.res-item.highlight { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); }

/* Fullscreen Loader */
.fullscreen-loader {
  position: absolute; inset: 0;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex; justify-content: center; align-items: center;
  color: white; flex-direction: column;
}
.pulse-ring {
  width: 60px; height: 60px;
  border-radius: 50%;
  border: 4px solid #3b82f6;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}
.fullscreen-loader h3 { margin: 0; font-size: 1.5rem; font-weight: 700; }
.fullscreen-loader p { color: #94a3b8; margin-top: 5px; }

.spinner-mini {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }
.fade-in { animation: fadeIn 0.3s; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.mt-10 { margin-top: 10px; }
.mt-15 { margin-top: 15px; }
.mt-20 { margin-top: 20px; }

/* Custom Leaflet Pins Overlay Fix */
:deep(.custom-div-icon) { background: none; border: none; }
:deep(.marker-pin) {
  width: 36px; height: 36px;
  border-radius: 50% 50% 50% 0;
  background: #3b82f6;
  position: absolute;
  transform: rotate(-45deg);
  left: 50%; top: 50%;
  margin: -18px 0 0 -18px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.4);
  border: 2px solid white;
}
:deep(.marker-pin span) {
  transform: rotate(45deg);
  color: white; font-size: 0.85rem; font-weight: 800;
}
:deep(.pin-origin) { background: #3b82f6; }
:deep(.pin-dest) { background: #10b981; }

/* FIX FOR LEAFLET TILE GAPS (WHITE/GREY LINES BETWEEN TILES) */
:deep(.leaflet-tile) {
  outline: 1px solid transparent;
  box-shadow: 0 0 1px rgba(0,0,0,0.5);
  margin-top: -1px;
  margin-left: -1px;
}
</style>
