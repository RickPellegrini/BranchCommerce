# 07 — Monitor + Cron de Detecção

## Objetivo

Função que roda a cada 30s, verifica todos os SKUs ativos, detecta restock, persiste estado e dispara notificação.

## Fluxo do cron

```
Cron dispara
    ↓
Pega todos os products ativos
    ↓
Para cada SKU (em paralelo, com limite de concorrência):
    ├─ chama vtex.consultarSku(sku)
    ├─ lê estado anterior do productState
    ├─ se mudou disponivel: false → true:
    │     ├─ valida preço máximo
    │     ├─ pega userSettings (chatId, pixChave, etc)
    │     ├─ gera Pix
    │     ├─ chama telegram.enviarRestockAlert
    │     └─ insere em notifications (sucesso ou erro)
    └─ atualiza productState
    ↓
Termina (próxima execução em 30s)
```

## Arquivo: `convex/monitor.ts`

```ts
"use node"

import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { gerarPix } from "./pix"

const DESCONTO_PIX = 0.05  // Eletro Club dá 5% off no Pix
const CONCORRENCIA = 5     // máx 5 requests VTEX simultâneos

export const verificarTodosOsProdutos = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checados: number; restocks: number }> => {
    // Pega todos os produtos ativos (independente de usuário)
    const produtos = await ctx.runQuery(internal.products.listarTodosAtivos)

    let checados = 0
    let restocks = 0

    // Processa em batches para não estourar rate limit
    for (let i = 0; i < produtos.length; i += CONCORRENCIA) {
      const batch = produtos.slice(i, i + CONCORRENCIA)
      const results = await Promise.all(
        batch.map((p) => verificarUmProduto(ctx, p))
      )
      checados += results.length
      restocks += results.filter((r) => r === "restock").length
    }

    console.log(`[Monitor] checados=${checados} restocks=${restocks}`)
    return { checados, restocks }
  },
})

async function verificarUmProduto(ctx: any, produto: any): Promise<"restock" | "sem_mudanca" | "erro"> {
  // 1. Consulta VTEX
  const dados = await ctx.runAction(internal.vtex.consultarSku, { sku: produto.sku })
  if (!dados) return "erro"

  // 2. Lê estado anterior
  const anterior = await ctx.runQuery(internal.products.getEstado, { sku: produto.sku })
  const eraDisponivel = anterior?.disponivel ?? true  // primeiro check assume true (evita falso positivo no boot)

  // 3. Atualiza estado
  await ctx.runMutation(internal.products.upsertEstado, {
    sku: produto.sku,
    disponivel: dados.disponivel,
    preco: dados.preco,
    precoOriginal: dados.precoOriginal,
    imagemUrl: dados.imagemUrl ?? undefined,
    link: dados.link,
    nomeProduto: dados.nomeProduto,
    ultimaChecagem: Date.now(),
  })

  // 4. Detecta restock
  const houveRestock = dados.disponivel && !eraDisponivel
  if (!houveRestock) return "sem_mudanca"

  // 5. Valida preço máximo
  if (produto.precoMaximo && dados.preco > produto.precoMaximo) {
    console.log(`[Monitor] ${produto.sku}: preço R$${dados.preco} > máx R$${produto.precoMaximo}, ignorando`)
    return "sem_mudanca"
  }

  // 6. Pega settings do dono do produto
  const settings = await ctx.runQuery(internal.settings.getByUserId, { userId: produto.userId })
  if (!settings?.telegramChatId || !settings?.pixChave) {
    console.warn(`[Monitor] usuário ${produto.userId} sem settings completas`)
    return "erro"
  }

  // 7. Gera Pix com desconto
  const total = dados.preco * produto.quantidade
  const precoPix = Number((total * (1 - DESCONTO_PIX)).toFixed(2))
  const pixCode = gerarPix({
    chave: settings.pixChave,
    nome: settings.pixNome ?? "Comprador",
    cidade: settings.pixCidade ?? "Sao Paulo",
    valor: precoPix,
    txid: `EC${produto.sku}`.slice(0, 25),
  })

  // 8. Dispara Telegram
  const result = await ctx.runAction(internal.telegram.enviarRestockAlert, {
    chatId: settings.telegramChatId,
    nome: produto.nome,
    sku: produto.sku,
    preco: dados.preco,
    quantidade: produto.quantidade,
    precoPix,
    pixCode,
    imagemUrl: dados.imagemUrl ?? undefined,
    link: dados.link,
  })

  // 9. Loga notificação
  await ctx.runMutation(internal.notifications.criar, {
    userId: produto.userId,
    productId: produto._id,
    sku: produto.sku,
    nome: produto.nome,
    preco: dados.preco,
    precoPix,
    pixCode,
    enviadoEm: Date.now(),
    sucesso: result.sucesso,
    erro: result.erro,
  })

  return "restock"
}
```

## Arquivo: `convex/crons.ts`

```ts
import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
  "monitor de restock",
  { seconds: 30 },
  internal.monitor.verificarTodosOsProdutos
)

export default crons
```

## Detalhes críticos

### 1. Por que `eraDisponivel = true` no primeiro check

Se o estado estiver vazio (primeira execução do bot pra esse SKU), assumir que **estava disponível** evita disparar alerta no boot caso o produto esteja realmente em estoque. Falso positivo só vira problema quando o usuário cadastra um SKU que está em restock no momento exato — caso muito raro.

### 2. Concorrência limitada

`CONCORRENCIA = 5` para não bater 100 SKUs simultâneos na VTEX e tomar 429.

### 3. Idempotência

A tabela `notifications` registra o evento. Se quiser deduplicar, dá pra checar antes de enviar:
```ts
const ultima = await ctx.db.query("notifications")
  .withIndex("by_user_recent", q => q.eq("userId", uid))
  .filter(q => q.eq(q.field("sku"), sku))
  .order("desc").first()
if (ultima && Date.now() - ultima.enviadoEm < 5 * 60 * 1000) return // já notifiquei nos últimos 5min
```

### 4. Custos no Convex Free Tier

- Free tier: **1M function calls/mês**
- 30s × 1 SKU = 86.400 calls/mês por SKU
- Limite prático: ~10 SKUs simultâneos no plano free
- Se passar disso: subir intervalo para 60s ou Convex Pro ($25/mês)

## Critério de aceite

- [ ] Cron registrado e visível no dashboard Convex
- [ ] Logs aparecem a cada 30s
- [ ] Restock simulado (mock VTEX returning `IsAvailable: true` após `false`) dispara notificação
- [ ] Preço máximo respeitado
- [ ] Settings ausentes não derrubam o cron
- [ ] Tabela `notifications` populada após cada alerta
