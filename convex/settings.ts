import { v } from "convex/values"

import { internalQuery, mutation, query } from "./_generated/server"

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("notifySettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()
  },
})

export const getByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("notifySettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()
  },
})

export const upsert = mutation({
  args: {
    userId: v.string(),
    telegramEnabled: v.boolean(),
    telegramChatId: v.optional(v.string()),
    pixChave: v.optional(v.string()),
    pixNome: v.optional(v.string()),
    pixCidade: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("notifySettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first()
    const row = {
      userId: args.userId,
      telegramEnabled: args.telegramEnabled,
      telegramChatId: args.telegramChatId,
      pixChave: args.pixChave,
      pixNome: args.pixNome,
      pixCidade: args.pixCidade,
    }
    if (existing) {
      await ctx.db.patch(existing._id, row)
      return existing._id
    }
    return ctx.db.insert("notifySettings", row)
  },
})
