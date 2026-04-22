import { v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx } from "./_generated/server"

import { manualStockDedupeKey } from "./dedupeHelpers"

const kanbanStatusValidator = v.union(
  v.literal("planned"),
  v.literal("buying"),
  v.literal("in_transit"),
  v.literal("awaiting_inspection"),
  v.literal("returned"),
  v.literal("completed"),
  v.literal("in_stock"),
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

    return { products, movements, kanbanEvents }
  },
})

export const addProduct = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    sku: v.string(),
    category: v.string(),
    quantity: v.number(),
    minStock: v.number(),
    unitCost: v.number(),
    sellingPrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const normalizedSku = args.sku.trim().toUpperCase()
    const normalizedName = args.name.trim()
    const normalizedCategory = args.category.trim()

    if (!normalizedSku || !normalizedName || !normalizedCategory) {
      throw new Error("Preencha nome, SKU e categoria do produto.")
    }
    if (args.quantity < 0 || args.minStock < 0 || args.unitCost < 0) {
      throw new Error("Quantidade, estoque minimo e custo devem ser maiores ou iguais a zero.")
    }

    const existing = await ctx.db
      .query("stockProducts")
      .withIndex("by_user_sku", (queryBuilder) =>
        queryBuilder.eq("userId", args.userId).eq("sku", normalizedSku),
      )
      .first()

    if (existing) {
      throw new Error("SKU ja existe no estoque.")
    }

    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)

    const productId = await ctx.db.insert("stockProducts", {
      userId: args.userId,
      name: normalizedName,
      sku: normalizedSku,
      category: normalizedCategory,
      quantity: args.quantity,
      minStock: args.minStock,
      unitCost: args.unitCost,
      unitCostSource: "manual",
      sellingPrice: args.sellingPrice,
      kanbanStatus: args.quantity > 0 ? "in_stock" : "planned",
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
  await ctx.db.insert("productKanbanEvents", {
    userId: args.userId,
    productId: args.productId,
    fromStatus: args.fromStatus,
    toStatus: args.toStatus,
    note: args.note,
    createdAt: Date.now(),
  })
}

export const updateProduct = mutation({
  args: {
    userId: v.string(),
    productId: v.id("stockProducts"),
    name: v.string(),
    sku: v.string(),
    category: v.string(),
    quantity: v.number(),
    minStock: v.number(),
    unitCost: v.number(),
    sellingPrice: v.optional(v.number()),
    kanbanStatus: v.optional(kanbanStatusValidator),
    kanbanNote: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId)
    if (!product || product.userId !== args.userId) {
      throw new Error("Produto nao encontrado.")
    }

    const normalizedSku = args.sku.trim().toUpperCase()
    const normalizedName = args.name.trim()
    const normalizedCategory = args.category.trim()

    if (!normalizedSku || !normalizedName || !normalizedCategory) {
      throw new Error("Preencha nome, SKU e categoria do produto.")
    }
    if (args.quantity < 0 || args.minStock < 0 || args.unitCost < 0) {
      throw new Error("Quantidade, estoque minimo e custo devem ser maiores ou iguais a zero.")
    }

    const existing = await ctx.db
      .query("stockProducts")
      .withIndex("by_user_sku", (queryBuilder) =>
        queryBuilder.eq("userId", args.userId).eq("sku", normalizedSku),
      )
      .first()

    if (existing && existing._id !== args.productId) {
      throw new Error("SKU ja existe no estoque.")
    }

    const prevKanban = product.kanbanStatus ?? "planned"
    if (args.kanbanStatus !== undefined && args.kanbanStatus !== prevKanban) {
      await logKanbanTransition(ctx, {
        userId: args.userId,
        productId: args.productId,
        fromStatus: prevKanban,
        toStatus: args.kanbanStatus,
        note: args.kanbanNote,
      })
    }

    await ctx.db.patch(args.productId, {
      name: normalizedName,
      sku: normalizedSku,
      category: normalizedCategory,
      quantity: args.quantity,
      minStock: args.minStock,
      unitCost: args.unitCost,
      unitCostSource: "manual",
      sellingPrice: args.sellingPrice,
      ...(args.kanbanStatus !== undefined && { kanbanStatus: args.kanbanStatus }),
      ...(args.kanbanNote !== undefined && { kanbanNote: args.kanbanNote }),
      ...(args.estimatedArrival !== undefined && { estimatedArrival: args.estimatedArrival }),
      updatedAt: Date.now(),
    })
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

    const prev = product.kanbanStatus ?? "planned"
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

/**
 * Move no Kanban com persistência correta: ir para "Em falta" zera quantidade,
 * registra movimento de saída e mantém status coerente com o estoque.
 */
export const applyKanbanMove = mutation({
  args: {
    userId: v.string(),
    productId: v.id("stockProducts"),
    target: kanbanMoveTargetValidator,
    kanbanNote: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId)
    if (!product || product.userId !== args.userId) {
      throw new Error("Produto nao encontrado.")
    }

    const prevKanban = product.kanbanStatus ?? "planned"
    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)

    const notePatch = args.kanbanNote !== undefined ? { kanbanNote: args.kanbanNote } : {}
    const arrivalPatch =
      args.estimatedArrival !== undefined ? { estimatedArrival: args.estimatedArrival } : {}

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
    quantity: v.number(),
    unitCost: v.number(),
    supplier: v.string(),
    manualEntryDate: v.string(),
    location: manualLocationValidator,
    estimatedArrival: v.optional(v.string()),
    observations: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedName = args.name.trim()
    const supplier = args.supplier.trim()
    if (!normalizedName || !supplier) {
      throw new Error("Preencha nome e fornecedor.")
    }
    if (args.quantity < 0 || args.unitCost < 0) {
      throw new Error("Quantidade e custo devem ser zero ou positivos.")
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
      | "planned"
      | "buying"
      | "in_transit"
      | "awaiting_inspection"
      | "returned"
      | "completed"
      | "in_stock" = "planned"
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
    const sku = `MAN-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase()

    const productId = await ctx.db.insert("stockProducts", {
      userId: args.userId,
      name: normalizedName,
      sku,
      category: "Entrada manual",
      quantity: args.quantity,
      minStock: 0,
      unitCost: args.unitCost,
      unitCostSource: "manual",
      kanbanStatus,
      estimatedArrival: args.estimatedArrival,
      kanbanNote: args.observations,
      supplier,
      manualEntryDate: args.manualEntryDate,
      manualDedupeKey: dedupeKey,
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)
    let created = 0
    let updated = 0

    for (const listing of args.listings) {
      const normalizedSku = (listing.sku?.trim().toUpperCase() || listing.id).slice(0, 64)
      const nextQuantity = Math.max(0, Math.floor(listing.availableQuantity))

      const byMlItem = await ctx.db
        .query("stockProducts")
        .withIndex("by_user_ml_item", (queryBuilder) =>
          queryBuilder.eq("userId", args.userId).eq("mlItemId", listing.id),
        )
        .first()

      const bySku = byMlItem
        ? null
        : await ctx.db
            .query("stockProducts")
            .withIndex("by_user_sku", (queryBuilder) =>
              queryBuilder.eq("userId", args.userId).eq("sku", normalizedSku),
            )
            .first()

      const existing = byMlItem ?? bySku

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: listing.title,
          sku: existing.sku || normalizedSku,
          mlItemId: listing.id,
          imageUrl: listing.thumbnail,
          quantity: nextQuantity,
          sellingPrice: listing.price,
          kanbanStatus: "in_stock",
          updatedAt: now,
        })

        if (existing.quantity !== nextQuantity) {
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

      const productId = await ctx.db.insert("stockProducts", {
        userId: args.userId,
        name: listing.title,
        sku: normalizedSku,
        mlItemId: listing.id,
        imageUrl: listing.thumbnail,
        category: "Mercado Livre",
        quantity: nextQuantity,
        minStock: 0,
        unitCost: 0,
        sellingPrice: listing.price,
        kanbanStatus: "in_stock",
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
          note: "Importado do Mercado Livre",
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

    await ctx.db.delete(args.productId)
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
