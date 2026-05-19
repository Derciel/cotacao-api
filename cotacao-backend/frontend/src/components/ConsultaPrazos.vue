<script setup lang="ts">
import { ref, computed } from 'vue';
import { safeFetch } from '../utils/api-utils';

interface PrazoResult {
    cnpj: string;
    razaoSocial: string;
    cidade: string;
    uf: string;
    cep: string;
    status: 'PENDING' | 'SUCCESS' | 'ERROR' | 'LOADING' | 'READY';
    message?: string;
    options: {
        carrier: string;
        price: number;
        deadline: number;
    }[];
}

const cnpjs = ref("");
const isProcessingCities = ref(false);
const isProcessingPrazos = ref(false);
const timeCities = ref(0);
const timePrazos = ref(0);
let timerInterval: any = null;
const results = ref<PrazoResult[]>([]);
const progress = ref({ current: 0, total: 0 });

const extractCnpj = (text: string) => {
    const match = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
    if (match) return match[0].replace(/\D/g, '');
    const justNums = text.replace(/\D/g, '');
    if (justNums.length === 14) return justNums;
    return null;
};

const cnpjList = computed(() => {
    const lines = cnpjs.value.split('\n');
    const list: string[] = [];
    for (const line of lines) {
        const c = extractCnpj(line);
        if (c && !list.includes(c)) {
            list.push(c);
        }
    }
    return list;
});

const canCalculatePrazos = computed(() => results.value.some(r => r.status === 'READY' || r.status === 'SUCCESS'));

const getBestDeadline = (options: any[], uf: string) => {
    if (!options || options.length === 0) return '---';
    
    let validOptions = options.filter(o => 
        !o.carrier.toLowerCase().includes('correio') && 
        !o.carrier.toLowerCase().includes('pac') && 
        !o.carrier.toLowerCase().includes('sedex')
    );
    
    if (validOptions.length === 0) return 'Sem transp. disponível';

    const sorted = validOptions.sort((a, b) => a.deadline - b.deadline);
    const best = sorted.find(o => o.deadline > 0) || sorted[0];
    return `${best.deadline} dias úteis (${best.carrier})`;
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const fetchCities = async () => {
    const list = cnpjList.value;
    if (list.length === 0) return window.showToast("Nenhum CNPJ válido encontrado no texto.", "warning");

    isProcessingCities.value = true;
    timeCities.value = 0;
    
    timerInterval = setInterval(() => timeCities.value++, 1000);

    results.value = list.map(cnpj => ({
        cnpj: cnpj,
        razaoSocial: '---',
        cidade: '---',
        uf: '---',
        cep: '---',
        status: 'PENDING',
        options: []
    }));

    progress.value = { current: 0, total: results.value.length };

    for (let i = 0; i < results.value.length; i++) {
        const item = results.value[i];
        item.status = 'LOADING';
        
        let success = false;
        let retries = 3;
        
        while (!success && retries > 0) {
            try {
                const res = await safeFetch('/api/freight/resolve-cnpj', {
                    method: 'POST',
                    body: JSON.stringify({ cnpj: item.cnpj }),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (res.status === 429) {
                    throw new Error("RATE_LIMIT");
                }
                
                if (res.ok && res.data) {
                    item.razaoSocial = res.data.cliente || 'Desconhecido';
                    item.cidade = res.data.cidade || '---';
                    item.uf = res.data.uf || '---';
                    item.cep = res.data.cep || '---';
                    item.status = 'READY';
                    success = true;
                } else {
                    throw new Error(res.data?.message || "Erro na consulta");
                }
            } catch (err: any) {
                if (err.message === "RATE_LIMIT" || err.message.includes('fetch') || err.message.includes('Network')) {
                    retries--;
                    if (retries > 0) {
                        await delay(2000);
                        continue;
                    }
                    item.status = 'ERROR';
                    item.message = "Erro de rede";
                } else {
                    item.status = 'ERROR';
                    item.message = err.message;
                    break;
                }
            }
        }
        
        progress.value.current++;
        
        if (i < results.value.length - 1) {
            await delay(400); 
        }
    }

    clearInterval(timerInterval);
    isProcessingCities.value = false;
    window.showToast(`Cidades buscadas em ${formatTime(timeCities.value)}!`, "success");
};

const calculatePrazos = async () => {
    const itemsToProcess = results.value.filter(r => r.status === 'READY');
    if (itemsToProcess.length === 0) return;

    isProcessingPrazos.value = true;
    timePrazos.value = 0;
    progress.value = { current: 0, total: itemsToProcess.length };
    
    timerInterval = setInterval(() => timePrazos.value++, 1000);

    // 1. Agrupar itens por região (Cidade - UF)
    const regions: { [key: string]: PrazoResult[] } = {};
    for (const item of itemsToProcess) {
        const key = `${(item.cidade || '').trim().toUpperCase()} - ${(item.uf || '').trim().toUpperCase()}`;
        if (!regions[key]) {
            regions[key] = [];
        }
        regions[key].push(item);
    }

    const regionKeys = Object.keys(regions);
    
    // Função auxiliar para extrair o melhor prazo em número
    const getBestDeadlineNumber = (options: any[]) => {
        if (!options || options.length === 0) return 0;
        const validOptions = options.filter(o => 
            !o.carrier.toLowerCase().includes('correio') && 
            !o.carrier.toLowerCase().includes('pac') && 
            !o.carrier.toLowerCase().includes('sedex')
        );
        if (validOptions.length === 0) return 0;
        const sorted = validOptions.sort((a, b) => a.deadline - b.deadline);
        const best = sorted.find(o => o.deadline > 0) || sorted[0];
        return best.deadline;
    };

    // Processar cada região
    for (let rIndex = 0; rIndex < regionKeys.length; rIndex++) {
        const regionKey = regionKeys[rIndex];
        const regionItems = regions[regionKey];

        if (regionItems.length === 0) continue;

        // Se houver apenas 1 item na região
        if (regionItems.length === 1) {
            const item = regionItems[0];
            item.status = 'LOADING';
            
            let success = false;
            let retries = 3;
            
            while (!success && retries > 0) {
                try {
                    const res = await safeFetch('/api/freight/simulate-cnpj', {
                        method: 'POST',
                        body: JSON.stringify({ cnpj: item.cnpj }),
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (res.ok && res.data && Array.isArray(res.data.options)) {
                        item.options = res.data.options;
                        item.status = 'SUCCESS';
                        success = true;
                    } else {
                        throw new Error("Erro na simulação");
                    }
                } catch (err: any) {
                    if (err.message.includes('fetch') || err.message.includes('Network')) {
                        retries--;
                        if (retries > 0) {
                            await delay(2000);
                            continue;
                        }
                        item.status = 'ERROR';
                        item.message = "Erro de rede";
                    } else {
                        item.status = 'ERROR';
                        item.message = err.message;
                        break;
                    }
                }
            }
            
            progress.value.current++;
            
            // Delay de segurança entre requisições
            if (rIndex < regionKeys.length - 1) {
                await delay(400);
            }
        } else {
            // Se houver 2 ou mais itens na região
            // Selecionar os 2 primeiros itens para simular
            const refItem1 = regionItems[0];
            const refItem2 = regionItems[1];

            // Colocar todos os itens da região como LOADING para feedback visual
            regionItems.forEach(item => item.status = 'LOADING');

            // Simular o primeiro item
            let success1 = false;
            let retries1 = 3;
            while (!success1 && retries1 > 0) {
                try {
                    const res = await safeFetch('/api/freight/simulate-cnpj', {
                        method: 'POST',
                        body: JSON.stringify({ cnpj: refItem1.cnpj }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (res.ok && res.data && Array.isArray(res.data.options)) {
                        refItem1.options = res.data.options;
                        refItem1.status = 'SUCCESS';
                        success1 = true;
                    } else {
                        throw new Error("Erro na simulação");
                    }
                } catch (err: any) {
                    if (err.message.includes('fetch') || err.message.includes('Network')) {
                        retries1--;
                        if (retries1 > 0) {
                            await delay(2000);
                            continue;
                        }
                        refItem1.status = 'ERROR';
                        refItem1.message = "Erro de rede";
                    } else {
                        refItem1.status = 'ERROR';
                        refItem1.message = err.message;
                        break;
                    }
                }
            }

            // Pequeno delay entre simulações na mesma região para evitar 429
            await delay(400);

            // Simular o segundo item
            let success2 = false;
            let retries2 = 3;
            while (!success2 && retries2 > 0) {
                try {
                    const res = await safeFetch('/api/freight/simulate-cnpj', {
                        method: 'POST',
                        body: JSON.stringify({ cnpj: refItem2.cnpj }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (res.ok && res.data && Array.isArray(res.data.options)) {
                        refItem2.options = res.data.options;
                        refItem2.status = 'SUCCESS';
                        success2 = true;
                    } else {
                        throw new Error("Erro na simulação");
                    }
                } catch (err: any) {
                    if (err.message.includes('fetch') || err.message.includes('Network')) {
                        retries2--;
                        if (retries2 > 0) {
                            await delay(2000);
                            continue;
                        }
                        refItem2.status = 'ERROR';
                        refItem2.message = "Erro de rede";
                    } else {
                        refItem2.status = 'ERROR';
                        refItem2.message = err.message;
                        break;
                    }
                }
            }

            // Agora analisamos os prazos das duas simulações e aplicamos aos demais
            if (success1 && success2) {
                const d1 = getBestDeadlineNumber(refItem1.options);
                const d2 = getBestDeadlineNumber(refItem2.options);

                if (d1 === d2) {
                    // Mesmo prazo, replica as opções do refItem1 para os outros
                    const optionsToCopy = refItem1.options;
                    for (let k = 2; k < regionItems.length; k++) {
                        regionItems[k].options = JSON.parse(JSON.stringify(optionsToCopy));
                        regionItems[k].status = 'SUCCESS';
                    }
                } else {
                    // Prazos diferentes, faz a média e replica com deadline ajustado
                    const media = Math.round((d1 + d2) / 2);
                    const adjustedOptions = JSON.parse(JSON.stringify(refItem1.options)).map((o: any) => ({
                        ...o,
                        deadline: media
                    }));
                    for (let k = 2; k < regionItems.length; k++) {
                        regionItems[k].options = JSON.parse(JSON.stringify(adjustedOptions));
                        regionItems[k].status = 'SUCCESS';
                    }
                }
            } else if (success1) {
                // Apenas refItem1 funcionou, replica para toda a região
                const optionsToCopy = refItem1.options;
                refItem2.options = JSON.parse(JSON.stringify(optionsToCopy));
                refItem2.status = 'SUCCESS';
                for (let k = 2; k < regionItems.length; k++) {
                    regionItems[k].options = JSON.parse(JSON.stringify(optionsToCopy));
                    regionItems[k].status = 'SUCCESS';
                }
            } else if (success2) {
                // Apenas refItem2 funcionou, replica para toda a região
                const optionsToCopy = refItem2.options;
                refItem1.options = JSON.parse(JSON.stringify(optionsToCopy));
                refItem1.status = 'SUCCESS';
                for (let k = 2; k < regionItems.length; k++) {
                    regionItems[k].options = JSON.parse(JSON.stringify(optionsToCopy));
                    regionItems[k].status = 'SUCCESS';
                }
            } else {
                // Ambas falharam
                refItem1.status = 'ERROR';
                refItem2.status = 'ERROR';
                for (let k = 2; k < regionItems.length; k++) {
                    regionItems[k].status = 'ERROR';
                    regionItems[k].message = "Falha nas simulações de referência da região";
                }
            }

            // Conta todos os itens da região como concluídos
            progress.value.current += regionItems.length;

            // Delay de segurança entre regiões
            if (rIndex < regionKeys.length - 1) {
                await delay(400);
            }
        }
    }

    clearInterval(timerInterval);
    isProcessingPrazos.value = false;
    window.showToast(`Prazos calculados em ${formatTime(timePrazos.value)}!`, "success");
};

const copyToClipboard = () => {
    if (results.value.length === 0) return;
    
    const headers = ["CNPJ", "CLIENTE", "CIDADE", "UF", "CEP", "PRAZO (DIAS)", "TRANSPORTADORA"];
    const rows = results.value.map(r => {
        let bestDays = "---";
        let bestCarrier = "---";
        
        if (r.options && r.options.length > 0) {
            let validOptions = r.options.filter(o => 
                !o.carrier.toLowerCase().includes('correio') && 
                !o.carrier.toLowerCase().includes('pac') && 
                !o.carrier.toLowerCase().includes('sedex')
            );
            if (validOptions.length > 0) {
                const sorted = validOptions.sort((a, b) => a.deadline - b.deadline);
                const best = sorted.find(o => o.deadline > 0) || sorted[0];
                bestDays = `${best.deadline} dias úteis`;
                bestCarrier = best.carrier;
            } else {
                 bestDays = "N/A";
                 bestCarrier = "Nenhuma disponivel";
            }
        }

        return [
            formatCNPJ(r.cnpj),
            r.razaoSocial,
            r.cidade,
            r.uf,
            r.cep,
            bestDays,
            bestCarrier
        ].join('\t');
    });

    const tsv = [headers.join('\t'), ...rows].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
        window.showToast("Tabela copiada para a área de transferência!", "success");
    }).catch(() => {
        window.showToast("Erro ao copiar tabela.", "error");
    });
};

const formatCNPJ = (v: string) => v?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') || v;

</script>

<template>
    <div class="batch-container">
        <div class="glass-card mb-20">
            <div class="card-title">
                <span><i class="fas fa-truck-fast"></i> CONSULTA RÁPIDA DE PRAZOS</span>
            </div>
            
            <div class="mt-20">
                <div class="input-section">
                    <label class="section-label">Lista de CNPJs (um por linha)</label>
                    <textarea 
                        v-model="cnpjs" 
                        placeholder="00.000.000/0001-00&#10;11.111.111/0001-11"
                        class="pill-textarea"
                        rows="8"
                    ></textarea>
                </div>
            </div>

            <div class="action-bar mt-20" style="gap: 15px;">
                <button @click="fetchCities" class="btn-giant" :disabled="isProcessingCities || isProcessingPrazos">
                    <span v-if="isProcessingCities" class="btn-spinner"></span>
                    {{ isProcessingCities ? `BUSCANDO CIDADES (${progress.current}/${progress.total}) - ${formatTime(timeCities)}` : '1. BUSCAR CIDADES E ESTADOS' }}
                </button>

                <button v-if="canCalculatePrazos" @click="calculatePrazos" class="btn-giant" style="background-color: #0284c7;" :disabled="isProcessingPrazos || isProcessingCities">
                    <span v-if="isProcessingPrazos" class="btn-spinner"></span>
                    {{ isProcessingPrazos ? `CALCULANDO PRAZOS (${progress.current}/${progress.total}) - ${formatTime(timePrazos)}` : '2. CALCULAR PRAZOS' }}
                </button>
            </div>
        </div>

        <div v-if="results.length > 0" class="glass-card mt-20 fade-in">
            <div class="card-title" style="display: flex; justify-content: space-between;">
                <span><i class="fas fa-list-check"></i> RESULTADOS</span>
                <button @click="copyToClipboard" class="btn-copy">
                    <i class="fas fa-copy"></i> COPIAR TABELA PARA EXCEL
                </button>
            </div>

            <div class="results-table-wrapper mt-10">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>CNPJ / CLIENTE</th>
                            <th>CIDADE / UF</th>
                            <th>CEP</th>
                            <th>MELHOR PRAZO</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(r, idx) in results" :key="idx" :class="r.status">
                            <td>
                                <strong>{{ formatCNPJ(r.cnpj) }}</strong>
                                <div class="client-name">{{ r.razaoSocial }}</div>
                            </td>
                            <td>{{ r.cidade !== '---' ? `${r.cidade} / ${r.uf}` : '---' }}</td>
                            <td>{{ r.cep }}</td>
                            <td>
                                <strong>{{ r.status === 'LOADING' ? '...' : getBestDeadline(r.options, r.uf) }}</strong>
                            </td>
                            <td>
                                <span class="status-badge" :class="r.status">{{ r.status === 'LOADING' ? 'Processando...' : (r.status === 'SUCCESS' ? 'Concluído' : (r.status === 'READY' ? 'Cidade OK' : 'Erro')) }}</span>
                                <div v-if="r.message" class="error-msg"><small>{{ r.message }}</small></div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<style scoped>
.batch-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    color: var(--text-main);
}

.glass-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 24px;
    box-shadow: var(--shadow-card);
    padding: 30px;
}

.card-title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--primary);
    font-size: 1rem;
    font-weight: 850;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 20px;
}

.mt-10 { margin-top: 10px; }
.mt-20 { margin-top: 20px; }
.mb-20 { margin-bottom: 20px; }

.section-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 800;
    color: var(--text-muted);
    margin-bottom: 10px;
    text-transform: uppercase;
}

.pill-textarea {
    width: 100%;
    min-height: 210px;
    background: var(--bg-input);
    border: 2px solid var(--border);
    border-radius: 12px;
    padding: 15px;
    font-family: monospace;
    font-size: 0.95rem;
    color: var(--text-main);
    resize: none;
    transition: 0.3s;
}

.pill-textarea:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--bg-surface);
    box-shadow: 0 0 0 4px rgba(0, 74, 153, 0.1);
}

.action-bar {
    display: flex;
    justify-content: center;
}

.btn-giant {
    background: var(--primary);
    color: white;
    border: none;
    min-width: 280px;
    padding: 18px 42px;
    border-radius: 18px;
    font-size: 1rem;
    font-weight: 900;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 10px 20px rgba(0, 74, 153, 0.2);
    transition: 0.3s ease;
}

.btn-giant:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 15px 30px rgba(0, 74, 153, 0.3);
}

.btn-giant:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.btn-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 3px solid rgba(255, 255, 255, 0.35);
    border-top-color: white;
    border-radius: 999px;
    animation: spin 0.8s linear infinite;
}

.results-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 16px;
}

.modern-table {
    width: 100%;
    border-collapse: collapse;
}

.modern-table th {
    text-align: left;
    padding: 14px 16px;
    border-bottom: 2px solid var(--border);
    color: var(--text-muted);
    font-size: 0.8rem;
    text-transform: uppercase;
    background: var(--bg-input);
}

.modern-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
}

.modern-table tbody tr:last-child td {
    border-bottom: none;
}

.client-name {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 3px;
}

.status-badge {
    padding: 5px 10px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 800;
}

.status-badge.SUCCESS { background: #dcfce7; color: #15803d; }
.status-badge.ERROR { background: #fee2e2; color: #b91c1c; }
.status-badge.LOADING { background: #e0f2fe; color: #0369a1; }

.error-msg {
    color: #b91c1c;
    margin-top: 4px;
}

tr.ERROR { background: rgba(239, 68, 68, 0.02); }

.fade-in {
    animation: fadeIn 0.4s ease-out;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
.btn-copy {
    background: #10b981;
    color: white;
    border: none;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 800;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: 0.2s;
}

.btn-copy:hover {
    background: #059669;
    transform: translateY(-1px);
}
</style>
