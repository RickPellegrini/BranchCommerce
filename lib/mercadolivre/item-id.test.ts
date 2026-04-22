import { describe, it, expect } from "vitest"
import { normalizeMercadoLibreItemId } from "./item-id"

describe("normalizeMercadoLibreItemId", () => {
  it("canonicaliza MLB sem hifen", () => {
    expect(normalizeMercadoLibreItemId("MLB46063324")).toBe("MLB46063324")
  })

  it("canonicaliza MLB com hifen", () => {
    expect(normalizeMercadoLibreItemId("MLB-46063324")).toBe("MLB46063324")
  })

  it("ignora caixa no prefixo", () => {
    expect(normalizeMercadoLibreItemId("mlb-46063324")).toBe("MLB46063324")
  })
})
