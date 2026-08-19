import { v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { query, type QueryCtx } from "./_generated/server"

async function listOrderItems(ctx: QueryCtx, orderId: Id<"storeOrders">) {
  return await ctx.db
    .query("storeOrderItems")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .take(100)
}

async function toPublicOrder(ctx: QueryCtx, orderId: Id<"storeOrders">) {
  const order = await ctx.db.get(orderId)
  if (!order) return null
  const items = await listOrderItems(ctx, order._id)
  const address = await ctx.db.get(order.shippingAddressId)

  return {
    order: {
      orderNumber: order.orderNumber,
      email: order.email,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      subtotal: order.subtotal,
      shippingTotal: order.shippingTotal,
      discountTotal: order.discountTotal,
      grandTotal: order.grandTotal,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
    items: items.map((item) => ({
      title: item.titleSnapshot,
      sku: item.skuSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    shippingAddress: address
      ? {
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
        }
      : null,
  }
}

export const getPublicOrderStatus = query({
  args: {
    orderNumber: v.string(),
    cartTokenHash: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("storeOrders")
      .withIndex("by_order_number", (q) => q.eq("orderNumber", args.orderNumber))
      .first()
    if (!order) return null

    const cart = await ctx.db.get(order.cartId)
    const emailMatches = args.email?.trim().toLowerCase() === order.email
    const tokenMatches = args.cartTokenHash && cart?.cartTokenHash === args.cartTokenHash
    if (!emailMatches && !tokenMatches) return null

    return await toPublicOrder(ctx, order._id)
  },
})

export const listCustomerOrders = query({
  args: {
    clerkUserId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
    const orders = await ctx.db
      .query("storeOrders")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .order("desc")
      .take(limit)

    const payload = []
    for (const order of orders) {
      const publicOrder = await toPublicOrder(ctx, order._id)
      if (publicOrder) payload.push(publicOrder)
    }
    return payload
  },
})

export const listAdminOrders = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100)
    const statuses = ["pending", "confirmed", "cancelled", "payment_expired"] as const
    const rows = []

    for (const status of statuses) {
      const orders = await ctx.db
        .query("storeOrders")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(limit)
      for (const order of orders) {
        const items = await listOrderItems(ctx, order._id)
        let belongsToUser = false
        for (const item of items) {
          const stock = await ctx.db.get(item.stockProductId)
          if (stock?.userId === args.userId) {
            belongsToUser = true
            break
          }
        }
        if (!belongsToUser) continue
        rows.push({
          order,
          items,
        })
      }
    }

    return rows.sort((a, b) => b.order.createdAt - a.order.createdAt).slice(0, limit)
  },
})
