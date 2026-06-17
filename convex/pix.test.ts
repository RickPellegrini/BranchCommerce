import { expect, test } from "vitest"

import { gerarPix } from "./pix"

test("gera BR Code com CRC e tamanho minimo", () => {
  const s = gerarPix({
    chave: "test@email.com",
    nome: "Nome Teste",
    cidade: "CidadeX",
    valor: 10.5,
  })
  expect(s.startsWith("000201010212")).toBe(true)
  expect(s).toContain("BR.GOV.BCB.PIX")
  expect(s).toMatch(/6304[0-9A-F]{4}$/i)
  expect(s.length).toBeGreaterThan(30)
})
