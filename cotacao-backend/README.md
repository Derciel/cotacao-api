# NP Cargo (Nicopel Cargo System)

O **NP Cargo** é um ecossistema logístico completo desenvolvido para a **Nicopel**, focado na gestão inteligente de cotações, rastreamento de fretes, controle de coletas e auditoria financeira de transporte.

---

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

### 5. 🗺️ Rastreio em Tempo Real & Roteirização
- Mapa interativo colorido dinamicamente por status da carga.
- Módulo avançado de **Roteirização de Frota** (multi-paradas e via planilha Excel) usando a API **OpenRouteService**.
- Acompanhamento visual do Lead Time (prazo de entrega).

### 6. 👥 Usuários & Permissões
- Gestão de acessos granular por módulo.
- Interface administrativa protegida para deleção e auditoria.

---

## 🎨 Interface & Design (X-Aesthetics)
- **Dark Mode**: Suporte total a temas claros e escuros com variáveis CSS universais.
- **Glassmorphism**: Design premium com transparências, fundos desfocados e sombras suaves.
- **UX Dinâmica**: Micro-animações de feedback e transições fluidas entre páginas.

---

## 🛠️ Stack Tecnológica

- **Frontend**: Astro (SSR), Vue.js 3 (Composition API), FontAwesome 6, Leaflet.
- **Backend**: NestJS (TypeScript), PostgreSQL, TypeORM, Puppeteer (para geração de PDF).
- **Documentação**: [Swagger (OpenAPI)](https://cotacao.nicopel.com.br/api-docs) disponível em produção.

---

## ⚙️ Variáveis de Ambiente (.env)

O projeto requer a configuração de variáveis de ambiente. Crie os arquivos `.env` nas pastas correspondentes, utilizando os exemplos abaixo:

**Exemplo para o Backend (`cotacao-backend/.env`):**
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_NAME=cotacao_db
JWT_SECRET=super_secret_key_nicopel_2025
FRENET_TOKEN=seu_token_frenet
PORT=3000
```

**Exemplo para o Frontend (`cotacao-backend/frontend/.env`):**
```env
VITE_API_URL=http://localhost:3000
VITE_ORS_API_KEY=seu_token_do_openrouteservice
```

---

## 📦 Como Rodar o Projeto (Desenvolvimento Local)

### 1. Inicializando o Banco de Dados
Certifique-se de ter o PostgreSQL rodando na sua máquina e crie o banco de dados configurado no seu `.env` (ex: `cotacao_db`).

### 2. Rodando o Backend (API NestJS)
Abra um terminal, acesse a pasta raiz do backend e inicie o servidor:
```bash
cd cotacao-backend
npm install
npm run dev
```
A API estará rodando em `http://localhost:3000` (com o Swagger disponível em `http://localhost:3000/api-docs`).

### 3. Rodando o Frontend (Astro + Vue)
Abra **outro** terminal e acesse a pasta do frontend para iniciá-lo:
```bash
cd cotacao-backend/frontend
npm install
npm run dev
```
O painel administrativo estará acessível em `http://localhost:4321` (ou a porta informada no console pelo Astro).

---

## 🚀 Como Fazer o Build (Produção / Deploy)

Para preparar o projeto para deploy em servidores como Render, Heroku ou VPS, siga os comandos abaixo de acordo com sua estratégia de hospedagem:

### Opção 1: Build Integrado (Recomendado para Full-Stack na mesma máquina)
Na raiz do backend, existe um comando configurado no `package.json` que compila automaticamente tanto o Frontend quanto o Backend de uma vez:
```bash
cd cotacao-backend
npm run build:all
npm run start:prod
```

### Opção 2: Build Separado (Ideal para Render, Vercel, Netlify)
Se você for hospedar o Frontend separado do Backend:

**Para compilar apenas o Frontend:**
```bash
cd cotacao-backend/frontend
npm install
npm run build
```
*(Os arquivos estáticos otimizados serão gerados dentro da pasta `dist/` do frontend).*

**Para compilar e rodar apenas o Backend:**
```bash
cd cotacao-backend
npm install
npm run build
npm run start:prod
```

---
*Desenvolvido para oferecer precisão técnica e excelência visual na logística industrial.*
