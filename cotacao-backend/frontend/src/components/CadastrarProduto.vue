<script setup lang="ts">
import { reactive, ref } from 'vue';
import { safeFetch } from '../utils/api-utils';

const isSubmitting = ref(false);

const form = reactive({
  nome: '',
  categoria: 'POTE',
  peso_caixa_kg: null as number | null,
  unidades_caixa: null as number | null,
  medida_cm: '',
  valor_unitario: null as number | null,
});

const resetForm = () => {
  form.nome = '';
  form.categoria = 'POTE';
  form.peso_caixa_kg = null;
  form.unidades_caixa = null;
  form.medida_cm = '';
  form.valor_unitario = null;
};

const submitForm = async () => {
  if (!form.nome || !form.peso_caixa_kg || !form.unidades_caixa) {
    window.showToast?.("Preencha todos os campos obrigatórios.", "warning");
    return;
  }

  isSubmitting.value = true;
  try {
    const res = await safeFetch('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        peso_caixa_kg: Number(form.peso_caixa_kg),
        unidades_caixa: Number(form.unidades_caixa),
        valor_unitario: form.valor_unitario ? Number(form.valor_unitario) : null,
        // Adicionando campo legado como opcional para evitar erros no backend
        peso_unitario_kg: Number((Number(form.peso_caixa_kg) / Number(form.unidades_caixa)).toFixed(3))
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      window.showToast?.("Item cadastrado com sucesso!", "success");
      resetForm();
    } else {
      throw new Error(res.data?.message || "Erro ao cadastrar item");
    }
  } catch (error: any) {
    console.error("Erro no cadastro:", error);
    window.showToast?.(error.message || "Erro de conexão com o servidor.", "error");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="registration-container">
    <div class="glass-card registration-card">
      <div class="card-header">
        <div class="icon-box">
          <i class="fas fa-box-open"></i>
        </div>
        <div>
          <h2>Novo Item</h2>
          <p>Cadastre um novo produto na base do sistema.</p>
        </div>
      </div>

      <form @submit.prevent="submitForm" class="registration-form">
        <div class="form-section">
          <div class="form-group full-width">
            <label>Nome do Produto <span class="required">*</span></label>
            <input v-model="form.nome" type="text" placeholder="Ex: Pote Redondo 500ml" class="pill-input" required>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label>Categoria</label>
              <select v-model="form.categoria" class="pill-input">
                <option value="POTE">POTE</option>
                <option value="CAIXA">CAIXA</option>
                <option value="OUTROS">OUTROS</option>
              </select>
            </div>
            <div class="form-group">
              <label>Valor Unitário (R$)</label>
              <input v-model="form.valor_unitario" type="number" step="0.01" placeholder="0.00" class="pill-input">
            </div>
          </div>

          <div class="grid-3">
            <div class="form-group">
              <label>Peso Caixa (kg) <span class="required">*</span></label>
              <input v-model="form.peso_caixa_kg" type="number" step="0.001" placeholder="0.000" class="pill-input" required>
            </div>
            <div class="form-group">
              <label>Unid. por Caixa <span class="required">*</span></label>
              <input v-model="form.unidades_caixa" type="number" placeholder="0" class="pill-input" required>
            </div>
            <div class="form-group">
              <label>Medidas (CxLxA)</label>
              <input v-model="form.medida_cm" type="text" placeholder="43x31x27" class="pill-input">
              <small class="hint">Formato: Comprimento x Largura x Altura</small>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" @click="resetForm" class="btn-secondary" :disabled="isSubmitting">
            <i class="fas fa-eraser"></i> Limpar
          </button>
          <button type="submit" class="btn-primary" :disabled="isSubmitting">
            <i v-if="!isSubmitting" class="fas fa-check"></i>
            <span v-else class="btn-spinner"></span>
            {{ isSubmitting ? 'CADASTRANDO...' : 'CADASTRAR PRODUTO' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.registration-container {
  padding: 40px 20px;
  max-width: 800px;
  margin: 0 auto;
}

.registration-card {
  padding: 40px;
  border-radius: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 40px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 25px;
}

.icon-box {
  width: 60px;
  height: 60px;
  background: rgba(0, 74, 153, 0.1);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  border-radius: 16px;
}

.card-header h2 {
  font-size: 1.8rem;
  font-weight: 850;
  color: var(--primary);
  margin-bottom: 5px;
}

.card-header p {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-main);
  margin-left: 5px;
}

.required { color: #eb445a; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
.full-width { grid-column: span 3; }

.pill-input {
  width: 100%;
  padding: 12px 18px;
  border-radius: 12px;
  border: 2px solid var(--border);
  background: var(--bg-input);
  font-size: 1rem;
  color: var(--text-main);
  transition: 0.3s;
  font-weight: 600;
}

.pill-input:focus {
  border-color: var(--primary);
  background: white;
  outline: none;
}

.hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-left: 5px;
}

.form-actions {
  margin-top: 50px;
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  border-top: 1px solid var(--border);
  padding-top: 30px;
}

.btn-primary {
  background: var(--primary);
  color: white;
  border: none;
  padding: 15px 35px;
  border-radius: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: 0.3s;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 12px rgba(0, 74, 153, 0.2);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(0, 74, 153, 0.3);
}

.btn-secondary {
  background: var(--bg-body);
  color: var(--text-muted);
  border: 1px solid var(--border);
  padding: 15px 30px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.3s;
}

.btn-secondary:hover:not(:disabled) {
  background: #f1f5f9;
  color: var(--text-main);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .registration-card { padding: 25px; }
  .form-actions { flex-direction: column-reverse; }
  .btn-primary, .btn-secondary { width: 100%; justify-content: center; }
}
</style>
