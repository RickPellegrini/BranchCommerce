import { describe, expect, it } from "vitest"

import { formatBrl } from "./money"

describe("formatBrl", () => {
  it("formats positive number as BRL", () => {
    const result = formatBrl(1234.56)
    expect(result).toContain("R$")
    expect(result).toContain("1.234,56")
  })

  it("formats zero", () => {
    const result = formatBrl(0)
    expect(result).toContain("0,00")
  })

  it("formats negative number", () => {
    const result = formatBrl(-99.9)
    expect(result).toContain("99,90")
  })
})
