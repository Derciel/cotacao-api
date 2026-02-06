<script setup lang="ts">
import { ref } from 'vue';
import { safeFetch } from '../utils/api-utils';

declare global {
  interface Window {
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  }
}


const client = ref({
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

const isSearching = ref(false);
const isSaving = ref(false);

const lookupCNPJ = async () => {
  const cnpjClean = client.value.cnpj.replace(/\D/g, '');
  if (cnpjClean.length !== 14) {
    return window.showToast('Digite um CNPJ válido com 14 dígitos.', 'warning');
  }

  isSearching.value = true;
  try {
    const res = await safeFetch(`/api/clients/cnpj/${cnpjClean}`);
    if (res.ok && res.data.data) {
      const d = res.data.data;
      client.value.razao_social = d.razao_social || '';
      client.value.fantasia = d.fantasia || '';
      client.value.cep = d.cep || '';
      client.value.cidade = d.cidade || '';
      client.value.estado = d.estado || '';
      
      if (res.data.isAlreadyRegistered) {
        window.showToast('Este cliente já está cadastrado no sistema.', 'warning');
      } else {
        window.showToast('Dados da empresa localizados!', 'success');
      }
      
      // Se houver CEP, tenta buscar endereço
      if (client.value.cep) lookupCEP();
      
    } else {
      window.showToast('CNPJ não encontrado na base externa.', 'error');
    }
  } catch (e) {
    window.showToast('Erro ao consultar CNPJ.', 'error');
  } finally {
    isSearching.value = false;
  }
};

const lookupCEP = async () => {
  const cepClean = client.value.cep.replace(/\D/g, '');
  if (cepClean.length !== 8) return;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepClean}`);
    const d = await res.json();

    if (res.ok) {
      client.value.logradouro = d.street || '';
      client.value.bairro = d.neighborhood || '';
      client.value.cidade = d.city || '';
      client.value.estado = d.state || '';
      window.showToast('Endereço preenchido via CEP.', 'info');
    }
  } catch (e) {
    console.error("Erro CEP:", e);
  }
};

const handleSave = async (e: Event) => {
  e.preventDefault();
  if (!client.value.cnpj || !client.value.razao_social) {
    return window.showToast('Preencha os campos obrigatórios (*)', 'warning');
  }

  isSaving.value = true;
  try {
    const res = await safeFetch('/api/clients', {
      method: 'POST',
      body: JSON.stringify(client.value),
      headers: { 
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      window.showToast('Cliente cadastrado com sucesso!', 'success');
      // Limpar formulário se desejar
      resetForm();
    } else {
      window.showToast(res.data.message || 'Erro ao salvar cliente.', 'error');
    }
  } catch (e) {
    window.showToast('Erro na comunicação com o servidor.', 'error');
  } finally {
    isSaving.value = false;
  }
};

const resetForm = () => {
  client.value = {
    cnpj: '', razao_social: '', fantasia: '', cep: '',
    logradouro: '', numero: '', bairro: '', cidade: '',
    estado: '', inscricao_estadual: '', telefone: '',
    empresa_faturamento: 'NICOPEL'
  };
};

// Formatação básica de CNPJ
const onCnpjInput = (e: any) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 14) v = v.slice(0, 14);
    if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})/, "$1.$2.$3/");
    else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})/, "$1.$2.");
    else if (v.length > 2) v = v.replace(/^(\d{2})/, "$1.");
    client.value.cnpj = v;
};
</script>

<template>
    <div class="glass-card form-card animate-fade-in shadow-lg">
      <form class="premium-form" @submit="handleSave">
        
        <div class="form-grid">
          <!-- Coluna 1: Dados Básicos -->
          <div class="form-section">
            <h3><i class="fas fa-building"></i> Dados Empresariais</h3>
            
            <div class="input-stack">
              <div class="input-group">
                <label>CNPJ <span class="required">*</span></label>
                <div class="input-with-button">
                  <div class="input-with-icon flex-1">
                    <i class="fas fa-id-card"></i>
                    <input 
                      type="text" 
                      placeholder="00.000.000/0000-00" 
                      class="premium-input"
                      :value="client.cnpj"
                      @input="onCnpjInput"
                    >
                    <span v-if="isSearching" class="form-spinner"></span>
                  </div>
                  <button type="button" class="btn-search-cep" @click="lookupCNPJ" :disabled="isSearching" title="Buscar via Brasil API">
                    <i class="fas fa-search" v-if="!isSearching"></i>
                    <span v-else class="loader-tiny"></span>
                  </button>
                </div>
              </div>

              <div class="input-group">
                <label>Razão Social <span class="required">*</span></label>
                <input v-model="client.razao_social" type="text" placeholder="Nome oficial da empresa..." class="premium-input">
              </div>

              <div class="input-group">
                <label>Nome Fantasia</label>
                <input v-model="client.fantasia" type="text" placeholder="Como a empresa é conhecida..." class="premium-input">
              </div>

              <div class="input-row">
                <div class="input-group flex-1">
                  <label>Inc. Estadual</label>
                  <input v-model="client.inscricao_estadual" type="text" placeholder="Número ou Isento" class="premium-input">
                </div>
                <div class="input-group flex-1">
                  <label>Telefone</label>
                  <input v-model="client.telefone" type="text" placeholder="(00) 00000-0000" class="premium-input">
                </div>
              </div>
            </div>
          </div>

          <!-- Coluna 2: Endereço -->
          <div class="form-section">
            <h3><i class="fas fa-map-marker-alt"></i> Localização</h3>
            
            <div class="input-stack">
              <div class="input-row">
                <div class="input-group flex-2">
                  <label>CEP <span class="required">*</span></label>
                  <div class="input-with-button">
                    <input v-model="client.cep" type="text" placeholder="00000-000" class="premium-input">
                    <button type="button" class="btn-search-cep" @click="lookupCEP"><i class="fas fa-search"></i></button>
                  </div>
                </div>
                <div class="input-group flex-1">
                  <label>UF</label>
                  <select v-model="client.estado" class="premium-input">
                    <option value="">UF</option>
                    <option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option>
                    <option value="AM">AM</option><option value="BA">BA</option><option value="CE">CE</option>
                    <option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option>
                    <option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option>
                    <option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option>
                    <option value="PR">PR</option><option value="PE">PE</option><option value="PI">PI</option>
                    <option value="RJ">RJ</option><option value="RN">RN</option><option value="RS">RS</option>
                    <option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option>
                    <option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option>
                  </select>
                </div>
              </div>

              <div class="input-group">
                <label>Logradouro <span class="required">*</span></label>
                <input v-model="client.logradouro" type="text" placeholder="Rua, Avenida, Praça..." class="premium-input">
              </div>

              <div class="input-row">
                <div class="input-group flex-1">
                  <label>Número <span class="required">*</span></label>
                  <input v-model="client.numero" type="text" placeholder="Ex: 123" class="premium-input">
                </div>
                <div class="input-group flex-2">
                  <label>Bairro</label>
                  <input v-model="client.bairro" type="text" placeholder="Nome do bairro..." class="premium-input">
                </div>
              </div>

              <div class="input-group">
                <label>Cidade <span class="required">*</span></label>
                <div class="input-with-icon">
                   <i class="fas fa-city"></i>
                   <input v-model="client.cidade" type="text" placeholder="Nome da cidade..." class="premium-input">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="form-footer">
           <p class="form-tip"><i class="fas fa-info-circle"></i> Os campos marcados com <span>*</span> são obrigatórios.</p>
           <div class="btn-group">
             <button type="reset" class="btn-cancel" @click="resetForm">Limpar Campos</button>
             <button type="submit" class="btn-submit" :disabled="isSaving">
                <i v-if="!isSaving" class="fas fa-check-circle"></i>
                <span v-else class="loader-mini"></span>
                {{ isSaving ? 'Salvando...' : 'Finalizar Cadastro' }}
             </button>
           </div>
        </div>
      </form>
    </div>
</template>

<style scoped>
  .form-card { padding: 40px !important; }
  
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
  }

  .form-section h3 {
    font-size: 1.1rem;
    font-weight: 800;
    color: #111827;
    margin-bottom: 30px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 2px solid #f1f5f9;
  }
  .form-section h3 i { color: #2563eb; font-size: 1.2rem; }

  .input-stack { display: flex; flex-direction: column; gap: 20px; }
  .input-row { display: flex; gap: 15px; }
  .flex-1 { flex: 1; }
  .flex-2 { flex: 2; }

  .input-group label {
    display: block;
    font-size: 0.75rem;
    font-weight: 800;
    color: #6b7280;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .input-group label .required { color: #ef4444; margin-left: 2px; }

  .premium-input {
    width: 100%;
    padding: 14px 18px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 0.95rem;
    color: #111827;
    outline: none;
    transition: 0.2s;
  }
  .premium-input:focus {
    border-color: #2563eb;
    background: white;
    box-shadow: 0 0 0 4px #eff6ff;
  }

  .input-with-icon { position: relative; }
  .input-with-icon i { position: absolute; left: 18px; top: 16px; color: #94a3b8; }
  .input-with-icon input { padding-left: 45px; }

  .form-spinner {
    position: absolute; right: 15px; top: 15px;
    width: 18px; height: 18px; border: 2px solid #e2e8f0;
    border-top: 2px solid #2563eb; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .input-with-button { display: flex; gap: 8px; }
  .btn-search-cep {
    background: #2563eb;
    color: white;
    border: none;
    width: 48px;
    border-radius: 12px;
    cursor: pointer;
    transition: 0.2s;
  }
  .btn-search-cep:hover { background: #1e40af; transform: translateY(-1px); }

  /* Footer */
  .form-footer {
    margin-top: 50px;
    padding-top: 30px;
    border-top: 1px dashed #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
  }

  .form-tip { font-size: 0.85rem; color: #6b7280; }
  .form-tip span { color: #ef4444; font-weight: 700; }

  .btn-group { display: flex; gap: 15px; }
  
  .btn-cancel {
    padding: 14px 25px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    color: #6b7280;
    font-weight: 700;
    cursor: pointer;
    transition: 0.2s;
  }
  .btn-cancel:hover { background: #fef2f2; border-color: #fee2e2; color: #ef4444; }

  .btn-submit {
    padding: 14px 40px;
    background: linear-gradient(135deg, #2563eb, #4f46e5);
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
    transition: 0.2s;
  }
  .btn-submit:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 15px 20px -3px rgba(37, 99, 235, 0.4);
  }
  .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

  .loader-mini {
    width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
    border-top: 2px solid white; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loader-tiny {
    width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
    border-top: 2px solid white; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

  @media (max-width: 1024px) {
    .form-grid { grid-template-columns: 1fr; gap: 40px; }
  }
</style>
