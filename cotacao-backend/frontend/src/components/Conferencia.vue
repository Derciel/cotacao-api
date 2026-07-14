<template>
  <div class="conferencia-container animate-fade-in">
    <!-- Header Premium -->
    <div class="glass-card header-card">
      <div class="header-main">
        <div class="header-info">
          <div class="icon-circle shadow-glow">
            <i class="fas fa-file-invoice-dollar"></i>
          </div>
          <div>
            <h1 class="page-title">Módulo de Conferência</h1>
            <p class="page-subtitle">Auditoria de fretes, pesos e volumes integrados ao SIEG</p>
          </div>
        </div>
        
        <!-- Controle de Abas Premium -->
        <div class="tabs-control glass-premium">
          <button 
            @click="activeTab = 'historico'" 
            :class="['tab-btn', { active: activeTab === 'historico' }]"
          >
            <i class="fas fa-history"></i> Histórico de Auditorias
          </button>
          <button 
            @click="activeTab = 'sieg_live'" 
            :class="['tab-btn', { active: activeTab === 'sieg_live' }]"
          >
            <i class="fas fa-broadcast-tower"></i> Auditoria SIEG Live
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== ABA 1: HISTÓRICO DE AUDITORIAS ==================== -->
    <div v-if="activeTab === 'historico'" class="tab-content animate-fade-in">
      <!-- Dashboard de Resumo -->
      <div v-if="summary && Object.keys(summary).length > 0" class="summary-row">
        <div v-for="(data, carrier) in summary" :key="carrier" class="summary-box glass-premium">
          <div class="box-top">
            <span class="carrier-tag">{{ carrier }}</span>
            <span class="count-tag">{{ data.count }} Audits</span>
          </div>
          <div class="box-values">
            <div class="val-group">
              <span class="val-label">Economia</span>
              <span class="val-number text-success">R$ {{ formatNumber(data.gains) }}</span>
            </div>
            <div class="val-group">
              <span class="val-label">Perda/Divergência</span>
              <span class="val-number text-danger">R$ {{ formatNumber(data.losses) }}</span>
            </div>
          </div>
          <div class="box-progress">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: getProgressWidth(data), background: getProgressColor(data) }"></div>
            </div>
            <div class="progress-labels">
              <span>{{ getProgressPercentage(data) }}% OK</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Lista de Auditorias -->
      <div class="glass-card table-card">
        <div class="card-header-inner">
          <h3>Histórico de Conferências Gravadas</h3>
          <div class="header-actions">
            <button @click="loadData" class="btn-primary-outline" :disabled="loading">
              <i :class="['fas fa-sync-alt', { 'fa-spin': loading }]"></i>
              <span>Sincronizar Histórico</span>
            </button>
          </div>
        </div>

        <div class="table-wrapper">
          <table v-if="!loading && audits.length > 0" class="premium-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Referência</th>
                <th>Transportadora</th>
                <th>Cotação</th>
                <th>Real (SIEG)</th>
                <th>Divergência</th>
                <th>Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="audit in audits" :key="audit.id" :class="{ 'row-warning': audit.status === 'DIVERGENTE' }">
                <td>
                  <div class="doc-cell">
                    <div class="nf-badge">NF {{ audit.nfe_number || '---' }}</div>
                    <div class="cte-info" :title="audit.cte_number">
                      CT-e {{ audit.cte_number?.length > 20 ? audit.cte_number.substring(0, 8) + '...' + audit.cte_number.slice(-8) : (audit.cte_number || 'Pendente') }}
                    </div>
                  </div>
                </td>
                <td>
                  <div class="ref-cell">
                    <span class="ref-badge">{{ audit.quotation?.numero_pedido_manual || 'ID: ' + audit.quotationId }}</span>
                  </div>
                </td>
                <td>
                  <span class="carrier-name-cell">{{ audit.transportadora }}</span>
                </td>
                <td>
                  <span class="currency">R$</span> {{ formatNumber(audit.valor_frete_cotado) }}
                </td>
                <td>
                  <span class="currency">R$</span> {{ formatNumber(audit.valor_frete_sieg) }}
                </td>
                <td>
                  <span :class="['diff-tag', getDiffClass(audit.divergencia_valor)]">
                    R$ {{ formatNumber(audit.divergencia_valor) }}
                  </span>
                </td>
                <td>
                  <div :class="['status-indicator', audit.status.toLowerCase()]">
                    <span class="dot"></span>
                    {{ audit.status }}
                  </div>
                </td>
                <td class="text-right">
                  <div class="btn-group">
                    <button v-if="audit.status === 'DIVERGENTE'" @click="handleCheck(audit.id, false)" class="btn-action success" title="Aprovar">
                      <i class="fas fa-check"></i>
                    </button>
                    <button @click="openPdfPreview(audit.quotation)" class="btn-action primary" title="Ver PDF Cotação">
                      <i class="fas fa-file-pdf"></i>
                    </button>
                    <button v-if="audit.xml_content" @click="openXmlModal(audit)" class="btn-action info" title="Ver XML">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button v-if="audit.xml_content" @click="downloadXml(audit.id)" class="btn-action secondary" title="Download XML">
                      <i class="fas fa-download"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- State Empty -->
          <div v-else-if="!loading && audits.length === 0" class="empty-state-lux">
            <div class="empty-icon">
              <i class="fas fa-clipboard-check"></i>
            </div>
            <h4>Nenhuma auditoria encontrada</h4>
            <p>As conferências salvas no banco aparecerão aqui.</p>
          </div>

          <!-- State Loading -->
          <div v-if="loading" class="loading-overlay">
            <div class="loader-premium"></div>
            <span>Buscando histórico local...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== ABA 2: AUDITORIA SIEG LIVE (BUSCA ATIVA) ==================== -->
    <div v-if="activeTab === 'sieg_live'" class="tab-content animate-fade-in">
      <!-- Painel de Filtros e Busca SIEG -->
      <div class="glass-card filter-card">
        <h3 class="panel-title"><i class="fas fa-search-dollar text-primary"></i> Varredura Fiscais no cofre da SIEG</h3>
        <p class="panel-desc">Selecione o período de emissão e restrinja pelos CNPJs dos clientes cadastrados para confrontar com o faturamento real do SIEG.</p>
        
        <div class="filter-grid">
          <!-- Filtro de Período -->
          <div class="form-group-custom">
            <label class="form-label-custom"><i class="fas fa-calendar-day"></i> Período de Emissão</label>
            <div class="date-inputs-wrapper">
              <input type="date" v-model="filterStartDate" class="input-date" />
              <span class="date-divider">até</span>
              <input type="date" v-model="filterEndDate" class="input-date" />
            </div>
          </div>

          <!-- Multi-Seletor de CNPJs (Lista de Clientes) -->
          <div class="form-group-custom flex-grow">
            <label class="form-label-custom"><i class="fas fa-users-cog"></i> Clientes Relacionados (CNPJ)</label>
            <div class="client-multiselect-container glass-premium">
              <div v-if="loadingClients" class="loading-clients-state">
                <i class="fas fa-circle-notch fa-spin"></i><span>Carregando clientes do sistema...</span>
              </div>
              <div v-else class="clients-scroll-list">
                <label v-for="client in clientsList" :key="client.id" class="client-checkbox-item">
                  <input type="checkbox" :value="client.cnpj" v-model="selectedClientCnpjs" />
                  <div class="client-cb-details">
                    <span class="client-cb-name">{{ client.razao_social }}</span>
                    <span class="client-cb-cnpj">{{ formatCnpj(client.cnpj) }}</span>
                  </div>
                </label>
              </div>
            </div>
            <span class="input-hint"><i class="fas fa-info-circle"></i> Deixe todos desmarcados para trazer todos os CT-es da Nicopel no período.</span>
          </div>

          <!-- Ação Principal de Pesquisa -->
          <div class="search-action-container">
            <button @click="querySiegCtes" class="btn-sieg-search shadow-glow" :disabled="loadingSieg">
              <i :class="['fas fa-cloud-download-alt', { 'fa-spin': loadingSieg }]"></i>
              <span>{{ loadingSieg ? 'Consultando Cofre...' : 'Consultar no Cofre SIEG' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Alerta de Erro de Varredura Fiel -->
      <div v-if="sQueryError" class="glass-card error-debug-card animate-fade-in">
        <div class="error-debug-header">
          <div class="error-title-group">
            <i class="fas fa-exclamation-triangle"></i>
            <h4>Erro Interno Detectado no Servidor (Status 500)</h4>
          </div>
          <button @click="sQueryError = null" class="btn-close-error">&times;</button>
        </div>
        <p class="error-debug-desc">O servidor NestJS retornou o seguinte detalhamento técnico do erro. Você pode mandar essa informação para o suporte:</p>
        <div class="error-debug-content">
          <pre class="error-debug-code"><code>{{ typeof sQueryError === 'object' ? JSON.stringify(sQueryError, null, 2) : sQueryError }}</code></pre>
        </div>
      </div>

      <!-- Métricas em Destaque do SIEG Live -->
      <div v-if="siegCtes.length > 0" class="live-metrics-row animate-fade-in">
        <div class="metric-box glass-premium info">
          <div class="metric-header-box">
            <span class="metric-title">Faturas do Período</span>
            <i class="fas fa-file-invoice"></i>
          </div>
          <span class="metric-number">{{ siegCtes.length }}</span>
          <span class="metric-sub">CT-es obtidos da API</span>
        </div>
        <div class="metric-box glass-premium success">
          <div class="metric-header-box">
            <span class="metric-title">Valores Corretos</span>
            <i class="fas fa-check-circle"></i>
          </div>
          <span class="metric-number text-success">{{ siegCtes.filter(c => c.status === 'OK').length }}</span>
          <span class="metric-sub">Diferença de até R$ 0,50</span>
        </div>
        <div class="metric-box glass-premium warning">
          <div class="metric-header-box">
            <span class="metric-title">Divergências de Valor</span>
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <span class="metric-number text-danger">{{ siegCtes.filter(c => c.status === 'DIVERGENTE').length }}</span>
          <span class="metric-sub">Valores cobrados acima do cotado</span>
        </div>
        <div class="metric-box glass-premium neutral">
          <div class="metric-header-box">
            <span class="metric-title">Sem Cotação Vinculada</span>
            <i class="fas fa-question-circle"></i>
          </div>
          <span class="metric-number text-purple">{{ siegCtes.filter(c => c.status === 'SEM_COTACAO').length }}</span>
          <span class="metric-sub">Fretes emitidos sem orçamentos</span>
        </div>
      </div>

      <!-- Tabela SIEG Live -->
      <div class="glass-card table-card live-table-card animate-fade-in">
        <div class="card-header-inner border-bottom">
          <h3>Faturamento Real Localizado no SIEG</h3>
          <span v-if="siegCtes.length > 0" class="live-badge-count">{{ siegCtes.length }} documentos listados</span>
        </div>

        <div class="table-wrapper">
          <table v-if="!loadingSieg && siegCtes.length > 0" class="premium-table">
            <thead>
              <tr>
                <th>CT-e / Emissão</th>
                <th>Participantes (Rem / Dest)</th>
                <th>Cotação / NF</th>
                <th>Frete Cotado</th>
                <th>Frete Real (SIEG)</th>
                <th>Divergência</th>
                <th>Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cte in siegCtes" :key="cte.cte_chave" :class="{ 'row-warning': cte.status === 'DIVERGENTE', 'row-danger': cte.status === 'SEM_COTACAO' }">
                <!-- CT-e Info -->
                <td>
                  <div class="cte-cell">
                    <span class="cte-number-badge" :title="cte.cte_chave">
                      <i class="fas fa-receipt text-primary"></i> CT-e <strong>{{ cte.cte_number }}</strong>
                    </span>
                    <span class="cte-date-sub">{{ formatDate(cte.data_emissao) }}</span>
                    <span class="cte-carrier" :title="'CNPJ: ' + cte.transportadora_cnpj">
                      <i class="fas fa-truck-moving"></i> {{ cte.transportadora }}
                    </span>
                  </div>
                </td>

                <!-- Participantes -->
                <td>
                  <div class="participants-cell">
                    <div class="participant-row" :title="'CNPJ: ' + cte.remetente_cnpj">
                      <span class="p-badge rem">REM</span>
                      <span class="p-name">{{ cte.remetente }}</span>
                    </div>
                    <div class="participant-row" :title="'CNPJ: ' + cte.destinatario_cnpj">
                      <span class="p-badge dest">DES</span>
                      <span class="p-name">{{ cte.destinatario }}</span>
                    </div>
                  </div>
                </td>

                <!-- Cotação & NF -->
                <td>
                  <div v-if="cte.cotacao" class="linked-quote-cell">
                    <span class="quote-number-pill"><i class="fas fa-folder-open"></i> {{ cte.cotacao.numero_pedido_manual || 'ID: ' + cte.cotacao.id }}</span>
                    <span class="nf-number-sub"><i class="fas fa-file-alt"></i> NF {{ cte.nfe_numero }}</span>
                  </div>
                  <div v-else class="linked-quote-cell">
                    <span class="quote-unlinked-pill"><i class="fas fa-unlink"></i> Avulso</span>
                    <span class="nf-number-sub" v-if="cte.nfe_numero"><i class="fas fa-file-alt"></i> NF {{ cte.nfe_numero }}</span>
                  </div>
                </td>

                <!-- Frete Cotado -->
                <td>
                  <div v-if="cte.cotacao" class="freight-value">
                    <span class="currency">R$</span> {{ formatNumber(cte.valor_frete_cotado) }}
                  </div>
                  <span v-else class="text-muted italic">Não cotado</span>
                </td>

                <!-- Frete Real (SIEG) -->
                <td>
                  <div class="freight-value real">
                    <span class="currency">R$</span> {{ formatNumber(cte.valor_frete_sieg) }}
                  </div>
                </td>

                <!-- Divergência -->
                <td>
                  <div v-if="cte.cotacao">
                    <span :class="['diff-tag-large', getDiffClass(cte.divergencia_valor)]">
                      R$ {{ formatNumber(cte.divergencia_valor) }}
                    </span>
                  </div>
                  <span v-else class="text-muted">---</span>
                </td>

                <!-- Status -->
                <td>
                  <div :class="['status-pill-premium', cte.status.toLowerCase()]">
                    <span class="status-dot"></span>
                    <span>{{ cte.status === 'SEM_COTACAO' ? 'Sem Cotação' : cte.status }}</span>
                  </div>
                </td>

                <!-- Ações -->
                <td class="text-right">
                  <div class="btn-group-live">
                    <!-- Realizar e Salvar Auditoria -->
                    <button 
                      v-if="cte.cotacao && !cte.audit_id" 
                      @click="saveLiveAudit(cte.cotacao.id)" 
                      class="btn-live-action save animate-pulse" 
                      title="Salvar e Registrar Auditoria no Banco"
                    >
                      <i class="fas fa-cloud-upload-alt"></i>
                    </button>
                    <!-- Ação de aprovar manual divergência existente -->
                    <button 
                      v-if="cte.audit_id && cte.status === 'DIVERGENTE'" 
                      @click="handleCheck(cte.audit_id, true)" 
                      class="btn-live-action approve" 
                      title="Aprovar Manualmente no Histórico"
                    >
                      <i class="fas fa-check"></i>
                    </button>
                    <!-- Visualizar XML -->
                    <button v-if="cte.xml_content" @click="openXmlModal(cte)" class="btn-live-action view" title="Visualizar XML">
                      <i class="fas fa-eye"></i>
                    </button>
                    <!-- Baixar XML do CT-e (Conforme solicitado) -->
                    <button v-if="cte.xml_content" @click="downloadXmlDirect(cte)" class="btn-live-action download" title="Baixar XML do CT-e para Conferência">
                      <i class="fas fa-download"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Empty State SIEG Live -->
          <div v-else-if="!loadingSieg && siegCtes.length === 0" class="empty-state-lux">
            <div class="empty-icon-live">
              <i class="fas fa-broadcast-tower"></i>
            </div>
            <h4>Pronto para Varredura Fiscal</h4>
            <p>Selecione um período de emissão e os CNPJs acima para consultar no cofre da SIEG.</p>
          </div>

          <!-- Loading SIEG Live -->
          <div v-if="loadingSieg" class="loading-overlay-live">
            <div class="spinner-premium-circle"></div>
            <span class="loading-title">Realizando Busca de Documentos Fiscais no SIEG...</span>
            <span class="loading-subtitle">Buscando arquivos XML e descompactando dados do cofre. Aguarde.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== MODAIS DE VISUALIZAÇÃO E PDF ==================== -->
    <!-- Modal Visualizador XML / DACTE -->
    <div v-if="selectedXmlAudit" class="modal-overlay" @click.self="selectedXmlAudit = null">
      <div class="modal-box xml-viewer-modal animate-pop" :class="{ 'dacte-mode': modalTab === 'dacte' }">
        <div class="modal-header">
          <div>
            <h3>{{ modalTab === 'dacte' ? 'Visualizador de DACTE' : 'Visualizador de XML' }}</h3>
            <p>CT-e {{ selectedXmlAudit.cte_numero || selectedXmlAudit.cte_number }} | {{ selectedXmlAudit.xml_filename }}</p>
          </div>
          
          <!-- Controle de Abas do Modal -->
          <div class="modal-tabs">
            <button 
              @click="modalTab = 'dacte'" 
              :class="['modal-tab-btn', { active: modalTab === 'dacte' }]"
            >
              <i class="fas fa-file-invoice"></i> DACTE Visual
            </button>
            <button 
              @click="modalTab = 'xml'" 
              :class="['modal-tab-btn', { active: modalTab === 'xml' }]"
            >
              <i class="fas fa-code"></i> XML Bruto
            </button>
          </div>

          <button @click="selectedXmlAudit = null" class="btn-close">&times;</button>
        </div>

        <div class="modal-body-wrapper">
          <!-- ABA XML BRUTO -->
          <div v-if="modalTab === 'xml'" class="xml-content-area">
            <pre><code>{{ selectedXmlAudit.xml_content }}</code></pre>
          </div>

          <!-- ABA DACTE VISUAL -->
          <div v-if="modalTab === 'dacte'" class="dacte-viewer-area">
            <div v-if="!parsedDacte" class="dacte-error">
              <i class="fas fa-exclamation-triangle"></i>
              <p>Não foi possível processar o XML para gerar o DACTE.</p>
            </div>
            <div v-else id="dacte-print-area" class="dacte-container">
              <!-- CABEÇALHO DACTE -->
              <div class="dacte-row dacte-header-row">
                <div class="dacte-col dacte-emitente">
                  <div class="dacte-emit-name">{{ parsedDacte.emitente?.nome }}</div>
                  <div class="dacte-emit-fant" v-if="parsedDacte.emitente?.fantasia">{{ parsedDacte.emitente?.fantasia }}</div>
                  <div class="dacte-emit-addr">
                    {{ parsedDacte.emitente?.endereco?.logradouro }}, {{ parsedDacte.emitente?.endereco?.numero }}
                    <span v-if="parsedDacte.emitente?.endereco?.complemento"> - {{ parsedDacte.emitente?.endereco?.complemento }}</span>
                  </div>
                  <div class="dacte-emit-addr-sub">
                    {{ parsedDacte.emitente?.endereco?.bairro }} - {{ parsedDacte.emitente?.endereco?.municipio }}/{{ parsedDacte.emitente?.endereco?.uf }}
                  </div>
                  <div class="dacte-emit-contact" v-if="parsedDacte.emitente?.endereco?.fone">Fone: {{ parsedDacte.emitente?.endereco?.fone }}</div>
                </div>
                
                <div class="dacte-col dacte-title-block">
                  <div class="dacte-doc-title">DACTE</div>
                  <div class="dacte-doc-desc">Documento Auxiliar do Conhecimento de Transporte Eletrônico</div>
                  <div class="dacte-doc-types">
                    <div><strong>MOD:</strong> {{ parsedDacte.modelo }}</div>
                    <div><strong>SÉRIE:</strong> {{ parsedDacte.serie }}</div>
                    <div><strong>NÚMERO:</strong> {{ parsedDacte.numero }}</div>
                  </div>
                  <div class="dacte-doc-dh">
                    <strong>Emissão:</strong> {{ formatDate(parsedDacte.dhEmi) }}
                  </div>
                </div>

                <div class="dacte-col dacte-key-block">
                  <div class="dacte-label">CHAVE DE ACESSO DO CT-e</div>
                  <div class="dacte-key">{{ formatKey(parsedDacte.chave) }}</div>
                  
                  <div class="dacte-protocol-box">
                    <div class="dacte-label">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
                    <div class="dacte-val">
                      {{ parsedDacte.protocolo || 'N/A' }} 
                      <span v-if="parsedDacte.data_protocolo"> - {{ formatDate(parsedDacte.data_protocolo) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- DADOS ADICIONAIS CABEÇALHO -->
              <div class="dacte-row dacte-border-top">
                <div class="dacte-col size-4">
                  <div class="dacte-label">NATUREZA DA OPERAÇÃO</div>
                  <div class="dacte-val">{{ parsedDacte.natOp }}</div>
                </div>
                <div class="dacte-col size-1">
                  <div class="dacte-label">CFOP</div>
                  <div class="dacte-val">{{ parsedDacte.cfop }}</div>
                </div>
                <div class="dacte-col size-3">
                  <div class="dacte-label">INSCRIÇÃO ESTADUAL DO EMITENTE</div>
                  <div class="dacte-val">{{ parsedDacte.emitente?.ie }}</div>
                </div>
                <div class="dacte-col size-2">
                  <div class="dacte-label">CNPJ DO EMITENTE</div>
                  <div class="dacte-val">{{ formatCnpj(parsedDacte.emitente?.cnpj) }}</div>
                </div>
              </div>

              <!-- PARTICIPANTES -->
              <!-- REMETENTE -->
              <div class="dacte-section-title">REMETENTE</div>
              <div class="dacte-row dacte-border-top">
                <div class="dacte-col size-5">
                  <div class="dacte-label">RAZÃO SOCIAL</div>
                  <div class="dacte-val bold">{{ parsedDacte.remetente?.nome }}</div>
                </div>
                <div class="dacte-col size-3">
                  <div class="dacte-label">CNPJ/CPF</div>
                  <div class="dacte-val">{{ formatCnpj(parsedDacte.remetente?.cnpj) }}</div>
                </div>
                <div class="dacte-col size-2">
                  <div class="dacte-label">INSCRIÇÃO ESTADUAL</div>
                  <div class="dacte-val">{{ parsedDacte.remetente?.ie || 'ISENTO' }}</div>
                </div>
              </div>
              <div class="dacte-row">
                <div class="dacte-col size-5">
                  <div class="dacte-label">ENDEREÇO</div>
                  <div class="dacte-val">
                    {{ parsedDacte.remetente?.endereco?.logradouro }}, {{ parsedDacte.remetente?.endereco?.numero }}
                    <span v-if="parsedDacte.remetente?.endereco?.bairro"> - {{ parsedDacte.remetente?.endereco?.bairro }}</span>
                  </div>
                </div>
                <div class="dacte-col size-3">
                  <div class="dacte-label">MUNICÍPIO / UF</div>
                  <div class="dacte-val">{{ parsedDacte.remetente?.endereco?.municipio }} / {{ parsedDacte.remetente?.endereco?.uf }}</div>
                </div>
                <div class="dacte-col size-2">
                  <div class="dacte-label">FONE / CEP</div>
                  <div class="dacte-val">{{ parsedDacte.remetente?.endereco?.fone || 'N/A' }} - {{ parsedDacte.remetente?.endereco?.cep || '' }}</div>
                </div>
              </div>

              <!-- DESTINATÁRIO -->
              <div class="dacte-section-title">DESTINATÁRIO</div>
              <div class="dacte-row dacte-border-top">
                <div class="dacte-col size-5">
                  <div class="dacte-label">RAZÃO SOCIAL</div>
                  <div class="dacte-val bold">{{ parsedDacte.destinatario?.nome }}</div>
                </div>
                <div class="dacte-col size-3">
                  <div class="dacte-label">CNPJ/CPF</div>
                  <div class="dacte-val">{{ formatCnpj(parsedDacte.destinatario?.cnpj) }}</div>
                </div>
                <div class="dacte-col size-2">
                  <div class="dacte-label">INSCRIÇÃO ESTADUAL</div>
                  <div class="dacte-val">{{ parsedDacte.destinatario?.ie || 'ISENTO' }}</div>
                </div>
              </div>
              <div class="dacte-row">
                <div class="dacte-col size-5">
                  <div class="dacte-label">ENDEREÇO</div>
                  <div class="dacte-val">
                    {{ parsedDacte.destinatario?.endereco?.logradouro }}, {{ parsedDacte.destinatario?.endereco?.numero }}
                    <span v-if="parsedDacte.destinatario?.endereco?.bairro"> - {{ parsedDacte.destinatario?.endereco?.bairro }}</span>
                  </div>
                </div>
                <div class="dacte-col size-3">
                  <div class="dacte-label">MUNICÍPIO / UF</div>
                  <div class="dacte-val">{{ parsedDacte.destinatario?.endereco?.municipio }} / {{ parsedDacte.destinatario?.endereco?.uf }}</div>
                </div>
                <div class="dacte-col size-2">
                  <div class="dacte-label">FONE / CEP</div>
                  <div class="dacte-val">{{ parsedDacte.destinatario?.endereco?.fone || 'N/A' }} - {{ parsedDacte.destinatario?.endereco?.cep || '' }}</div>
                </div>
              </div>

              <!-- TOMADOR DO SERVIÇO -->
              <div v-if="parsedDacte.tomador" class="dacte-section-title">TOMADOR DO SERVIÇO (RESPONSÁVEL PELO FRETE)</div>
              <div v-if="parsedDacte.tomador" class="dacte-row dacte-border-top">
                <div class="dacte-col size-5">
                  <div class="dacte-label">RAZÃO SOCIAL (Papel: {{ parsedDacte.tomador.ref }})</div>
                  <div class="dacte-val bold">{{ parsedDacte.tomador.nome }}</div>
                </div>
                <div class="dacte-col size-3">
                  <div class="dacte-label">CNPJ/CPF</div>
                  <div class="dacte-val">{{ formatCnpj(parsedDacte.tomador.cnpj) }}</div>
                </div>
                <div class="dacte-col size-2">
                  <div class="dacte-label">INSCRIÇÃO ESTADUAL</div>
                  <div class="dacte-val">{{ parsedDacte.tomador.ie || 'ISENTO' }}</div>
                </div>
              </div>
              <div v-if="parsedDacte.tomador" class="dacte-row">
                <div class="dacte-col size-5">
                  <div class="dacte-label">ENDEREÇO</div>
                  <div class="dacte-val">
                    {{ parsedDacte.tomador.endereco?.logradouro || '' }} {{ parsedDacte.tomador.endereco?.numero || '' }}
                    <span v-if="parsedDacte.tomador.endereco?.bairro"> - {{ parsedDacte.tomador.endereco.bairro }}</span>
                  </div>
                </div>
                <div class="dacte-col size-3">
                  <div class="dacte-label">MUNICÍPIO / UF</div>
                  <div class="dacte-val">{{ parsedDacte.tomador.endereco?.municipio || '' }} / {{ parsedDacte.tomador.endereco?.uf || '' }}</div>
                </div>
                <div class="dacte-col size-2">
                  <div class="dacte-label">FONE / CEP</div>
                  <div class="dacte-val">{{ parsedDacte.tomador.endereco?.fone || 'N/A' }} - {{ parsedDacte.tomador.endereco?.cep || '' }}</div>
                </div>
              </div>

              <!-- DADOS DA CARGA -->
              <div class="dacte-section-title">PRODUTO PREDOMINANTE E DADOS DA CARGA</div>
              <div class="dacte-row dacte-border-top">
                <div class="dacte-col size-5">
                  <div class="dacte-label">PRODUTO PREDOMINANTE</div>
                  <div class="dacte-val">{{ parsedDacte.produto_predominante || 'CARGA GERAL' }}</div>
                </div>
                <div class="dacte-col size-5">
                  <div class="dacte-label">VALOR TOTAL DA CARGA</div>
                  <div class="dacte-val bold">R$ {{ formatNumber(parsedDacte.valor_total_carga || parsedDacte.valor_carga) }}</div>
                </div>
              </div>
              <div class="dacte-row dacte-border-top">
                <div v-for="med in parsedDacte.medidas" :key="med.type" class="dacte-col">
                  <div class="dacte-label">{{ med.type }}</div>
                  <div class="dacte-val bold">{{ formatNumber(med.val) }}</div>
                </div>
                <div v-if="!parsedDacte.medidas || parsedDacte.medidas.length === 0" class="dacte-col">
                  <div class="dacte-label">PESO (KG)</div>
                  <div class="dacte-val">N/A</div>
                </div>
                <div v-if="!parsedDacte.medidas || parsedDacte.medidas.length === 0" class="dacte-col">
                  <div class="dacte-label">VOLUMES</div>
                  <div class="dacte-val">N/A</div>
                </div>
              </div>

              <!-- VALORES DO FRETE -->
              <div class="dacte-section-title">COMPONENTES DO VALOR DA PRESTAÇÃO DO SERVIÇO</div>
              <div class="dacte-row dacte-border-top">
                <div class="dacte-col size-7">
                  <div class="dacte-components-grid">
                    <div v-for="comp in parsedDacte.componentes" :key="comp.name" class="dacte-comp-item">
                      <span class="dacte-comp-name">{{ comp.name }}:</span>
                      <span class="dacte-comp-val">R$ {{ formatNumber(comp.value) }}</span>
                    </div>
                    <div v-if="!parsedDacte.componentes || parsedDacte.componentes.length === 0" class="dacte-comp-item text-muted">
                      Nenhum componente discriminado no XML.
                    </div>
                  </div>
                </div>
                <div class="dacte-col size-3 dacte-border-left bg-light-gray dacte-align-right">
                  <div class="dacte-label text-right">VALOR TOTAL DO SERVIÇO</div>
                  <div class="dacte-val-large">R$ {{ formatNumber(parsedDacte.valor_total) }}</div>
                  <div class="dacte-label text-right">VALOR A RECEBER</div>
                  <div class="dacte-val-large">R$ {{ formatNumber(parsedDacte.valor_receber) }}</div>
                </div>
              </div>

              <!-- NOTAS FISCAIS RELACIONADAS -->
              <div class="dacte-section-title">DOCUMENTOS FISCAIS RELACIONADOS (NF-e)</div>
              <div class="dacte-row dacte-border-top">
                <div class="dacte-col size-10">
                  <div class="dacte-nfe-list">
                    <div v-for="(chave, idx) in parsedDacte.nfe_chaves" :key="chave" class="dacte-nfe-item">
                      <strong>NF-e {{ idx + 1 }}:</strong> <span class="dacte-nfe-key">{{ formatKey(chave) }}</span>
                    </div>
                    <div v-if="!parsedDacte.nfe_chaves || parsedDacte.nfe_chaves.length === 0" class="text-muted">
                      Nenhuma Nota Fiscal Eletrônica vinculada encontrada no XML.
                    </div>
                  </div>
                </div>
              </div>

              <!-- OBSERVAÇÕES -->
              <div class="dacte-section-title">OBSERVAÇÕES DO CONTRIBUINTE</div>
              <div class="dacte-row dacte-border-top">
                <div class="dacte-col size-10 dacte-obs-box">
                  <div class="dacte-obs-content">{{ parsedDacte.xObs || 'Sem observações declaradas pelo contribuinte.' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button v-if="modalTab === 'dacte' && parsedDacte" @click="printDacte" class="btn-primary">
            <i class="fas fa-print"></i> Imprimir DACTE (PDF)
          </button>
          <button @click="downloadXmlDirect(selectedXmlAudit)" class="btn-primary-outline">
            <i class="fas fa-download"></i> Baixar XML
          </button>
          <button @click="selectedXmlAudit = null" class="btn-secondary">Fechar</button>
        </div>
      </div>
    </div>

    <!-- Visualizador de PDF Modal -->
    <div v-if="isPdfPreviewOpen" class="modal-overlay pdf-modal" @click.self="isPdfPreviewOpen = false">
        <div class="pdf-container animate-pop" :class="{ 'bg-black': currentCarrierLogo === 'white', 'bg-white': currentCarrierLogo === 'dark' }">
            <div class="pdf-header">
                <div class="pdf-titles">
                    <h3>Visualizando Cotação Original</h3>
                    <p>Documento gerado no momento do orçamento</p>
                </div>
                <button class="btn-close-pdf" @click="isPdfPreviewOpen = false">×</button>
            </div>
            
            <div class="pdf-content">
                <div v-if="isPdfLoading" class="pdf-loading">
                    <div class="spinner-blue"></div>
                    <p>Aguarde, carregando documento...</p>
                </div>
                <iframe 
                    :src="pdfPreviewUrl" 
                    class="pdf-frame" 
                    @load="onPdfLoaded"
                    frameborder="0"
                ></iframe>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAuthenticatedBlobUrl } from '../utils/api-utils';

// Abas
const activeTab = ref('historico');

// Aba 1: Histórico
const audits = ref([]);
const summary = ref(null);
const loading = ref(false);

// Aba 2: SIEG Live
const loadingSieg = ref(false);
const siegCtes = ref([]);
const sQueryError = ref(null);
const loadingClients = ref(false);
const clientsList = ref([]);
const selectedClientCnpjs = ref([]);

// Filtros Datas (Inicializa com últimos 30 dias)
const today = new Date();
const past30Days = new Date();
past30Days.setDate(today.getDate() - 30);

const filterStartDate = ref(past30Days.toISOString().substring(0, 10));
const filterEndDate = ref(today.toISOString().substring(0, 10));

// Modais
const selectedXmlAudit = ref(null);
const modalTab = ref('dacte');

// Função de parsing do DACTE a partir do XML
const parseXmlDacte = (xmlStr) => {
  if (!xmlStr) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, "text/xml");
    
    const getTagText = (tagName) => {
      const el = doc.getElementsByTagName(tagName)[0];
      return el ? el.textContent : '';
    };

    const getNestedTagText = (parentTag, childTag) => {
      const parent = doc.getElementsByTagName(parentTag)[0];
      if (!parent) return '';
      const child = parent.getElementsByTagName(childTag)[0];
      return child ? child.textContent : '';
    };

    const getNfeChaves = () => {
      const chaves = [];
      const nodes = doc.getElementsByTagName('infNFe');
      for (let i = 0; i < nodes.length; i++) {
        const ch = nodes[i].getElementsByTagName('chave')[0]?.textContent;
        if (ch) chaves.push(ch);
      }
      const nDocNodes = doc.getElementsByTagName('infNF');
      for (let i = 0; i < nDocNodes.length; i++) {
        const nDoc = nDocNodes[i].getElementsByTagName('nDoc')[0]?.textContent;
        if (nDoc) chaves.push(`Nota: ${nDoc}`);
      }
      return chaves;
    };

    const getFreteComponentes = () => {
      const compList = [];
      const nodes = doc.getElementsByTagName('Comp');
      for (let i = 0; i < nodes.length; i++) {
        const xNome = nodes[i].getElementsByTagName('xNome')[0]?.textContent;
        const vComp = nodes[i].getElementsByTagName('vComp')[0]?.textContent;
        if (xNome && vComp) {
          compList.push({ name: xNome, value: parseFloat(vComp) });
        }
      }
      return compList;
    };

    const getMedidas = () => {
      const medList = [];
      const nodes = doc.getElementsByTagName('infQ');
      for (let i = 0; i < nodes.length; i++) {
        const tpMed = nodes[i].getElementsByTagName('tpMed')[0]?.textContent;
        const qCarga = nodes[i].getElementsByTagName('qCarga')[0]?.textContent;
        if (tpMed && qCarga) {
          medList.push({ type: tpMed, val: qCarga });
        }
      }
      return medList;
    };

    const parseEndereco = (parentEl) => {
      if (!parentEl) return {};
      const get = (tag) => parentEl.getElementsByTagName(tag)[0]?.textContent || '';
      return {
        logradouro: get('xLgr'),
        numero: get('nro'),
        complemento: get('xCpl'),
        bairro: get('xBairro'),
        municipio: get('xMun'),
        uf: get('UF'),
        cep: get('CEP'),
        fone: get('fone')
      };
    };

    const getParticipant = (tagName) => {
      const el = doc.getElementsByTagName(tagName)[0];
      if (!el) return null;
      const get = (tag) => el.getElementsByTagName(tag)[0]?.textContent || '';
      const enderTag = el.getElementsByTagName('ender' + tagName.charAt(0).toUpperCase() + tagName.slice(1))[0] 
                    || el.getElementsByTagName('enderEmit')[0]
                    || el.getElementsByTagName('enderDest')[0]
                    || el.getElementsByTagName('enderReme')[0];
      return {
        cnpj: get('CNPJ') || get('CPF'),
        ie: get('IE'),
        nome: get('xNome'),
        fantasia: get('xFant'),
        endereco: parseEndereco(enderTag)
      };
    };

    const getTomador = () => {
      const toma3 = doc.getElementsByTagName('toma3')[0];
      if (toma3) {
        const tomaVal = parseInt(toma3.getElementsByTagName('toma')[0]?.textContent || '0');
        if (tomaVal === 0) return { ref: 'REMETENTE', ...getParticipant('rem') };
        if (tomaVal === 3) return { ref: 'DESTINATÁRIO', ...getParticipant('dest') };
        if (toma3.getElementsByTagName('CNPJ')[0] || toma3.getElementsByTagName('CPF')[0]) {
          const get = (tag) => toma3.getElementsByTagName(tag)[0]?.textContent || '';
          return {
            ref: 'TOMADOR (3)',
            cnpj: get('CNPJ') || get('CPF'),
            ie: get('IE'),
            nome: get('xNome'),
            endereco: parseEndereco(toma3)
          };
        }
      }
      const toma4 = doc.getElementsByTagName('toma4')[0];
      if (toma4) {
        const get = (tag) => toma4.getElementsByTagName(tag)[0]?.textContent || '';
        return {
          ref: 'TOMADOR (4)',
          cnpj: get('CNPJ') || get('CPF'),
          ie: get('IE'),
          nome: get('xNome'),
          endereco: parseEndereco(toma4)
        };
      }
      return null;
    };

    const ide = doc.getElementsByTagName('ide')[0];
    const compl = doc.getElementsByTagName('compl')[0];
    const vPrest = doc.getElementsByTagName('vPrest')[0];
    const infCarga = doc.getElementsByTagName('infCarga')[0];
    const protCTe = doc.getElementsByTagName('protCTe')[0];

    const getChaveAcesso = () => {
      const infCte = doc.getElementsByTagName('infCte')[0];
      let id = infCte ? infCte.getAttribute('Id') : '';
      if (id) {
        return id.replace(/[^\d]/g, '');
      }
      return getTagText('chCTe');
    };

    return {
      chave: getChaveAcesso(),
      protocolo: protCTe ? protCTe.getElementsByTagName('nProt')[0]?.textContent : '',
      data_protocolo: protCTe ? protCTe.getElementsByTagName('dhRecbto')[0]?.textContent : '',
      numero: ide?.getElementsByTagName('nCT')[0]?.textContent || '',
      serie: ide?.getElementsByTagName('serie')[0]?.textContent || '',
      modelo: ide?.getElementsByTagName('mod')[0]?.textContent || '',
      dhEmi: ide?.getElementsByTagName('dhEmi')[0]?.textContent || '',
      natOp: ide?.getElementsByTagName('natOp')[0]?.textContent || '',
      cfop: ide?.getElementsByTagName('CFOP')[0]?.textContent || '',
      xObs: compl?.getElementsByTagName('xObs')[0]?.textContent || '',
      
      emitente: getParticipant('emit'),
      remetente: getParticipant('rem'),
      destinatario: getParticipant('dest'),
      tomador: getTomador(),
      
      valor_total: parseFloat(vPrest?.getElementsByTagName('vTPrest')[0]?.textContent || '0'),
      valor_receber: parseFloat(vPrest?.getElementsByTagName('vRec')[0]?.textContent || '0'),
      componentes: getFreteComponentes(),
      
      valor_carga: parseFloat(infCarga?.getElementsByTagName('vCarga')[0]?.textContent || '0'),
      produto_predominante: infCarga?.getElementsByTagName('proPred')[0]?.textContent || '',
      medidas: getMedidas(),
      nfe_chaves: getNfeChaves()
    };
  } catch (err) {
    console.error("Erro ao processar DACTE do XML:", err);
    return null;
  }
};

const parsedDacte = computed(() => {
  if (!selectedXmlAudit.value || !selectedXmlAudit.value.xml_content) return null;
  return parseXmlDacte(selectedXmlAudit.value.xml_content);
});

const formatKey = (key) => {
  if (!key) return '';
  const clean = key.replace(/\D/g, '');
  if (clean.length !== 44) return key;
  return clean.replace(/(\d{4})/g, '$1 ').trim();
};

const printDacte = () => {
  window.print();
};

const isPdfPreviewOpen = ref(false);
const pdfPreviewUrl = ref("");
const isPdfLoading = ref(false);
const currentCarrierLogo = ref("");

// Formatadores
const formatNumber = (val) => {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatCnpj = (cnpj) => {
  if (!cnpj) return '';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

const getDiffClass = (val) => {
  if (val > 0.5) return 'is-loss';
  if (val < -0.5) return 'is-gain';
  return 'is-neutral';
};

const getProgressWidth = (data) => {
  const total = data.gains + data.losses;
  if (total === 0) return '0%';
  const perc = (data.gains / total) * 100;
  return `${perc}%`;
};

const getProgressPercentage = (data) => {
    const total = data.gains + data.losses;
    if (total === 0) return '0';
    return ((data.gains / total) * 100).toFixed(0);
};

const getProgressColor = (data) => {
  const perc = (data.gains / (data.gains + data.losses || 1)) * 100;
  if (perc > 90) return 'var(--primary)';
  if (perc > 70) return '#10b981';
  return '#f59e0b';
};

// Ações Aba 1
const loadData = async () => {
  if (loading.value) return;
  loading.value = true;
  try {
    const [resAudits, resSummary] = await Promise.all([
      window.safeFetch('/api/audit'),
      window.safeFetch('/api/audit/summary')
    ]);

    if (resAudits.ok) audits.value = resAudits.data;
    if (resSummary.ok) summary.value = resSummary.data;
  } catch (error) {
    console.error('Audit Error:', error);
    if (window.showToast) window.showToast('Erro ao carregar dados de auditoria', 'error');
  } finally {
    loading.value = false;
  }
};

const handleCheck = async (id, isFromSiegLive = false) => {
    if (!confirm('Deseja marcar esta divergência como conferida no banco?')) return;
    try {
        const res = await window.safeFetch(`/api/audit/${id}/check`, { method: 'POST' });
        if (res.ok) {
            if (window.showToast) window.showToast('Conferência aprovada com sucesso!', 'success');
            if (isFromSiegLive) {
                querySiegCtes();
            }
            loadData();
        } else {
            if (window.showToast) window.showToast(res.data.message || 'Erro ao conferir', 'error');
        }
    } catch (e) {
        console.error(e);
    }
};

// Ações Aba 2
const fetchClients = async () => {
  loadingClients.value = true;
  try {
    const res = await window.safeFetch('/api/clients?limit=200');
    if (res.ok) {
      clientsList.value = res.data.data || [];
    }
  } catch (e) {
    console.error('Erro ao buscar clientes:', e);
  } finally {
    loadingClients.value = false;
  }
};

const querySiegCtes = async () => {
  if (loadingSieg.value) return;
  loadingSieg.value = true;
  siegCtes.value = [];
  sQueryError.value = null;
  try {
    const res = await window.safeFetch('/api/audit/sieg-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cnpjs: selectedClientCnpjs.value,
        startDate: filterStartDate.value,
        endDate: filterEndDate.value
      })
    });

    if (res.ok) {
      siegCtes.value = res.data;
      if (window.showToast) {
        window.showToast(`Cofre consultado! ${res.data.length} CT-es localizados no período.`, 'success');
      }
    } else {
      sQueryError.value = res.data || { message: 'Erro interno desconhecido no servidor' };
      if (window.showToast) {
        window.showToast(res.data?.message || 'Erro ao realizar varredura no SIEG', 'error');
      }
    }
  } catch (error) {
    console.error(error);
    sQueryError.value = { message: error.message || 'Erro de conexão com a API do servidor' };
    if (window.showToast) window.showToast('Erro de conexão com a API do servidor', 'error');
  } finally {
    loadingSieg.value = false;
  }
};

const saveLiveAudit = async (quotationId) => {
  try {
    if (window.showToast) window.showToast('Iniciando persistência e salvamento da auditoria...', 'info');
    const res = await window.safeFetch(`/api/audit/${quotationId}`, { method: 'POST' });
    if (res.ok) {
      if (window.showToast) window.showToast('Auditoria salva com sucesso no histórico local!', 'success');
      // Recarrega o SIEG live para obter o ID da auditoria no banco e mudar a opção do botão
      querySiegCtes();
      // Recarrega o histórico
      loadData();
    } else {
      if (window.showToast) window.showToast(res.data.message || 'Falha ao salvar auditoria', 'error');
    }
  } catch (e) {
    console.error(e);
    if (window.showToast) window.showToast('Falha na conexão', 'error');
  }
};

// Download direto offline do XML vindo do SIEG (Solicitado pelo usuário)
const downloadXmlDirect = (cte) => {
  if (!cte.xml_content) {
    if (window.showToast) window.showToast('Conteúdo XML indisponível para download', 'warning');
    return;
  }
  try {
    const blob = new Blob([cte.xml_content], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cte.xml_filename || `cte_${cte.cte_numero || cte.numero_cte}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    if (window.showToast) window.showToast('Download do XML concluído com sucesso!', 'success');
  } catch (e) {
    console.error(e);
    if (window.showToast) window.showToast('Erro ao processar download do XML', 'error');
  }
};

const openXmlModal = (cte) => {
  modalTab.value = 'dacte';
  selectedXmlAudit.value = {
    cte_numero: cte.cte_number || cte.numero_cte,
    xml_filename: cte.xml_filename,
    xml_content: cte.xml_content
  };
};

const openPdfPreview = async (quotation) => {
    if (!quotation) {
        if (window.showToast) window.showToast('Dados da cotação não encontrados para este audit', 'warning');
        return;
    }
    const url = `/api/quotations/${quotation.id}/pdf`;
    
    isPdfLoading.value = true;
    isPdfPreviewOpen.value = true;

    try {
        const blobUrl = await getAuthenticatedBlobUrl(url);
        pdfPreviewUrl.value = blobUrl;
    } catch (e) {
        console.error(e);
        if (window.showToast) window.showToast('Erro ao carregar PDF', 'error');
        isPdfPreviewOpen.value = false;
    }
    
    const carrier = quotation.transportadora_escolhida?.toUpperCase() || "";
    if (carrier.includes("RODONAVES") || carrier.includes("TEX") || carrier.includes("ENVIA") || carrier.includes("SUDOESTE")) {
        currentCarrierLogo.value = "white";
    } else {
        currentCarrierLogo.value = "dark";
    }
};

const onPdfLoaded = () => {
    isPdfLoading.value = false;
};

const downloadXml = async (auditId) => {
  try {
    const res = await window.safeFetch(`/api/audit/${auditId}/xml`);
    if (res.ok) {
      const { xml, filename } = res.data;
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `audit_${auditId}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      if (window.showToast) window.showToast('Erro ao baixar XML', 'error');
    }
  } catch (e) {
    console.error('Download Error:', e);
    if (window.showToast) window.showToast('Falha na conexão', 'error');
  }
};

onMounted(() => {
  loadData();
  fetchClients();
});
</script>

<style scoped>
.conferencia-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Glass Cards */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  padding: 24px;
}

/* Header */
.header-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.icon-circle {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #004a99, #003366);
  color: white;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  border: 2px solid white;
}

.shadow-glow {
  box-shadow: 0 8px 20px rgba(0, 74, 153, 0.25);
}

.page-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  letter-spacing: -0.02em;
}

.page-subtitle {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin: 4px 0 0;
}

/* Controle de Abas */
.tabs-control {
  display: flex;
  gap: 6px;
  background: #f1f5f9;
  padding: 6px;
  border-radius: 16px;
  border: 1.5px solid var(--border);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-weight: 700;
  font-size: 0.85rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-btn:hover {
  color: var(--primary);
  background: rgba(255,255,255,0.5);
}

.tab-btn.active {
  background: white;
  color: var(--primary);
  box-shadow: 0 4px 10px rgba(0,0,0,0.04);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Summary Row */
.summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.summary-box {
  padding: 24px;
  border-radius: 24px;
  background: white;
  border: 1px solid var(--border);
  transition: transform 0.3s;
}

.summary-box:hover {
  transform: translateY(-5px);
}

.box-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.carrier-tag {
  background: #f1f5f9;
  color: var(--primary);
  padding: 4px 12px;
  border-radius: 8px;
  font-weight: 800;
  font-size: 0.85rem;
  text-transform: uppercase;
}

.count-tag {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}

.box-values {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.val-group {
  display: flex;
  flex-direction: column;
}

.val-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.val-number {
  font-size: 1.25rem;
  font-weight: 800;
  margin-top: 4px;
}

.text-success { color: #10b981; }
.text-danger { color: #ef4444; }
.text-purple { color: #8b5cf6; }

.progress-track {
  height: 8px;
  background: #f1f5f9;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-labels {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-align: right;
}

/* ==================== ESTILOS FILTROS SIEG ==================== */
.filter-card {
  border-radius: 28px;
  border: 1.5px solid #e2e8f0;
}

.panel-title {
  font-size: 1.15rem;
  font-weight: 900;
  color: #0f172a;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  letter-spacing: -0.01em;
}

.panel-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 24px;
}

.filter-grid {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.form-group-custom {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flex-grow {
  flex: 1;
  min-width: 280px;
}

.form-label-custom {
  font-weight: 800;
  color: #334155;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.date-inputs-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  padding: 6px 12px;
  border: 1.5px solid #e2e8f0;
  border-radius: 16px;
  height: 54px;
  transition: 0.2s;
}

.date-inputs-wrapper:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(0, 74, 153, 0.08);
}

.input-date {
  border: none;
  font-family: inherit;
  font-weight: 700;
  color: #0f172a;
  outline: none;
  font-size: 0.9rem;
}

.date-divider {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 600;
}

/* Scroll list de Clientes */
.client-multiselect-container {
  border: 1.5px solid #e2e8f0;
  border-radius: 18px;
  background: white;
  padding: 10px;
  height: 110px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.loading-clients-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 10px;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
}

.clients-scroll-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}

.client-checkbox-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
  cursor: pointer;
  transition: 0.2s;
}

.client-checkbox-item:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.client-checkbox-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
  cursor: pointer;
}

.client-cb-details {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.client-cb-name {
  font-size: 0.75rem;
  font-weight: 800;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.client-cb-cnpj {
  font-size: 0.65rem;
  color: var(--text-muted);
  font-weight: 600;
  font-family: monospace;
}

.input-hint {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-action-container {
  display: flex;
  align-self: stretch;
  align-items: flex-end;
  padding-bottom: 2px;
}

.btn-sieg-search {
  height: 54px;
  background: linear-gradient(135deg, #004a99, #002244);
  color: white;
  border: none;
  border-radius: 16px;
  font-weight: 800;
  font-size: 0.95rem;
  padding: 0 30px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-sieg-search:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0, 74, 153, 0.25);
  filter: brightness(1.1);
}

.btn-sieg-search:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ==================== PAINEL DE MÉTRICAS LIVE ==================== */
.live-metrics-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.metric-box {
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 20px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
}

.metric-header-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.metric-header-box i {
  font-size: 1.1rem;
}

.metric-number {
  font-size: 1.8rem;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin-bottom: 4px;
}

.metric-sub {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 600;
}

/* Cores das Métricas */
.metric-box.info i { color: var(--primary); }
.metric-box.success i { color: #10b981; }
.metric-box.warning i { color: #ef4444; }
.metric-box.neutral i { color: #8b5cf6; }

.text-purple { color: #8b5cf6 !important; }

/* ==================== ESTILOS TABELA LIVE ==================== */
.live-table-card {
  border-radius: 28px;
  border: 1.5px solid #e2e8f0;
  box-shadow: 0 10px 30px rgba(0,0,0,0.03);
}

.border-bottom {
  border-bottom: 1.5px solid #f1f5f9;
}

.live-badge-count {
  font-size: 0.75rem;
  font-weight: 800;
  background: #eff6ff;
  color: var(--primary);
  padding: 4px 12px;
  border-radius: var(--radius-pill);
}

/* CT-e Cell */
.cte-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cte-number-badge {
  font-size: 0.88rem;
  font-weight: 800;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cte-date-sub {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 600;
}

.cte-carrier {
  font-size: 0.7rem;
  font-weight: 800;
  color: #004a99;
  background: #f0f7ff;
  padding: 2px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  margin-top: 2px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Atores Cell */
.participants-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 250px;
}

.participant-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.p-badge {
  font-size: 0.55rem;
  font-weight: 900;
  padding: 1px 4px;
  border-radius: 4px;
  color: white;
}

.p-badge.rem { background: #64748b; }
.p-badge.dest { background: #3b82f6; }

.p-name {
  font-size: 0.75rem;
  font-weight: 750;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Link quote cell */
.linked-quote-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.quote-number-pill {
  font-size: 0.75rem;
  font-weight: 800;
  background: #eff6ff;
  color: var(--primary);
  border: 1px solid #bfdbfe;
  padding: 3px 8px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
}

.quote-unlinked-pill {
  font-size: 0.75rem;
  font-weight: 800;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 3px 8px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
}

.nf-number-sub {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Freight Value */
.freight-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: #475569;
}

.freight-value.real {
  color: #0f172a;
  font-weight: 850;
}

/* Divergence Tag */
.diff-tag-large {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 900;
  display: inline-block;
}

.diff-tag-large.is-loss { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
.diff-tag-large.is-gain { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.diff-tag-large.is-neutral { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

/* Status Pill Premium */
.status-pill-premium {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 6px 14px;
  border-radius: 99px;
  border: 1px solid #e2e8f0;
  background: white;
}

.status-pill-premium .status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-pill-premium.ok {
  color: #15803d;
  background: #f0fdf4;
  border-color: #bbf7d0;
}
.status-pill-premium.ok .status-dot {
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.status-pill-premium.divergente {
  color: #b91c1c;
  background: #fdf2f2;
  border-color: #fecaca;
}
.status-pill-premium.divergente .status-dot {
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
}

.status-pill-premium.sem_cotacao {
  color: #4338ca;
  background: #eef2ff;
  border-color: #c7d2fe;
}
.status-pill-premium.sem_cotacao .status-dot {
  background: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

.status-pill-premium.conferido {
  color: #0369a1;
  background: #f0f9ff;
  border-color: #bae6fd;
}
.status-pill-premium.conferido .status-dot {
  background: var(--primary);
  box-shadow: 0 0 0 3px rgba(0, 74, 153, 0.2);
}

.row-danger {
  background: rgba(99, 102, 241, 0.015) !important;
}

/* Actions Live */
.btn-group-live {
  display: flex;
  gap: 5px;
  justify-content: flex-end;
}

.btn-live-action {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.9rem;
  background: white;
}

.btn-live-action.save { color: var(--primary); }
.btn-live-action.save:hover { background: #eff6ff; border-color: var(--primary); color: var(--primary); transform: translateY(-2px); box-shadow: 0 5px 12px rgba(0, 74, 153, 0.15); }

.btn-live-action.approve { color: #10b981; }
.btn-live-action.approve:hover { background: #ecfdf5; border-color: #10b981; color: #10b981; transform: translateY(-2px); box-shadow: 0 5px 12px rgba(16, 185, 129, 0.15); }

.btn-live-action.view { color: #64748b; }
.btn-live-action.view:hover { background: #f8fafc; border-color: #64748b; color: #334155; }

.btn-live-action.download { color: #f59e0b; }
.btn-live-action.download:hover { background: #fffbeb; border-color: #f59e0b; color: #d97706; transform: translateY(-2px); box-shadow: 0 5px 12px rgba(245, 158, 11, 0.15); }

.animate-pulse {
  animation: pulse-mini 2s infinite;
}

@keyframes pulse-mini {
  0% { box-shadow: 0 0 0 0 rgba(0, 74, 153, 0.15); }
  70% { box-shadow: 0 0 0 6px rgba(0, 74, 153, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 74, 153, 0); }
}

/* Loading SIEG Live */
.loading-overlay-live {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(6px);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;
}

.spinner-premium-circle {
  width: 48px;
  height: 48px;
  border: 4px solid #f1f5f9;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 74, 153, 0.1);
}

.loading-title {
  font-size: 1.05rem;
  font-weight: 850;
  color: #0f172a;
  margin-bottom: 6px;
}

.loading-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  max-width: 400px;
  line-height: 1.4;
}

.empty-icon-live {
  width: 80px;
  height: 80px;
  background: #f0f7ff;
  color: var(--primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  margin-bottom: 20px;
  box-shadow: 0 8px 16px rgba(0, 74, 153, 0.08);
}

/* ==================== ESTILOS MODAL XML ==================== */
.table-card {
  padding: 0;
  overflow: hidden;
}

.card-header-inner {
  padding: 24px 30px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header-inner h3 {
  font-size: 1.1rem;
  font-weight: 800;
  margin: 0;
}

.table-wrapper {
  position: relative;
  min-height: 200px;
  overflow-x: auto;
}

.premium-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.premium-table th {
  padding: 16px 30px;
  background: rgba(241, 245, 249, 0.5);
  text-align: left;
  font-size: 0.75rem;
  font-weight: 750;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
}

.premium-table td {
  padding: 16px 30px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  font-size: 0.95rem;
  color: var(--text-main);
}

.premium-table tr:last-child td {
  border-bottom: none;
}

.premium-table tr:hover {
  background: rgba(0, 74, 153, 0.015);
}

.doc-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nf-badge {
  font-weight: 850;
  color: var(--primary);
  font-size: 0.9rem;
}

.cte-info {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
}

.carrier-name-cell {
  font-weight: 750;
  color: var(--text-main);
}

.currency {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-right: 2px;
}
  
.ref-cell {
  display: flex;
  align-items: center;
}

.ref-badge {
  background: #f8fafc;
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: monospace;
}

.diff-tag {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 800;
}

.is-loss { background: #fee2e2; color: #991b1b; }
.is-gain { background: #dcfce7; color: #166534; }
.is-neutral { background: #f1f5f9; color: #475569; }

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 6px 12px;
  border-radius: 99px;
  background: white;
  border: 1px solid var(--border);
}

.status-indicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-indicator.ok .dot { background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2); }
.status-indicator.divergente .dot { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2); }
.status-indicator.conferido .dot { background: var(--primary); box-shadow: 0 0 0 3px rgba(0, 74, 153, 0.2); }

.row-warning {
  background: rgba(245, 158, 11, 0.015) !important;
}

/* Actions */
.btn-group {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.btn-action {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: 0.2s;
  font-size: 0.85rem;
  background: white;
}

.btn-action.success { color: #10b981; }
.btn-action.success:hover { background: #ecfdf5; border-color: #10b981; }
.btn-action.primary { color: var(--primary); }
.btn-action.primary:hover { background: #eff6ff; border-color: var(--primary); }
.btn-action.info { color: #3b82f6; }
.btn-action.info:hover { background: #f0f9ff; border-color: #3b82f6; }
.btn-action.secondary { color: var(--text-muted); }
.btn-action.secondary:hover { background: #f1f5f9; border-color: #cbd5e1; }

.btn-action:hover {
  transform: scale(1.08);
}

/* PDF Preview Modal */
.pdf-modal { background: rgba(0,0,0,0.85); z-index: 10000; }
.pdf-container { width: 95%; height: 90vh; max-width: 1000px; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }
.pdf-container.bg-black { background: #111; color: white; }
.pdf-container.bg-white { background: #fff; color: #111; }

.pdf-header { padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(128,128,128,0.2); }
.pdf-titles h3 { margin: 0; font-size: 1.2rem; font-weight: 850; color: inherit; }
.pdf-titles p { margin: 0; font-size: 0.8rem; opacity: 0.7; }

.btn-close-pdf { background: none; border: none; font-size: 2rem; color: inherit; cursor: pointer; opacity: 0.6; transition: 0.2s; }
.btn-close-pdf:hover { opacity: 1; transform: rotate(90deg); }

.pdf-content { flex: 1; position: relative; }
.pdf-frame { width: 100%; height: 100%; }
.pdf-loading { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: inherit; z-index: 10; }

.spinner-blue { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; margin: 0 auto 15px; animation: spin-alt 1s linear infinite; }
@keyframes spin-alt { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* Empty State */
.empty-state-lux {
  padding: 60px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--text-light);
  margin-bottom: 20px;
}

.empty-state-lux h4 { margin: 0; font-size: 1.25rem; font-weight: 800; }
.empty-state-lux p { color: var(--text-muted); margin-top: 8px; }

/* Loading */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(4px);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.loader-premium {
  width: 40px;
  height: 40px;
  border: 4px solid #f1f5f9;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Modal XML */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.xml-viewer-modal {
  width: 100%;
  max-width: 900px;
  max-height: 85vh;
  background: white;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border);
  overflow: hidden;
}

.modal-header {
  padding: 24px 30px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 850;
  color: var(--primary);
}

.modal-header p {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: 0.2s;
}

.btn-close:hover {
  color: #ef4444;
  transform: rotate(90deg);
}

.xml-content-area {
  flex: 1;
  overflow: auto;
  padding: 20px 30px;
  background: #f8fafc;
}

.xml-content-area pre {
  margin: 0;
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #1e293b;
}

.modal-footer {
  padding: 20px 30px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: white;
}

.animate-pop {
  animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes pop {
  from { opacity: 0; transform: scale(0.9) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.btn-primary {
  background: var(--primary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-secondary {
  background: #f1f5f9;
  color: var(--text-main);
  border: 1px solid var(--border);
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
}

.btn-primary-outline {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: white;
  border: 1.5px solid var(--primary);
  color: var(--primary);
  border-radius: var(--radius-pill);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary-outline:hover:not(:disabled) {
  background: var(--primary);
  color: white;
  transform: translateY(-1px);
}

@media (max-width: 1024px) {
  .live-metrics-row { grid-template-columns: repeat(2, 1fr); }
  .premium-table th:nth-child(2), .premium-table td:nth-child(2),
  .premium-table th:nth-child(4), .premium-table td:nth-child(4) {
    display: none;
  }
}

@media (max-width: 768px) {
  .header-main { flex-direction: column; align-items: flex-start; gap: 20px; }
  .summary-row { grid-template-columns: 1fr; }
  .live-metrics-row { grid-template-columns: 1fr; }
  .premium-table th:nth-child(3), .premium-table td:nth-child(3),
  .premium-table th:nth-child(6), .premium-table td:nth-child(6) {
    display: none;
  }
}

/* Estilos de Debug de Erro do SIEG Live */
.error-debug-card {
  background: #fdf2f2 !important;
  border: 1.5px solid #fecaca !important;
  padding: 24px !important;
  border-radius: 20px !important;
  margin-bottom: 24px;
}
.error-debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.error-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #b91c1c;
}
.error-title-group i {
  font-size: 1.3rem;
}
.error-title-group h4 {
  font-size: 1.05rem;
  font-weight: 850;
  margin: 0;
  letter-spacing: -0.01em;
}
.btn-close-error {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #991b1b;
  cursor: pointer;
  opacity: 0.6;
  transition: 0.2s;
  line-height: 1;
}
.btn-close-error:hover {
  opacity: 1;
  transform: scale(1.1);
}
.error-debug-desc {
  font-size: 0.85rem;
  color: #7f1d1d;
  margin-bottom: 15px;
  line-height: 1.4;
  font-weight: 600;
}
.error-debug-content {
  background: #1e293b;
  border-radius: 12px;
  padding: 15px;
  max-height: 250px;
  overflow: auto;
  border: 1px solid rgba(255,255,255,0.05);
}
.error-debug-code {
  margin: 0;
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.8rem;
  color: #f8fafc;
  line-height: 1.5;
}

/* Abas no Modal */
.modal-tabs {
  display: flex;
  gap: 12px;
  margin-left: 20px;
}

.modal-tab-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.modal-tab-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--text-main);
}

.modal-tab-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(0, 74, 153, 0.25);
}

/* Modal Responsivo para DACTE */
.xml-viewer-modal.dacte-mode {
  max-width: 900px;
  width: 95%;
}

.modal-body-wrapper {
  overflow-y: auto;
  max-height: calc(80vh - 120px);
  padding: 10px 0;
}

/* Área do DACTE */
.dacte-viewer-area {
  background: #f8fafc;
  padding: 15px;
  border-radius: 8px;
  color: #1e293b;
  font-family: 'Courier New', Courier, monospace;
}

.dacte-container {
  background: white;
  border: 2px solid #000;
  padding: 12px;
  font-size: 9px;
  line-height: 1.2;
}

.dacte-row {
  display: flex;
  width: 100%;
}

.dacte-border-top {
  border-top: 1px solid #000;
}

.dacte-border-left {
  border-left: 1px solid #000;
}

.dacte-col {
  flex: 1;
  padding: 4px;
  box-sizing: border-box;
}

.dacte-col.size-1 { flex: 1; }
.dacte-col.size-2 { flex: 2; }
.dacte-col.size-3 { flex: 3; }
.dacte-col.size-4 { flex: 4; }
.dacte-col.size-5 { flex: 5; }
.dacte-col.size-6 { flex: 6; }
.dacte-col.size-7 { flex: 7; }
.dacte-col.size-10 { flex: 10; }

.dacte-emitente {
  border-right: 1px solid #000;
  flex: 4;
}

.dacte-emit-name {
  font-size: 11px;
  font-weight: bold;
}

.dacte-emit-fant {
  font-size: 9px;
  font-style: italic;
  margin-bottom: 2px;
}

.dacte-emit-addr, .dacte-emit-addr-sub, .dacte-emit-contact {
  font-size: 8px;
}

.dacte-title-block {
  border-right: 1px solid #000;
  flex: 3;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.dacte-doc-title {
  font-size: 16px;
  font-weight: bold;
}

.dacte-doc-desc {
  font-size: 7px;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.dacte-doc-types {
  display: flex;
  gap: 8px;
  font-size: 8px;
}

.dacte-doc-dh {
  font-size: 8px;
  margin-top: 3px;
}

.dacte-key-block {
  flex: 5;
  padding: 4px;
}

.dacte-label {
  font-size: 7px;
  font-weight: bold;
  color: #475569;
  text-transform: uppercase;
  margin-bottom: 1px;
}

.dacte-key {
  font-size: 10px;
  font-weight: bold;
  word-break: break-all;
  margin-bottom: 6px;
  font-family: monospace;
}

.dacte-protocol-box {
  border-top: 1px solid #ddd;
  padding-top: 3px;
}

.dacte-val {
  font-size: 9px;
}

.dacte-val.bold {
  font-weight: bold;
}

.dacte-val-large {
  font-size: 12px;
  font-weight: bold;
}

.dacte-section-title {
  background: #000;
  color: #fff;
  font-weight: bold;
  font-size: 8px;
  padding: 2px 4px;
  text-transform: uppercase;
  margin-top: 6px;
}

.bg-light-gray {
  background-color: #f1f5f9;
}

.dacte-align-right {
  text-align: right;
}

.dacte-components-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}

.dacte-comp-item {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px dashed #ddd;
  padding-bottom: 1px;
}

.dacte-comp-name {
  font-weight: bold;
}

.dacte-nfe-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dacte-nfe-item {
  font-family: monospace;
}

.dacte-obs-box {
  min-height: 40px;
}

.dacte-obs-content {
  font-size: 8px;
  white-space: pre-wrap;
}

.dacte-error {
  text-align: center;
  padding: 40px;
}

.dacte-error i {
  font-size: 2rem;
  color: #ef4444;
  margin-bottom: 10px;
}

/* REGRAS DE IMPRESSÃO EXCLUSIVAS */
@media print {
  body * {
    visibility: hidden !important;
  }
  
  /* Exibe somente a modal de DACTE e seus filhos */
  .modal-overlay {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    height: auto !important;
    background: transparent !important;
    display: block !important;
    visibility: visible !important;
    overflow: visible !important;
  }
  
  .xml-viewer-modal {
    box-shadow: none !important;
    border: none !important;
    background: transparent !important;
    margin: 0 !important;
    padding: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
    visibility: visible !important;
  }

  .modal-header, .modal-footer, .modal-tabs, .btn-close {
    display: none !important;
  }

  .modal-body-wrapper {
    overflow: visible !important;
    max-height: none !important;
    padding: 0 !important;
    visibility: visible !important;
  }

  .dacte-viewer-area {
    background: white !important;
    padding: 0 !important;
    border-radius: 0 !important;
    visibility: visible !important;
  }

  #dacte-print-area, #dacte-print-area * {
    visibility: visible !important;
  }

  #dacte-print-area {
    border: 2px solid #000 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
}
</style>
