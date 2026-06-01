<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { safeFetch } from '../utils/api-utils';

declare global {
  interface Window {
    L: any;
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  }
}

const clients = ref<any[]>([]);
const selectedClientId = ref<number | null>(null);
const selectedClient = ref<any>(null);

const originCep = ref('86087-350'); // CEP padrão Londrina/PR
const destCep = ref('');
const truckConsumo = ref(3.5); // km/l padrão
const fuelType = ref<'dieselS10' | 'gasolina' | 'etanol'>('dieselS10');
const fuelPrice = ref(5.88); // Valor médio padrão para PR

const isSearching = ref(false);
const isMapLoading = ref(false);
const routeCalculated = ref(false);

const routeDetails = ref({
  distance: 0,
  duration: '',
  liters: 0,
  cost: 0
});

// Cache local de preços de combustíveis por UF
const fuelPricesCache = ref<any>(null);

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
    const res = await safeFetch('/api/clients');
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

  // Layer elegante CartoDB Dark Matter / Positron de acordo com o tema do sistema
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
    
    // Remover camadas antigas e adicionar a nova baseada no tema
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

// Observa a seleção do cliente
watch(selectedClientId, async (newId) => {
  if (!newId) return;
  const client = clients.value.find(c => c.id === newId);
  if (client) {
    selectedClient.value = client;
    destCep.value = client.cep || '';
    updateFuelPrice();
  }
});

// Observa o tipo de combustível
watch(fuelType, () => {
  updateFuelPrice();
});

const updateFuelPrice = () => {
  if (!selectedClient.value || !fuelPricesCache.value) return;
  
  const uf = (selectedClient.value.estado || 'PR').toUpperCase();
  const prices = fuelPricesCache.value[uf] || { dieselS10: 6.05, gasolina: 5.90, etanol: 3.98 };
  
  fuelPrice.value = Number(prices[fuelType.value]);
};

// Geocodificação de CEP via API pública do Nominatim (resiliente)
const geocodeCep = async (cep: string): Promise<[number, number] | null> => {
  const clean = cep.replace(/\D/g, '');
  if (!clean || clean.length < 8) return null;

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&postalcode=${clean}&country=Brazil&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    }
  } catch (e) {
    console.error(`Erro ao geocodificar CEP ${cep}:`, e);
  }
  return null;
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

// Calcular Rota pelas ruas via OSRM e Computar Custos
const calculateRoute = async () => {
  if (!originCep.value || !destCep.value) {
    return window.showToast('Informe os CEPs de origem e destino.', 'warning');
  }

  isSearching.value = true;
  routeCalculated.value = false;
  clearMap();

  try {
    // 1. Geocodificar Origem e Destino em coordenadas lat/lon
    const coordOrigem = await geocodeCep(originCep.value);
    if (!coordOrigem) {
      isSearching.value = false;
      return window.showToast('Não foi possível localizar as coordenadas do CEP de Origem.', 'error');
    }

    const coordDestino = await geocodeCep(destCep.value);
    if (!coordDestino) {
      isSearching.value = false;
      return window.showToast('Não foi possível localizar as coordenadas do CEP de Destino.', 'error');
    }

    // 2. Chamar a API pública de Roteirização do OSRM (driving pelas ruas e rodovias)
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordOrigem[1]},${coordOrigem[0]};${coordDestino[1]},${coordDestino[0]}?overview=full&geometries=geojson`;
    const resRoute = await fetch(osrmUrl);
    
    if (!resRoute.ok) {
      isSearching.value = false;
      return window.showToast('Erro ao traçar rota real pelas rodovias no servidor de mapas.', 'error');
    }

    const routeData = await resRoute.json();
    if (!routeData.routes || routeData.routes.length === 0) {
      isSearching.value = false;
      return window.showToast('Nenhuma rota viária viável encontrada entre os pontos.', 'warning');
    }

    const route = routeData.routes[0];
    const distanceKm = route.distance / 1000; // metros para km
    const durationStr = formatDuration(route.duration); // segundos para formatado

    // 3. Efetuar Cálculos Logísticos
    const totalLiters = distanceKm / truckConsumo.value;
    const totalCost = totalLiters * fuelPrice.value;

    routeDetails.value = {
      distance: Number(distanceKm.toFixed(1)),
      duration: durationStr,
      liters: Number(totalLiters.toFixed(1)),
      cost: Number(totalCost.toFixed(2))
    };

    // 4. Desenhar Rota no Leaflet
    const L = window.L;
    
    // Desenhar o traçado GeoJSON da estrada
    routeLayer.value = L.geoJSON(route.geometry, {
      style: {
        color: '#3b82f6',
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }
    }).addTo(map.value);

    // Ícones personalizados
    const iconOrigem = L.divIcon({
      html: '<div class="marker-pin pin-origin"><i class="fas fa-play"></i></div>',
      className: 'custom-div-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });

    const iconDestino = L.divIcon({
      html: '<div class="marker-pin pin-dest"><i class="fas fa-flag-checkered"></i></div>',
      className: 'custom-div-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });

    // Criar marcadores com popup
    const markerOrigem = L.marker(coordOrigem, { icon: iconOrigem })
      .bindPopup(`<strong>Origem (Partida)</strong><br>CEP: ${originCep.value}`)
      .addTo(map.value);

    const markerDestino = L.marker(coordDestino, { icon: iconDestino })
      .bindPopup(`<strong>Destino (Cliente: ${selectedClient.value?.razao_social || 'Desconhecido'})</strong><br>CEP: ${destCep.value}`)
      .addTo(map.value);

    markers.value.push(markerOrigem);
    markers.value.push(markerDestino);

    // Ajustar o enquadramento do mapa para englobar toda a rota traçada
    const bounds = L.latLngBounds(coordOrigem, coordDestino);
    map.value.fitBounds(bounds, { padding: [50, 50] });

    routeCalculated.value = true;
    window.showToast('Cálculo de rota real e combustível realizado com sucesso!', 'success');
  } catch (err) {
    console.error(err);
    window.showToast('Erro interno de comunicação com as APIs de mapas.', 'error');
  } finally {
    isSearching.value = false;
  }
};
</script>

<template>
  <div class="router-dashboard-wrapper">
    <header class="page-header">
      <div class="header-left">
        <h1>Programação de Rota</h1>
        <p>Mapeamento de rotas reais pelas estradas e cálculo de consumo logístico de combustível por Estado (UF).</p>
      </div>
    </header>

    <div class="routing-grid mt-20">
      <!-- Painel Esquerdo: Parametrização -->
      <div class="glass-card panel-card animate-fade-in">
        <h3 class="panel-title"><i class="fas fa-sliders-h"></i> Parâmetros da Viagem</h3>
        <p class="panel-desc">Selecione o cliente cadastrado para buscar as coordenadas viárias reais e planejar a rota.</p>

        <form @submit.prevent="calculateRoute" class="form-container mt-15">
          <div class="form-group">
            <label>Cliente de Destino</label>
            <select v-model="selectedClientId" class="premium-select">
              <option :value="null" disabled>Selecione um cliente...</option>
              <option v-for="client in clients" :key="client.id" :value="client.id">
                {{ client.razao_social }} ({{ client.estado }})
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>CEP Origem</label>
              <input type="text" v-model="originCep" placeholder="86087-350" class="premium-input" />
            </div>
            <div class="form-group flex-1">
              <label>CEP Destino</label>
              <input type="text" v-model="destCep" placeholder="Selecione um cliente..." class="premium-input" />
            </div>
          </div>

          <div class="form-row mt-10">
            <div class="form-group flex-1">
              <label>Consumo do Veículo (km/L)</label>
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

          <div class="form-group mt-10">
            <label>Preço Combustível (R$/Litro)</label>
            <div class="price-input-wrapper">
              <span class="currency-prefix">R$</span>
              <input type="number" step="0.01" v-model="fuelPrice" class="premium-input pl-30" />
              <span class="uf-tag" v-if="selectedClient">
                ANP: {{ selectedClient.estado || 'PR' }}
              </span>
            </div>
          </div>

          <button type="submit" class="btn-calculate mt-20" :disabled="isSearching">
            <i class="fas fa-route" :class="{ 'fa-spin': isSearching }" v-if="!isSearching"></i>
            <span v-else class="spinner-mini"></span>
            <span>{{ isSearching ? 'Processando Rota...' : 'Calcular Rota e Custos' }}</span>
          </button>
        </form>

        <!-- Indicadores Premium de Resultado -->
        <div v-if="routeCalculated" class="indicators-section mt-25 animate-slide-up">
          <h4 class="indicators-title"><i class="fas fa-calculator"></i> Estimativas de Viagem</h4>
          <div class="indicators-grid mt-10">
            <div class="indicator-card">
              <span class="ind-label"><i class="fas fa-road"></i> Distância</span>
              <span class="ind-value">{{ routeDetails.distance }} km</span>
            </div>
            <div class="indicator-card">
              <span class="ind-label"><i class="fas fa-clock"></i> Duração</span>
              <span class="ind-value">{{ routeDetails.duration }}</span>
            </div>
            <div class="indicator-card">
              <span class="ind-label"><i class="fas fa-gas-pump"></i> Consumo</span>
              <span class="ind-value">{{ routeDetails.liters }} Litros</span>
            </div>
            <div class="indicator-card glow-green">
              <span class="ind-label"><i class="fas fa-dollar-sign"></i> Custo Combustível</span>
              <span class="ind-value highlight">{{ routeDetails.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Painel Direito: Mapa Interativo Leaflet -->
      <div class="glass-card map-card">
        <div class="map-header">
          <div class="header-details">
            <i class="fas fa-map-marked-alt text-primary"></i>
            <h3>Mapa Logístico Interativo</h3>
            <span class="badge" :class="routeCalculated ? 'badge-success' : 'badge-neutral'">
              {{ routeCalculated ? 'Rota Traçada' : 'Aguardando Seleção' }}
            </span>
          </div>
        </div>
        <div id="map-container" class="map-view"></div>
        <div v-if="isSearching" class="map-overlay">
          <div class="spinner-blue"></div>
          <p class="mt-10">Geocodificando e traçando rota viária pelas ruas...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.routing-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 25px;
  min-height: 650px;
}

.panel-card {
  padding: 30px;
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

/* Inputs Premium */
.form-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.flex-1 { flex: 1; }
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  text-transform: uppercase;
}

.btn-calculate {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
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
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  transition: all 0.2s ease;
}

.btn-calculate:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.35);
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

/* Indicadores de Estimativa */
.indicators-section {
  margin-top: 20px;
  border-top: 1px dashed var(--border);
  padding-top: 20px;
}

.indicators-title {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--text-main);
  text-transform: uppercase;
  letter-spacing: 0.5px;
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
  font-size: 1rem;
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

/* Mapa Interativo */
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
  min-height: 500px;
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

.mt-10 { margin-top: 10px; }
.mt-20 { margin-top: 20px; }
.mt-25 { margin-top: 25px; }

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

:deep(.pin-origin) {
  background: #10b981;
}

:deep(.pin-dest) {
  background: #2563eb;
}

@media (max-width: 1024px) {
  .routing-grid {
    grid-template-columns: 1fr;
  }
}
</style>
