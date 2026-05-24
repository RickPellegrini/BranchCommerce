import { v } from "convex/values"

import { mutation, query } from "./_generated/server"

const resolvedInputTypeValidator = v.union(v.literal("catalog_product"), v.literal("item"))
const primaryItemSourceValidator = v.union(
  v.literal("real_item"),
  v.literal("synthetic_catalog_item"),
)
const analysisStatusValidator = v.union(
  v.literal("success"),
  v.literal("partial"),
  v.literal("no_competitors"),
  v.literal("not_catalog"),
)

export const addSnapshot = mutation({
  args: {
    userId: v.string(),
    receivedId: v.string(),
    itemId: v.string(),
    title: v.string(),
    catalogProductId: v.optional(v.string()),
    resolvedInputType: resolvedInputTypeValidator,
    primaryItemSource: primaryItemSourceValidator,
    analysisStatus: analysisStatusValidator,
    price: v.number(),
    minPrice: v.optional(v.number()),
    avgPrice: v.optional(v.number()),
    buyBoxWinnerItemId: v.optional(v.string()),
    buyBoxConfirmed: v.boolean(),
    competitorCount: v.number(),
    stockFoundCount: v.number(),
    stockTotalCount: v.number(),
    totalMs: v.number(),
    dataSourcesJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userId.trim()) throw new Error("Usuario nao autenticado.")
    if (!args.receivedId.trim()) throw new Error("ID analisado invalido.")
    if (!args.itemId.trim()) throw new Error("Item analisado invalido.")

    return await ctx.db.insert("productAnalysisSnapshots", {
      ...args,
      catalogProductId: args.catalogProductId?.trim() || undefined,
      buyBoxWinnerItemId: args.buyBoxWinnerItemId?.trim() || undefined,
      dataSourcesJson: args.dataSourcesJson?.trim() || undefined,
      createdAt: Date.now(),
    })
  },
})

export const listRecentSnapshots = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.userId.trim()) return []
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
    const rows = await ctx.db
      .query("productAnalysisSnapshots")
      .withIndex("by_user_created_at", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit)
    return rows
  },
})
