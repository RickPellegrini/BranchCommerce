/** Alinha IDs de anuncio ML (`MLB123` / `MLB-123`) para indice `by_user_ml_item`. */
export function normalizeMlItemIdForStock(raw: string): string {
  const m = raw.trim().match(/^(MLB)-?(\d+)$/i)
  return m ? `MLB${m[2]}` : raw.trim()
}

export function attachmentDedupeKey(
  userId: string,
  transactionId: string,
  fileName: string,
  byteSize: number,
): string {
  return `${userId}|${transactionId}|${fileName.trim().toLowerCase()}|${byteSize}`
}

export function manualStockDedupeKey(
  userId: string,
  productName: string,
  supplier: string,
  date: string,
): string {
  return `${userId}|${productName.trim().toLowerCase()}|${supplier.trim().toLowerCase()}|${date}`
}

export function firstDayOfIsoMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`
}

/** Soma meses a uma data YYYY-MM-DD */
export function addMonthsIsoDate(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const dt = new Date(y, m - 1 + months, d)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}
