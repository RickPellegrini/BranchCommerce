import { v } from "convex/values"

import { internalMutation, query } from "./_generated/server"

export const listRecent = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit = 50 }) => {
    const n = Math.min(100, Math.max(1, limit))
    return ctx.db
      .query("notifications")
      .withIndex("by_user_enviado", (q) => q.eq("userId", userId))
      .order("desc")
      .take(n)
  },
})

export const criar = internalMutation({
  args: {
    userId: v.string(),
    productId: v.id("products"),
    sku: v.string(),
    nome: v.string(),
    preco: v.number(),
    precoPix: v.number(),
    pixCode: v.string(),
    enviadoEm: v.number(),
    sucesso: v.boolean(),
    erro: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("notifications", args)
  },
})
