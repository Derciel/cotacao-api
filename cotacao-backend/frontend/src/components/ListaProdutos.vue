<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { safeFetch } from '../utils/api-utils';

interface Product {
  id: number;
  nome: string;
  categoria: string;
  peso_caixa_kg: number;
  unidades_caixa: number;
  medida_cm: string;
  valor_unitario: number;
  peso_unitario_kg: number;
}

const products = ref<Product[]>([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const errorMessage = ref('');
const searchTerm = ref('');
const filterCategoria = ref('');

// Estado do Modal de Edição
const isModalOpen = ref(false);
const editingProduct = ref<Product | null>(null);

// Estado do Modal de Exclusão
const isDeleteModalOpen = ref(false);
const productToDelete = ref<Product | null>(null);
const isDeleting = ref(false);

const fetchProducts = async () => {
  console.log("Iniciando busca de produtos...");
  
  // Aguarda um breve momento para garantir que o script global do MainLayout carregou
  if (!(window as any).safeFetch) {
    console.log("window.safeFetch não encontrado, aguardando 500ms...");
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  isLoading.value = true;
  errorMessage.value = '';
  
  try {
    const fetchFn = (window as any).safeFetch || safeFetch;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn("Fetch timeout atingido (15s)");
      controller.abort();
    }, 15000);
    
    console.log("Executando fetch em /api/products...");
    const res = await fetchFn('/api/products', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    console.log("Resposta da API recebida:", res?.status);
    
    if (res && res.ok) {
      const data = res.data;
      const finalData = Array.isArray(data) ? data : (data?.data || []);
      products.value = finalData;
      console.log("Produtos processados:", products.value.length);
      
      if (products.value.length === 0) {
        console.warn("API retornou lista vazia.");
      }
    } else {
      console.error("Erro na resposta da API:", res);
      errorMessage.value = res?.data?.message || `Erro do servidor (${res?.status || 'Conexão interrompida'})`;
    }
  } catch (error: any) {
    console.error("Exceção capturada no fetchProducts:", error);
    if (error.name === 'AbortError') {
      errorMessage.value = "O servidor demorou demais para responder. Tente recarregar a página.";
    } else {
      errorMessage.value = "Não foi possível carregar os itens. Verifique sua conexão.";
    }
  } finally {
    console.log("Estado de carregamento finalizado.");
    isLoading.value = false;
  }
};

const filteredProducts = computed(() => {
  return products.value.filter(p => {
    // Proteção contra campos nulos vindos do banco
    const nome = p.nome || '';
    const categoria = p.categoria || '';
    
    const matchesSearch = nome.toLowerCase().includes(searchTerm.value.toLowerCase());
    const matchesCategory = filterCategoria.value === '' || categoria === filterCategoria.value;
    return matchesSearch && matchesCategory;
  });
});

const openEditModal = (product: Product) => {
  editingProduct.value = { ...product };
  isModalOpen.value = true;
};

const closeEditModal = () => {
  isModalOpen.value = false;
  editingProduct.value = null;
};

const saveProduct = async () => {
  if (!editingProduct.value) return;
  
  isSubmitting.value = true;
  try {
    const res = await safeFetch(`/api/products/${editingProduct.value.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...editingProduct.value,
        peso_caixa_kg: Number(editingProduct.value.peso_caixa_kg),
        unidades_caixa: Number(editingProduct.value.unidades_caixa),
        valor_unitario: Number(editingProduct.value.valor_unitario),
        // Adicionando campo legado para consistência
        peso_unitario_kg: Number((Number(editingProduct.value.peso_caixa_kg) / Number(editingProduct.value.unidades_caixa)).toFixed(3))
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      window.showToast?.("Item atualizado com sucesso!", "success");
      await fetchProducts();
      closeEditModal();
    } else {
      throw new Error(res.data?.message || "Erro ao atualizar item");
    }
  } catch (error: any) {
    window.showToast?.(error.message || "Erro de conexão", "error");
  } finally {
    isSubmitting.value = false;
  }
};

const openDeleteModal = (product: Product) => {
  productToDelete.value = product;
  isDeleteModalOpen.value = true;
};

const closeDeleteModal = () => {
  isDeleteModalOpen.value = false;
  productToDelete.value = null;
};

const confirmDelete = async () => {
  if (!productToDelete.value) return;
  
  isDeleting.value = true;
  try {
    const fetchFn = (window as any).safeFetch || safeFetch;
    const res = await fetchFn(`/api/products/${productToDelete.value.id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      window.showToast?.("Item removido com sucesso!", "success");
      await fetchProducts();
      closeDeleteModal();
    } else {
      throw new Error(res.data?.message || "Erro ao excluir item");
    }
  } catch (error: any) {
    window.showToast?.(error.message || "Erro de conexão", "error");
  } finally {
    isDeleting.value = false;
  }
};

const formatCurrency = (value: any) => {
  if (value === null || value === undefined || value === '') return '---';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '---';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

const formatNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toString();
};

onMounted(fetchProducts);
</script>

<template>
  <div class="list-container">
    <div class="filters-card glass-card">
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input v-model="searchTerm" type="text" placeholder="Buscar por nome do produto..." class="search-input">
      </div>
      <div class="category-filter">
        <select v-model="filterCategoria" class="pill-select">
          <option value="">Todas Categorias</option>
          <option value="POTE">POTE</option>
          <option value="CAIXA">CAIXA</option>
          <option value="OUTROS">OUTROS</option>
        </select>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Carregando itens...</p>
    </div>

    <div v-else-if="errorMessage" class="error-state">
      <i class="fas fa-exclamation-triangle"></i>
      <p>{{ errorMessage }}</p>
      <button @click="fetchProducts" class="btn-primary">TENTAR NOVAMENTE</button>
    </div>

    <div v-else-if="filteredProducts.length === 0" class="empty-state">
      <i class="fas fa-box-open"></i>
      <p>Nenhum item encontrado.</p>
      <a href="/cadastrar-item" class="btn-primary">CADASTRAR PRIMEIRO ITEM</a>
    </div>

    <div v-else class="products-grid">
      <div v-for="product in filteredProducts" :key="product.id" class="product-card glass-card">
        <div class="product-header">
          <span class="category-badge" :class="(product.categoria || '').toLowerCase()">{{ product.categoria || 'OUTROS' }}</span>
          <span class="product-id">#{{ product.id }}</span>
        </div>
        
        <h3 class="product-name">{{ product.nome }}</h3>
        
        <div class="product-details">
          <div class="detail-item">
            <span class="label">Peso Caixa:</span>
            <span class="value">{{ formatNumber(product.peso_caixa_kg) }} kg</span>
          </div>
          <div class="detail-item">
            <span class="label">Unid. Caixa:</span>
            <span class="value">{{ formatNumber(product.unidades_caixa) }} un</span>
          </div>
          <div class="detail-item">
            <span class="label">Medidas:</span>
            <span class="value">{{ product.medida_cm || '---' }}</span>
          </div>
          <div class="detail-item price">
            <span class="label">Valor Unit:</span>
            <span class="value">{{ formatCurrency(product.valor_unitario) }}</span>
          </div>
        </div>

        <div class="product-actions">
          <button @click="openEditModal(product)" class="btn-edit">
            <i class="fas fa-edit"></i> EDITAR
          </button>
          <button @click="openDeleteModal(product)" class="btn-delete-icon" title="Excluir Item">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Confirmação de Exclusão -->
    <div v-if="isDeleteModalOpen" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-content glass-card animate-slide-up delete-modal">
        <div class="delete-icon-wrapper">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3>Excluir Item?</h3>
        <p>Você está prestes a excluir <strong>{{ productToDelete?.nome }}</strong>. Esta ação não pode ser desfeita.</p>
        
        <div class="modal-footer-centered">
          <button @click="closeDeleteModal" class="btn-cancel" :disabled="isDeleting">CANCELAR</button>
          <button @click="confirmDelete" class="btn-confirm-delete" :disabled="isDeleting">
            {{ isDeleting ? 'EXCLUINDO...' : 'SIM, EXCLUIR' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Edição -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal-content glass-card animate-slide-up">
        <div class="modal-header">
          <h3><i class="fas fa-edit"></i> Editar Item #{{ editingProduct?.id }}</h3>
          <button @click="closeEditModal" class="btn-close">&times;</button>
        </div>
        
        <form v-if="editingProduct" @submit.prevent="saveProduct" class="edit-form">
          <div class="form-group full-width">
            <label>Nome do Produto</label>
            <input v-model="editingProduct.nome" type="text" class="pill-input" required>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label>Categoria</label>
              <select v-model="editingProduct.categoria" class="pill-input">
                <option value="POTE">POTE</option>
                <option value="CAIXA">CAIXA</option>
                <option value="OUTROS">OUTROS</option>
              </select>
            </div>
            <div class="form-group">
              <label>Valor Unitário (R$)</label>
              <input v-model="editingProduct.valor_unitario" type="number" step="0.01" class="pill-input">
            </div>
          </div>

          <div class="grid-3">
            <div class="form-group">
              <label>Peso Caixa (kg)</label>
              <input v-model="editingProduct.peso_caixa_kg" type="number" step="0.001" class="pill-input" required>
            </div>
            <div class="form-group">
              <label>Unid. Caixa</label>
              <input v-model="editingProduct.unidades_caixa" type="number" class="pill-input" required>
            </div>
            <div class="form-group">
              <label>Medidas (CxLxA)</label>
              <input v-model="editingProduct.medida_cm" type="text" placeholder="43x31x27" class="pill-input">
            </div>
          </div>

          <div class="form-footer">
            <button type="button" @click="closeEditModal" class="btn-cancel" :disabled="isSubmitting">CANCELAR</button>
            <button type="submit" class="btn-save" :disabled="isSubmitting">
              {{ isSubmitting ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.filters-card {
  display: flex;
  gap: 20px;
  padding: 20px;
  margin-bottom: 30px;
  border-radius: 16px;
  align-items: center;
}

.search-box {
  flex: 1;
  position: relative;
}

.search-box i {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  padding: 12px 15px 12px 45px;
  border-radius: 12px;
  border: 2px solid var(--border);
  background: var(--bg-input);
  font-weight: 600;
  transition: 0.3s;
}

.search-input:focus {
  border-color: var(--primary);
  outline: none;
  background: white;
}

.pill-select {
  padding: 12px 20px;
  border-radius: 12px;
  border: 2px solid var(--border);
  background: var(--bg-input);
  font-weight: 700;
  color: var(--text-main);
  cursor: pointer;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.product-card {
  padding: 25px;
  border-radius: 20px;
  transition: 0.3s;
  border: 1px solid var(--border);
}

.product-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  border-color: var(--primary);
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.category-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
}

.category-badge.pote { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.category-badge.caixa { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.category-badge.outros { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }

.product-id {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 600;
}

.product-name {
  font-size: 1.2rem;
  font-weight: 850;
  color: var(--text-main);
  margin-bottom: 20px;
  line-height: 1.3;
}

.product-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.detail-item .label {
  color: var(--text-muted);
  font-weight: 600;
}

.detail-item .value {
  color: var(--text-main);
  font-weight: 700;
}

.detail-item.price {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.detail-item.price .value {
  color: var(--primary);
  font-size: 1.1rem;
}

.product-actions {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 10px;
}

.btn-edit {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: white;
  color: var(--text-muted);
  font-weight: 800;
  font-size: 0.8rem;
  cursor: pointer;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-edit:hover {
  background: var(--bg-body);
  color: var(--primary);
  border-color: var(--primary);
}

.btn-delete-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: white;
  color: #ef4444;
  cursor: pointer;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-delete-icon:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  transform: scale(1.05);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.modal-content {
  width: 100%;
  max-width: 600px;
  padding: 30px;
  border-radius: 24px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.8rem;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-main);
}

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }

.pill-input {
  padding: 12px 15px;
  border-radius: 12px;
  border: 2px solid var(--border);
  background: var(--bg-input);
  font-weight: 600;
}

.pill-input:focus {
  border-color: var(--primary);
  background: white;
  outline: none;
}

.form-footer {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.btn-cancel {
  padding: 12px 20px;
  border-radius: 12px;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  font-weight: 700;
  cursor: pointer;
}

.btn-save {
  padding: 12px 30px;
  border-radius: 12px;
  border: none;
  background: var(--primary);
  color: white;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 74, 153, 0.2);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-slide-up {
  animation: slideUp 0.3s ease-out;
}

/* Delete Modal Specifics */
.delete-modal {
  max-width: 400px;
  text-align: center;
}

.delete-icon-wrapper {
  width: 60px;
  height: 60px;
  background: #fee2e2;
  color: #ef4444;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  margin: 0 auto 20px;
}

.modal-footer-centered {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 25px;
}

.btn-confirm-delete {
  padding: 12px 25px;
  border-radius: 12px;
  border: none;
  background: #ef4444;
  color: white;
  font-weight: 800;
  cursor: pointer;
  transition: 0.2s;
}

.btn-confirm-delete:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
}

.loading-state, .empty-state, .error-state {
  text-align: center;
  padding: 60px;
  background: white;
  border-radius: 20px;
  border: 1px solid var(--border);
}

.error-state {
  border-color: #fee2e2;
  background: #fffcfc;
}

.error-state i {
  font-size: 3rem;
  color: #ef4444;
  margin-bottom: 20px;
}

.error-state p {
  color: #64748b;
  margin-bottom: 20px;
  font-size: 1.1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 74, 153, 0.1);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state i {
  font-size: 3rem;
  color: var(--border);
  margin-bottom: 20px;
}

.empty-state p {
  color: var(--text-muted);
  margin-bottom: 20px;
  font-size: 1.1rem;
}

.btn-primary {
  display: inline-block;
  background: var(--primary);
  color: white;
  padding: 12px 25px;
  border-radius: 12px;
  font-weight: 800;
  text-decoration: none;
  transition: 0.3s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 74, 153, 0.3);
}

@media (max-width: 600px) {
  .filters-card { flex-direction: column; align-items: stretch; }
}
</style>
