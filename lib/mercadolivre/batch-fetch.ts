import { fetchMlApi } from "@/lib/mercadolivre/storage"
import { normalizeMercadoLibreItemId } from "@/lib/mercadolivre/item-id"

const ML_MULTI_GET_LIMIT = 20
const ML_SEARCH_PAGE_SIZE = 50
const DEFAULT_CONCURRENCY = 5

type MlSearchResponse = {
  results: string[]
  paging?: { total?: number; offset?: number; limit?: number }
}

async function pool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0

  async function worker() {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

/**
 * Fetch item details from ML multi-get endpoint in chunks of 20,
 * with controlled concurrency so we don't hit rate limits.
 */
export async function fetchItemDetailsBatched<T>(
  ids: string[],
  accessToken: string,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<Array<{ body?: T }>> {
  if (ids.length === 0) return []

  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += ML_MULTI_GET_LIMIT) {
    chunks.push(ids.slice(i, i + ML_MULTI_GET_LIMIT))
  }

  const tasks = chunks.map(
    (chunk) => () => fetchMlApi<Array<{ body?: T }>>(`/items?ids=${chunk.join(",")}`, accessToken),
  )

  const batched = await pool(tasks, concurrency)
  return batched.flat()
}

async function paginateSearch(
  accessToken: string,
  mlUserId: string,
  status: "active" | "paused",
  pageSize = ML_SEARCH_PAGE_SIZE,
): Promise<string[]> {
  const allIds: string[] = []
  let offset = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await fetchMlApi<MlSearchResponse>(
      `/users/${mlUserId}/items/search?limit=${pageSize}&offset=${offset}&status=${status}`,
      accessToken,
    )

    for (const id of page.results ?? []) {
      allIds.push(normalizeMercadoLibreItemId(id))
    }

    const total = page.paging?.total ?? 0
    offset += pageSize

    if (offset >= total || (page.results?.length ?? 0) < pageSize) break
  }

  return allIds
}

/**
 * Fetch ALL item IDs for a seller by paginating through active + paused
 * statuses separately and merging (deduplicated).
 */
export async function fetchAllUserItemIds(
  accessToken: string,
  mlUserId: string,
): Promise<string[]> {
  const [active, paused] = await Promise.all([
    paginateSearch(accessToken, mlUserId, "active"),
    paginateSearch(accessToken, mlUserId, "paused"),
  ])

  const seen = new Set<string>()
  const merged: string[] = []
  for (const id of [...active, ...paused]) {
    if (!seen.has(id)) {
      seen.add(id)
      merged.push(id)
    }
  }

  return merged
}
