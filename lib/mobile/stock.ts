export type StockListItem = {
  name: string
  quantity: number
  minStock: number
}

function stockPriority(product: StockListItem): number {
  if (product.quantity > product.minStock) return 0
  if (product.quantity > 0) return 1
  return 2
}

export function compareMobileStockProducts(a: StockListItem, b: StockListItem): number {
  return stockPriority(a) - stockPriority(b) || a.name.localeCompare(b.name, "pt-BR")
}

export function nextStockQuantity(
  currentQuantity: number,
  type: "in" | "out" | "sale" | "adjustment",
  quantity: number,
): number {
  if (type === "in") return currentQuantity + quantity
  if (type === "out" || type === "sale") return currentQuantity - quantity
  return quantity
}
