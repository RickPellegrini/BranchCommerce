import type { Id } from "./_generated/dataModel"
import { internalMutation, type MutationCtx } from "./_generated/server"

async function releaseExpiredReservations(ctx: MutationCtx) {
  const now = Date.now()
  const expired = await ctx.db
    .query("storeInventoryReservations")
    .withIndex("by_status_expires", (q) => q.eq("status", "active").lt("expiresAt", now))
    .take(200)

  const touchedOrders = new Set<Id<"storeOrders">>()
  for (const reservation of expired) {
    await ctx.db.patch(reservation._id, { status: "expired" })
    if (reservation.orderId) touchedOrders.add(reservation.orderId)
  }

  for (const orderId of touchedOrders) {
    const order = await ctx.db.get(orderId)
    if (order && order.paymentStatus === "pending") {
      await ctx.db.patch(order._id, {
        status: "payment_expired",
        paymentStatus: "expired",
        fulfillmentStatus: "cancelled",
        updatedAt: now,
      })
    }
  }

  return { released: expired.length }
}

export const releaseExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await releaseExpiredReservations(ctx)
  },
})
