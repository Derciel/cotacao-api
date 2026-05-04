# NP Cargo (Nicopel Cargo System)

O **NP Cargo** é um ecossistema logístico completo desenvolvido para a **Nicopel**, focado na gestão inteligente de cotações, rastreamento de fretes, controle de coletas e auditoria financeira de transporte.

## 🚀 Principais Módulos

### 1. 📊 Dashboards & Analytics
- Visualização em tempo real de métricas de frete.
- Gráficos de cotações por dia e economia gerada.
- Ranking das transportadoras mais competitivas.

### 2. 📝 Cotações de Frete
- Integração nativa com a API da **Frenet**.
- Tabelas de frete personalizadas (ex: **VIP Transportadora**) com regras de negócio específicas.
- Cálculo automático de **IPI** integral (Nicopel: 3.25% ou 6.75% dependendo do produto).
- Geração de orçamentos profissionais em PDF.

### 3. 📜 Histórico & Gestão
- Lista completa de cotações com **paginação** de alta performance (10 itens por página).
- Filtros rápidos por cliente ou número de pedido.
- Fluxo de status consolidado: Pendente → Aprovado → Aguardando Coleta → Enviado.

### 4. 🚚 Módulo de Coletas
- Agrupamento inteligente por **Transportadora**.
- Cálculo automático de **Volumes** e **Peso Total** baseado no cadastro técnico dos produtos.
- Resumo de cargas prontas para retirada com totais acumulados por transportadora.

### 5. 🗺️ Rastreio em Tempo Real
- Mapa interativo do Brasil (SVG) colorido dinamicamente por status da carga.
- Acompanhamento visual do Lead Time (prazo de entrega) por estado.
- Links diretos integrados para os rastreadores oficiais das transportadoras.

### 6. 👥 Usuários & Permissões
- Gestão de acessos granular por módulo.
- Grid de permissões otimizado para os módulos: **Rastreio**, **Conferência** e **Coletas**.
- Interface administrativa protegida para deleção e auditoria.

## 🎨 Interface & Design (X-Aesthetics)
- **Dark Mode**: Suporte total a temas claros e escuros com variáveis CSS universais.
- **Glassmorphism**: Design premium com transparências, fundos desfocados e sombras suaves.
- **UX Dinâmica**: Micro-animações de feedback e transições fluidas entre páginas.

## 🛠️ Stack Tecnológica

- **Frontend**: Astro (SSR), Vue.js 3 (Composition API), FontAwesome 6.
- **Backend**: NestJS (TypeScript), PostgreSQL, TypeORM.
- **Documentação**: [Swagger (OpenAPI)](https://cotacao.nicopel.com.br/api-docs) disponível em produção.

## 📦 Como Rodar o Projeto

### 1. Backend
```bash
cd cotacao-backend
npm install
# Configure o .env com DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET
npm run start:dev
```

### 2. Frontend
```bash
cd cotacao-backend/frontend
npm install
npm run dev
```

---
*Desenvolvido para oferecer precisão técnica e excelência visual na logística industrial.*
