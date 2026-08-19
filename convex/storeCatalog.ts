import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"

const productStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
)

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function listImages(ctx: QueryCtx, storeProductId: Id<"storeProducts">) {
  return await ctx.db
    .query("storeProductImages")
    .withIndex("by_product", (q) => q.eq("storeProductId", storeProductId))
    .order("asc")
    .take(12)
}

async function activeReservedQuantity(
  ctx: QueryCtx,
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

async function toPublicProduct(ctx: QueryCtx, product: Doc<"storeProducts">) {
  const stock = await ctx.db.get(product.stockProductId)
  if (!stock) return null

  const now = Date.now()
  const images = await listImages(ctx, product._id)
  const reserved = await activeReservedQuantity(ctx, product.stockProductId, now)
  const availableQuantity = Math.max(0, stock.quantity - reserved)

  return {
    _id: product._id,
    slug: product.slug,
    title: product.title,
    subtitle: product.subtitle,
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    featured: product.featured,
    publishedAt: product.publishedAt,
    sortOrder: product.sortOrder,
    sku: stock.sku,
    imageUrl: images[0]?.url ?? stock.imageUrl,
    images,
    availableQuantity,
    inStock: availableQuantity > 0,
  }
}

export const listPublishedProducts = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    featuredOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 24, 1), 60)
    const products = await ctx.db
      .query("storeProducts")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("asc")
      .take(limit)

    const publicProducts = []
    for (const product of products) {
      if (args.featuredOnly && !product.featured) continue
      const publicProduct = await toPublicProduct(ctx, product)
      if (publicProduct) publicProducts.push(publicProduct)
    }

    publicProducts.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
    return { products: publicProducts, nextCursor: null }
  },
})

export const listPublishedCategories = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 24, 1), 100)
    return await ctx.db
      .query("storeCategories")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("asc")
      .take(limit)
  },
})

export const getProductBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("storeProducts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()

    if (!product || product.status !== "published") return null
    return await toPublicProduct(ctx, product)
  },
})

export const listProductsByCategory = query({
  args: {
    slug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db
      .query("storeCategories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()

    if (!category || category.status !== "published") {
      return { category: null, products: [] }
    }

    const links = await ctx.db
      .query("storeProductCategories")
      .withIndex("by_category", (q) => q.eq("categoryId", category._id))
      .take(Math.min(Math.max(args.limit ?? 24, 1), 60))

    const products = []
    for (const link of links) {
      const product = await ctx.db.get(link.storeProductId)
      if (!product || product.status !== "published") continue
      const publicProduct = await toPublicProduct(ctx, product)
      if (publicProduct) products.push(publicProduct)
    }

    products.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
    return { category, products }
  },
})

export const listAdminProducts = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stockProducts = await ctx.db
      .query("stockProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(Math.min(Math.max(args.limit ?? 100, 1), 200))

    const rows = []
    for (const stockProduct of stockProducts) {
      const storeProduct = await ctx.db
        .query("storeProducts")
        .withIndex("by_stock_product", (q) => q.eq("stockProductId", stockProduct._id))
        .first()
      const images = storeProduct ? await listImages(ctx, storeProduct._id) : []
      rows.push({
        stockProduct: {
          _id: stockProduct._id,
          name: stockProduct.name,
          sku: stockProduct.sku,
          imageUrl: stockProduct.imageUrl,
          quantity: stockProduct.quantity,
          sellingPrice: stockProduct.sellingPrice,
          category: stockProduct.category,
        },
        storeProduct,
        images,
      })
    }

    return rows
  },
})

export const upsertStoreProduct = mutation({
  args: {
    userId: v.string(),
    stockProductId: v.id("stockProducts"),
    storeProductId: v.optional(v.id("storeProducts")),
    slug: v.optional(v.string()),
    title: v.string(),
    subtitle: v.optional(v.string()),
    description: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    price: v.number(),
    compareAtPrice: v.optional(v.number()),
    status: productStatusValidator,
    featured: v.boolean(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stockProduct = await ctx.db.get(args.stockProductId)
    if (!stockProduct || stockProduct.userId !== args.userId) {
      throw new Error("Produto de estoque nao encontrado.")
    }
    if (!args.title.trim()) throw new Error("Titulo obrigatorio.")
    if (!Number.isFinite(args.price) || args.price <= 0) {
      throw new Error("Preco publico deve ser maior que zero.")
    }

    const slug = slugify(args.slug ?? args.title)
    if (!slug) throw new Error("Slug invalido.")

    const bySlug = await ctx.db
      .query("storeProducts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first()
    if (bySlug && bySlug._id !== args.storeProductId) {
      throw new Error("Slug ja usado por outro produto da loja.")
    }

    const byStock = await ctx.db
      .query("storeProducts")
      .withIndex("by_stock_product", (q) => q.eq("stockProductId", args.stockProductId))
      .first()

    const storeProductId = args.storeProductId ?? byStock?._id
    const now = Date.now()
    const payload = {
      stockProductId: args.stockProductId,
      slug,
      title: args.title.trim(),
      subtitle: args.subtitle?.trim() || undefined,
      description: args.description?.trim() || undefined,
      seoTitle: args.seoTitle?.trim() || undefined,
      seoDescription: args.seoDescription?.trim() || undefined,
      price: args.price,
      compareAtPrice: args.compareAtPrice,
      status: args.status,
      publishedAt: args.status === "published" ? (byStock?.publishedAt ?? now) : undefined,
      featured: args.featured,
      sortOrder: args.sortOrder ?? byStock?.sortOrder ?? 1000,
      updatedAt: now,
    }

    if (storeProductId) {
      const current = await ctx.db.get(storeProductId)
      if (!current || current.stockProductId !== args.stockProductId) {
        throw new Error("Produto comercial nao encontrado.")
      }
      await ctx.db.patch(storeProductId, payload)
      return storeProductId
    }

    return await ctx.db.insert("storeProducts", {
      ...payload,
      createdAt: now,
    })
  },
})

export const replaceProductImages = mutation({
  args: {
    userId: v.string(),
    storeProductId: v.id("storeProducts"),
    images: v.array(
      v.object({
        url: v.string(),
        alt: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.storeProductId)
    if (!product) throw new Error("Produto comercial nao encontrado.")
    const stockProduct = await ctx.db.get(product.stockProductId)
    if (!stockProduct || stockProduct.userId !== args.userId) {
      throw new Error("Produto de estoque nao encontrado.")
    }

    const existing = await ctx.db
      .query("storeProductImages")
      .withIndex("by_product", (q) => q.eq("storeProductId", args.storeProductId))
      .take(50)
    for (const image of existing) {
      await ctx.db.delete(image._id)
    }

    const cleanImages = args.images
      .map((image) => ({
        url: image.url.trim(),
        alt: image.alt?.trim() || product.title,
      }))
      .filter((image) => image.url.length > 0)
      .slice(0, 12)

    for (const [index, image] of cleanImages.entries()) {
      await ctx.db.insert("storeProductImages", {
        storeProductId: args.storeProductId,
        url: image.url,
        alt: image.alt,
        sortOrder: index,
      })
    }

    await ctx.db.patch(args.storeProductId, { updatedAt: Date.now() })
    return { count: cleanImages.length }
  },
})

export const upsertCategory = mutation({
  args: {
    userId: v.string(),
    slug: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    status: productStatusValidator,
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.userId.trim()) throw new Error("Usuario obrigatorio.")
    const slug = slugify(args.slug ?? args.name)
    if (!slug || !args.name.trim()) throw new Error("Categoria invalida.")

    const existing = await ctx.db
      .query("storeCategories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first()

    const payload = {
      slug,
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      status: args.status,
      sortOrder: args.sortOrder ?? existing?.sortOrder ?? 1000,
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert("storeCategories", payload)
  },
})
