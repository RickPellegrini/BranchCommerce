import type { MutationCtx } from "./_generated/server"

export type UpsertProductStateArgs = {
  userId: string
  sku: string
  disponivel: boolean
  preco: number
  precoOriginal: number
  imagemUrl: string | undefined
  link: string | undefined
  nomeProduto: string | undefined
  ultimaChecagem: number
}

export async function upsertProductState(
  ctx: MutationCtx,
  {
    userId,
    sku,
    disponivel,
    preco,
    precoOriginal,
    imagemUrl,
    link,
    nomeProduto,
    ultimaChecagem,
  }: UpsertProductStateArgs,
) {
  const existing = await ctx.db
    .query("productState")
    .withIndex("by_user_sku", (q) => q.eq("userId", userId).eq("sku", sku))
    .first()
  const row = {
    userId,
    sku,
    disponivel,
    preco,
    precoOriginal,
    imagemUrl,
    link,
    nomeProduto,
    ultimaChecagem,
  }
  if (existing) {
    await ctx.db.patch(existing._id, {
      disponivel,
      preco,
      precoOriginal,
      imagemUrl,
      link,
      nomeProduto,
      ultimaChecagem,
    })
  } else {
    await ctx.db.insert("productState", row)
  }
}
