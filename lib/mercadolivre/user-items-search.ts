import { fetchMlApi } from "@/lib/mercadolivre/storage"

export type MlItemsSearchResponse = {
  results: string[]
  paging?: {
    total?: number
    offset?: number
    limit?: number
  }
}

/**
 * Busca itens do vendedor incluindo pausados.
 * Sem status, o ML costuma priorizar/retornar só ativos — se tudo estiver pausado, results vem vazio.
 * @see https://developers.mercadolivre.com.br/en_us/services-manage-users/items-and-searches (By status)
 */
export async function searchUserItemsIncludingPaused(
  accessToken: string,
  mlUserId: string,
  limit: number,
  offset: number,
): Promise<MlItemsSearchResponse> {
  if (offset > 0) {
    return fetchMlApi<MlItemsSearchResponse>(
      `/users/${mlUserId}/items/search?limit=${limit}&offset=${offset}`,
      accessToken,
    )
  }

  const capped = Math.min(Math.max(limit, 1), 50)
  const [active, paused] = await Promise.all([
    fetchMlApi<MlItemsSearchResponse>(
      `/users/${mlUserId}/items/search?limit=${capped}&offset=0&status=active`,
      accessToken,
    ),
    fetchMlApi<MlItemsSearchResponse>(
      `/users/${mlUserId}/items/search?limit=${capped}&offset=0&status=paused`,
      accessToken,
    ),
  ])

  const seen = new Set<string>()
  const merged: string[] = []
  for (const id of active.results ?? []) {
    if (!seen.has(id)) {
      seen.add(id)
      merged.push(id)
    }
  }
  for (const id of paused.results ?? []) {
    if (!seen.has(id)) {
      seen.add(id)
      merged.push(id)
    }
  }

  const activeTotal = active.paging?.total ?? active.results?.length ?? 0
  const pausedTotal = paused.paging?.total ?? paused.results?.length ?? 0

  return {
    results: merged.slice(0, capped),
    paging: {
      total: activeTotal + pausedTotal,
      limit: capped,
      offset: 0,
    },
  }
}
