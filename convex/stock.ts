import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx } from "./_generated/server"

import { manualStockDedupeKey, normalizeMlItemIdForStock } from "./dedupeHelpers"

const kanbanStatusValidator = v.union(
  v.literal("purchased"),
  v.literal("planned"),
  v.literal("buying"),
  v.literal("in_transit"),
  v.literal("awaiting_inspection"),
  v.literal("returned"),
  v.literal("completed"),
  v.literal("in_stock"),
  v.literal("fulfillment"),
)

export const getDashboardData = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("stockProducts")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect()

    const movements = await ctx.db
      .query("stockMovements")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect()

    const kanbanEvents = await ctx.db
      .query("productKanbanEvents")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect()

    const kanbanCards = await ctx.db
      .query("stockKanbanCards")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect()

    return { products, movements, kanbanEvents, kanbanCards }
  },
})

export const addProduct = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    sku: v.optional(v.string()),
    category: v.string(),
    quantity: v.number(),
    minStock: v.number(),
    unitCost: v.number(),
    sellingPrice: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    mlItemId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedMl = normalizeMlItemIdForStock(args.mlItemId)
    const normalizedName = args.name.trim()
    const normalizedCategory = args.category.trim()

    if (!normalizedMl || !normalizedName || !normalizedCategory) {
      throw new Error("Preencha nome, MLB ID e categoria do produto.")
    }
    if (args.quantity < 0 || args.minStock < 0 || args.unitCost < 0) {
      throw new Error("Quantidade, estoque minimo e custo devem ser maiores ou iguais a zero.")
    }

    const duplicate = await ctx.db
      .query("stockProducts")
      .withIndex("by_user_ml_item", (q) => q.eq("userId", args.userId).eq("mlItemId", normalizedMl))
      .first()
    if (duplicate) {
      throw new Error("MLB ID ja cadastrado em outro produto.")
    }

    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)

    const productId = await ctx.db.insert("stockProducts", {
      userId: args.userId,
      name: normalizedName,
      sku: normalizedMl,
      category: normalizedCategory,
      quantity: args.quantity,
      minStock: args.minStock,
      unitCost: args.unitCost,
      unitCostSource: "manual",
      stockSource: "manual",
      sellingPrice: args.sellingPrice,
      ...(args.imageUrl?.trim() && { imageUrl: args.imageUrl.trim() }),
      mlItemId: normalizedMl,
      kanbanStatus: args.quantity > 0 ? "in_stock" : "purchased",
      createdAt: now,
      updatedAt: now,
    })

    if (args.quantity > 0) {
      await ctx.db.insert("stockMovements", {
        userId: args.userId,
        productId,
        type: "in",
        quantity: args.quantity,
        date: today,
        note: "Cadastro manual",
        createdAt: now,
      })
    }

    return productId
  },
})

async function logKanbanTransition(
  ctx: MutationCtx,
  args: {
    userId: string
    productId: Id<"stockProducts">
    fromStatus: string
    toStatus: string
    note?: string
  },
) {
  // Histórico do Kanban é observabilidade: não pode bloquear o fluxo principal.
  try {
    await ctx.db.insert("productKanbanEvents", {
      userId: args.userId,
      productId: args.productId,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      note: args.note,
      createdAt: Date.now(),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(
      `[stock.logKanbanTransition] failed user=${args.userId} product=${args.productId} ${args.fromStatus}->${args.toStatus}: ${reason}`,
    )
  }
}

async function upsertKanbanCardForStatus(
  ctx: MutationCtx,
  args: {
    userId: string
    productId: Id<"stockProducts">
    kanbanStatus:
      | "purchased"
      | "planned"
      | "buying"
      | "in_transit"
      | "awaiting_inspection"
      | "returned"
      | "completed"
      | "in_stock"
      | "fulfillment"
    quantity: number
    note?: string
  },
) {
  const existing = await ctx.db
    .query("stockKanbanCards")
    .withIndex("by_user_product_status", (q) =>
      q
        .eq("userId", args.userId)
        .eq("productId", args.productId)
        .eq("kanbanStatus", args.kanbanStatus),
    )
    .first()
  const now = Date.now()
  if (existing) {
    await ctx.db.patch(existing._id, {
      quantity: args.quantity,
      ...(args.note !== undefined && { note: args.note }),
      updatedAt: now,
    })
    return existing._id
  }
  return await ctx.db.insert("stockKanbanCards", {
    userId: args.userId,
    productId: args.productId,
    kanbanStatus: args.kanbanStatus,
    quantity: args.quantity,
    note: args.note,
    createdAt: now,
    updatedAt: now,
  })
}

export const updateProduct = mutation({
  args: {
    userId: v.string(),
    productId: v.id("stockProducts"),
    name: v.string(),
    sku: v.optional(v.string()),
    category: v.string(),
    quantity: v.number(),
    minStock: v.number(),
    unitCost: v.number(),
    sellingPrice: v.optional(v.number()),
    kanbanStatus: v.optional(kanbanStatusValidator),
    kanbanNote: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
    mlItemId: v.optional(v.string()),
    mlItemAliases: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId)
    if (!product || product.userId !== args.userId) {
      throw new Error("Produto nao encontrado.")
    }

    const normalizedName = args.name.trim()
    const normalizedCategory = args.category.trim()

    if (!normalizedName || !normalizedCategory) {
      throw new Error("Preencha nome e categoria do produto.")
    }
    if (args.quantity < 0 || args.minStock < 0 || args.unitCost < 0) {
      throw new Error("Quantidade, estoque minimo e custo devem ser maiores ou iguais a zero.")
    }

    const prevKanban = product.kanbanStatus ?? "purchased"
    if (args.kanbanStatus !== undefined && args.kanbanStatus !== prevKanban) {
      await logKanbanTransition(ctx, {
        userId: args.userId,
        productId: args.productId,
        fromStatus: prevKanban,
        toStatus: args.kanbanStatus,
        note: args.kanbanNote,
      })
    }

    let mlSuffix: { mlItemId: string; sku: string } | Record<string, never> = {}
    if (args.mlItemId !== undefined && args.mlItemId.trim()) {
      const nid = normalizeMlItemIdForStock(args.mlItemId)
      mlSuffix = { mlItemId: nid, sku: nid }
    }

    let aliasesPatch: { mlItemAliases: string[] } | Record<string, never> = {}
    if (args.mlItemAliases !== undefined) {
      const normalized = [...new Set(args.mlItemAliases.map(normalizeMlItemIdForStock))]
      const primaryId = mlSuffix.mlItemId ?? product.mlItemId
      const clean = normalized.filter((a) => a !== primaryId)

      const allProducts = await ctx.db
        .query("stockProducts")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect()
      for (const alias of clean) {
        for (const other of allProducts) {
          if (other._id === args.productId) continue
          if (other.mlItemId === alias) {
            throw new Error(
              `O alias ${alias} ja esta vinculado como ID principal de outro produto.`,
            )
          }
          if ((other.mlItemAliases ?? []).includes(alias)) {
            throw new Error(`O alias ${alias} ja esta como alias de outro produto.`)
          }
        }
      }
      aliasesPatch = { mlItemAliases: clean }
    }

    await ctx.db.patch(args.productId, {
      name: normalizedName,
      category: normalizedCategory,
      quantity: args.quantity,
      minStock: args.minStock,
      unitCost: args.unitCost,
      unitCostSource: "manual",
      sellingPrice: args.sellingPrice,
      ...(args.kanbanStatus !== undefined && { kanbanStatus: args.kanbanStatus }),
      ...(args.kanbanNote !== undefined && { kanbanNote: args.kanbanNote }),
      ...(args.estimatedArrival !== undefined && { estimatedArrival: args.estimatedArrival }),
      ...mlSuffix,
      ...aliasesPatch,
      updatedAt: Date.now(),
    })
  },
})

export const addKanbanCard = mutation({
  args: {
    userId: v.string(),
    productId: v.id("stockProducts"),
    kanbanStatus: kanbanStatusValidator,
    quantity: v.number(),
    note: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId)
    if (!product || product.userId !== args.userId) {
      throw new Error("Produto nao encontrado.")
    }
    if (args.quantity < 0) {
      throw new Error("Quantidade deve ser zero ou positiva.")
    }

    const now = Date.now()
    const cardId = await ctx.db.insert("stockKanbanCards", {
      userId: args.userId,
      productId: args.productId,
      kanbanStatus: args.kanbanStatus,
      quantity: args.quantity,
      note: args.note?.trim() || undefined,
      estimatedArrival: args.estimatedArrival,
      createdAt: now,
      updatedAt: now,
    })

    await logKanbanTransition(ctx, {
      userId: args.userId,
      productId: args.productId,
      fromStatus: "novo-card",
      toStatus: args.kanbanStatus,
      note: args.note,
    })

    return cardId
  },
})

export const updateKanbanCard = mutation({
  args: {
    userId: v.string(),
    kanbanCardId: v.id("stockKanbanCards"),
    kanbanStatus: v.optional(kanbanStatusValidator),
    quantity: v.optional(v.number()),
    note: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.kanbanCardId)
    if (!card || card.userId !== args.userId) {
      throw new Error("Card do Kanban nao encontrado.")
    }
    if (args.quantity !== undefined && args.quantity < 0) {
      throw new Error("Quantidade deve ser zero ou positiva.")
    }

    const nextStatus = args.kanbanStatus ?? card.kanbanStatus
    if (args.kanbanStatus !== undefined && args.kanbanStatus !== card.kanbanStatus) {
      await logKanbanTransition(ctx, {
        userId: args.userId,
        productId: card.productId,
        fromStatus: card.kanbanStatus,
        toStatus: args.kanbanStatus,
        note: args.note,
      })
    }

    await ctx.db.patch(args.kanbanCardId, {
      kanbanStatus: nextStatus,
      ...(args.quantity !== undefined && { quantity: args.quantity }),
      ...(args.note !== undefined && { note: args.note.trim() || undefined }),
      ...(args.estimatedArrival !== undefined && { estimatedArrival: args.estimatedArrival }),
      updatedAt: Date.now(),
    })
  },
})

export const deleteKanbanCard = mutation({
  args: {
    userId: v.string(),
    kanbanCardId: v.id("stockKanbanCards"),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.kanbanCardId)
    if (!card || card.userId !== args.userId) {
      throw new Error("Card do Kanban nao encontrado.")
    }
    await ctx.db.delete(args.kanbanCardId)
  },
})

export const updateProductKanban = mutation({
  args: {
    userId: v.string(),
    productId: v.id("stockProducts"),
    kanbanStatus: kanbanStatusValidator,
    kanbanNote: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId)
    if (!product || product.userId !== args.userId) {
      throw new Error("Produto nao encontrado.")
    }

    const prev = product.kanbanStatus ?? "purchased"
    if (prev !== args.kanbanStatus) {
      await logKanbanTransition(ctx, {
        userId: args.userId,
        productId: args.productId,
        fromStatus: prev,
        toStatus: args.kanbanStatus,
        note: args.kanbanNote,
      })
    }

    await ctx.db.patch(args.productId, {
      kanbanStatus: args.kanbanStatus,
      updatedAt: Date.now(),
      ...(args.kanbanNote !== undefined && { kanbanNote: args.kanbanNote }),
      ...(args.estimatedArrival !== undefined && { estimatedArrival: args.estimatedArrival }),
    })
  },
})

const kanbanMoveTargetValidator = v.union(v.literal("em_falta"), kanbanStatusValidator)

function stockSourceForProduct(product: { stockSource?: string; kanbanStatus?: string }) {
  return product.stockSource ?? (product.kanbanStatus === "fulfillment" ? "ml_full" : "manual")
}

function isMlFullStockProduct(product: { stockSource?: string; kanbanStatus?: string }) {
  return stockSourceForProduct(product) === "ml_full"
}

function buildMlAliasOwnerMap<T extends { mlItemAliases?: string[] }>(products: T[]) {
  const aliasOwner = new Map<string, T>()
  for (const product of products) {
    for (const alias of product.mlItemAliases ?? []) {
      const normalized = normalizeMlItemIdForStock(alias)
      if (normalized) aliasOwner.set(normalized, product)
    }
  }
  return aliasOwner
}

function normalizeStockTokenText(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
}

function titleSimilarity(a: string, b: string): number {
  const left = normalizeStockTokenText(a)
  const right = normalizeStockTokenText(b)
  if (left.length === 0 || right.length === 0) return 0
  const rightSet = new Set(right)
  const matches = left.filter((token) => rightSet.has(token)).length
  return matches / Math.min(left.length, right.length)
}

function findProductForSaleItem(
  products: Doc<"stockProducts">[],
  item: { mlItemId: string; sku?: string; title: string },
): { product: Doc<"stockProducts"> | null; matchMethod: string; score: number } {
  const normalizedItemId = normalizeMlItemIdForStock(item.mlItemId)
  const normalizedSku = normalizeMlItemIdForStock(item.sku ?? "")

  const byMlId = new Map<string, Doc<"stockProducts">>()
  const bySku = new Map<string, Doc<"stockProducts">>()
  const aliasOwner = buildMlAliasOwnerMap(products)

  for (const product of products) {
    if (product.mlItemId) byMlId.set(normalizeMlItemIdForStock(product.mlItemId), product)
    if (product.sku) bySku.set(normalizeMlItemIdForStock(product.sku), product)
  }

  if (normalizedItemId && byMlId.has(normalizedItemId)) {
    return { product: byMlId.get(normalizedItemId) ?? null, matchMethod: "mlItemId", score: 1 }
  }
  if (normalizedItemId && aliasOwner.has(normalizedItemId)) {
    return { product: aliasOwner.get(normalizedItemId) ?? null, matchMethod: "alias", score: 1 }
  }
  if (normalizedSku && bySku.has(normalizedSku)) {
    return { product: bySku.get(normalizedSku) ?? null, matchMethod: "sku", score: 1 }
  }

  let bestProduct: Doc<"stockProducts"> | null = null
  let bestScore = 0
  for (const product of products) {
    const score = titleSimilarity(product.name, item.title)
    if (score > bestScore) {
      bestScore = score
      bestProduct = product
    }
  }

  if (bestProduct && bestScore >= 0.5) {
    return { product: bestProduct, matchMethod: "title", score: bestScore }
  }

  return { product: null, matchMethod: "none", score: bestScore }
}

/**
 * Move no Kanban com persistência correta: ir para "Em falta" zera quantidade,
 * registra movimento de saída e mantém status coerente com o estoque.
 */
export const applyKanbanMove = mutation({
  args: {
    userId: v.string(),
    productId: v.id("stockProducts"),
    kanbanCardId: v.optional(v.id("stockKanbanCards")),
    target: kanbanMoveTargetValidator,
    kanbanNote: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId)
    if (!product || product.userId !== args.userId) {
      throw new Error("Produto nao encontrado.")
    }

    const prevKanban = product.kanbanStatus ?? "purchased"
    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)

    const notePatch = args.kanbanNote !== undefined ? { kanbanNote: args.kanbanNote } : {}
    const arrivalPatch =
      args.estimatedArrival !== undefined ? { estimatedArrival: args.estimatedArrival } : {}

    if (args.kanbanCardId !== undefined) {
      const card = await ctx.db.get(args.kanbanCardId)
      if (!card || card.userId !== args.userId || card.productId !== args.productId) {
        throw new Error("Card do Kanban nao encontrado.")
      }

      const nextStatus = args.target === "em_falta" ? "in_stock" : args.target
      if (args.target === "in_stock" && card.quantity <= 0) {
        throw new Error(
          "Sem unidades neste card. Ajuste a quantidade antes de colocar em No estoque.",
        )
      }
      if (card.kanbanStatus !== nextStatus || args.target === "em_falta") {
        await logKanbanTransition(ctx, {
          userId: args.userId,
          productId: args.productId,
          fromStatus: card.kanbanStatus,
          toStatus: args.target,
          note: args.kanbanNote,
        })
      }

      await ctx.db.patch(args.kanbanCardId, {
        kanbanStatus: nextStatus,
        ...(args.target === "em_falta" && { quantity: 0 }),
        ...(args.kanbanNote !== undefined && { note: args.kanbanNote }),
        ...arrivalPatch,
        updatedAt: now,
      })
      return
    }

    if (args.target === "em_falta") {
      const prevQty = product.quantity
      if (prevQty === 0 && product.kanbanStatus === "in_stock") {
        await ctx.db.patch(args.productId, {
          ...notePatch,
          ...arrivalPatch,
          updatedAt: now,
        })
        return
      }

      await ctx.db.patch(args.productId, {
        quantity: 0,
        kanbanStatus: "in_stock",
        ...notePatch,
        ...arrivalPatch,
        updatedAt: now,
      })

      await logKanbanTransition(ctx, {
        userId: args.userId,
        productId: args.productId,
        fromStatus: prevKanban,
        toStatus: "em_falta",
        note: args.kanbanNote,
      })

      if (prevQty > 0) {
        await ctx.db.insert("stockMovements", {
          userId: args.userId,
          productId: args.productId,
          type: "out",
          quantity: prevQty,
          date: today,
          note: "Saida via Kanban (movido para Em falta)",
          createdAt: now,
        })
      }
      return
    }

    if (args.target === "in_stock") {
      if (product.quantity <= 0) {
        throw new Error(
          "Sem unidades em estoque. Ajuste a quantidade no produto antes de colocar em No estoque.",
        )
      }
      if (prevKanban !== "in_stock") {
        await logKanbanTransition(ctx, {
          userId: args.userId,
          productId: args.productId,
          fromStatus: prevKanban,
          toStatus: "in_stock",
          note: args.kanbanNote,
        })
      }
      await ctx.db.patch(args.productId, {
        kanbanStatus: "in_stock",
        ...notePatch,
        ...arrivalPatch,
        updatedAt: now,
      })
      return
    }

    if (prevKanban !== args.target) {
      await logKanbanTransition(ctx, {
        userId: args.userId,
        productId: args.productId,
        fromStatus: prevKanban,
        toStatus: args.target,
        note: args.kanbanNote,
      })
    }

    await ctx.db.patch(args.productId, {
      kanbanStatus: args.target,
      ...notePatch,
      ...arrivalPatch,
      updatedAt: now,
    })
  },
})

const manualLocationValidator = v.union(
  v.literal("in_stock_physical"),
  v.literal("in_transit"),
  v.literal("awaiting_delivery"),
  v.literal("returned_supplier"),
)

export const setProductKanbanHidden = mutation({
  args: {
    userId: v.string(),
    productId: v.id("stockProducts"),
    kanbanHidden: v.boolean(),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId)
    if (!product || product.userId !== args.userId) {
      throw new Error("Produto nao encontrado.")
    }
    await ctx.db.patch(args.productId, {
      kanbanHidden: args.kanbanHidden,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Entrada manual com mapeamento para coluna Kanban; dedupe silencioso por nome+fornecedor+data.
 */
export const addManualStockEntry = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    sku: v.optional(v.string()),
    mlItemId: v.string(),
    quantity: v.number(),
    unitCost: v.number(),
    supplier: v.string(),
    manualEntryDate: v.string(),
    location: manualLocationValidator,
    estimatedArrival: v.optional(v.string()),
    observations: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedName = args.name.trim()
    const supplier = args.supplier.trim()
    const normalizedMl = normalizeMlItemIdForStock(args.mlItemId)
    if (!normalizedName || !supplier) {
      throw new Error("Preencha nome e fornecedor.")
    }
    if (!normalizedMl) {
      throw new Error("Informe o MLB ID do produto.")
    }
    if (args.quantity < 0 || args.unitCost < 0) {
      throw new Error("Quantidade e custo devem ser zero ou positivos.")
    }

    const duplicateMl = await ctx.db
      .query("stockProducts")
      .withIndex("by_user_ml_item", (q) => q.eq("userId", args.userId).eq("mlItemId", normalizedMl))
      .first()
    if (duplicateMl) {
      throw new Error("MLB ID ja cadastrado em outro produto.")
    }

    const dedupeKey = manualStockDedupeKey(
      args.userId,
      normalizedName,
      supplier,
      args.manualEntryDate,
    )

    const duplicate = await ctx.db
      .query("stockProducts")
      .withIndex("by_user_manual_dedupe", (q) =>
        q.eq("userId", args.userId).eq("manualDedupeKey", dedupeKey),
      )
      .first()
    if (duplicate) {
      return duplicate._id
    }

    let kanbanStatus:
      | "purchased"
      | "planned"
      | "buying"
      | "in_transit"
      | "awaiting_inspection"
      | "returned"
      | "completed"
      | "in_stock"
      | "fulfillment" = "purchased"
    if (args.location === "in_stock_physical") {
      kanbanStatus = "in_stock"
    } else if (args.location === "in_transit") {
      kanbanStatus = "in_transit"
    } else if (args.location === "awaiting_delivery") {
      kanbanStatus = "awaiting_inspection"
    } else if (args.location === "returned_supplier") {
      kanbanStatus = "returned"
    }

    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)

    const productId = await ctx.db.insert("stockProducts", {
      userId: args.userId,
      name: normalizedName,
      sku: normalizedMl,
      mlItemId: normalizedMl,
      category: "Entrada manual",
      quantity: args.quantity,
      minStock: 0,
      unitCost: args.unitCost,
      unitCostSource: "manual",
      stockSource: "manual",
      kanbanStatus,
      estimatedArrival: args.estimatedArrival,
      kanbanNote: args.observations,
      supplier,
      manualEntryDate: args.manualEntryDate,
      manualDedupeKey: dedupeKey,
      ...(args.imageUrl?.trim() ? { imageUrl: args.imageUrl.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    })

    await logKanbanTransition(ctx, {
      userId: args.userId,
      productId,
      fromStatus: "novo",
      toStatus: kanbanStatus,
      note: args.observations,
    })

    if (args.quantity > 0) {
      await ctx.db.insert("stockMovements", {
        userId: args.userId,
        productId,
        type: "in",
        quantity: args.quantity,
        date: today,
        note: `Entrada manual — ${supplier}`,
        createdAt: now,
      })
    }

    return productId
  },
})

export const upsertCostFromBranchHunter = mutation({
  args: {
    mlItemId: v.string(),
    unitCost: v.number(),
  },
  handler: async (ctx, args) => {
    const normalizedItemId = args.mlItemId.trim()
    if (!normalizedItemId) {
      throw new Error("mlItemId invalido.")
    }
    if (!Number.isFinite(args.unitCost) || args.unitCost < 0) {
      throw new Error("unitCost invalido.")
    }

    const products = await ctx.db
      .query("stockProducts")
      .withIndex("by_ml_item", (queryBuilder) => queryBuilder.eq("mlItemId", normalizedItemId))
      .collect()

    let updated = 0
    let skippedManual = 0
    const now = Date.now()

    for (const product of products) {
      if (product.unitCostSource === "manual") {
        skippedManual += 1
        continue
      }

      await ctx.db.patch(product._id, {
        unitCost: args.unitCost,
        unitCostSource: "extension",
        updatedAt: now,
      })
      updated += 1
    }

    return {
      totalMatched: products.length,
      updated,
      skippedManual,
    }
  },
})

export const syncFromMercadoLivre = mutation({
  args: {
    userId: v.string(),
    listings: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        price: v.number(),
        availableQuantity: v.number(),
        thumbnail: v.optional(v.string()),
        sku: v.optional(v.string()),
        logisticType: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)
    let created = 0
    let updated = 0
    const allProducts = await ctx.db
      .query("stockProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
    const aliasOwner = buildMlAliasOwnerMap(allProducts)

    for (const listing of args.listings) {
      const nextQuantity = Math.max(0, Math.floor(listing.availableQuantity))
      const normalizedListingId = normalizeMlItemIdForStock(listing.id)

      const byMlItems = await ctx.db
        .query("stockProducts")
        .withIndex("by_user_ml_item", (queryBuilder) =>
          queryBuilder.eq("userId", args.userId).eq("mlItemId", normalizedListingId),
        )
        .collect()

      const isFull = listing.logisticType === "fulfillment"
      const existing = isFull
        ? (byMlItems.find(isMlFullStockProduct) ??
          byMlItems[0] ??
          (normalizedListingId ? aliasOwner.get(normalizedListingId) : null) ??
          null)
        : (byMlItems[0] ??
          (normalizedListingId ? aliasOwner.get(normalizedListingId) : null) ??
          null)

      if (existing) {
        const existingMlItemId = normalizeMlItemIdForStock(existing.mlItemId ?? "")
        const matchedByAlias =
          Boolean(normalizedListingId) && existingMlItemId !== normalizedListingId
        const patchData: Record<string, unknown> = {
          ...(matchedByAlias ? {} : { mlItemId: normalizedListingId, sku: normalizedListingId }),
          imageUrl: listing.thumbnail,
          sellingPrice: listing.price,
          updatedAt: now,
        }
        if (isFull && existing.kanbanStatus === "fulfillment") {
          patchData.quantity = nextQuantity
          patchData.stockSource = "ml_full"
        }
        await ctx.db.patch(existing._id, patchData)

        if (isFull && existing.kanbanStatus !== "fulfillment") {
          await upsertKanbanCardForStatus(ctx, {
            userId: args.userId,
            productId: existing._id,
            kanbanStatus: "fulfillment",
            quantity: nextQuantity,
            note: matchedByAlias
              ? `Quantidade no Full sincronizada pelo Mercado Livre (${normalizedListingId})`
              : "Quantidade no Full sincronizada pelo Mercado Livre",
          })
        }

        if (
          isFull &&
          existing.kanbanStatus === "fulfillment" &&
          existing.quantity !== nextQuantity
        ) {
          await ctx.db.insert("stockMovements", {
            userId: args.userId,
            productId: existing._id,
            type: "adjustment",
            quantity: nextQuantity,
            date: today,
            note: `Sincronizacao ML: ${existing.quantity} -> ${nextQuantity}`,
            createdAt: now,
          })
        }

        updated += 1
        continue
      }

      if (!isFull) continue

      const productId = await ctx.db.insert("stockProducts", {
        userId: args.userId,
        name: listing.title,
        sku: normalizedListingId,
        mlItemId: normalizedListingId,
        imageUrl: listing.thumbnail,
        category: "Mercado Livre",
        quantity: nextQuantity,
        minStock: 0,
        unitCost: 0,
        stockSource: "ml_full",
        sellingPrice: listing.price,
        kanbanStatus: "fulfillment",
        createdAt: now,
        updatedAt: now,
      })

      if (nextQuantity > 0) {
        await ctx.db.insert("stockMovements", {
          userId: args.userId,
          productId,
          type: "in",
          quantity: nextQuantity,
          date: today,
          note: "Importado do Mercado Livre (fulfillment)",
          createdAt: now,
        })
      }

      created += 1
    }

    return {
      created,
      updated,
      removedManual: 0,
      total: args.listings.length,
    }
  },
})

export const deleteProduct = mutation({
  args: {
    userId: v.string(),
    productId: v.id("stockProducts"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId)
    if (!product || product.userId !== args.userId) {
      throw new Error("Produto nao encontrado.")
    }

    const movements = await ctx.db
      .query("stockMovements")
      .withIndex("by_user_product", (queryBuilder) =>
        queryBuilder.eq("userId", args.userId).eq("productId", args.productId),
      )
      .collect()

    for (const movement of movements) {
      await ctx.db.delete(movement._id)
    }

    const events = await ctx.db
      .query("productKanbanEvents")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", args.userId).eq("productId", args.productId),
      )
      .collect()
    for (const ev of events) {
      await ctx.db.delete(ev._id)
    }

    const kanbanCards = await ctx.db
      .query("stockKanbanCards")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", args.userId).eq("productId", args.productId),
      )
      .collect()
    for (const card of kanbanCards) {
      await ctx.db.delete(card._id)
    }

    await ctx.db.delete(args.productId)
  },
})

/** Migração única: planejado + comprando → comprado (unificação de colunas). */
export const migratePlannedBuyingToPurchased = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("stockProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
    let updated = 0
    const now = Date.now()
    for (const p of products) {
      if (p.kanbanStatus === "planned" || p.kanbanStatus === "buying") {
        await ctx.db.patch(p._id, { kanbanStatus: "purchased", updatedAt: now })
        updated += 1
      }
    }
    return { updated }
  },
})

/**
 * Reconcilia dados de produtos do estoque com dados do Mercado Livre.
 * Atualiza nome, SKU, foto e quantidade para cada produto que tenha mlItemId.
 */
export const reconcileWithMlData = mutation({
  args: {
    userId: v.string(),
    items: v.array(
      v.object({
        mlItemId: v.string(),
        title: v.string(),
        sku: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        availableQuantity: v.number(),
        price: v.number(),
        logisticType: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)
    let updated = 0
    let created = 0

    const allProducts = await ctx.db
      .query("stockProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
    const aliasOwner = buildMlAliasOwnerMap(allProducts)

    for (const item of args.items) {
      const normalizedItemId = normalizeMlItemIdForStock(item.mlItemId)
      const byMlItems = await ctx.db
        .query("stockProducts")
        .withIndex("by_user_ml_item", (q) =>
          q.eq("userId", args.userId).eq("mlItemId", normalizedItemId),
        )
        .collect()

      const isFull = item.logisticType === "fulfillment"
      const product = isFull
        ? (byMlItems.find(isMlFullStockProduct) ??
          byMlItems[0] ??
          (normalizedItemId ? aliasOwner.get(normalizedItemId) : null) ??
          null)
        : (byMlItems[0] ?? (normalizedItemId ? aliasOwner.get(normalizedItemId) : null) ?? null)

      if (!product) {
        if (!isFull) continue

        const nextQty = Math.max(0, Math.floor(item.availableQuantity))
        const productId = await ctx.db.insert("stockProducts", {
          userId: args.userId,
          name: item.title,
          sku: normalizedItemId,
          mlItemId: normalizedItemId,
          imageUrl: item.imageUrl,
          category: "Mercado Livre",
          quantity: nextQty,
          minStock: 0,
          unitCost: 0,
          stockSource: "ml_full",
          sellingPrice: item.price,
          kanbanStatus: "fulfillment",
          createdAt: now,
          updatedAt: now,
        })

        if (nextQty > 0) {
          await ctx.db.insert("stockMovements", {
            userId: args.userId,
            productId,
            type: "in",
            quantity: nextQty,
            date: today,
            note: "Criado via sync ML (fulfillment)",
            createdAt: now,
          })
        }

        created += 1
        continue
      }

      const productMlItemId = normalizeMlItemIdForStock(product.mlItemId ?? "")
      const isAlias = Boolean(normalizedItemId) && productMlItemId !== normalizedItemId
      const patch: Record<string, unknown> = {
        updatedAt: now,
        ...(isAlias ? {} : { mlItemId: normalizedItemId, sku: normalizedItemId }),
      }

      if (!isAlias && item.title && item.title !== product.name) {
        patch.name = item.title
      }
      if (item.imageUrl && item.imageUrl !== product.imageUrl && (!isAlias || !product.imageUrl)) {
        patch.imageUrl = item.imageUrl
      }
      if (!isAlias && item.price > 0 && item.price !== product.sellingPrice) {
        patch.sellingPrice = item.price
      }

      const nextQty = isFull ? Math.max(0, Math.floor(item.availableQuantity)) : product.quantity
      if (isFull && product.kanbanStatus !== "fulfillment") {
        await upsertKanbanCardForStatus(ctx, {
          userId: args.userId,
          productId: product._id,
          kanbanStatus: "fulfillment",
          quantity: nextQty,
          note: isAlias
            ? `Quantidade no Full sincronizada pelo Mercado Livre (${normalizedItemId})`
            : "Quantidade no Full sincronizada pelo Mercado Livre",
        })
      }
      if (isFull && product.kanbanStatus === "fulfillment") {
        patch.stockSource = "ml_full"
      }

      if (isFull && product.kanbanStatus === "fulfillment" && nextQty !== product.quantity) {
        patch.quantity = nextQty
        await ctx.db.insert("stockMovements", {
          userId: args.userId,
          productId: product._id,
          type: "adjustment",
          quantity: nextQty,
          date: today,
          note: `Reconciliação ML: ${product.quantity} → ${nextQty}`,
          createdAt: now,
        })
      }

      await ctx.db.patch(product._id, patch)
      updated += 1
    }

    return { updated, created, total: args.items.length }
  },
})

export const enrichPhotosFromMl = mutation({
  args: {
    userId: v.string(),
    mlItems: v.array(
      v.object({
        mlItemId: v.string(),
        title: v.string(),
        imageUrl: v.optional(v.string()),
        sku: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("stockProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    function tokenize(text: string) {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/\s+/)
        .filter((t) => t.length > 2)
    }

    const usedMlIds = new Set<string>()
    for (const p of products) {
      if (p.mlItemId) usedMlIds.add(p.mlItemId)
      for (const a of p.mlItemAliases ?? []) usedMlIds.add(a)
    }

    let enriched = 0
    let linked = 0
    let aliasesAdded = 0

    // Phase 1: products without photo or without mlItemId (original behaviour)
    const candidates = products.filter((p) => !p.imageUrl || !p.mlItemId)
    for (const product of candidates) {
      const productTokens = tokenize(product.name)
      if (productTokens.length === 0) continue

      let bestMatch: (typeof args.mlItems)[number] | null = null
      let bestScore = 0

      for (const ml of args.mlItems) {
        if (!product.imageUrl && !ml.imageUrl) continue
        if (product.mlItemId && product.mlItemId === ml.mlItemId) continue
        if (!product.mlItemId && usedMlIds.has(ml.mlItemId)) continue

        const mlTokens = tokenize(ml.title)
        const matches = productTokens.filter((t) => mlTokens.includes(t))
        const score = matches.length / productTokens.length
        if (score > bestScore) {
          bestScore = score
          bestMatch = ml
        }
      }

      if (bestMatch && bestScore >= 0.4) {
        const patch: Record<string, unknown> = { updatedAt: Date.now() }
        if (!product.imageUrl && bestMatch.imageUrl) {
          patch.imageUrl = bestMatch.imageUrl
          enriched += 1
        }
        if (!product.mlItemId) {
          patch.mlItemId = bestMatch.mlItemId
          patch.sku = bestMatch.mlItemId
          usedMlIds.add(bestMatch.mlItemId)
          linked += 1
        }
        if (Object.keys(patch).length > 1) {
          await ctx.db.patch(product._id, patch)
        }
      }
    }

    // Phase 2: accumulate aliases for products that already have mlItemId.
    // For each ML listing not yet claimed, find the best-matching product and
    // append the listing's mlItemId to that product's mlItemAliases.
    const ALIAS_THRESHOLD = 0.55
    for (const ml of args.mlItems) {
      if (usedMlIds.has(ml.mlItemId)) continue
      const mlTokens = tokenize(ml.title)
      if (mlTokens.length === 0) continue

      let bestProduct: (typeof products)[number] | null = null
      let bestScore = 0
      for (const p of products) {
        if (!p.mlItemId) continue
        const pTokens = tokenize(p.name)
        if (pTokens.length === 0) continue
        const matches = pTokens.filter((t) => mlTokens.includes(t))
        const score = matches.length / Math.min(pTokens.length, mlTokens.length)
        if (score > bestScore) {
          bestScore = score
          bestProduct = p
        }
      }

      if (bestProduct && bestScore >= ALIAS_THRESHOLD) {
        const existing = bestProduct.mlItemAliases ?? []
        if (!existing.includes(ml.mlItemId)) {
          const updated = [...existing, ml.mlItemId]
          await ctx.db.patch(bestProduct._id, {
            mlItemAliases: updated,
            updatedAt: Date.now(),
          })
          bestProduct.mlItemAliases = updated
          usedMlIds.add(ml.mlItemId)
          aliasesAdded += 1
        }
      }
    }

    return { enriched, linked, aliasesAdded }
  },
})

/**
 * Detecta produtos duplicados por similaridade de titulo (tokens) e merge:
 * - mantém o produto com maior unitCost como survivor
 * - move os mlItemId dos duplicados para mlItemAliases do survivor
 * - deleta os duplicados e suas movimentações/eventos
 */
export const mergeProductDuplicates = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("stockProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    function tokenize(text: string) {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/\s+/)
        .filter((t) => t.length > 2)
    }

    function sim(a: string[], b: string[]): number {
      if (a.length === 0 || b.length === 0) return 0
      const matches = a.filter((t) => b.includes(t)).length
      return matches / Math.min(a.length, b.length)
    }

    const MERGE_THRESHOLD = 0.6
    const tokenized = products.map((p) => ({ product: p, tokens: tokenize(p.name) }))
    const assigned = new Set<string>()
    const groups: (typeof products)[] = []

    for (let i = 0; i < tokenized.length; i++) {
      const pid = tokenized[i].product._id
      if (assigned.has(pid)) continue
      assigned.add(pid)
      const group = [tokenized[i].product]

      for (let j = i + 1; j < tokenized.length; j++) {
        const cid = tokenized[j].product._id
        if (assigned.has(cid)) continue
        if (sim(tokenized[i].tokens, tokenized[j].tokens) >= MERGE_THRESHOLD) {
          group.push(tokenized[j].product)
          assigned.add(cid)
        }
      }
      groups.push(group)
    }

    let merged = 0
    let removed = 0
    for (const group of groups) {
      if (group.length < 2) continue

      group.sort((a, b) => {
        if (a.unitCost !== b.unitCost) return b.unitCost - a.unitCost
        if (a.quantity !== b.quantity) return b.quantity - a.quantity
        if (a.mlItemId && !b.mlItemId) return -1
        if (!a.mlItemId && b.mlItemId) return 1
        return a.createdAt - b.createdAt
      })

      const survivor = group[0]
      const existingAliases = new Set(survivor.mlItemAliases ?? [])
      if (survivor.mlItemId) existingAliases.delete(survivor.mlItemId)

      for (let i = 1; i < group.length; i++) {
        const dup = group[i]
        if (dup.mlItemId && dup.mlItemId !== survivor.mlItemId) {
          existingAliases.add(dup.mlItemId)
        }
        for (const a of dup.mlItemAliases ?? []) {
          if (a !== survivor.mlItemId) existingAliases.add(a)
        }

        const movements = await ctx.db
          .query("stockMovements")
          .withIndex("by_user_product", (q) => q.eq("userId", args.userId).eq("productId", dup._id))
          .collect()
        for (const m of movements) {
          await ctx.db.delete(m._id)
        }
        const events = await ctx.db
          .query("productKanbanEvents")
          .withIndex("by_user_product", (q) => q.eq("userId", args.userId).eq("productId", dup._id))
          .collect()
        for (const e of events) {
          await ctx.db.delete(e._id)
        }

        const kanbanCards = await ctx.db
          .query("stockKanbanCards")
          .withIndex("by_user_product", (q) => q.eq("userId", args.userId).eq("productId", dup._id))
          .collect()
        for (const card of kanbanCards) {
          await ctx.db.delete(card._id)
        }

        await ctx.db.delete(dup._id)
        removed += 1
      }

      await ctx.db.patch(survivor._id, {
        mlItemAliases: [...existingAliases],
        updatedAt: Date.now(),
      })
      merged += 1
    }

    return { merged, removed }
  },
})

export const bulkSetCosts = mutation({
  args: {
    userId: v.string(),
    costs: v.array(
      v.object({
        mlItemId: v.string(),
        unitCost: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("stockProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    const byMlId = new Map(products.filter((p) => p.mlItemId).map((p) => [p.mlItemId!, p]))

    let updated = 0
    for (const entry of args.costs) {
      const product = byMlId.get(entry.mlItemId)

      if (!product) continue
      if (product.unitCost === entry.unitCost) continue

      await ctx.db.patch(product._id, {
        unitCost: entry.unitCost,
        unitCostSource: "manual",
        updatedAt: Date.now(),
      })
      updated += 1
    }

    return { updated, total: args.costs.length }
  },
})

/**
 * Reconciliação em massa: define status Kanban (fulfillment vs in_stock) com base
 * no local real do produto (ML Full ou estoque físico).
 */
export const bulkReconcileStock = mutation({
  args: {
    userId: v.string(),
    assignments: v.array(
      v.object({
        productId: v.id("stockProducts"),
        targetStatus: v.union(v.literal("fulfillment"), v.literal("in_stock")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    let updated = 0

    for (const assignment of args.assignments) {
      const product = await ctx.db.get(assignment.productId)
      if (!product || product.userId !== args.userId) continue

      const prev = product.kanbanStatus ?? "purchased"
      if (prev === assignment.targetStatus) continue

      await logKanbanTransition(ctx, {
        userId: args.userId,
        productId: assignment.productId,
        fromStatus: prev,
        toStatus: assignment.targetStatus,
        note: "Reconciliação em massa",
      })

      await ctx.db.patch(assignment.productId, {
        kanbanStatus: assignment.targetStatus,
        updatedAt: now,
      })
      updated += 1
    }

    return { updated, total: args.assignments.length }
  },
})

export const reconcileSalesFromMercadoLivre = mutation({
  args: {
    userId: v.string(),
    orders: v.array(
      v.object({
        orderId: v.string(),
        status: v.string(),
        paymentStatus: v.optional(v.string()),
        date: v.string(),
        items: v.array(
          v.object({
            itemKey: v.string(),
            mlItemId: v.string(),
            title: v.string(),
            sku: v.optional(v.string()),
            quantity: v.number(),
            unitPrice: v.number(),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const products = await ctx.db
      .query("stockProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    let salesCategoryId = categories.find(
      (category) =>
        category.kind === "income" && category.name.toLowerCase() === "vendas de produtos",
    )?._id

    if (!salesCategoryId) {
      salesCategoryId = await ctx.db.insert("categories", {
        userId: args.userId,
        name: "Vendas de produtos",
        kind: "income",
        createdAt: now,
        updatedAt: now,
      })
    }

    let processedItems = 0
    let skippedAlreadyProcessed = 0
    let skippedCancelled = 0
    let unmatchedItems = 0
    let movementsCreated = 0
    let transactionsCreated = 0
    let stockShortages = 0
    const unmatched: Array<{ orderId: string; mlItemId: string; title: string; quantity: number }> =
      []
    const adjusted: Array<{
      orderId: string
      productId: Id<"stockProducts">
      productName: string
      soldQuantity: number
      previousQuantity: number
      nextQuantity: number
      matchMethod: string
    }> = []

    for (const order of args.orders) {
      const status = order.status.toLowerCase()
      const paymentStatus = order.paymentStatus?.toLowerCase()
      if (
        status.includes("cancel") ||
        status === "invalid" ||
        paymentStatus === "cancelled" ||
        paymentStatus === "rejected"
      ) {
        skippedCancelled += order.items.length
        continue
      }

      const date = order.date ? order.date.slice(0, 10) : new Date().toISOString().slice(0, 10)

      for (const item of order.items) {
        const quantity = Math.max(0, Math.floor(item.quantity))
        if (quantity <= 0) continue

        const externalItemId =
          item.itemKey.trim() || `${normalizeMlItemIdForStock(item.mlItemId)}:${item.title}`
        const existingMovement = await ctx.db
          .query("stockMovements")
          .withIndex("by_user_external_order_item", (q) =>
            q
              .eq("userId", args.userId)
              .eq("externalOrderId", order.orderId)
              .eq("externalItemId", externalItemId),
          )
          .first()

        if (existingMovement) {
          skippedAlreadyProcessed += 1
          continue
        }

        const match = findProductForSaleItem(products, {
          mlItemId: item.mlItemId,
          sku: item.sku,
          title: item.title,
        })

        if (!match.product) {
          unmatchedItems += 1
          unmatched.push({
            orderId: order.orderId,
            mlItemId: normalizeMlItemIdForStock(item.mlItemId),
            title: item.title,
            quantity,
          })
          continue
        }

        const previousQuantity = match.product.quantity
        const nextQuantity = Math.max(0, previousQuantity - quantity)
        if (quantity > previousQuantity) stockShortages += 1

        await ctx.db.patch(match.product._id, {
          quantity: nextQuantity,
          kanbanStatus:
            nextQuantity === 0 && (match.product.kanbanStatus ?? "in_stock") === "in_stock"
              ? "in_stock"
              : match.product.kanbanStatus,
          updatedAt: now,
        })
        match.product.quantity = nextQuantity

        await ctx.db.insert("stockMovements", {
          userId: args.userId,
          productId: match.product._id,
          type: "sale",
          quantity,
          date,
          unitPrice: item.unitPrice,
          note: `Venda Mercado Livre #${order.orderId} (${match.matchMethod})`,
          externalSource: "mercado_livre",
          externalOrderId: order.orderId,
          externalItemId,
          createdAt: now,
        })
        movementsCreated += 1
        processedItems += 1

        const existingTransaction = await ctx.db
          .query("transactions")
          .withIndex("by_user_external_order_item", (q) =>
            q
              .eq("userId", args.userId)
              .eq("externalOrderId", order.orderId)
              .eq("externalItemId", externalItemId),
          )
          .first()

        const totalSale = item.unitPrice * quantity
        if (!existingTransaction && totalSale > 0) {
          await ctx.db.insert("transactions", {
            userId: args.userId,
            kind: "income",
            amount: totalSale,
            date,
            description: `Venda ML #${order.orderId} - ${match.product.name} (${quantity} un.)`,
            categoryId: salesCategoryId,
            origin: "Venda online",
            externalSource: "mercado_livre",
            externalOrderId: order.orderId,
            externalItemId,
            createdAt: now,
          })
          transactionsCreated += 1
        }

        adjusted.push({
          orderId: order.orderId,
          productId: match.product._id,
          productName: match.product.name,
          soldQuantity: quantity,
          previousQuantity,
          nextQuantity,
          matchMethod: match.matchMethod,
        })
      }
    }

    return {
      processedItems,
      skippedAlreadyProcessed,
      skippedCancelled,
      unmatchedItems,
      movementsCreated,
      transactionsCreated,
      stockShortages,
      adjusted,
      unmatched,
      totalOrders: args.orders.length,
    }
  },
})

export const addMovement = mutation({
  args: {
    userId: v.string(),
    productId: v.id("stockProducts"),
    type: v.union(v.literal("in"), v.literal("out"), v.literal("adjustment"), v.literal("sale")),
    quantity: v.number(),
    date: v.string(),
    unitPrice: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId)
    if (!product || product.userId !== args.userId) {
      throw new Error("Produto nao encontrado.")
    }

    let nextQuantity = product.quantity

    if (args.type === "in") {
      nextQuantity += args.quantity
    } else if (args.type === "out" || args.type === "sale") {
      nextQuantity -= args.quantity
    } else {
      nextQuantity = args.quantity
    }

    if (nextQuantity < 0) {
      throw new Error("Movimentacao invalida: estoque nao pode ficar negativo.")
    }

    await ctx.db.patch(args.productId, {
      quantity: nextQuantity,
      updatedAt: Date.now(),
    })

    const movementId = await ctx.db.insert("stockMovements", {
      userId: args.userId,
      productId: args.productId,
      type: args.type,
      quantity: args.quantity,
      date: args.date,
      unitPrice: args.unitPrice,
      note: args.note,
      createdAt: Date.now(),
    })

    if (args.type === "sale") {
      const categories = await ctx.db
        .query("categories")
        .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
        .collect()

      let salesCategoryId = categories.find(
        (category) =>
          category.kind === "income" && category.name.toLowerCase() === "vendas de produtos",
      )?._id

      if (!salesCategoryId) {
        salesCategoryId = await ctx.db.insert("categories", {
          userId: args.userId,
          name: "Vendas de produtos",
          kind: "income",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }

      const totalSale = (args.unitPrice ?? product.sellingPrice ?? 0) * args.quantity
      if (salesCategoryId && totalSale > 0) {
        await ctx.db.insert("transactions", {
          userId: args.userId,
          kind: "income",
          amount: totalSale,
          date: args.date,
          description: `Venda de ${product.name} (${args.quantity} un.)`,
          categoryId: salesCategoryId,
          origin: "Venda online",
          createdAt: Date.now(),
        })
      }
    }

    return movementId
  },
})

/**
 * Migração única: limpa estoque existente e recria com dados reais confirmados.
 * Limpa todo o estoque e recria APENAS os itens de estoque físico (sem ML).
 * Os itens do Fulfillment/ML serão criados automaticamente pelo sync.
 * Rodar via API: POST /api/stock/reset
 */
export const resetStockToReality = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existingProducts = await ctx.db
      .query("stockProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    for (const p of existingProducts) {
      const movements = await ctx.db
        .query("stockMovements")
        .withIndex("by_user_product", (q) => q.eq("userId", args.userId).eq("productId", p._id))
        .collect()
      for (const m of movements) await ctx.db.delete(m._id)

      const events = await ctx.db
        .query("productKanbanEvents")
        .withIndex("by_user_product", (q) => q.eq("userId", args.userId).eq("productId", p._id))
        .collect()
      for (const e of events) await ctx.db.delete(e._id)

      const kanbanCards = await ctx.db
        .query("stockKanbanCards")
        .withIndex("by_user_product", (q) => q.eq("userId", args.userId).eq("productId", p._id))
        .collect()
      for (const card of kanbanCards) await ctx.db.delete(card._id)

      await ctx.db.delete(p._id)
    }

    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)

    type StockEntry = {
      name: string
      sku: string
      quantity: number
      unitCost: number
      kanbanStatus: "in_stock"
      category: string
    }

    const physicalStock: StockEntry[] = [
      {
        name: "Cafeteira Britânia Jarra De aço 1.2 Litros Inox 127v",
        sku: "30CAFE12",
        quantity: 2,
        unitCost: 0,
        kanbanStatus: "in_stock",
        category: "Cafeteiras",
      },
      {
        name: "CHALEIRA ELÉTRICA BCH06P BRITANIA 127V",
        sku: "BCH06P",
        quantity: 3,
        unitCost: 0,
        kanbanStatus: "in_stock",
        category: "Chaleiras",
      },
      {
        name: "Philco Soprador Termico PST01 (Inapto para venda)",
        sku: "PST01",
        quantity: 1,
        unitCost: 0,
        kanbanStatus: "in_stock",
        category: "Inaptos",
      },
      {
        name: "VENTILADOR BRITÂNIA ROSA BVT304 127V",
        sku: "VENTILADOROSA",
        quantity: 9,
        unitCost: 101.56,
        kanbanStatus: "in_stock",
        category: "Ventiladores",
      },
      {
        name: "Liquidificador Philco Turbo 1200w Plq1350 Preto 127v (Inapto para venda)",
        sku: "PLQ1350",
        quantity: 1,
        unitCost: 220.09,
        kanbanStatus: "in_stock",
        category: "Inaptos",
      },
      {
        name: "FERRO PHILCO PFV3100AZ NANO CERAMIC 127V",
        sku: "3100AZ",
        quantity: 5,
        unitCost: 131.0,
        kanbanStatus: "in_stock",
        category: "Ferros",
      },
      {
        name: "Panela De Arroz Philco 10 Xicaras PH10P Visor Glass Inox",
        sku: "PH10P110V",
        quantity: 1,
        unitCost: 0,
        kanbanStatus: "in_stock",
        category: "Panelas",
      },
      {
        name: "Passadeira à Vapor Britânia Portátil Turquesa/branco - 110v",
        sku: "PASSAVAPORPHILCO124",
        quantity: 1,
        unitCost: 128.52,
        kanbanStatus: "in_stock",
        category: "Passadeiras",
      },
    ]

    let created = 0
    for (const entry of physicalStock) {
      const productId = await ctx.db.insert("stockProducts", {
        userId: args.userId,
        name: entry.name,
        sku: entry.sku,
        category: entry.category,
        quantity: entry.quantity,
        minStock: 0,
        unitCost: entry.unitCost,
        kanbanStatus: entry.kanbanStatus,
        createdAt: now,
        updatedAt: now,
      })

      if (entry.quantity > 0) {
        await ctx.db.insert("stockMovements", {
          userId: args.userId,
          productId,
          type: "in",
          quantity: entry.quantity,
          date: today,
          note: "Reset estoque — dados reais 12/05/2026",
          createdAt: now,
        })
      }

      created += 1
    }

    return { deleted: existingProducts.length, created }
  },
})
