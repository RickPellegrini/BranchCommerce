import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"

const CART_TTL_MS = 1000 * 60 * 60 * 24 * 14

async function getActiveCartByHash(
  ctx: QueryCtx | MutationCtx,
  cartTokenHash: string,
  now = Date.now(),
) {
  const carts = await ctx.db
    .query("storeCarts")
    .withIndex("by_token", (q) => q.eq("cartTokenHash", cartTokenHash))
    .take(10)

  return (
    carts.find((cart) => cart.status === "active" && cart.expiresAt > now) ??
    carts.find((cart) => cart.status === "active")
  )
}

async function ensureActiveCart(
  ctx: MutationCtx,
  args: { cartTokenHash: string; clerkUserId?: string; customerEmail?: string },
) {
  const now = Date.now()
  const existing = await getActiveCartByHash(ctx, args.cartTokenHash, now)
  if (existing) {
    await ctx.db.patch(existing._id, {
      clerkUserId: args.clerkUserId ?? existing.clerkUserId,
      customerEmail: args.customerEmail ?? existing.customerEmail,
      expiresAt: now + CART_TTL_MS,
      updatedAt: now,
    })
    return existing._id
  }

  return await ctx.db.insert("storeCarts", {
    cartTokenHash: args.cartTokenHash,
    clerkUserId: args.clerkUserId,
    customerEmail: args.customerEmail,
    status: "active",
    expiresAt: now + CART_TTL_MS,
    createdAt: now,
    updatedAt: now,
  })
}

async function activeReservedQuantity(
  ctx: QueryCtx | MutationCtx,
  stockProductId: Id<"stockProducts">,
  now: number,
) {
  const reservations = await ctx.db
    .query("storeInventoryReservations")
    .withIndex("by_stock_product_status", (q) =>
      q.eq("stockProductId", stockProductId).eq("status", "active"),
    )
    .take(200)

  return reservations.reduce((total, reservation) => {
    if (reservation.expiresAt <= now) return total
    return total + reservation.quantity
  }, 0)
}

async function getPublicProductForCart(
  ctx: QueryCtx | MutationCtx,
  storeProductId: Id<"storeProducts">,
) {
  const storeProduct = await ctx.db.get(storeProductId)
  if (!storeProduct || storeProduct.status !== "published") {
    throw new Error("Produto indisponivel para compra.")
  }
  const stockProduct = await ctx.db.get(storeProduct.stockProductId)
  if (!stockProduct) throw new Error("Produto de estoque nao encontrado.")

  const image = await ctx.db
    .query("storeProductImages")
    .withIndex("by_product", (q) => q.eq("storeProductId", storeProductId))
    .order("asc")
    .first()

  const reserved = await activeReservedQuantity(ctx, storeProduct.stockProductId, Date.now())
  const availableQuantity = Math.max(0, stockProduct.quantity - reserved)

  return {
    storeProduct,
    stockProduct,
    publicProduct: {
      _id: storeProduct._id,
      slug: storeProduct.slug,
      title: storeProduct.title,
      subtitle: storeProduct.subtitle,
      price: storeProduct.price,
      compareAtPrice: storeProduct.compareAtPrice,
      sku: stockProduct.sku,
      imageUrl: image?.url ?? stockProduct.imageUrl,
      availableQuantity,
      inStock: availableQuantity > 0,
    },
  }
}

async function getCartPayload(ctx: QueryCtx | MutationCtx, cart: Doc<"storeCarts"> | null) {
  if (!cart) {
    return {
      cart: null,
      items: [],
      subtotal: 0,
      itemCount: 0,
      expiresAt: null,
    }
  }

  const items = await ctx.db
    .query("storeCartItems")
    .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
    .take(100)

  const publicItems = []
  for (const item of items) {
    try {
      const product = await getPublicProductForCart(ctx, item.storeProductId)
      publicItems.push({
        _id: item._id,
        storeProductId: item.storeProductId,
        quantity: item.quantity,
        unitPriceSnapshot: item.unitPriceSnapshot,
        lineTotal: item.quantity * item.unitPriceSnapshot,
        product: product.publicProduct,
      })
    } catch {
      publicItems.push({
        _id: item._id,
        storeProductId: item.storeProductId,
        quantity: item.quantity,
        unitPriceSnapshot: item.unitPriceSnapshot,
        lineTotal: item.quantity * item.unitPriceSnapshot,
        product: null,
      })
    }
  }

  return {
    cart: {
      _id: cart._id,
      status: cart.status,
      customerEmail: cart.customerEmail,
    },
    items: publicItems,
    subtotal: publicItems.reduce((total, item) => total + item.lineTotal, 0),
    itemCount: publicItems.reduce((total, item) => total + item.quantity, 0),
    expiresAt: cart.expiresAt,
  }
}

export const getCart = query({
  args: {
    cartTokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const cart = await getActiveCartByHash(ctx, args.cartTokenHash)
    return await getCartPayload(ctx, cart ?? null)
  },
})

export const ensureCart = mutation({
  args: {
    cartTokenHash: v.string(),
    clerkUserId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cartId = await ensureActiveCart(ctx, args)
    const cart = await ctx.db.get(cartId)
    return await getCartPayload(ctx, cart)
  },
})

export const addItem = mutation({
  args: {
    cartTokenHash: v.string(),
    clerkUserId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    storeProductId: v.id("storeProducts"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const quantity = Math.floor(args.quantity)
    if (quantity <= 0) throw new Error("Quantidade invalida.")

    const cartId = await ensureActiveCart(ctx, args)
    const product = await getPublicProductForCart(ctx, args.storeProductId)
    const existingItem = await ctx.db
      .query("storeCartItems")
      .withIndex("by_cart_product", (q) =>
        q.eq("cartId", cartId).eq("storeProductId", args.storeProductId),
      )
      .first()

    const nextQuantity = (existingItem?.quantity ?? 0) + quantity
    if (nextQuantity > product.publicProduct.availableQuantity) {
      throw new Error("Quantidade maior que o estoque disponivel.")
    }

    if (existingItem) {
      await ctx.db.patch(existingItem._id, {
        quantity: nextQuantity,
        unitPriceSnapshot: product.storeProduct.price,
      })
    } else {
      await ctx.db.insert("storeCartItems", {
        cartId,
        storeProductId: args.storeProductId,
        quantity,
        unitPriceSnapshot: product.storeProduct.price,
      })
    }

    await ctx.db.patch(cartId, { updatedAt: Date.now() })
    const cart = await ctx.db.get(cartId)
    return await getCartPayload(ctx, cart)
  },
})

export const updateItem = mutation({
  args: {
    cartTokenHash: v.string(),
    storeProductId: v.id("storeProducts"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const cart = await getActiveCartByHash(ctx, args.cartTokenHash)
    if (!cart) throw new Error("Carrinho nao encontrado.")

    const item = await ctx.db
      .query("storeCartItems")
      .withIndex("by_cart_product", (q) =>
        q.eq("cartId", cart._id).eq("storeProductId", args.storeProductId),
      )
      .first()
    if (!item) throw new Error("Item nao encontrado.")

    const quantity = Math.floor(args.quantity)
    if (quantity <= 0) {
      await ctx.db.delete(item._id)
    } else {
      const product = await getPublicProductForCart(ctx, args.storeProductId)
      if (quantity > product.publicProduct.availableQuantity) {
        throw new Error("Quantidade maior que o estoque disponivel.")
      }
      await ctx.db.patch(item._id, {
        quantity,
        unitPriceSnapshot: product.storeProduct.price,
      })
    }

    await ctx.db.patch(cart._id, { updatedAt: Date.now() })
    const updatedCart = await ctx.db.get(cart._id)
    return await getCartPayload(ctx, updatedCart)
  },
})

export const removeItem = mutation({
  args: {
    cartTokenHash: v.string(),
    storeProductId: v.id("storeProducts"),
  },
  handler: async (ctx, args) => {
    const cart = await getActiveCartByHash(ctx, args.cartTokenHash)
    if (!cart) return await getCartPayload(ctx, null)

    const item = await ctx.db
      .query("storeCartItems")
      .withIndex("by_cart_product", (q) =>
        q.eq("cartId", cart._id).eq("storeProductId", args.storeProductId),
      )
      .first()
    if (item) await ctx.db.delete(item._id)

    await ctx.db.patch(cart._id, { updatedAt: Date.now() })
    const updatedCart = await ctx.db.get(cart._id)
    return await getCartPayload(ctx, updatedCart)
  },
})
