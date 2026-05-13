import { v } from "convex/values"

import { mutation, query } from "./_generated/server"

export const getConnectionByAppUser = query({
  args: {
    appUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("mercadoPagoAccounts")
      .withIndex("by_app_user", (queryBuilder) => queryBuilder.eq("appUserId", args.appUserId))
      .first()
  },
})

export const getConnectionByMpUser = query({
  args: {
    mpUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("mercadoPagoAccounts")
      .withIndex("by_mp_user", (queryBuilder) => queryBuilder.eq("mpUserId", args.mpUserId))
      .first()
  },
})

export const upsertConnection = mutation({
  args: {
    appUserId: v.string(),
    mpUserId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenType: v.optional(v.string()),
    scope: v.optional(v.string()),
    publicKey: v.optional(v.string()),
    liveMode: v.optional(v.boolean()),
    expiresIn: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query("mercadoPagoAccounts")
      .withIndex("by_app_user", (queryBuilder) => queryBuilder.eq("appUserId", args.appUserId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        mpUserId: args.mpUserId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenType: args.tokenType,
        scope: args.scope,
        publicKey: args.publicKey,
        liveMode: args.liveMode,
        expiresIn: args.expiresIn,
        expiresAt: args.expiresAt,
        updatedAt: now,
      })
      return existing._id
    }

    return ctx.db.insert("mercadoPagoAccounts", {
      appUserId: args.appUserId,
      mpUserId: args.mpUserId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenType: args.tokenType,
      scope: args.scope,
      publicKey: args.publicKey,
      liveMode: args.liveMode,
      expiresIn: args.expiresIn,
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updateTokens = mutation({
  args: {
    appUserId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenType: v.optional(v.string()),
    scope: v.optional(v.string()),
    expiresIn: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mercadoPagoAccounts")
      .withIndex("by_app_user", (queryBuilder) => queryBuilder.eq("appUserId", args.appUserId))
      .first()

    if (!existing) {
      throw new Error("Conta do Mercado Pago nao conectada.")
    }

    await ctx.db.patch(existing._id, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenType: args.tokenType,
      scope: args.scope,
      expiresIn: args.expiresIn,
      expiresAt: args.expiresAt,
      updatedAt: Date.now(),
    })
  },
})

export const disconnectConnection = mutation({
  args: {
    appUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mercadoPagoAccounts")
      .withIndex("by_app_user", (queryBuilder) => queryBuilder.eq("appUserId", args.appUserId))
      .first()

    if (!existing) {
      return { removed: false }
    }

    await ctx.db.delete(existing._id)
    return { removed: true }
  },
})
