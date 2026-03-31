import { v } from "convex/values"

import { mutation, query } from "./_generated/server"

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

    return { products, movements }
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

    const timestamp = Date.now()
    const productId = await ctx.db.insert("stockProducts", {
      userId: args.userId,
      name: normalizedName,
      sku: normalizedSku,
      category: normalizedCategory,
      quantity: args.quantity,
      minStock: args.minStock,
      unitCost: args.unitCost,
      sellingPrice: args.sellingPrice,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    if (args.quantity > 0) {
      await ctx.db.insert("stockMovements", {
        userId: args.userId,
        productId,
        type: "in",
        quantity: args.quantity,
        date: new Date().toISOString().slice(0, 10),
        note: "Estoque inicial",
        createdAt: timestamp,
      })
    }

    return productId
  },
})

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

    await ctx.db.patch(args.productId, {
      name: normalizedName,
      sku: normalizedSku,
      category: normalizedCategory,
      quantity: args.quantity,
      minStock: args.minStock,
      unitCost: args.unitCost,
      sellingPrice: args.sellingPrice,
      updatedAt: Date.now(),
    })
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

    await ctx.db.delete(args.productId)
  },
})

export const addMovement = mutation({
  args: {
    userId: v.string(),
    productId: v.id("stockProducts"),
    type: v.union(
      v.literal("in"),
      v.literal("out"),
      v.literal("adjustment"),
      v.literal("sale"),
    ),
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
          category.kind === "income" &&
          category.name.toLowerCase() === "vendas de produtos",
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
