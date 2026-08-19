import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, type MutationCtx } from "./_generated/server"

const RESERVATION_TTL_MS = 1000 * 60 * 20

const paymentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("expired"),
)

type CartItemWithProduct = {
  item: Doc<"storeCartItems">
  product: Doc<"storeProducts">
  stock: Doc<"stockProducts">
}

function requireStoreServerKey(serverKey: string) {
  const expected = process.env.STORE_SERVER_KEY ?? process.env.TOKEN_ENCRYPTION_KEY
  if (!expected) {
    if (process.env.NODE_ENV === "test" && serverKey === "test-store-server-key") return
    throw new Error("STORE_SERVER_KEY nao configurado no Convex.")
  }
  if (serverKey !== expected) {
    throw new Error("Chave server-side invalida para operacao da loja.")
  }
}

async function findCartByHash(ctx: MutationCtx, cartTokenHash: string) {
  const carts = await ctx.db
    .query("storeCarts")
    .withIndex("by_token", (q) => q.eq("cartTokenHash", cartTokenHash))
    .take(10)

  const now = Date.now()
  return (
    carts.find((cart) => cart.status === "active" && cart.expiresAt > now) ??
    carts.find((cart) => cart.status === "ordered") ??
    carts.find((cart) => cart.status === "active")
  )
}

async function activeReservedQuantity(
  ctx: MutationCtx,
  stockProductId: Id<"stockProducts">,
  now: number,
  excludingCartId?: Id<"storeCarts">,
) {
  const reservations = await ctx.db
    .query("storeInventoryReservations")
    .withIndex("by_stock_product_status", (q) =>
      q.eq("stockProductId", stockProductId).eq("status", "active"),
    )
    .take(200)

  return reservations.reduce((total, reservation) => {
    if (reservation.expiresAt <= now || reservation.cartId === excludingCartId) return total
    return total + reservation.quantity
  }, 0)
}

async function loadCartItems(ctx: MutationCtx, cartId: Id<"storeCarts">) {
  const items = await ctx.db
    .query("storeCartItems")
    .withIndex("by_cart", (q) => q.eq("cartId", cartId))
    .take(100)

  if (items.length === 0) throw new Error("Carrinho vazio.")

  const rows: CartItemWithProduct[] = []
  for (const item of items) {
    const product = await ctx.db.get(item.storeProductId)
    if (!product || product.status !== "published") {
      throw new Error("Carrinho contem produto indisponivel.")
    }
    const stock = await ctx.db.get(product.stockProductId)
    if (!stock) throw new Error("Produto de estoque nao encontrado.")
    rows.push({ item, product, stock })
  }

  return rows
}

async function calculateShipping(ctx: MutationCtx, args: { state: string; subtotal: number }) {
  const state = args.state.trim().toUpperCase()
  const stateRules = await ctx.db
    .query("storeShippingRules")
    .withIndex("by_state_status", (q) => q.eq("state", state).eq("status", "active"))
    .take(20)
  const genericRules = await ctx.db
    .query("storeShippingRules")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .take(50)

  const rules = [...stateRules, ...genericRules.filter((rule) => !rule.state)]
  const match = rules.find((rule) => {
    if (rule.minSubtotal !== undefined && args.subtotal < rule.minSubtotal) return false
    if (rule.maxSubtotal !== undefined && args.subtotal > rule.maxSubtotal) return false
    return true
  })

  if (match) {
    return {
      price: match.price,
      estimatedDaysMin: match.estimatedDaysMin,
      estimatedDaysMax: match.estimatedDaysMax,
    }
  }

  if (args.subtotal >= 299) {
    return { price: 0, estimatedDaysMin: 4, estimatedDaysMax: 8 }
  }

  return { price: state === "SP" ? 14.9 : 24.9, estimatedDaysMin: 5, estimatedDaysMax: 10 }
}

async function upsertCustomer(
  ctx: MutationCtx,
  args: { clerkUserId?: string; email: string; name: string; phone?: string },
) {
  const email = args.email.trim().toLowerCase()
  const now = Date.now()
  const byClerk = args.clerkUserId
    ? await ctx.db
        .query("storeCustomers")
        .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
        .first()
    : null
  const existing =
    byClerk ??
    (await ctx.db
      .query("storeCustomers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first())

  if (existing) {
    await ctx.db.patch(existing._id, {
      clerkUserId: args.clerkUserId ?? existing.clerkUserId,
      email,
      name: args.name.trim(),
      phone: args.phone?.trim() || existing.phone,
      updatedAt: now,
    })
    return existing._id
  }

  return await ctx.db.insert("storeCustomers", {
    clerkUserId: args.clerkUserId,
    email,
    name: args.name.trim(),
    phone: args.phone?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  })
}

async function ensureIncomeCategory(ctx: MutationCtx, userId: string) {
  const categories = await ctx.db
    .query("categories")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(100)
  const existing = categories.find(
    (category) =>
      category.kind === "income" && category.name.toLowerCase() === "vendas loja propria",
  )
  if (existing) return existing._id

  const now = Date.now()
  return await ctx.db.insert("categories", {
    userId,
    name: "Vendas loja propria",
    kind: "income",
    createdAt: now,
    updatedAt: now,
  })
}

async function getOrderItems(ctx: MutationCtx, orderId: Id<"storeOrders">) {
  return await ctx.db
    .query("storeOrderItems")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .take(100)
}

async function releaseActiveReservationsForCart(ctx: MutationCtx, cartId: Id<"storeCarts">) {
  const reservations = await ctx.db
    .query("storeInventoryReservations")
    .withIndex("by_cart", (q) => q.eq("cartId", cartId))
    .take(100)

  for (const reservation of reservations) {
    if (reservation.status === "active") {
      await ctx.db.patch(reservation._id, { status: "released" })
    }
  }
}

export const createPendingOrder = mutation({
  args: {
    cartTokenHash: v.string(),
    clerkUserId: v.optional(v.string()),
    customer: v.object({
      email: v.string(),
      name: v.string(),
      phone: v.optional(v.string()),
    }),
    shippingAddress: v.object({
      name: v.string(),
      phone: v.optional(v.string()),
      zipCode: v.string(),
      street: v.string(),
      number: v.string(),
      complement: v.optional(v.string()),
      district: v.string(),
      city: v.string(),
      state: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    if (!args.customer.email.includes("@")) throw new Error("Email invalido.")
    if (!args.customer.name.trim()) throw new Error("Nome obrigatorio.")

    const cart = await findCartByHash(ctx, args.cartTokenHash)
    if (!cart) throw new Error("Carrinho nao encontrado.")

    const existingOrder = await ctx.db
      .query("storeOrders")
      .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
      .first()
    if (existingOrder && existingOrder.paymentStatus === "pending") {
      const items = await getOrderItems(ctx, existingOrder._id)
      return { order: existingOrder, items, reused: true }
    }

    const items = await loadCartItems(ctx, cart._id)
    const now = Date.now()
    for (const row of items) {
      const reserved = await activeReservedQuantity(ctx, row.stock._id, now, cart._id)
      const available = Math.max(0, row.stock.quantity - reserved)
      if (row.item.quantity > available) {
        throw new Error(`Estoque insuficiente para ${row.product.title}.`)
      }
    }

    await releaseActiveReservationsForCart(ctx, cart._id)

    const subtotal = items.reduce((total, row) => total + row.item.quantity * row.product.price, 0)
    const shipping = await calculateShipping(ctx, {
      state: args.shippingAddress.state,
      subtotal,
    })
    const discountTotal = 0
    const grandTotal = subtotal + shipping.price - discountTotal
    const customerId = await upsertCustomer(ctx, {
      clerkUserId: args.clerkUserId,
      email: args.customer.email,
      name: args.customer.name,
      phone: args.customer.phone,
    })
    const shippingAddressId = await ctx.db.insert("storeAddresses", {
      customerId,
      name: args.shippingAddress.name.trim() || args.customer.name.trim(),
      phone: args.shippingAddress.phone?.trim() || args.customer.phone?.trim() || undefined,
      zipCode: args.shippingAddress.zipCode.trim(),
      street: args.shippingAddress.street.trim(),
      number: args.shippingAddress.number.trim(),
      complement: args.shippingAddress.complement?.trim() || undefined,
      district: args.shippingAddress.district.trim(),
      city: args.shippingAddress.city.trim(),
      state: args.shippingAddress.state.trim().toUpperCase(),
    })

    const orderNumber = `BC-${now.toString(36).toUpperCase()}-${String(cart._id).slice(-6).toUpperCase()}`
    const orderId = await ctx.db.insert("storeOrders", {
      orderNumber,
      cartId: cart._id,
      customerId,
      clerkUserId: args.clerkUserId,
      email: args.customer.email.trim().toLowerCase(),
      status: "pending",
      paymentStatus: "pending",
      fulfillmentStatus: "reserved",
      subtotal,
      shippingTotal: shipping.price,
      discountTotal,
      grandTotal,
      shippingAddressId,
      createdAt: now,
      updatedAt: now,
    })

    const orderItems = []
    const expiresAt = now + RESERVATION_TTL_MS
    for (const row of items) {
      const total = row.item.quantity * row.product.price
      const orderItemId = await ctx.db.insert("storeOrderItems", {
        orderId,
        storeProductId: row.product._id,
        stockProductId: row.stock._id,
        titleSnapshot: row.product.title,
        skuSnapshot: row.stock.sku,
        quantity: row.item.quantity,
        unitPrice: row.product.price,
        total,
      })
      await ctx.db.insert("storeInventoryReservations", {
        orderId,
        cartId: cart._id,
        stockProductId: row.stock._id,
        quantity: row.item.quantity,
        status: "active",
        expiresAt,
        createdAt: now,
      })
      const orderItem = await ctx.db.get(orderItemId)
      if (orderItem) orderItems.push(orderItem)
    }

    await ctx.db.patch(cart._id, {
      status: "ordered",
      customerEmail: args.customer.email.trim().toLowerCase(),
      updatedAt: now,
    })

    const order = await ctx.db.get(orderId)
    return { order, items: orderItems, shipping, reused: false }
  },
})

export const attachPaymentPreference = mutation({
  args: {
    serverKey: v.string(),
    orderId: v.id("storeOrders"),
    mpPreferenceId: v.string(),
  },
  handler: async (ctx, args) => {
    requireStoreServerKey(args.serverKey)
    const order = await ctx.db.get(args.orderId)
    if (!order) throw new Error("Pedido nao encontrado.")
    await ctx.db.patch(order._id, {
      mpPreferenceId: args.mpPreferenceId,
      updatedAt: Date.now(),
    })
    return { ok: true }
  },
})

export const applyMercadoPagoPayment = mutation({
  args: {
    serverKey: v.string(),
    orderNumber: v.optional(v.string()),
    mpPreferenceId: v.optional(v.string()),
    mpPaymentId: v.string(),
    status: paymentStatusValidator,
    rawStatus: v.optional(v.string()),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    requireStoreServerKey(args.serverKey)
    const existingAttempt = await ctx.db
      .query("storePaymentAttempts")
      .withIndex("by_provider_payment", (q) =>
        q.eq("provider", "mercado_pago").eq("providerPaymentId", args.mpPaymentId),
      )
      .first()

    if (existingAttempt?.status === "paid") {
      return { ok: true, idempotent: true, orderId: existingAttempt.orderId }
    }

    const order = args.orderNumber
      ? await ctx.db
          .query("storeOrders")
          .withIndex("by_order_number", (q) => q.eq("orderNumber", args.orderNumber!))
          .first()
      : args.mpPreferenceId
        ? await ctx.db
            .query("storeOrders")
            .withIndex("by_payment", (q) => q.eq("mpPreferenceId", args.mpPreferenceId!))
            .first()
        : null

    if (!order) throw new Error("Pedido nao encontrado para o pagamento.")

    const now = Date.now()
    if (existingAttempt) {
      await ctx.db.patch(existingAttempt._id, {
        status: args.status,
        amount: args.amount,
        rawStatus: args.rawStatus,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert("storePaymentAttempts", {
        orderId: order._id,
        provider: "mercado_pago",
        providerPreferenceId: args.mpPreferenceId ?? order.mpPreferenceId,
        providerPaymentId: args.mpPaymentId,
        status: args.status,
        amount: args.amount,
        rawStatus: args.rawStatus,
        createdAt: now,
        updatedAt: now,
      })
    }

    if (order.paymentStatus === "paid") {
      return { ok: true, idempotent: true, orderId: order._id }
    }

    if (args.status !== "paid") {
      const orderStatus =
        args.status === "expired"
          ? "payment_expired"
          : args.status === "cancelled"
            ? "cancelled"
            : order.status
      if (args.status === "expired" || args.status === "cancelled" || args.status === "failed") {
        const reservations = await ctx.db
          .query("storeInventoryReservations")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .take(100)
        for (const reservation of reservations) {
          if (reservation.status === "active") {
            await ctx.db.patch(reservation._id, { status: "released" })
          }
        }
      }
      await ctx.db.patch(order._id, {
        status: orderStatus,
        paymentStatus: args.status,
        fulfillmentStatus: orderStatus === "cancelled" ? "cancelled" : order.fulfillmentStatus,
        mpPaymentId: args.mpPaymentId,
        updatedAt: now,
      })
      return { ok: true, idempotent: false, orderId: order._id }
    }

    const orderItems = await getOrderItems(ctx, order._id)
    const reservations = await ctx.db
      .query("storeInventoryReservations")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .take(100)

    for (const reservation of reservations) {
      if (reservation.status === "active") {
        await ctx.db.patch(reservation._id, { status: "consumed" })
      }
    }

    const userIds = new Set<string>()
    for (const item of orderItems) {
      const stock = await ctx.db.get(item.stockProductId)
      if (!stock) continue
      userIds.add(stock.userId)
      await ctx.db.patch(stock._id, {
        quantity: Math.max(0, stock.quantity - item.quantity),
        updatedAt: now,
      })
      await ctx.db.insert("stockMovements", {
        userId: stock.userId,
        productId: stock._id,
        type: "sale",
        quantity: item.quantity,
        date: new Date(now).toISOString().slice(0, 10),
        unitPrice: item.unitPrice,
        note: `Pedido loja ${order.orderNumber}`,
        externalSource: "store",
        externalOrderId: order.orderNumber,
        externalItemId: String(item._id),
        createdAt: now,
      })
    }

    const firstUserId = [...userIds][0]
    if (firstUserId) {
      const categoryId = await ensureIncomeCategory(ctx, firstUserId)
      const existingTransaction = await ctx.db
        .query("transactions")
        .withIndex("by_user_external_order_item", (q) =>
          q
            .eq("userId", firstUserId)
            .eq("externalOrderId", order.orderNumber)
            .eq("externalItemId", "order"),
        )
        .first()
      if (!existingTransaction) {
        await ctx.db.insert("transactions", {
          userId: firstUserId,
          kind: "income",
          amount: order.grandTotal,
          date: new Date(now).toISOString().slice(0, 10),
          description: `Receita loja propria ${order.orderNumber}`,
          categoryId,
          origin: "Loja propria",
          createdAt: now,
          paymentMethod: "credit",
          payStatus: "paid",
          externalSource: "store",
          externalOrderId: order.orderNumber,
          externalItemId: "order",
        })
      }
    }

    await ctx.db.patch(order._id, {
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "processing",
      mpPaymentId: args.mpPaymentId,
      updatedAt: now,
    })

    return { ok: true, idempotent: false, orderId: order._id }
  },
})
