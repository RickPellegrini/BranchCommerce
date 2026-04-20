import { describe, it, expect, vi, beforeEach } from "vitest"
import { extractStock, extractStartTime, scrapeCompetitorPages } from "./scrape-item-page"

// ─── extractStock ────────────────────────────────────────────────────

describe("extractStock", () => {
  it("returns null when no stock indicators are found", () => {
    const result = extractStock("<html><body>Hello</body></html>")
    expect(result).toEqual({ availableQuantity: null, stockIsMinimum: false })
  })

  it('extracts stock from "(+N disponíveis)" description pattern', () => {
    const html = `"description":"(+5 disponíveis)"`
    const result = extractStock(html)
    expect(result).toEqual({ availableQuantity: 6, stockIsMinimum: false })
  })

  it("extracts stock from quantity_selector input subtitles pattern", () => {
    const html = `quantity_selector blah "input": { "subtitles": ["+12 disponíveis"]`
    const result = extractStock(html)
    expect(result).toEqual({ availableQuantity: 13, stockIsMinimum: false })
  })

  it("extracts stock from quantity_selector available_quantity + rows pattern", () => {
    const html = `quantity_selector": {"available_quantity": 6, "other": true, "rows": 6`
    const result = extractStock(html)
    expect(result).toEqual({ availableQuantity: 6, stockIsMinimum: false })
  })

  it("detects capped stock (stockIsMinimum) when dropdown matches rows and input mode present", () => {
    const html = `quantity_selector": {"available_quantity": 6, "rows": 6 "input": {`
    const result = extractStock(html)
    expect(result).toEqual({ availableQuantity: 6, stockIsMinimum: true })
  })

  it("does not set stockIsMinimum when available_quantity < rows", () => {
    const html = `quantity_selector": {"available_quantity": 3, "rows": 6 "input": {`
    const result = extractStock(html)
    expect(result).toEqual({ availableQuantity: 3, stockIsMinimum: false })
  })

  it("extracts from bare available_quantity field", () => {
    const html = `"available_quantity": 42`
    const result = extractStock(html)
    expect(result).toEqual({ availableQuantity: 42, stockIsMinimum: false })
  })

  it('detects "Último disponível!" as quantity 1', () => {
    const html = `"text": "Último disponível!"`
    const result = extractStock(html)
    expect(result).toEqual({ availableQuantity: 1, stockIsMinimum: false })
  })

  it('detects "N disponíveis" text pattern', () => {
    const html = `"text": "3 disponíveis"`
    const result = extractStock(html)
    expect(result).toEqual({ availableQuantity: 3, stockIsMinimum: false })
  })
})

// ─── extractStartTime ────────────────────────────────────────────────

describe("extractStartTime", () => {
  it("returns null when no time pattern found", () => {
    expect(extractStartTime("<html>nothing</html>")).toBeNull()
  })

  it('extracts from "startTime" field', () => {
    const html = `"startTime": "2024-03-15T10:00:00.000Z"`
    expect(extractStartTime(html)).toBe("2024-03-15T10:00:00.000Z")
  })

  it('extracts from "date_created" field when startTime absent', () => {
    const html = `"date_created": "2023-12-01T08:30:00.000-03:00"`
    expect(extractStartTime(html)).toBe("2023-12-01T08:30:00.000-03:00")
  })

  it('extracts from "start_time" field as last resort', () => {
    const html = `"start_time": "2024-06-20T14:00:00.000Z"`
    expect(extractStartTime(html)).toBe("2024-06-20T14:00:00.000Z")
  })

  it("prefers startTime over date_created", () => {
    const html = `"startTime": "2024-01-01T00:00:00.000Z", "date_created": "2023-06-01T00:00:00.000Z"`
    expect(extractStartTime(html)).toBe("2024-01-01T00:00:00.000Z")
  })
})

// ─── scrapeCompetitorPages (integration with mocked fetch) ───────────

describe("scrapeCompetitorPages", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns empty map for empty input", async () => {
    const result = await scrapeCompetitorPages([])
    expect(result.size).toBe(0)
  })

  it("scrapes stock from fetched HTML pages", async () => {
    const fakeHtml =
      `<html>` +
      `"available_quantity": 20` +
      `"startTime": "2024-05-01T10:00:00.000Z"` +
      `${"x".repeat(5000)}` +
      `</html>`

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: "https://produto.mercadolivre.com.br/MLB-123",
        text: () => Promise.resolve(fakeHtml),
      }),
    )

    const result = await scrapeCompetitorPages(["MLB123"])
    expect(result.size).toBe(1)

    const item = result.get("MLB123")!
    expect(item.availableQuantity).toBe(20)
    expect(item.startTime).toBe("2024-05-01T10:00:00.000Z")
  })

  it("handles fetch failures gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        url: "https://produto.mercadolivre.com.br/MLB-456",
      }),
    )

    const result = await scrapeCompetitorPages(["MLB456"])
    expect(result.size).toBe(1)

    const item = result.get("MLB456")!
    expect(item.availableQuantity).toBeNull()
  })

  it("handles network errors gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")))

    const result = await scrapeCompetitorPages(["MLB789"])
    expect(result.size).toBe(1)

    const item = result.get("MLB789")!
    expect(item.availableQuantity).toBeNull()
  })
})
