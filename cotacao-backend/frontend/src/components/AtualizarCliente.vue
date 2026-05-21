<script setup lang="ts">
import { ref } from 'vue';
import { safeFetch } from '../utils/api-utils';

declare global {
  interface Window {
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  }
}

const cnpjInput = ref('');
const isSearching = ref(false);
const isSaving = ref(false);
const searchPerformed = ref(false);

const clientLocal = ref<any>(null);
const clientExternal = ref<any>(null);
const clientExists = ref(false);

const onCnpjInput = (e: any) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 14) v = v.slice(0, 14);
    if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})/, "$1.$2.$3/");
    else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})/, "$1.$2.");
    else if (v.length > 2) v = v.replace(/^(\d{2})/, "$1.");
    cnpjInput.value = v;
};

const lookupCNPJ = async () => {
  const cnpjClean = cnpjInput.value.replace(/\D/g, '');
  if (cnpjClean.length !== 14) {
    return window.showToast('Digite um CNPJ válido com 14 dígitos.', 'warning');
  }

  isSearching.value = true;
  searchPerformed.value = false;
  clientLocal.value = null;
  clientExternal.value = null;
  clientExists.value = false;

  try {
    const res = await safeFetch(`/api/clients/cnpj/${cnpjClean}`);
    if (res.ok && res.data) {
      clientExternal.value = res.data.data;
      clientExists.value = res.data.isAlreadyRegistered;
      
      if (res.data.isAlreadyRegistered && res.data.registeredId) {
        // Buscar os dados locais completos do cliente cadastrado
        const localRes = await safeFetch(`/api/clients/${res.data.registeredId}`);
        if (localRes.ok) {
          clientLocal.value = localRes.data;
        }
        window.showToast('Cliente localizado no banco de dados!', 'info');
      } else {
        window.showToast('CNPJ localizado na base externa, mas não cadastrado localmente.', 'warning');
      }
      searchPerformed.value = true;
    } else {
      window.showToast('CNPJ não encontrado nas bases externas.', 'error');
    }
  } catch (e) {
    window.showToast('Erro ao consultar CNPJ nas APIs.', 'error');
  } finally {
    isSearching.value = false;
  }
};

const isDifferent = (field: string) => {
  if (!clientLocal.value || !clientExternal.value) return false;
  
  const localVal = String(clientLocal.value[field] || '').trim().toUpperCase();
  const externalVal = String(clientExternal.value[field] || '').trim().toUpperCase();
  
  // Tratar CEP de forma limpa
  if (field === 'cep') {
    return localVal.replace(/\D/g, '') !== externalVal.replace(/\D/g, '');
  }
  
  return localVal !== externalVal;
};

const handleUpdate = async () => {
  if (!clientLocal.value || !clientExternal.value) return;

  isSaving.value = true;
  try {
    const res = await safeFetch(`/api/clients/${clientLocal.value.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        razao_social: clientExternal.value.razao_social,
        fantasia: clientExternal.value.fantasia,
        cep: clientExternal.value.cep,
        cidade: clientExternal.value.cidade,
        estado: clientExternal.value.estado
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      window.showToast('Cadastro atualizado com sucesso com os dados da API!', 'success');
      // Recarregar os dados para atualizar a visualização
      const localRes = await safeFetch(`/api/clients/${clientLocal.value.id}`);
      if (localRes.ok) {
        clientLocal.value = localRes.data;
      }
    } else {
      window.showToast(res.data?.message || 'Erro ao atualizar dados do cliente.', 'error');
    }
  } catch (e) {
    window.showToast('Erro de conexão com o servidor.', 'error');
  } finally {
    isSaving.value = false;
  }
};

const handleCreateQuick = async () => {
  if (!clientExternal.value) return;

  isSaving.value = true;
  try {
    const res = await safeFetch('/api/clients', {
      method: 'POST',
      body: JSON.stringify({
        cnpj: clientExternal.value.cnpj,
        razao_social: clientExternal.value.razao_social,
        fantasia: clientExternal.value.fantasia,
        cep: clientExternal.value.cep,
        cidade: clientExternal.value.cidade,
        estado: clientExternal.value.estado,
        empresa_faturamento: 'NICOPEL',
        logradouro: 'Não Informado',
        numero: 'S/N',
        bairro: 'Não Informado'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      window.showToast('Cliente cadastrado com sucesso de forma ágil!', 'success');
      // Recarregar a consulta para entrar no fluxo de "cliente existente"
      await lookupCNPJ();
    } else {
      window.showToast(res.data?.message || 'Erro ao cadastrar cliente de forma rápida.', 'error');
    }
  } catch (e) {
    window.showToast('Erro de comunicação com o servidor.', 'error');
  } finally {
    isSaving.value = false;
  }
};

const formatCNPJ = (v: string) => {
  if (!v) return '';
  const clean = v.replace(/\D/g, '');
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const formatCEP = (v: string) => {
  if (!v) return '';
  const clean = v.replace(/\D/g, '');
  return clean.replace(/^(\d{5})(\d{3})/, "$1-$2");
};
</script>

<template>
  <div class="glass-card main-card animate-fade-in shadow-lg">
    <!-- Barra de Consulta Principal -->
    <div class="search-section">
      <h3 class="section-title"><i class="fas fa-search-dollar"></i> Consulta Rápida de CNPJ</h3>
      <p class="section-desc">Insira o CNPJ da empresa para buscar dados atualizados na base federal (Brasil API) e sincronizar com o cadastro local.</p>
      
      <div class="search-box">
        <div class="input-with-icon flex-1">
          <i class="fas fa-id-card"></i>
          <input 
            type="text" 
            placeholder="00.000.000/0000-00" 
            class="premium-input"
            :value="cnpjInput"
            @input="onCnpjInput"
            @keyup.enter="lookupCNPJ"
            :disabled="isSearching || isSaving"
          >
          <span v-if="isSearching" class="form-spinner"></span>
        </div>
        <button 
          type="button" 
          class="btn-search" 
          @click="lookupCNPJ" 
          :disabled="isSearching || isSaving"
        >
          <i class="fas fa-sync" :class="{ 'fa-spin': isSearching }" v-if="!isSearching"></i>
          <span>{{ isSearching ? 'Consultando...' : 'Consultar APIs' }}</span>
        </button>
      </div>
    </div>

    <!-- Visualização de Resultados -->
    <div v-if="searchPerformed" class="results-section animate-slide-up">
      
      <!-- CASO 1: Cliente já existe no banco (Comparação Lado a Lado) -->
      <div v-if="clientExists && clientLocal && clientExternal" class="comparison-flow">
        
        <div class="alert-box alert-info">
          <i class="fas fa-info-circle"></i>
          <span>Este cliente já está cadastrado no sistema. Abaixo você pode comparar os dados locais atuais com os dados atualizados das APIs de CNPJ. Campos destacados em amarelo possuem divergências.</span>
        </div>

        <div class="comparison-grid">
          
          <!-- Card da Esquerda: Dados Atuais -->
          <div class="comparison-card local-card">
            <div class="card-header">
              <span class="badge badge-local"><i class="fas fa-database"></i> Local (Cadastro Atual)</span>
              <h4>Dados no Banco de Dados</h4>
            </div>
            <div class="card-body">
              <div class="info-group" :class="{ 'highlight-diff': isDifferent('razao_social') }">
                <label>Razão Social</label>
                <div class="info-value">{{ clientLocal.razao_social || 'Não cadastrado' }}</div>
              </div>
              <div class="info-group" :class="{ 'highlight-diff': isDifferent('fantasia') }">
                <label>Nome Fantasia</label>
                <div class="info-value">{{ clientLocal.fantasia || 'Não informado' }}</div>
              </div>
              <div class="info-group" :class="{ 'highlight-diff': isDifferent('cep') }">
                <label>CEP</label>
                <div class="info-value">{{ formatCEP(clientLocal.cep) || 'Não informado' }}</div>
              </div>
              <div class="info-group" :class="{ 'highlight-diff': isDifferent('cidade') }">
                <label>Cidade</label>
                <div class="info-value">{{ clientLocal.cidade || 'Não informada' }}</div>
              </div>
              <div class="info-group" :class="{ 'highlight-diff': isDifferent('estado') }">
                <label>Estado (UF)</label>
                <div class="info-value">{{ clientLocal.estado || 'Não informado' }}</div>
              </div>
            </div>
          </div>

          <!-- Card da Direita: Dados Externos Resolvidos -->
          <div class="comparison-card external-card">
            <div class="card-header">
              <span class="badge badge-external"><i class="fas fa-cloud-download-alt"></i> API (Base Federal)</span>
              <h4>Informações da Consulta</h4>
            </div>
            <div class="card-body">
              <div class="info-group" :class="{ 'highlight-diff': isDifferent('razao_social') }">
                <label>Razão Social</label>
                <div class="info-value">{{ clientExternal.razao_social || 'Não retornado' }}</div>
              </div>
              <div class="info-group" :class="{ 'highlight-diff': isDifferent('fantasia') }">
                <label>Nome Fantasia</label>
                <div class="info-value">{{ clientExternal.fantasia || 'Não retornado' }}</div>
              </div>
              <div class="info-group" :class="{ 'highlight-diff': isDifferent('cep') }">
                <label>CEP</label>
                <div class="info-value">{{ formatCEP(clientExternal.cep) || 'Não retornado' }}</div>
              </div>
              <div class="info-group" :class="{ 'highlight-diff': isDifferent('cidade') }">
                <label>Cidade</label>
                <div class="info-value">{{ clientExternal.cidade || 'Não retornado' }}</div>
              </div>
              <div class="info-group" :class="{ 'highlight-diff': isDifferent('estado') }">
                <label>Estado (UF)</label>
                <div class="info-value">{{ clientExternal.estado || 'Não retornado' }}</div>
              </div>
            </div>
          </div>

        </div>

        <!-- Rodapé com ação de sincronização -->
        <div class="action-footer">
          <button 
            type="button" 
            class="btn-sync" 
            @click="handleUpdate"
            :disabled="isSaving"
          >
            <i class="fas fa-check-double" v-if="!isSaving"></i>
            <span v-else class="loader-mini"></span>
            <span>{{ isSaving ? 'Atualizando...' : 'Confirmar e Atualizar Cadastro Local' }}</span>
          </button>
        </div>

      </div>

      <!-- CASO 2: Cliente NÃO existe no banco (Cadastro Rápido) -->
      <div v-else-if="!clientExists && clientExternal" class="creation-flow">
        
        <div class="alert-box alert-warning">
          <i class="fas fa-exclamation-triangle"></i>
          <span>Este cliente **não está cadastrado** no banco de dados local da Nicopel. Deseja realizar um cadastro rápido e ágil usando estes dados oficiais?</span>
        </div>

        <div class="comparison-card single-card">
          <div class="card-header">
            <span class="badge badge-new"><i class="fas fa-plus"></i> Novo Cliente Localizado</span>
            <h4>Dados Cadastrais da Empresa</h4>
          </div>
          <div class="card-body">
            <div class="info-row">
              <div class="info-group flex-1">
                <label>Razão Social</label>
                <div class="info-value text-bold">{{ clientExternal.razao_social }}</div>
              </div>
              <div class="info-group flex-1">
                <label>Nome Fantasia</label>
                <div class="info-value">{{ clientExternal.fantasia || 'Não informado' }}</div>
              </div>
            </div>
            
            <div class="info-row mt-20">
              <div class="info-group flex-1">
                <label>CNPJ</label>
                <div class="info-value text-code">{{ formatCNPJ(clientExternal.cnpj) }}</div>
              </div>
              <div class="info-group flex-1">
                <label>CEP</label>
                <div class="info-value">{{ formatCEP(clientExternal.cep) }}</div>
              </div>
            </div>

            <div class="info-row mt-20">
              <div class="info-group flex-2">
                <label>Cidade</label>
                <div class="info-value">{{ clientExternal.cidade }}</div>
              </div>
              <div class="info-group flex-1">
                <label>Estado (UF)</label>
                <div class="info-value">{{ clientExternal.estado }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="action-footer">
          <button 
            type="button" 
            class="btn-create" 
            @click="handleCreateQuick"
            :disabled="isSaving"
          >
            <i class="fas fa-user-plus" v-if="!isSaving"></i>
            <span v-else class="loader-mini"></span>
            <span>{{ isSaving ? 'Cadastrando...' : 'Realizar Cadastro Rápido' }}</span>
          </button>
        </div>

      </div>

    </div>
  </div>
</template>

<style scoped>
.main-card {
  padding: 40px !important;
}

.search-section {
  margin-bottom: 40px;
  border-bottom: 1px dashed var(--border);
  padding-bottom: 30px;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-title i {
  color: var(--primary);
}

.section-desc {
  font-size: 0.95rem;
  color: var(--text-light);
  margin-bottom: 25px;
}

.search-box {
  display: flex;
  gap: 15px;
  max-width: 700px;
}

.flex-1 { flex: 1; }
.flex-2 { flex: 2; }
.mt-20 { margin-top: 20px; }

.input-with-icon {
  position: relative;
}

.input-with-icon i {
  position: absolute;
  left: 18px;
  top: 16px;
  color: var(--text-muted);
}

.input-with-icon input {
  padding-left: 45px;
}

.premium-input {
  width: 100%;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  font-size: 1.05rem;
  color: var(--text-main);
  outline: none;
  transition: 0.2s;
}

.premium-input:focus {
  border-color: var(--primary);
  background: var(--bg-surface);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.form-spinner {
  position: absolute;
  right: 15px;
  top: 15px;
  width: 18px;
  height: 18px;
  border: 2px solid #e2e8f0;
  border-top: 2px solid #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn-search {
  padding: 14px 28px;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
  transition: 0.2s;
}

.btn-search:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 15px rgba(37, 99, 235, 0.35);
}

.btn-search:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Fluxos e Cards */
.alert-box {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 18px;
  border-radius: 14px;
  margin-bottom: 30px;
  font-size: 0.92rem;
  line-height: 1.5;
}

.alert-info {
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.2);
  color: #2563eb;
}
.alert-info i { font-size: 1.1rem; margin-top: 2px; }

.alert-warning {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #d97706;
}
.alert-warning i { font-size: 1.1rem; margin-top: 2px; }

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 40px;
}

.comparison-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-card);
  transition: transform 0.3s;
}

.comparison-card:hover {
  transform: translateY(-2px);
}

.local-card {
  border-left: 4px solid var(--text-muted);
}

.external-card {
  border-left: 4px solid #10b981;
  background: rgba(16, 185, 129, 0.02);
}

.single-card {
  max-width: 700px;
  margin: 0 auto 30px auto;
  border-left: 4px solid #f59e0b;
}

.card-header {
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border);
}

.card-header h4 {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 8px 0 0 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-local {
  background: rgba(107, 114, 128, 0.1);
  color: var(--text-muted);
}

.badge-external {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.badge-new {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-row {
  display: flex;
  gap: 20px;
}

.info-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 10px;
  transition: all 0.2s;
}

.info-group label {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main);
}

.text-bold {
  font-weight: 800;
}

.text-code {
  font-family: monospace;
  font-size: 1rem;
}

/* Efeito de Destaque para Divergências */
.highlight-diff {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.05);
}

.highlight-diff label {
  color: #b45309;
}

.highlight-diff .info-value {
  color: #b45309;
}

/* Rodapés de Ação */
.action-footer {
  display: flex;
  justify-content: center;
  padding-top: 20px;
  border-top: 1px dashed var(--border);
}

.btn-sync {
  padding: 16px 40px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  border-radius: 14px;
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.3);
  transition: all 0.2s;
}

.btn-sync:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 15px 25px -5px rgba(16, 185, 129, 0.45);
}

.btn-sync:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-create {
  padding: 16px 40px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  border: none;
  border-radius: 14px;
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 20px -5px rgba(245, 158, 11, 0.3);
  transition: all 0.2s;
}

.btn-create:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 15px 25px -5px rgba(245, 158, 11, 0.45);
}

.btn-create:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loader-mini {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top: 2px solid white;
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
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}

.animate-slide-up {
  animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (max-width: 768px) {
  .comparison-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .info-row {
    flex-direction: column;
    gap: 15px;
  }
}
</style>
