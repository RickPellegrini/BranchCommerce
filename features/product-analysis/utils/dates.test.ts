import { describe, expect, it } from "vitest"

import { dateRange, daysSince, formatDateBr, toIsoDate } from "./dates"

describe("toIsoDate", () => {
  it("formats date as YYYY-MM-DD", () => {
    expect(toIsoDate(new Date(2025, 5, 15))).toBe("2025-06-15")
  })

  it("zero-pads month and day", () => {
    expect(toIsoDate(new Date(2025, 0, 5))).toBe("2025-01-05")
  })
})

describe("dateRange", () => {
  it("returns from/to spanning the given number of days", () => {
    const { from, to } = dateRange(7)
    const fromDate = new Date(from)
    const toDate = new Date(to)
    const diffMs = toDate.getTime() - fromDate.getTime()
    const diffDays = Math.round(diffMs / 86_400_000)
    expect(diffDays).toBe(7)
  })

  it("to is today", () => {
    const { to } = dateRange(1)
    expect(to).toBe(toIsoDate(new Date()))
  })
})

describe("daysSince", () => {
  it("computes days since a past date", () => {
    const past = new Date()
    past.setDate(past.getDate() - 10)
    expect(daysSince(past.toISOString())).toBe(10)
  })

  it("returns 0 for null", () => {
    expect(daysSince(null)).toBe(0)
  })

  it("returns 0 for undefined", () => {
    expect(daysSince(undefined)).toBe(0)
  })

  it("returns 0 for invalid date string", () => {
    expect(daysSince("not-a-date")).toBe(0)
  })

  it("returns 0 for future dates (clamped)", () => {
    const future = new Date()
    future.setDate(future.getDate() + 5)
    expect(daysSince(future.toISOString())).toBe(0)
  })
})

describe("formatDateBr", () => {
  it("formats ISO date to pt-BR", () => {
    const result = formatDateBr("2025-06-15T10:00:00Z")
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it("returns '-' for null", () => {
    expect(formatDateBr(null)).toBe("-")
  })

  it("returns '-' for undefined", () => {
    expect(formatDateBr(undefined)).toBe("-")
  })

  it("returns '-' for invalid date", () => {
    expect(formatDateBr("invalid")).toBe("-")
  })
})
