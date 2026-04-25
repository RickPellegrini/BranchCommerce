import { expect, test } from "vitest"

import { isAboveMaxPrice, isRestockMoment, lineTotalBrl, precoPixFromLine } from "./monitor-logic"
import type { VtexProductState } from "./vtex"

const vtex = (o: Partial<VtexProductState>): VtexProductState => ({
  sku: o.sku ?? "1",
  disponivel: o.disponivel ?? false,
  preco: o.preco ?? 0,
  precoOriginal: o.precoOriginal ?? 0,
  nomeProduto: o.nomeProduto ?? "P",
  imagemUrl: o.imagemUrl ?? null,
  link: o.link ?? "/",
})

test("line total e preco pix (5% off line)", () => {
  expect(lineTotalBrl(10, 2)).toBe(20)
  expect(precoPixFromLine(10, 2)).toBe(19)
})

test("restock so quando passa a disponivel", () => {
  const ag = vtex({ disponivel: true, preco: 5 })
  expect(isRestockMoment(true, ag)).toBe(false)
  expect(isRestockMoment(false, ag)).toBe(true)
  expect(isRestockMoment(true, vtex({ disponivel: false }))).toBe(false)
})

test("acima do max", () => {
  expect(isAboveMaxPrice(vtex({ preco: 100 }), 99)).toBe(true)
  expect(isAboveMaxPrice(vtex({ preco: 100 }), 100)).toBe(false)
  expect(isAboveMaxPrice(vtex({ preco: 10 }), undefined)).toBe(false)
})
