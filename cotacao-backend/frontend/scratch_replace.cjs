const fs = require('fs');
const path = require('path');

const file = path.join('e:', 'Projetos Finalizados', 'projeto-cotacao-2025', 'cotacao-backend', 'frontend', 'src', 'components', 'RoteirizadorPro.vue');
const content = fs.readFileSync(file, 'utf-8');

const scriptEnd = content.indexOf('</script>');
if (scriptEnd === -1) {
    console.error('Script end not found');
    process.exit(1);
}

const scriptPart = content.substring(0, scriptEnd + 9);

const newTemplate = `

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

</style>
`;

fs.writeFileSync(file, scriptPart + newTemplate);
console.log('Successfully replaced template and styles.');
