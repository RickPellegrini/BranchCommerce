import { describe, expect, it, vi } from "vitest"

import { buildMlOrdersSearchPath, fetchMlOrdersSearchPages } from "./orders-pagination"

describe("orders pagination", () => {
  it("builds Mercado Livre order search path with date filters", () => {
    const path = buildMlOrdersSearchPath({
      sellerId: "seller-1",
      limit: 50,
      offset: 100,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    })

    expect(path).toContain("/orders/search?")
    expect(path).toContain("seller=seller-1")
    expect(path).toContain("limit=50")
    expect(path).toContain("offset=100")
    expect(decodeURIComponent(path)).toContain(
      "order.date_created.from=2026-01-01T00:00:00.000-00:00",
    )
    expect(decodeURIComponent(path)).toContain(
      "order.date_created.to=2026-01-31T23:59:59.999-00:00",
    )
  })

  it("fetches every page when full history is requested", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        results: Array.from({ length: 50 }, (_, index) => ({ id: `order-${index}` })),
        paging: { total: 87, limit: 50, offset: 0 },
      })
      .mockResolvedValueOnce({
        results: Array.from({ length: 37 }, (_, index) => ({ id: `order-${index + 50}` })),
        paging: { total: 87, limit: 50, offset: 50 },
      })

    const payload = await fetchMlOrdersSearchPages({
      sellerId: "seller-1",
      loadAll: true,
      limit: 20,
      offset: 0,
      fetchPage,
    })

    expect(payload.results).toHaveLength(87)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage.mock.calls[0][0]).toContain("limit=50")
    expect(fetchPage.mock.calls[0][0]).toContain("offset=0")
    expect(fetchPage.mock.calls[1][0]).toContain("limit=50")
    expect(fetchPage.mock.calls[1][0]).toContain("offset=50")
  })

  it("keeps single-page behavior when full history is not requested", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      results: [{ id: "latest" }],
      paging: { total: 87, limit: 1, offset: 0 },
    })

    const payload = await fetchMlOrdersSearchPages({
      sellerId: "seller-1",
      loadAll: false,
      limit: 1,
      offset: 0,
      fetchPage,
    })

    expect(payload.results).toEqual([{ id: "latest" }])
    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage.mock.calls[0][0]).toContain("limit=1")
    expect(fetchPage.mock.calls[0][0]).toContain("offset=0")
  })
})
