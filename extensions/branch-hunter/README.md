# Branch Hunter (Browser Extension)

Extensao de navegador para calculo rapido de payout em anuncios do Mercado Livre.
Agora a experiencia principal acontece diretamente dentro da pagina do anuncio, com arquitetura
hibrida para separar dados dinamicos do marketplace e custos configuraveis do vendedor.

## Funcionalidades

- Calculadora de:
  - preco de venda
  - custo do produto
  - frete
  - taxa Mercado Livre (%)
  - impostos (%)
  - outros custos fixos
- Resultado com:
  - valor taxa ML
  - valor impostos
  - payout antes do custo do produto
  - lucro liquido
  - margem liquida
- Injeção automatica de painel no anuncio (sem depender do popup)
- Captura automatica de preco em paginas de anuncio do Mercado Livre (com fallback)
- Shadow DOM para isolamento de estilos
- Observacao de mudancas no DOM para manter painel ativo em renderizacao assincrona
- Persistencia local dos valores por anuncio
- Popup secundario para configuracoes padrao
- Calculo hibrido com separacao explicita:
  - `marketplace` (dados dinamicos ML/page/manual fallback)
  - `operation` (custos internos do vendedor)
- Prioridade explicita de frete:
  - `shippingRealCost` -> `shippingEstimatedCost` -> `shippingFallback`

## Estrutura

- `manifest.json`: configuracao Manifest V3
- `src/domain/types.js`: tipagens JSDoc do dominio de calculo
- `src/domain/hybrid-calculator.js`: motor de calculo hibrido
- `src/ml-page-utils.js`: utilitarios de deteccao de pagina, preco e ancora
- `src/services/marketplace-dynamic-data.js`: camada de dados dinamicos ML/page
- `src/storage.js`: persistencia local (settings e inputs por anuncio)
- `src/content-script.js`: injecao do painel, renderizacao, eventos e observadores
- `src/background.js`: recebe e salva ultimo anuncio detectado (telemetria simples)
- `popup/popup.html`: interface da extensao
- `popup/popup.css`: estilos do popup
- `popup/popup.js`: configuracoes (nao e fluxo principal)

## Modelo de dados

- `MarketplaceDynamicData`:
  - preco, tipo de anuncio, taxa ML, categoria, shipping estimado/real e origem de cada campo
- `SellerOperationCosts`:
  - custo produto, impostos, ads, embalagem, custos fixos, risco, frete fallback
- `CalculationResult`:
  - receita, custos detalhados, lucro, margem e `shippingCostSource` (`real|estimated|fallback`)

## Onde conectar API real do ML depois

- Arquivo: `src/services/marketplace-dynamic-data.js`
- Funcao: `loadApiDynamicCache` / `getMarketplaceDynamicData`
- Hoje:
  - usa leitura da pagina + cache local opcional para dados de API
- Evolucao recomendada:
  - preencher `branchHunter:mlDynamicCache:<listingId>` a partir da sua plataforma (backend)
  - alimentar `saleFeePercent`, `saleFeeAmount`, `shippingEstimatedCost`, `shippingRealCost`,
    `categoryId`, `categoryName`, `shippingMode` com dados reais da API

## Como carregar no Chrome/Edge

1. Abra `chrome://extensions` (ou `edge://extensions`)
2. Ative `Modo do desenvolvedor`
3. Clique em `Carregar sem compactacao`
4. Selecione a pasta:
   - `extensions/branch-hunter`

## Proximos passos sugeridos

- Presets de taxas por tipo de anuncio (Classico/Premium/Fulfillment)
- Importar automaticamente frete e reputacao quando disponivel na pagina
- Exportar simulacoes (CSV)
- Sincronizar simulacoes com backend do BranchCommerce
