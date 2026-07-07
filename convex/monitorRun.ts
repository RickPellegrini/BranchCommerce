import { v } from "convex/values"

import { internal } from "./_generated/api"
import { action, internalAction } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"

import { fetchVtexProductState } from "./vtexFetch"
import type { Doc, Id } from "./_generated/dataModel"

type ListWithStateRow = {
  product: Doc<"products">
  state: Doc<"productState"> | null
}

type MonitorTickResult = {
  checked: number
  failed: number
}

const CONC = 5

/**
 * Polling: lista produtos activos, consulta VTEX em lotes, aplica regras em mutação.
 * Partilhado pelo cron e por `runMonitorNow` (teste manual).
 */
export async function executeMonitorTickCore(
  ctx: ActionCtx,
  products?: Doc<"products">[],
): Promise<MonitorTickResult> {
  const prods: Doc<"products">[] =
    products ?? (await ctx.runQuery(internal.products.listarTodosAtivos, {}))
  let checked = 0
  let failed = 0
  for (let i = 0; i < prods.length; i += CONC) {
    const batch = prods.slice(i, i + CONC)
    const results = await Promise.all(
      batch.map(async (p: Doc<"products">) => {
        try {
          const vtex = await fetchVtexProductState(p.sku)
          if (!vtex) {
            failed += 1
            return
          }
          await ctx.runMutation(internal.monitor.applyProductTick, {
            productId: p._id as Id<"products">,
            vtex: {
              sku: vtex.sku,
              disponivel: vtex.disponivel,
              preco: vtex.preco,
              precoOriginal: vtex.precoOriginal,
              nomeProduto: vtex.nomeProduto,
              imagemUrl: vtex.imagemUrl,
              link: vtex.link,
            },
          })
          checked += 1
        } catch (error) {
          failed += 1
          console.error(`[monitorRun] Falha ao processar SKU ${p.sku}:`, error)
        }
      }),
    )
    void results
  }
  return { checked, failed }
}

/**
 * Polling: lista produtos activos, consulta VTEX em lotes, aplica regras em mutação.
 */
export const runTick = internalAction({
  args: {},
  handler: async (ctx) => {
    await executeMonitorTickCore(ctx)
    return null
  },
})

/**
 * Teste: mesmo trabalho do cron, em pedido. Exige `userId` e pelo menos um produto activo.
 */
export const runMonitorNow = action({
  args: { userId: v.string() },
  handler: async (
    ctx,
    { userId },
  ): Promise<{ ok: true; produtos: number; checked: number; failed: number }> => {
    if (!userId.trim()) {
      throw new Error("Sessao invalida.")
    }
    const rows: ListWithStateRow[] = await ctx.runQuery(internal.products.listWithStateInternal, {
      userId,
    })
    if (rows.length === 0) {
      throw new Error("Adicione ao menos um SKU activo no BranchNotify antes de testar.")
    }
    const ativos: ListWithStateRow[] = rows.filter((r: ListWithStateRow) => r.product.ativo)
    if (ativos.length === 0) {
      throw new Error("Ligue o monitor (Activo) em ao menos um produto.")
    }
    const result = await executeMonitorTickCore(
      ctx,
      ativos.map((row: ListWithStateRow) => row.product),
    )
    return { ok: true, produtos: ativos.length, checked: result.checked, failed: result.failed }
  },
})
