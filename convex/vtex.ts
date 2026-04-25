/**
 * Parser puro da resposta VTEX Eletro Club.
 * Ver branchcommerce-docs/04-convex-vtex-client.md
 */
export type VtexProductState = {
  sku: string
  disponivel: boolean
  preco: number
  precoOriginal: number
  nomeProduto: string
  imagemUrl: string | null
  link: string
}

export function parseVtexResponse(sku: string, data: unknown): VtexProductState {
  const empty: VtexProductState = {
    sku,
    disponivel: false,
    preco: 0,
    precoOriginal: 0,
    nomeProduto: `SKU ${sku}`,
    imagemUrl: null,
    link: "",
  }

  if (!Array.isArray(data) || data.length === 0) return empty

  const produto = data[0] as {
    productName?: string
    link?: string
    items?: Array<{
      itemId?: string
      sellers?: Array<{
        commertialOffer?: {
          IsAvailable?: boolean
          Price?: number
          ListPrice?: number
        }
      }>
      images?: Array<{ imageUrl?: string }>
    }>
  }

  const items = produto.items ?? []
  const item = items.find((i) => i.itemId === sku) ?? items[0]
  if (!item) return { ...empty, nomeProduto: String(produto.productName ?? empty.nomeProduto) }

  const seller = item.sellers?.[0]
  const offer = seller?.commertialOffer
  if (!offer) {
    return {
      ...empty,
      nomeProduto: String(produto.productName ?? `SKU ${sku}`),
    }
  }

  return {
    sku,
    disponivel: Boolean(offer.IsAvailable),
    preco: offer.Price ?? 0,
    precoOriginal: offer.ListPrice ?? offer.Price ?? 0,
    nomeProduto: String(produto.productName ?? `SKU ${sku}`),
    imagemUrl: item.images?.[0]?.imageUrl ?? null,
    link: String(produto.link ?? ""),
  }
}
