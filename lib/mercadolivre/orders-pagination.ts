export type MlOrdersSearchResponse<TOrder> = {
  results: TOrder[]
  paging?: {
    total?: number
    limit?: number
    offset?: number
  }
}

type BuildMlOrdersSearchPathArgs = {
  sellerId: string
  limit: number
  offset: number
  startDate?: string | null
  endDate?: string | null
}

type FetchMlOrdersSearchPagesArgs<TOrder> = {
  sellerId: string
  loadAll: boolean
  limit: number
  offset: number
  startDate?: string | null
  endDate?: string | null
  fetchPage: (path: string) => Promise<MlOrdersSearchResponse<TOrder>>
}

const FULL_HISTORY_PAGE_SIZE = 50

export function buildMlOrdersSearchPath({
  sellerId,
  limit,
  offset,
  startDate,
  endDate,
}: BuildMlOrdersSearchPathArgs) {
  const params = new URLSearchParams({
    seller: sellerId,
    sort: "date_desc",
    limit: String(limit),
    offset: String(offset),
  })
  if (startDate) params.set("order.date_created.from", `${startDate}T00:00:00.000-00:00`)
  if (endDate) params.set("order.date_created.to", `${endDate}T23:59:59.999-00:00`)
  return `/orders/search?${params.toString()}`
}

export async function fetchMlOrdersSearchPages<TOrder>({
  sellerId,
  loadAll,
  limit,
  offset,
  startDate,
  endDate,
  fetchPage,
}: FetchMlOrdersSearchPagesArgs<TOrder>): Promise<MlOrdersSearchResponse<TOrder>> {
  const firstLimit = loadAll ? FULL_HISTORY_PAGE_SIZE : limit
  const firstOffset = loadAll ? 0 : offset
  const firstPage = await fetchPage(
    buildMlOrdersSearchPath({
      sellerId,
      limit: firstLimit,
      offset: firstOffset,
      startDate,
      endDate,
    }),
  )

  if (!loadAll) return firstPage

  const results = [...firstPage.results]
  const total = firstPage.paging?.total ?? results.length
  let nextOffset = results.length

  while (nextOffset < total) {
    const page = await fetchPage(
      buildMlOrdersSearchPath({
        sellerId,
        limit: FULL_HISTORY_PAGE_SIZE,
        offset: nextOffset,
        startDate,
        endDate,
      }),
    )
    if (page.results.length === 0) break
    results.push(...page.results)
    nextOffset += page.results.length
  }

  return {
    ...firstPage,
    results,
    paging: {
      ...firstPage.paging,
      total,
      limit: results.length,
      offset: 0,
    },
  }
}
