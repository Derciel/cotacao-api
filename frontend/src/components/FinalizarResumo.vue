<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { safeFetch } from '../utils/api-utils';

const props = defineProps<{
    quotationId: string | null;
}>();

const quotation = ref<any>(null);
const todayQuotations = ref<any[]>([]);
const isLoading = ref(true);

const fetchDetails = async () => {
    if (!props.quotationId) return;
    isLoading.value = true;
    try {
        const [qRes, historyRes] = await Promise.all([
            safeFetch(`/api/quotations/${props.quotationId}`),
            safeFetch(`/api/quotations`)
        ]);

        if (qRes.ok) quotation.value = qRes.data;
        if (historyRes.ok) {
            todayQuotations.value = historyRes.data.data || historyRes.data || [];
        }
    } catch (e) {
        console.error("Erro ao buscar dados da finalização:", e);
    } finally {
        isLoading.value = false;
    }
};

const formatCurrency = (val: number) => {
    return val?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
};

const printPage = () => {
    window.print();
};

onMounted(() => {
    fetchDetails();
});
</script>

<template>
    <div v-if="isLoading" class="loading-state">
        <i class="fas fa-circle-notch fa-spin"></i> Carregando detalhes...
    </div>
    <div v-else class="grid-layout animate-fade-in">
        <section class="result-card glass-card shadow-lg">
            <div class="card-header">DETALHES DA COTAÇÃO #{{ quotationId }}</div>
            <div class="card-content">
                <div class="info-row">
                    <span>Cliente:</span>
                    <strong>{{ quotation?.client?.razao_social || 'N/A' }}</strong>
                </div>
                <div class="info-row">
                    <span>Destino:</span>
                    <strong>{{ quotation?.client?.cidade }} - {{ quotation?.client?.estado }}</strong>
                </div>
                <hr />
                <div class="shipping-box">
                    <div class="shipping-header">RESULTADO DO FRETE</div>
                    <div class="price-tag">
                        <small>Valor Total</small>
                        <div class="value">{{ formatCurrency(quotation?.valor_frete) }}</div>
                    </div>
                    <p>Transportadora: <strong>{{ quotation?.transportadora_escolhida || 'A calcular' }}</strong></p>
                    <p>Prazo Estimado: <strong>{{ quotation?.dias_para_entrega || '--' }} dias úteis</strong></p>
                </div>

                <div class="actions-group">
                    <a :href="`/api/quotations/${quotationId}/pdf`" target="_blank" class="btn-download">
                        BAIXAR COTAÇÃO (PDF) 🚚
                    </a>
                    <button @click="printPage" class="btn-outline">IMPRIMIR TELA</button>
                    <a href="/" class="btn-home"><i class="fas fa-home"></i> Voltar ao Início</a>
                </div>
            </div>
        </section>

        <section class="history-card glass-card shadow-lg">
            <div class="card-header">RECENTES</div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Nº</th>
                            <th>Cliente</th>
                            <th>Valor</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="q in todayQuotations.slice(0, 8)" :key="q.id">
                            <td>#{{ q.id }}</td>
                            <td class="truncate">{{ q.client?.razao_social }}</td>
                            <td>{{ formatCurrency(q.valor_total_nota) }}</td>
                            <td><span class="status-pill">Gerado</span></td>
                        </tr>
                    </tbody>
                </table>
                <div v-if="todayQuotations.length === 0" class="empty-msg">
                    Nenhuma cotação hoje ainda.
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
.loading-state { text-align: center; padding: 100px; color: #64748b; font-style: italic; }
.grid-layout { display: grid; grid-template-columns: 1fr 1.2fr; gap: 30px; }
.result-card, .history-card { padding: 0 !important; overflow: hidden; border-radius: 20px; }
.card-header { background: #1e293b; color: white; padding: 15px 25px; font-weight: 700; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }
.card-content { padding: 30px; }
.info-row { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 0.95rem; }
.info-row span { color: #64748b; }
hr { border: 0; border-top: 1px dashed #e2e8f0; margin: 25px 0; }
.shipping-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px; }
.shipping-header { font-size: 0.75rem; font-weight: 800; color: #64748b; margin-bottom: 10px; letter-spacing: 1px; }
.price-tag { margin-bottom: 20px; }
.price-tag small { color: #64748b; font-size: 0.8rem; font-weight: 600; }
.price-tag .value { font-size: 2.5rem; font-weight: 900; color: #1e293b; line-height: 1; margin-top: 5px; }
.actions-group { display: flex; flex-direction: column; gap: 12px; }
.btn-download { background: linear-gradient(135deg, #f39c12, #d97706); color: white; text-align: center; padding: 16px; border-radius: 99px; text-decoration: none; font-weight: 800; font-size: 1rem; transition: 0.2s; box-shadow: 0 10px 15px -3px rgba(243, 156, 18, 0.3); }
.btn-download:hover { transform: translateY(-2px); box-shadow: 0 15px 20px -3px rgba(243, 156, 18, 0.4); }
.btn-outline { background: transparent; border: 2px solid #1e293b; color: #1e293b; padding: 14px; border-radius: 99px; cursor: pointer; font-weight: 700; transition: 0.2s; }
.btn-home { text-align: center; color: #64748b; font-size: 0.9rem; font-weight: 600; text-decoration: none; margin-top: 5px; }
.table-responsive { padding: 0; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
th { text-align: left; padding: 15px 20px; background: #f8fafc; color: #64748b; border-bottom: 2px solid #f1f5f9; font-size: 0.7rem; text-transform: uppercase; font-weight: 800; }
td { padding: 15px 20px; border-bottom: 1px solid #f1f5f9; }
.truncate { max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.status-pill { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 99px; font-weight: 800; font-size: 0.65rem; text-transform: uppercase; }
.empty-msg { padding: 40px; text-align: center; color: #94a3b8; font-style: italic; font-size: 0.9rem; }
@media (max-width: 900px) { .grid-layout { grid-template-columns: 1fr; } }
</style>
