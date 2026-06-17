import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import { upsertProductState } from "./branchNotifyDb"
import { isAboveMaxPrice, isRestockMoment, precoPixFromLine } from "./monitorLogic"
import { gerarPix } from "./pix"
import type { VtexProductState } from "./vtex"

const vtexStateValidator = v.object({
  sku: v.string(),
  disponivel: v.boolean(),
  preco: v.number(),
  precoOriginal: v.number(),
  nomeProduto: v.string(),
  imagemUrl: v.union(v.string(), v.null()),
  link: v.string(),
})

function toVtex(agora: {
  sku: string
  disponivel: boolean
  preco: number
  precoOriginal: number
  nomeProduto: string
  imagemUrl: string | null
  link: string
}): VtexProductState {
  return {
    sku: agora.sku,
    disponivel: agora.disponivel,
    preco: agora.preco,
    precoOriginal: agora.precoOriginal,
    nomeProduto: agora.nomeProduto,
    imagemUrl: agora.imagemUrl,
    link: agora.link,
  }
}

/**
 * Aplica o resultado de uma leitura VTEX: actualiza `productState` e, no restock, notificação + Telegram agendado.
 */
export const applyProductTick = internalMutation({
  args: {
    productId: v.id("products"),
    vtex: vtexStateValidator,
  },
  handler: async (ctx, { productId, vtex: raw }) => {
    const agora = toVtex(raw)
    const now = Date.now()
    const product = await ctx.db.get(productId)
    if (!product || !product.ativo) {
      return { ok: false as const, reason: "inactive" }
    }

    const prev = await ctx.db
      .query("productState")
      .withIndex("by_user_sku", (q) => q.eq("userId", product.userId).eq("sku", product.sku))
      .first()
    const estavaDisponivel = prev?.disponivel ?? true
    const restock = isRestockMoment(estavaDisponivel, agora)
    const aboveMax = isAboveMaxPrice(agora, product.precoMaximo)

    await upsertProductState(ctx, {
      userId: product.userId,
      sku: product.sku,
      disponivel: agora.disponivel,
      preco: agora.preco,
      precoOriginal: agora.precoOriginal,
      imagemUrl: agora.imagemUrl ?? undefined,
      link: agora.link || undefined,
      nomeProduto: agora.nomeProduto,
      ultimaChecagem: now,
    })

    if (!restock) {
      return { ok: true as const, notified: false as const }
    }

    const settings = await ctx.db
      .query("notifySettings")
      .withIndex("by_user", (q) => q.eq("userId", product.userId))
      .first()

    const precoUnit = agora.preco
    const precoPixBrl = precoPixFromLine(precoUnit, product.quantidade)
    let pixCode = ""
    if (
      !aboveMax &&
      settings?.pixChave &&
      settings.pixNome &&
      settings.pixCidade &&
      precoPixBrl > 0
    ) {
      try {
        pixCode = gerarPix({
          chave: settings.pixChave,
          nome: settings.pixNome,
          cidade: settings.pixCidade,
          valor: precoPixBrl,
        })
      } catch (e) {
        console.error("[branchnotify] gerarPix failed:", e)
      }
    }

    const notifErr = aboveMax
      ? "Preco acima do maximo: Pix nao emitido"
      : !pixCode
        ? "Dados do Pix incompletos ou valor zero"
        : undefined

    await ctx.db.insert("notifications", {
      userId: product.userId,
      productId: product._id,
      sku: product.sku,
      nome: product.nome,
      preco: precoUnit,
      precoPix: precoPixBrl,
      pixCode,
      enviadoEm: now,
      sucesso: true,
      erro: notifErr,
    })

    if (settings?.telegramEnabled && settings.telegramChatId) {
      const totalLinha = precoUnit * product.quantidade
      const line = totalLinha.toFixed(2)
      const lines = [
        `BranchNotify — ${product.nome}`,
        `SKU ${product.sku} voltou ao estoque (Eletro Club).`,
        `Preco unit. R$ ${precoUnit.toFixed(2)} | qtd. ${product.quantidade} (linha ~ R$ ${line})`,
        `Total Pix (5%): R$ ${precoPixBrl.toFixed(2)}`,
        aboveMax
          ? "Aviso: preco acima do maximo — Pix nao gerado."
          : pixCode
            ? `Pix: ${pixCode}`
            : "Pix nao gerado (complete dados em Definicoes).",
      ]
      const text = lines.join("\n")
      await ctx.scheduler.runAfter(0, internal.telegram.sendMessage, {
        chatId: settings.telegramChatId,
        text,
      })
    }

    return { ok: true as const, notified: true as const, restock: true as const }
  },
})
