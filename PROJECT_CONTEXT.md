# BranchCommerce — Contexto Completo do Projeto

**BranchCommerce** é uma aplicação **Next.js + Convex + Clerk** para **controle financeiro e estoque de e-commerce brasileiro**, integrada com **Mercado Livre** (OAuth), **Mercado Pago** (APIs financeiras) e uma extensão Chrome **Branch Hunter** que calcula payouts em anúncios do ML e sincroniza custos com o backend.

---

## Índice

1. [Stack Tecnológico](#1-stack-tecnológico)
2. [Estrutura de Diretórios](#2-estrutura-de-diretórios)
3. [Arquivos de Configuração](#3-arquivos-de-configuração)
4. [Backend — Convex](#4-backend--convex)
5. [Rotas da Aplicação (App Router)](#5-rotas-da-aplicação-app-router)
6. [API Routes](#6-api-routes)
7. [Componentes UI](#7-componentes-ui)
8. [Feature: Product Analysis](#8-feature-product-analysis)
9. [Lib — Módulos Compartilhados](#9-lib--módulos-compartilhados)
10. [Extensão Chrome — Branch Hunter](#10-extensão-chrome--branch-hunter)
11. [Testes](#11-testes)

---

## 1. Stack Tecnológico

| Camada        | Tecnologia                                                   |
| ------------- | ------------------------------------------------------------ |
| Frontend      | Next.js 16.2, React 19, Tailwind CSS v4, Radix UI, shadcn/ui |
| Backend       | Convex (queries, mutations, schema)                          |
| Autenticação  | Clerk (`@clerk/nextjs`)                                      |
| Integração ML | Mercado Livre OAuth (PKCE), API REST v1                      |
| Integração MP | Mercado Pago REST API                                        |
| Extensão      | Chrome Manifest V3 (Branch Hunter)                           |
| Testes        | Vitest 4, `convex-test`, `@edge-runtime/vm`                  |
| Criptografia  | AES-256-GCM (tokens ML)                                      |

**Dependências principais:** `convex`, `@clerk/nextjs`, `radix-ui`, `tailwind-merge`, `cva`, `lucide-react`, `next-themes`, `fflate` (zip), `shadcn`.

---

## 2. Estrutura de Diretórios

```
BranchCommerce/
├── app/                          # Next.js App Router (páginas, layouts, API routes)
│   ├── layout.tsx                # Root layout (Clerk, Theme, Convex providers)
│   ├── page.tsx                  # Home — redireciona admin → /dashboard
│   ├── globals.css               # Estilos globais Tailwind v4
│   ├── dashboard/page.tsx        # Dashboard principal
│   ├── unauthorized/page.tsx     # Página acesso negado
│   ├── sign-in/[[...sign-in]]/   # Clerk sign-in
│   ├── sign-up/[[...sign-up]]/   # Clerk sign-up
│   └── api/                      # API Routes
│       ├── ml/                   # Mercado Livre (OAuth, listings, orders, analysis, catalog)
│       ├── mp/                   # Mercado Pago (balance, transactions, future-releases)
│       └── branch-hunter/        # Extension sync (cost, download, reviews)
├── components/                   # Componentes React compartilhados
│   ├── finance/                  # financial-dashboard.tsx (~7.6k linhas)
│   ├── providers/                # ConvexClientProvider, ThemeProvider
│   ├── ui/                       # Primitivos shadcn (button, card, table, tabs, etc.)
│   └── theme-toggle.tsx          # Toggle dark/light
├── convex/                       # Backend Convex
│   ├── schema.ts                 # Definição de tabelas
│   ├── finance.ts                # Queries/mutations financeiras
│   ├── stock.ts                  # Queries/mutations de estoque
│   ├── mercadolivre.ts           # CRUD de conexões ML
│   ├── *.test.ts                 # Testes Convex
│   └── _generated/               # Código gerado pelo Convex
├── features/                     # Feature modules
│   └── product-analysis/         # Análise de produtos/catálogo
│       ├── application/          # Orquestração e lógica de negócio
│       ├── components/           # Componentes React da feature
│       ├── domain/               # Tipos TypeScript
│       ├── hooks/                # React hooks
│       ├── infra/                # API calls e scraping
│       └── utils/                # Utilitários (datas, moeda, normalização)
├── lib/                          # Utilitários compartilhados
│   ├── auth/                     # Clerk helpers, admin check
│   ├── crypto/                   # AES-256-GCM para tokens
│   ├── finance/                  # Cálculos financeiros
│   ├── mercadolivre/             # OAuth, config, storage, HTTP
│   ├── mercadopago/              # Balance, transactions, future releases
│   ├── rate-limit/               # Throttle para fetches ML
│   └── utils.ts                  # cn() — clsx + tailwind-merge
├── extensions/                   # Extensões Chrome
│   └── branch-hunter/            # Calculadora ML + scraping
│       ├── manifest.json         # Manifest V3
│       ├── src/                  # Background, bridge, content-script, storage, utils
│       └── popup/                # Popup da extensão
├── proxy.ts                      # Clerk middleware
├── vitest.config.ts              # Configuração Vitest
├── package.json                  # Dependências e scripts
├── tsconfig.json                 # TypeScript config
├── AGENTS.md / CLAUDE.md         # Regras para assistentes AI
└── .agents/skills/               # Skills Convex para AI tooling
```

---

## 3. Arquivos de Configuração

| Arquivo              | Descrição                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `package.json`       | Scripts: `dev`, `build`, `start`, `lint`, `test`, `test:watch`                                             |
| `tsconfig.json`      | Strict TS, bundler resolution, Next plugin, `@/*` paths                                                    |
| `next.config.ts`     | Config Next.js (placeholder mínimo)                                                                        |
| `vitest.config.ts`   | Dois projetos: `unit` (Node.js, lib + features) e `convex` (Edge Runtime)                                  |
| `eslint.config.mjs`  | Next Core Web Vitals + TypeScript presets                                                                  |
| `postcss.config.mjs` | Tailwind v4 PostCSS plugin                                                                                 |
| `proxy.ts`           | Clerk middleware — rotas públicas: `/sign-in`, `/sign-up`, `/api/ml/notifications`, `/api/branch-hunter/*` |

---

## 4. Backend — Convex

### Schema (`convex/schema.ts`)

#### Tabela `categories`

| Campo       | Tipo                    | Descrição             |
| ----------- | ----------------------- | --------------------- |
| `userId`    | `string`                | ID do usuário Clerk   |
| `name`      | `string`                | Nome da categoria     |
| `kind`      | `"income" \| "expense"` | Tipo                  |
| `createdAt` | `number`                | Timestamp criação     |
| `updatedAt` | `number`                | Timestamp atualização |

**Índices:** `by_user` → `["userId"]`

#### Tabela `transactions`

| Campo         | Tipo                                          | Descrição                   |
| ------------- | --------------------------------------------- | --------------------------- |
| `userId`      | `string`                                      | ID do usuário               |
| `kind`        | `"income" \| "expense"`                       | Tipo                        |
| `amount`      | `number`                                      | Valor                       |
| `date`        | `string`                                      | Data ISO                    |
| `description` | `string`                                      | Descrição                   |
| `categoryId`  | `Id<"categories">`                            | Referência à categoria      |
| `origin`      | `string?`                                     | Origem (ex: "Venda online") |
| `expenseType` | `"fixed" \| "variable"?`                      | Tipo de despesa             |
| `periodicity` | `"one_time" \| "weekly" \| "monthly" \| ...?` | Periodicidade               |
| `createdAt`   | `number`                                      | Timestamp                   |

**Índices:** `by_user`, `by_user_date`, `by_user_category`

#### Tabela `bills`

| Campo                     | Tipo                               | Descrição     |
| ------------------------- | ---------------------------------- | ------------- |
| `userId`                  | `string`                           | ID do usuário |
| `title`                   | `string`                           | Título        |
| `amount`                  | `number`                           | Valor         |
| `dueDate`                 | `string`                           | Vencimento    |
| `status`                  | `"paid" \| "pending" \| "overdue"` | Status        |
| `kind`                    | `"payable" \| "receivable"`        | Tipo          |
| `categoryId`              | `Id<"categories">`                 | Categoria     |
| `createdAt` / `updatedAt` | `number`                           | Timestamps    |

**Índices:** `by_user`, `by_user_due_date`

#### Tabela `stockProducts`

| Campo                     | Tipo                       | Descrição             |
| ------------------------- | -------------------------- | --------------------- |
| `userId`                  | `string`                   | ID do usuário         |
| `name`                    | `string`                   | Nome do produto       |
| `sku`                     | `string`                   | SKU único             |
| `mlItemId`                | `string?`                  | ID do anúncio ML      |
| `imageUrl`                | `string?`                  | URL da imagem         |
| `category`                | `string`                   | Categoria             |
| `quantity`                | `number`                   | Quantidade em estoque |
| `minStock`                | `number`                   | Estoque mínimo        |
| `unitCost`                | `number`                   | Custo unitário        |
| `unitCostSource`          | `"manual" \| "extension"?` | Origem do custo       |
| `sellingPrice`            | `number?`                  | Preço de venda        |
| `createdAt` / `updatedAt` | `number`                   | Timestamps            |

**Índices:** `by_user`, `by_user_sku`, `by_user_ml_item`, `by_ml_item`

#### Tabela `stockMovements`

| Campo       | Tipo                                      | Descrição            |
| ----------- | ----------------------------------------- | -------------------- |
| `userId`    | `string`                                  | ID do usuário        |
| `productId` | `Id<"stockProducts">`                     | Produto              |
| `type`      | `"in" \| "out" \| "adjustment" \| "sale"` | Tipo de movimentação |
| `quantity`  | `number`                                  | Quantidade           |
| `date`      | `string`                                  | Data                 |
| `unitPrice` | `number?`                                 | Preço unitário       |
| `note`      | `string?`                                 | Observação           |
| `createdAt` | `number`                                  | Timestamp            |

**Índices:** `by_user`, `by_user_product`

#### Tabela `mercadoLivreAccounts`

| Campo                     | Tipo      | Descrição                      |
| ------------------------- | --------- | ------------------------------ |
| `appUserId`               | `string`  | ID Clerk do usuário            |
| `mlUserId`                | `string`  | ID ML do vendedor              |
| `accessToken`             | `string`  | Token encriptado (AES-256-GCM) |
| `refreshToken`            | `string`  | Refresh token encriptado       |
| `tokenType`               | `string?` | Tipo do token                  |
| `scope`                   | `string?` | Escopo OAuth                   |
| `expiresIn`               | `number`  | Duração em segundos            |
| `expiresAt`               | `number`  | Timestamp de expiração         |
| `createdAt` / `updatedAt` | `number`  | Timestamps                     |

**Índices:** `by_app_user`, `by_ml_user`

---

### Funções — `convex/finance.ts`

| Função                 | Tipo     | Descrição                                                    |
| ---------------------- | -------- | ------------------------------------------------------------ |
| `getDashboardData`     | query    | Carrega categorias, transações filtradas e contas do usuário |
| `addCategory`          | mutation | Insere nova categoria (income/expense)                       |
| `updateCategory`       | mutation | Atualiza nome da categoria (verifica ownership)              |
| `addTransaction`       | mutation | Insere transação com validação de categoria                  |
| `updateTransaction`    | mutation | Atualiza transação (verifica ownership)                      |
| `deleteTransaction`    | mutation | Deleta transação (bloqueia se `origin === "Venda online"`)   |
| `addBill`              | mutation | Insere conta a pagar/receber                                 |
| `updateBillStatus`     | mutation | Atualiza status da conta                                     |
| `ensureEcommerceSetup` | mutation | Cria categorias padrão para e-commerce se não existirem      |

### Funções — `convex/stock.ts`

| Função                       | Tipo     | Descrição                                                                         |
| ---------------------------- | -------- | --------------------------------------------------------------------------------- |
| `getDashboardData`           | query    | Carrega produtos e movimentações do usuário                                       |
| `addProduct`                 | mutation | Cria produto com SKU único; se qty > 0, cria movimentação "in"                    |
| `updateProduct`              | mutation | Atualiza produto (verifica ownership, SKU único)                                  |
| `deleteProduct`              | mutation | Deleta produto e todas suas movimentações                                         |
| `addMovement`                | mutation | Registra movimentação; atualiza qty do produto; vendas criam transação de receita |
| `upsertCostFromBranchHunter` | mutation | Atualiza custo via extensão por `mlItemId` (ignora se fonte é "manual")           |
| `syncFromMercadoLivre`       | mutation | Importa/atualiza produtos a partir de listings ML                                 |

### Funções — `convex/mercadolivre.ts`

| Função                   | Tipo     | Descrição                                |
| ------------------------ | -------- | ---------------------------------------- |
| `getConnectionByAppUser` | query    | Busca conexão ML por `appUserId`         |
| `getConnectionByMlUser`  | query    | Busca conexão ML por `mlUserId`          |
| `getAnyConnection`       | query    | Retorna qualquer conexão (debug/admin)   |
| `upsertConnection`       | mutation | Cria ou atualiza conexão ML              |
| `updateTokens`           | mutation | Atualiza tokens de uma conexão existente |
| `disconnectConnection`   | mutation | Remove conexão ML                        |

---

## 5. Rotas da Aplicação (App Router)

| Rota            | Arquivo                               | Descrição                                                                                    |
| --------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/`             | `app/page.tsx`                        | Redireciona: admin → `/dashboard`, não-admin → `/unauthorized`, não-autenticado → `/sign-in` |
| `/dashboard`    | `app/dashboard/page.tsx`              | Dashboard principal com `FinancialDashboard` (admin only)                                    |
| `/unauthorized` | `app/unauthorized/page.tsx`           | Página de acesso negado com botão sign-out                                                   |
| `/sign-in`      | `app/sign-in/[[...sign-in]]/page.tsx` | Clerk sign-in                                                                                |
| `/sign-up`      | `app/sign-up/[[...sign-up]]/page.tsx` | Clerk sign-up                                                                                |

---

## 6. API Routes

### Mercado Livre (`/api/ml/`)

| Rota                        | Método       | Descrição                                                             |
| --------------------------- | ------------ | --------------------------------------------------------------------- |
| `/api/ml/connect`           | GET          | Inicia OAuth ML (PKCE); seta cookies; redireciona ao ML               |
| `/api/ml/callback`          | GET          | Callback OAuth; troca code por tokens; salva conexão no Convex        |
| `/api/ml/disconnect`        | POST         | Remove conexão ML do usuário                                          |
| `/api/ml/account`           | GET          | Status da conexão ML + perfil `/users/me`                             |
| `/api/ml/listings`          | GET          | Listings paginados do vendedor (ativos + pausados)                    |
| `/api/ml/listings/[id]`     | PATCH        | Atualiza anúncio (título, preço, quantidade, status)                  |
| `/api/ml/metrics`           | GET          | Métricas agregadas: contagem de listings, pedidos, ticket médio       |
| `/api/ml/orders`            | GET          | Pedidos com detalhes de envio, taxas, itens                           |
| `/api/ml/missed-feeds`      | GET          | Notificações perdidas do ML                                           |
| `/api/ml/notifications`     | POST/GET     | Webhook do ML (IP allowlist em prod)                                  |
| `/api/ml/analysis/[itemId]` | GET          | Análise completa de produto/catálogo (concorrentes, scoring, estoque) |
| `/api/ml/catalog/hub`       | GET/POST/PUT | Hub multi-ação: competition, products, suggestions, catalog listings  |

### Mercado Pago (`/api/mp/`)

| Rota                      | Método | Descrição                            |
| ------------------------- | ------ | ------------------------------------ |
| `/api/mp/balance`         | GET    | Saldo MP do vendedor                 |
| `/api/mp/transactions`    | GET    | Movimentações financeiras MP         |
| `/api/mp/future-releases` | GET    | Liberações futuras agrupadas por dia |

### Branch Hunter (`/api/branch-hunter/`)

| Rota                            | Método | Descrição                                                                  |
| ------------------------------- | ------ | -------------------------------------------------------------------------- |
| `/api/branch-hunter/cost`       | POST   | Sincroniza custo unitário da extensão → Convex (via `x-branch-hunter-key`) |
| `/api/branch-hunter/download`   | GET    | Download ZIP da extensão (admin only)                                      |
| `/api/branch-hunter/ml-reviews` | GET    | Avaliações do vendedor no ML (CORS para extensão)                          |

---

## 7. Componentes UI

### `components/finance/financial-dashboard.tsx`

Componente principal do dashboard (~7.6k linhas). Módulos internos:

| Módulo            | Seções                                                 |
| ----------------- | ------------------------------------------------------ |
| **Home**          | Visão geral, métricas rápidas                          |
| **Finanças**      | Overview, ABC, DRE, despesas, fluxo de caixa, previsão |
| **Estoque**       | Produtos, movimentações, sync ML                       |
| **Mercado Livre** | Listings, pedidos, métricas, conexão OAuth             |
| **Branch Hunter** | Análise de anúncios, modal de análise                  |

**Integrações:** Convex queries/mutations (finance + stock), REST APIs (ML + MP), `AnalysisModal`, `HunterAnalysisPage`.

### `components/ui/` (shadcn/Radix)

| Componente      | Descrição                                                        |
| --------------- | ---------------------------------------------------------------- |
| `button.tsx`    | Botão com variantes (default, outline, ghost, destructive, link) |
| `card.tsx`      | Card layout com header, title, description, content, footer      |
| `input.tsx`     | Input de texto estilizado                                        |
| `textarea.tsx`  | Textarea estilizado                                              |
| `table.tsx`     | Tabela com header, body, footer, row, head, cell                 |
| `tabs.tsx`      | Tabs (Radix) horizontal/vertical                                 |
| `select.tsx`    | Select (Radix) completo com scroll                               |
| `badge.tsx`     | Badge com variantes                                              |
| `separator.tsx` | Separador horizontal/vertical (Radix)                            |

### Providers

| Componente                   | Descrição                              |
| ---------------------------- | -------------------------------------- |
| `convex-client-provider.tsx` | `ConvexReactClient` + `ConvexProvider` |
| `theme-provider.tsx`         | Wrapper `next-themes`                  |
| `theme-toggle.tsx`           | Toggle dark/light (Sun/Moon icon)      |

---

## 8. Feature: Product Analysis

### `features/product-analysis/application/`

| Arquivo                    | Função                 | Descrição                                                                                                                                                                |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get-product-analysis.ts`  | `getProductAnalysis`   | Orquestrador principal: resolve ID como catálogo ou item, busca concorrentes, enriquece (sellers, visits, stock scraping, price-to-win), agrega e retorna `FullAnalysis` |
| `build-catalog-section.ts` | `buildCatalogSection`  | Constrói `CatalogSection` com status do catálogo, atributos, GTIN/marca/modelo, completeness score, visits, price-to-win                                                 |
| `aggregate-competitors.ts` | `aggregateCompetitors` | Estatísticas: min/max/avg/mediana de preço, contagens (loja oficial, frete grátis, fulfillment), ranking, top-5 mais baratos                                             |
| `scoring.ts`               | `computeCompleteness`  | Score 0–100 de qualidade do anúncio com checklist detalhado por campo                                                                                                    |

### `features/product-analysis/components/`

| Componente               | Descrição                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `HunterAnalysisPage.tsx` | Página completa: input MLB ID, buscas recentes, filtros (logística, cidade, tipo), merge com extensão, `CatalogOverview` + `CompetitorTable` |
| `AnalysisModal.tsx`      | Modal wrapper: fetch de análise por `itemId`, tabs (catálogo vs concorrentes)                                                                |
| `CatalogOverview.tsx`    | Tab catálogo: status badge, métricas, price-to-win, completeness checklist, identificadores                                                  |
| `CompetitorTable.tsx`    | Tabela de concorrentes: seller, delta de preço, estoque (scrapeado), badges logísticos, highlight do buy box winner                          |
| `CompetitorSummary.tsx`  | Cards de resumo (contagens, preços, posição, métricas de frete)                                                                              |
| `AnalysisLoading.tsx`    | Estado de carregamento                                                                                                                       |
| `AnalysisError.tsx`      | Estado de erro com retry                                                                                                                     |
| `AnalysisEmpty.tsx`      | Estado vazio                                                                                                                                 |

### `features/product-analysis/domain/types.ts`

**Tipos ML/API:** `MlAttribute`, `MlPicture`, `MlItemFull`, `CatalogCompetitor`, `CatalogProductItemsResponse`, `MlSeller`, `MlProduct`, `MlSearchResult`, `MlPriceToWinResult`, `MlVisitsEntry`

**Tipos da feature:** `CatalogStatus`, `Identifiers`, `CompletenessDetail`, `CatalogSection`, `CompetitorEntry`, `CompetitorSummary`, `DiscoveryStrategy`, `CompetitorSection`, `LogEntry`, `FullAnalysis`

### `features/product-analysis/hooks/`

| Hook                   | Descrição                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `useProductAnalysis`   | Fetch `GET /api/ml/analysis/:id` com fases: idle, loading, success, partial, error                                      |
| `useExtensionScraping` | Bridge PostMessage com extensão (`BH_SCRAPE_*`): detecta bridge, dispara scrape, retorna stock overlay + buy box winner |

### `features/product-analysis/infra/`

| Arquivo               | Funções                                                                                                                                   | Descrição                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ml-api.ts`           | `fetchMlPrivate`, `getItem`, `getProduct`, `getProductItems`, `getSellersBatch`, `getPriceToWin`, `getCompetitorVisits`, `getVisitsBatch` | Chamadas autenticadas à API ML com logging e tratamento de erros                                                                     |
| `scrape-item-page.ts` | `extractStock`, `extractStartTime`, `scrapeItemPage`, `scrapeCompetitorPages`                                                             | Fetch de HTML do ML, extração de estoque/data por regex; batch paralelo com timeout (4s/página, 6s global) usando mapa compartilhado |
| `logger.ts`           | `createAnalysisLogger`                                                                                                                    | Logger de steps com timing e entries para debug                                                                                      |

### `features/product-analysis/utils/`

| Arquivo        | Funções                                                                                                                                 | Descrição                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `dates.ts`     | `toIsoDate`, `dateRange`, `daysSince`, `formatDateBr`                                                                                   | Helpers de data ISO e formatação pt-BR                               |
| `money.ts`     | `formatBrl`                                                                                                                             | Formatação BRL                                                       |
| `normalize.ts` | `normalizeTitle`, `extractBrand`, `extractModel`, `extractGtin`, `extractVoltage`, `extractCapacity`, `extractColor`, `titleSimilarity` | Normalização de títulos, extração de atributos, similaridade Jaccard |

---

## 9. Lib — Módulos Compartilhados

### `lib/auth/`

| Arquivo     | Funções                                                | Descrição                                                   |
| ----------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| `server.ts` | `requireAuthenticatedAppUserId`, `getCurrentUserEmail` | Clerk: exige userId autenticado ou throw; lê email primário |
| `admin.ts`  | `isAdminEmail`                                         | Verifica se email está na allowlist de admin (normalizado)  |

### `lib/crypto/`

| Arquivo           | Funções                                       | Descrição                                                                                     |
| ----------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `token-cipher.ts` | `encryptToken`, `decryptToken`, `isEncrypted` | AES-256-GCM via `TOKEN_ENCRYPTION_KEY` + salt; heurística para detectar tokens já encriptados |

### `lib/finance/`

| Arquivo           | Funções                                                                                                                                                                                                        | Descrição                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`        | Tipos                                                                                                                                                                                                          | `CategoryKind`, `ExpenseType`, `TransactionPeriodicity`, `FinancialPeriod`, `BillStatus`, `BillKind`, `FinancialCategory`, `FinancialTransaction`, `FinancialBill`, `TransactionFilters`, `MonthlyEvolutionPoint` |
| `calculations.ts` | `formatCurrency`, `filterTransactions`, `summarizeTransactions`, `expensesByCategory`, `monthlyEvolution`, `cashFlowByPeriod`, `calculateCostBreakdown`, `calculateProductChampions`, `forecastFinancialTrend` | Formatação pt-BR; filtro/resumo de transações; evolução mensal; fluxo de caixa por dia/semana/mês; breakdown fixo/variável; top produtos; previsão de tendência                                                   |

### `lib/mercadolivre/`

| Arquivo                | Funções                                                                                                                                | Descrição                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `config.ts`            | `getMercadoLivreConfig`                                                                                                                | Lê env vars; retorna auth URL, API base, OAuth client                                                          |
| `http.ts`              | `jsonError`, `jsonOk`                                                                                                                  | Helpers `NextResponse.json` com shape padronizada                                                              |
| `oauth.ts`             | `generatePkce`, `buildMlAuthorizationUrl`, `exchangeCodeForTokens`, `refreshMlAccessToken`                                             | PKCE, URL de autorização, troca code→tokens, refresh                                                           |
| `server.ts`            | `requireMlConnection`                                                                                                                  | Compõe auth Clerk + conexão ML válida                                                                          |
| `storage.ts`           | `getMlConnectionByAppUser`, `upsertMlConnection`, `updateMlTokens`, `getValidMlConnection`, `fetchMlApi`, `requestMlApi`, `MlApiError` | Client HTTP Convex para conexões ML; encrypt/decrypt tokens at rest; refresh automático se expirando em <10min |
| `types.ts`             | `MlTokenResponse`, `MlUser`                                                                                                            | Tipos OAuth e user ML                                                                                          |
| `user-items-search.ts` | `searchUserItemsIncludingPaused`                                                                                                       | Merge de busca ativa + pausada para vendedores                                                                 |

### `lib/mercadopago/`

| Arquivo              | Funções                         | Descrição                                                               |
| -------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| `http.ts`            | `mpFetch`, `mpFetchRaw`         | GET autenticado à API MP                                                |
| `simple-balance.ts`  | `getBalance`, `getTransactions` | Saldo MP; classifica movimentações como credit/debit                    |
| `future-releases.ts` | `getFutureReleases`             | Busca pagamentos aprovados com data de liberação futura; agrupa por dia |

### `lib/rate-limit/`

| Arquivo          | Funções            | Descrição                                                                       |
| ---------------- | ------------------ | ------------------------------------------------------------------------------- |
| `ml-throttle.ts` | `throttledMlFetch` | Controle de concorrência global (max 15) + delay mínimo (25ms) entre fetches ML |

### `lib/utils.ts`

| Função | Descrição                                                    |
| ------ | ------------------------------------------------------------ |
| `cn()` | `clsx` + `tailwind-merge` para classes condicionais Tailwind |

---

## 10. Extensão Chrome — Branch Hunter

### Manifest V3 (`extensions/branch-hunter/manifest.json`)

- **Permissões:** `storage`
- **Host permissions:** `*.mercadolivre.com.br`, `*.mercadolivre.com`, `branchcommercehub.com`, `branch-commerce.vercel.app`, `localhost:3000`
- **Background:** service worker `src/background.js`
- **Content scripts:**
  1. **Domínios ML:** carrega `types.js`, `hybrid-calculator.js`, `ml-page-utils.js`, `marketplace-dynamic-data.js`, `storage.js`, `content-script.js`
  2. **Domínios da app:** carrega `bridge.js` (ponte PostMessage)

### Arquivos da Extensão

| Arquivo                                    | Descrição                                                                                                                                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/background.js`                        | Service worker: `fetchWithRetry` para scraping de páginas ML; extração de stock/sold/startTime; handler `SCRAPE_COMPETITORS` para batch scraping; salva `lastListing` em storage                                                                                          |
| `src/bridge.js`                            | Injeta nos domínios da app: escuta `BH_SCRAPE_REQUEST` via `postMessage`, encaminha ao background, responde com `BH_SCRAPE_RESPONSE`; anuncia `BH_BRIDGE_READY`                                                                                                           |
| `src/content-script.js`                    | Script principal nas páginas ML: Shadow DOM panel HTML/CSS; calculadora de payout inline; detecção de listing; wiring com hybrid-calculator; hydratation de settings; `MutationObserver` para SPA; sync de custo via POST ao app; enrichment de SERP (badges de catálogo) |
| `src/storage.js`                           | Persistência `chrome.storage.local`: settings globais (`branchHunter:settings`) e por listing (`branchHunter:listingState:*`); defaults de frete e sync                                                                                                                   |
| `src/ml-page-utils.js`                     | Parse de moeda BR; extração de listing ID do URL/DOM/scripts; título; preço; `findBestAnchor` para posicionamento do painel; detecção de SERP; `extractCardItemIds` para resultados de busca                                                                              |
| `src/services/marketplace-dynamic-data.js` | Lê dados da página + cache `chrome.storage`; merge API cache sobre page para preço, tipo de anúncio, taxas, frete, categoria, rating                                                                                                                                      |
| `src/domain/types.js`                      | JSDoc tipos: `createEmptyMarketplaceData`, `createDefaultOperationCosts`; documenta marketplace vs operation vs `CalculationResult`                                                                                                                                       |
| `src/domain/hybrid-calculator.js`          | Motor de cálculo: taxas, impostos/ads/risco %, resolução de frete (manual, subsídio ML, padrão), custos fixos "centralize" (envio R$5 + embalagem R$1.50), lucro líquido/margem/ROI                                                                                       |
| `popup/popup.html`                         | Popup da extensão: toggle auto-inject, taxa ML fallback %, BranchHub sync (enable, URL, key), custos padrão                                                                                                                                                               |
| `popup/popup.js`                           | Lê/salva `branchHunter:settings` em `chrome.storage.local`; handlers save/reset                                                                                                                                                                                           |
| `popup/popup.css`                          | Estilos do popup                                                                                                                                                                                                                                                          |

### Fluxo de Dados da Extensão

```
[Página ML] → content-script.js detecta anúncio
    ↓
Extrai: preço, tipo, ID → hybrid-calculator.js calcula payout
    ↓
Shadow DOM panel mostra: lucro, margem, custos
    ↓
POST /api/branch-hunter/cost (sync custo unitário → Convex)
    ↓
[Dashboard App] ← bridge.js ← BH_SCRAPE_REQUEST
    ↓
background.js scrapa páginas ML → stock/sold data
    ↓
bridge.js → BH_SCRAPE_RESPONSE → HunterAnalysisPage
```

---

## 11. Testes

### Configuração

**Vitest 4** com dois projetos no `vitest.config.ts`:

- **unit** — Node.js: `lib/**/*.test.ts`, `features/**/*.test.ts`
- **convex** — Edge Runtime: `convex/**/*.test.ts` (usando `convex-test`)

### Suíte de Testes (225 testes, 17 arquivos)

| Arquivo                                                               | Testes                                                        | Cobertura |
| --------------------------------------------------------------------- | ------------------------------------------------------------- | --------- |
| `convex/finance.test.ts`                                              | Queries/mutations financeiras, categorias, transações, contas |
| `convex/stock.test.ts`                                                | Produtos, movimentações, sync ML, upsert extension            |
| `convex/mercadolivre.test.ts`                                         | CRUD de conexões ML                                           |
| `lib/auth/admin.test.ts`                                              | `isAdminEmail`                                                |
| `lib/crypto/token-cipher.test.ts`                                     | Encrypt/decrypt AES-256-GCM                                   |
| `lib/finance/calculations.test.ts`                                    | Filtros, resumos, evolução mensal, fluxo de caixa, forecast   |
| `lib/mercadolivre/oauth.test.ts`                                      | PKCE, URLs OAuth, troca de tokens                             |
| `lib/mercadopago/simple-balance.test.ts`                              | Saldo, transações MP                                          |
| `lib/mercadopago/future-releases.test.ts`                             | Liberações futuras                                            |
| `lib/rate-limit/ml-throttle.test.ts`                                  | Concorrência (max 15), delay mínimo                           |
| `features/product-analysis/application/scoring.test.ts`               | Completeness score                                            |
| `features/product-analysis/application/aggregate-competitors.test.ts` | Agregação de concorrentes                                     |
| `features/product-analysis/application/build-catalog-section.test.ts` | Seção catálogo                                                |
| `features/product-analysis/infra/scrape-item-page.test.ts`            | Stock extraction, startTime, catalog sold parsing             |
| `features/product-analysis/utils/dates.test.ts`                       | Helpers de data                                               |
| `features/product-analysis/utils/money.test.ts`                       | Formatação BRL                                                |
| `features/product-analysis/utils/normalize.test.ts`                   | Normalização de títulos, extração de atributos                |

---

## Resumo Executivo

**BranchCommerce** é uma plataforma completa para vendedores brasileiros do Mercado Livre que oferece:

1. **Controle financeiro** — Categorias, transações (receita/despesa), contas a pagar/receber, DRE, fluxo de caixa, análise ABC, previsão de tendências
2. **Gestão de estoque** — Produtos com SKU, movimentações (entrada/saída/venda/ajuste), sync automático com ML, custo unitário via extensão
3. **Integração Mercado Livre** — OAuth PKCE, listings, pedidos, métricas, webhooks de notificação
4. **Integração Mercado Pago** — Saldo, transações, liberações futuras
5. **Análise de concorrentes** — Scraping de estoque, price-to-win, completeness score, ranking, identificação do buy box winner
6. **Extensão Chrome** — Calculadora de payout inline em páginas ML, sync de custos, badges de catálogo na busca, scraping client-side para análise
7. **Suite de testes** — 225 testes cobrindo backend, lógica de negócio, APIs e utilitários
