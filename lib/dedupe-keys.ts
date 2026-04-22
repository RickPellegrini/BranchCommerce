/**
 * Chaves estáveis para deduplicação no cliente e documentação das regras no servidor.
 */

export function transactionAttachmentDedupeKey(
  userId: string,
  transactionId: string,
  fileName: string,
  byteSize: number,
): string {
  return `${userId}|${transactionId}|${fileName.trim().toLowerCase()}|${byteSize}`
}

export function installmentDedupeKey(
  userId: string,
  planId: string,
  installmentIndex: number,
): string {
  return `${userId}|${planId}|${installmentIndex}`
}

export function manualStockDedupeKey(
  userId: string,
  productName: string,
  supplier: string,
  date: string,
): string {
  return `${userId}|${productName.trim().toLowerCase()}|${supplier.trim().toLowerCase()}|${date}`
}
