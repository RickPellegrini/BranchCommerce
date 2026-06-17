import { v } from "convex/values"

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server"

import { upsertProductState } from "./branchNotifyDb"

export async function listWithStateData(ctx: QueryCtx, userId: string) {
  const prods = await ctx.db
    .query("products")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
  const withState = await Promise.all(
    prods.map(async (p) => {
      const st = await ctx.db
        .query("productState")
        .withIndex("by_user_sku", (q) => q.eq("userId", userId).eq("sku", p.sku))
        .first()
      return { product: p, state: st }
    }),
  )
  return withState
}

export const listWithState = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => listWithStateData(ctx, userId),
})

export const listWithStateInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => listWithStateData(ctx, userId),
})

export const add = mutation({
  args: {
    userId: v.string(),
    sku: v.string(),
    nome: v.string(),
    quantidade: v.number(),
    precoMaximo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sku = args.sku.trim()
    if (!/^\d{1,12}$/.test(sku)) {
      throw new Error("SKU: use apenas numeros (1 a 12 digitos).")
    }
    if (args.quantidade < 1 || args.quantidade > 99) {
      throw new Error("Quantidade entre 1 e 99.")
    }
    if (args.precoMaximo != null && args.precoMaximo < 0) {
      throw new Error("Preco maximo invalido.")
    }
    const existing = await ctx.db
      .query("products")
      .withIndex("by_user_sku", (q) => q.eq("userId", args.userId).eq("sku", sku))
      .first()
    if (existing) {
      throw new Error("Voce ja monitora este SKU.")
    }
    return ctx.db.insert("products", {
      userId: args.userId,
      sku,
      nome: args.nome.trim().slice(0, 200),
      quantidade: args.quantidade,
      precoMaximo: args.precoMaximo,
      ativo: true,
      createdAt: Date.now(),
    })
  },
})

export const setAtivo = mutation({
  args: { userId: v.string(), productId: v.id("products"), ativo: v.boolean() },
  handler: async (ctx, { userId, productId, ativo }) => {
    const p = await ctx.db.get(productId)
    if (!p || p.userId !== userId) {
      throw new Error("Produto nao encontrado.")
    }
    await ctx.db.patch(productId, { ativo })
  },
})

export const remove = mutation({
  args: { userId: v.string(), productId: v.id("products") },
  handler: async (ctx, { userId, productId }) => {
    const p = await ctx.db.get(productId)
    if (!p || p.userId !== userId) {
      throw new Error("Produto nao encontrado.")
    }
    const st = await ctx.db
      .query("productState")
      .withIndex("by_user_sku", (q) => q.eq("userId", userId).eq("sku", p.sku))
      .first()
    if (st) await ctx.db.delete(st._id)
    await ctx.db.delete(productId)
  },
})

export const listarTodosAtivos = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("products").collect()
    return all.filter((p) => p.ativo)
  },
})

export const getEstado = internalQuery({
  args: { userId: v.string(), sku: v.string() },
  handler: async (ctx, { userId, sku }) => {
    return ctx.db
      .query("productState")
      .withIndex("by_user_sku", (q) => q.eq("userId", userId).eq("sku", sku))
      .first()
  },
})

export const upsertEstado = internalMutation({
  args: {
    userId: v.string(),
    sku: v.string(),
    disponivel: v.boolean(),
    preco: v.number(),
    precoOriginal: v.number(),
    imagemUrl: v.optional(v.string()),
    link: v.optional(v.string()),
    nomeProduto: v.optional(v.string()),
    ultimaChecagem: v.number(),
  },
  handler: async (ctx, args) => {
    await upsertProductState(ctx, {
      userId: args.userId,
      sku: args.sku,
      disponivel: args.disponivel,
      preco: args.preco,
      precoOriginal: args.precoOriginal,
      imagemUrl: args.imagemUrl,
      link: args.link,
      nomeProduto: args.nomeProduto,
      ultimaChecagem: args.ultimaChecagem,
    })
  },
})
