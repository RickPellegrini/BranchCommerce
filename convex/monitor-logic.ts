/** Puro: transição de stock e preço (testável). Doc 07 + 09. */
import type { VtexProductState } from "./vtex"

const DESCONTO_PIX = 0.05

export function lineTotalBrl(precoUnit: number, quantidade: number): number {
  return Number((precoUnit * quantidade).toFixed(2))
}

/** Total da linha com 5% desconto Pix (Eletro Club) — usado no BR Code. */
export function precoPixFromLine(precoUnit: number, quantidade: number): number {
  return Number((lineTotalBrl(precoUnit, quantidade) * (1 - DESCONTO_PIX)).toFixed(2))
}

/**
 * `estavaDisponivel` = estado anterior, ou `true` se ainda sem documento (evita falso restock no boot, doc 07).
 */
export function isRestockMoment(estavaDisponivel: boolean, agora: VtexProductState): boolean {
  return agora.disponivel && !estavaDisponivel
}

export function isAboveMaxPrice(agora: VtexProductState, precoMaximo: number | undefined): boolean {
  if (precoMaximo == null) return false
  return agora.preco > precoMaximo
}
