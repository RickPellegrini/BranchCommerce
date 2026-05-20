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

const mpMovementTypeValidator = v.union(v.literal("credit"), v.literal("debit"))

export const getLedger = query({
  args: {
    appUserId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const anchor = await ctx.db
      .query("mpBalanceAnchors")
      .withIndex("by_app_user", (queryBuilder) => queryBuilder.eq("appUserId", args.appUserId))
      .first()

    const movements = await ctx.db
      .query("mpAccountMovements")
      .withIndex("by_app_user", (queryBuilder) => queryBuilder.eq("appUserId", args.appUserId))
      .collect()

    const anchorDate = anchor?.anchoredAt ?? ""
    const movementsAfterAnchor = movements.filter((movement) =>
      anchorDate ? movement.date > anchorDate : true,
    )
    const movementNet = movementsAfterAnchor.reduce(
      (sum, movement) => sum + (movement.type === "credit" ? movement.amount : -movement.amount),
      0,
    )
    const availableBalance = anchor ? anchor.balance + movementNet : movementNet
    const recentLimit = Math.max(1, Math.min(args.limit ?? 100, 500))
    const recentMovements = [...movements]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, recentLimit)

    const lastSync = await ctx.db
      .query("mpReportSyncRuns")
      .withIndex("by_app_user", (queryBuilder) => queryBuilder.eq("appUserId", args.appUserId))
      .collect()

    return {
      anchor: anchor ?? null,
      balance: {
        availableBalance,
        unavailableBalance: 0,
        totalAmount: availableBalance,
        currencyId: anchor?.currencyId ?? "BRL",
      },
      movements: recentMovements,
      movementCount: movements.length,
      movementNet,
      lastSync: lastSync.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
    }
  },
})

export const setBalanceAnchor = mutation({
  args: {
    appUserId: v.string(),
    balance: v.number(),
    currencyId: v.string(),
    anchoredAt: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query("mpBalanceAnchors")
      .withIndex("by_app_user", (queryBuilder) => queryBuilder.eq("appUserId", args.appUserId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        balance: args.balance,
        currencyId: args.currencyId,
        anchoredAt: args.anchoredAt,
        note: args.note,
        updatedAt: now,
      })
      return existing._id
    }

    return ctx.db.insert("mpBalanceAnchors", {
      appUserId: args.appUserId,
      balance: args.balance,
      currencyId: args.currencyId,
      anchoredAt: args.anchoredAt,
      note: args.note,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const upsertReportMovements = mutation({
  args: {
    appUserId: v.string(),
    mpUserId: v.string(),
    fileName: v.string(),
    movements: v.array(
      v.object({
        movementKey: v.string(),
        sourceId: v.optional(v.string()),
        externalReference: v.optional(v.string()),
        date: v.string(),
        description: v.string(),
        amount: v.number(),
        type: mpMovementTypeValidator,
        status: v.string(),
        rawJson: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    let imported = 0
    let skipped = 0

    for (const movement of args.movements) {
      const existing = await ctx.db
        .query("mpAccountMovements")
        .withIndex("by_app_user_key", (queryBuilder) =>
          queryBuilder.eq("appUserId", args.appUserId).eq("movementKey", movement.movementKey),
        )
        .first()

      if (existing) {
        skipped += 1
        await ctx.db.patch(existing._id, {
          mpUserId: args.mpUserId,
          sourceId: movement.sourceId,
          externalReference: movement.externalReference,
          fileName: args.fileName,
          date: movement.date,
          description: movement.description,
          amount: movement.amount,
          type: movement.type,
          status: movement.status,
          rawJson: movement.rawJson,
          updatedAt: now,
        })
        continue
      }

      imported += 1
      await ctx.db.insert("mpAccountMovements", {
        appUserId: args.appUserId,
        mpUserId: args.mpUserId,
        movementKey: movement.movementKey,
        sourceId: movement.sourceId,
        externalReference: movement.externalReference,
        fileName: args.fileName,
        date: movement.date,
        description: movement.description,
        amount: movement.amount,
        type: movement.type,
        status: movement.status,
        rawJson: movement.rawJson,
        createdAt: now,
        updatedAt: now,
      })
    }

    await ctx.db.insert("mpReportSyncRuns", {
      appUserId: args.appUserId,
      status: "success",
      fileName: args.fileName,
      imported,
      skipped,
      createdAt: now,
    })

    return { imported, skipped }
  },
})

export const addReportSyncRun = mutation({
  args: {
    appUserId: v.string(),
    status: v.union(v.literal("success"), v.literal("pending"), v.literal("failed")),
    fileName: v.optional(v.string()),
    imported: v.number(),
    skipped: v.number(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("mpReportSyncRuns", {
      ...args,
      createdAt: Date.now(),
    })
  },
})
