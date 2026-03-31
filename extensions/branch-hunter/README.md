# Branch Hunter (Browser Extension)

Extensao de navegador para calculo rapido de payout em anuncios do Mercado Livre.

## Funcionalidades iniciais

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
- Captura automatica de preco em paginas de anuncio do Mercado Livre (quando detectavel)
- Persistencia local dos ultimos valores preenchidos

## Estrutura

- `manifest.json`: configuracao Manifest V3
- `src/content-script.js`: leitura de dados do anuncio aberto
- `src/background.js`: recebe e salva ultimo anuncio detectado
- `popup/popup.html`: interface da extensao
- `popup/popup.css`: estilos do popup
- `popup/popup.js`: logica da calculadora

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
