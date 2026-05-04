<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { safeFetch } from '../utils/api-utils';

const props = defineProps<{
  onSuccess?: () => void;
}>();

const isModalOpen = ref(false);
const isSearching = ref(false);
const modalSearch = ref("");
const modalClients = ref<any[]>([]);
const isSaving = ref(false);

const form = reactive({
  clientId: null as number | null,
  clientName: '',
  obs: '',
  packages: [
    { qty: 1, length: 0, width: 0, height: 0, weight: 0 }
  ]
});

const totalVolumes = computed(() => form.packages.reduce((acc, p) => acc + (Number(p.qty) || 0), 0));
const totalWeight = computed(() => form.packages.reduce((acc, p) => acc + (Number(p.qty) * (Number(p.weight) || 0)), 0));

const addPackage = () => {
  form.packages.push({ qty: 1, length: 0, width: 0, height: 0, weight: 0 });
};

const removePackage = (idx: number) => {
  if (form.packages.length > 1) {
    form.packages.splice(idx, 1);
  }
};

const handleSearchInput = async () => {
  if (modalSearch.value.length < 2) return;
  isSearching.value = true;
  try {
    const res = await safeFetch(`/api/clients?search=${encodeURIComponent(modalSearch.value)}&limit=10`);
    if (res.ok) {
      modalClients.value = res.data.data || res.data;
    }
  } catch (e) {
    console.error(e);
  } finally {
    isSearching.value = false;
  }
};

const selectClient = (c: any) => {
  form.clientId = c.id;
  form.clientName = c.fantasia || c.razao_social;
  modalSearch.value = "";
  modalClients.value = [];
};

const openModal = () => {
    isModalOpen.value = true;
};

const saveColeta = async () => {
  if (!form.clientId) return window.showToast("Selecione um cliente.", "warning");
  if (form.packages.some(p => p.weight <= 0)) return window.showToast("Verifique os pesos dos volumes.", "warning");

  isSaving.value = true;
  try {
    // Simulando persistência por enquanto até ter o endpoint de backend
    console.log("Saving Coleta:", form);
    window.showToast("Coleta registrada com sucesso!", "success");
    isModalOpen.value = false;
    if (props.onSuccess) props.onSuccess();
  } catch (e) {
    window.showToast("Erro ao salvar coleta.", "error");
  } finally {
    isSaving.value = false;
  }
};

const formatCurrency = (val: number) => val?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
</script>

<template>
  <div>
    <button @click="openModal" class="btn-new-coleta">
      <i class="fas fa-plus"></i> NOVA SOLICITAÇÃO DE COLETA
    </button>

    <div v-if="isModalOpen" class="modal-overlay" @click.self="isModalOpen = false">
      <div class="modal-box animate-pop">
        <div class="modal-header">
            <h3>Nova Coleta</h3>
            <button @click="isModalOpen = false" class="btn-close-modal">×</button>
        </div>

        <div class="modal-body">
            <!-- Busca de Cliente -->
            <div class="form-section">
                <label class="field-label">Cliente (Destinatário)</label>
                <div v-if="!form.clientId" class="search-wrapper">
                    <input v-model="modalSearch" @input="handleSearchInput" placeholder="Buscar cliente por nome ou CNPJ..." class="pill-input">
                    <div v-if="modalClients.length > 0" class="search-results">
                        <div v-for="c in modalClients" :key="c.id" @click="selectClient(c)" class="result-item">
                            <strong>{{ c.fantasia || c.razao_social }}</strong>
                            <small>{{ c.cidade }}/{{ c.estado }}</small>
                        </div>
                    </div>
                </div>
                <div v-else class="selected-client">
                    <i class="fas fa-check-circle"></i>
                    <span>{{ form.clientName }}</span>
                    <button @click="form.clientId = null; form.clientName = ''" class="btn-change">Alterar</button>
                </div>
            </div>

            <!-- Volumes e Pesos -->
            <div class="form-section mt-20">
                <div class="section-title">
                    <span><i class="fas fa-boxes"></i> Volumes</span>
                    <button @click="addPackage" class="btn-small-add">+ Add Volume</button>
                </div>

                <div class="packages-list">
                    <div v-for="(p, idx) in form.packages" :key="idx" class="package-row">
                        <div class="p-field">
                            <label>Qtd</label>
                            <input type="number" v-model="p.qty" min="1">
                        </div>
                        <div class="p-field">
                            <label>Peso (kg)</label>
                            <input type="number" v-model="p.weight" step="0.1">
                        </div>
                        <div class="p-field dim">
                            <label>Medidas (A x L x C)</label>
                            <div class="dim-inputs">
                                <input type="number" v-model="p.height" placeholder="A">
                                <input type="number" v-model="p.width" placeholder="L">
                                <input type="number" v-model="p.length" placeholder="C">
                            </div>
                        </div>
                        <button @click="removePackage(idx)" class="btn-del-row">×</button>
                    </div>
                </div>
            </div>

            <!-- Resumo -->
            <div class="coleta-summary">
                <div class="sum-item">
                    <small>Total Volumes</small>
                    <strong>{{ totalVolumes }}</strong>
                </div>
                <div class="sum-item">
                    <small>Peso Total</small>
                    <strong>{{ totalWeight.toFixed(2) }} kg</strong>
                </div>
            </div>

            <div class="form-section mt-20">
                <label class="field-label">Observações</label>
                <textarea v-model="form.obs" class="text-area-input" placeholder="Horário de coleta, contato específico..."></textarea>
            </div>
        </div>

        <div class="modal-footer">
            <button @click="isModalOpen = false" class="btn-cancel">Cancelar</button>
            <button @click="saveColeta" class="btn-save" :disabled="isSaving">
                {{ isSaving ? 'Salvando...' : 'Confirmar Coleta' }}
            </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-new-coleta {
    background: var(--primary);
    color: white;
    border: none;
    padding: 14px 25px;
    border-radius: 12px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: 0.2s;
}
.btn-new-coleta:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0, 74, 153, 0.2); }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center; }
.modal-box { background: var(--bg-surface); width: 95%; max-width: 650px; border-radius: 24px; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow-card); border: 1px solid var(--border); }

.modal-header { padding: 20px 30px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; color: var(--text-main); font-weight: 850; font-size: 1.3rem; }
.btn-close-modal { background: none; border: none; font-size: 2rem; color: var(--text-muted); cursor: pointer; }

.modal-body { padding: 30px; max-height: 70vh; overflow-y: auto; }

.form-section { display: flex; flex-direction: column; gap: 10px; }
.field-label { font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }

.search-wrapper { position: relative; }
.search-results { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; z-index: 10; margin-top: 5px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); max-height: 200px; overflow-y: auto; }
.result-item { padding: 12px 15px; border-bottom: 1px solid var(--border); cursor: pointer; }
.result-item:hover { background: var(--bg-input); }
.result-item strong { display: block; color: var(--text-main); font-size: 0.9rem; }
.result-item small { color: var(--text-muted); font-size: 0.75rem; }

.selected-client { background: var(--bg-input); padding: 12px 20px; border-radius: 12px; display: flex; align-items: center; gap: 10px; border: 1px solid var(--primary); }
.selected-client i { color: #10b981; }
.selected-client span { font-weight: 700; color: var(--text-main); flex: 1; }
.btn-change { background: none; border: none; color: var(--primary); font-weight: 700; cursor: pointer; text-decoration: underline; }

.section-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.section-title span { font-weight: 800; color: var(--text-main); font-size: 0.9rem; }
.btn-small-add { background: var(--bg-input); border: 1px solid var(--border); padding: 5px 12px; border-radius: 8px; font-weight: 700; font-size: 0.75rem; cursor: pointer; color: var(--primary); }

.packages-list { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.package-row { display: grid; grid-template-columns: 60px 100px 1fr 40px; gap: 10px; padding: 15px; border-bottom: 1px solid var(--border); align-items: end; background: var(--bg-surface); }
.package-row:last-child { border-bottom: none; }
.p-field { display: flex; flex-direction: column; gap: 5px; }
.p-field label { font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
.p-field input { background: var(--bg-input); border: 1px solid var(--border); padding: 10px; border-radius: 8px; color: var(--text-main); font-weight: 700; width: 100%; }

.dim-inputs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }

.btn-del-row { background: none; border: none; color: #ef4444; font-size: 1.5rem; cursor: pointer; opacity: 0.6; }
.btn-del-row:hover { opacity: 1; }

.coleta-summary { margin-top: 20px; background: var(--primary); color: white; padding: 20px; border-radius: 15px; display: flex; justify-content: space-around; }
.sum-item { text-align: center; }
.sum-item small { display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; opacity: 0.9; margin-bottom: 5px; }
.sum-item strong { font-size: 1.5rem; font-weight: 900; }

.text-area-input { width: 100%; height: 80px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 15px; color: var(--text-main); font-family: inherit; resize: none; }

.modal-footer { padding: 20px 30px; background: var(--bg-input); display: flex; justify-content: flex-end; gap: 15px; }
.btn-cancel { padding: 12px 25px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-surface); font-weight: 700; color: var(--text-muted); cursor: pointer; }
.btn-save { padding: 12px 35px; border-radius: 12px; background: var(--primary); color: white; border: none; font-weight: 800; cursor: pointer; }
.btn-save:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 74, 153, 0.3); }
.btn-save:disabled { opacity: 0.7; cursor: not-allowed; }

.animate-pop { animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes pop { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

.mt-20 { margin-top: 20px; }
.mt-10 { margin-top: 10px; }
</style>
