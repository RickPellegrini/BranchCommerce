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

const CONC = 5

/**
 * Polling: lista produtos activos, consulta VTEX em lotes, aplica regras em mutação.
 * Partilhado pelo cron e por `runMonitorNow` (teste manual).
 */
export async function executeMonitorTickCore(ctx: ActionCtx) {
  const prods: Doc<"products">[] = await ctx.runQuery(internal.products.listarTodosAtivos, {})
  for (let i = 0; i < prods.length; i += CONC) {
    const batch = prods.slice(i, i + CONC)
    await Promise.all(
      batch.map(async (p: Doc<"products">) => {
        const vtex = await fetchVtexProductState(p.sku)
        if (!vtex) {
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
      }),
    )
  }
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
  handler: async (ctx, { userId }): Promise<{ ok: true; produtos: number }> => {
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
    await executeMonitorTickCore(ctx)
    return { ok: true, produtos: ativos.length }
  },
})
