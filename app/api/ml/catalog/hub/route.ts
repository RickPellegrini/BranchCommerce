import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { normalizeMercadoLibreItemId } from "@/lib/mercadolivre/item-id"
import { fetchMlApi, requestMlApi } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { searchUserItemsIncludingPaused } from "@/lib/mercadolivre/user-items-search"

export const dynamic = "force-dynamic"
export const revalidate = 0

type MlListingDetail = {
  id: string
  title: string
  price: number
  available_quantity: number
  status: string
  catalog_product_id?: string
  /** false = par classico sincronizado (nao competir na grade de buy box deste hub) */
  catalog_listing?: boolean
  thumbnail?: string
  secure_thumbnail?: string
  seller_id?: number
}

type PriceToWinResponse = {
  item_id: string
  current_price: number
  currency_id: string
  price_to_win: number | null
  status: "winning" | "competing" | "sharing_first_place" | "listed" | string
  reason?: string[]
  visit_share?: string
  competitors_sharing_first_place?: number | null
  winner?: {
    item_id?: string
    price?: number
    currency_id?: string
  }
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function isNoWinnersError(error: unknown) {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes("No winners found") || error.message.includes('"error": "not_found"')
  )
}

function getParam(url: URL, key: string) {
  return String(url.searchParams.get(key) ?? "").trim()
}

function toOptionalNumber(value: string) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function loadSellerListings(accessToken: string, mlUserId: string, limit = 50) {
  const payload = await searchUserItemsIncludingPaused(
    accessToken,
    mlUserId,
    Math.min(limit, 50),
    0,
  )
  const ids = [...new Set((payload.results ?? []).map(normalizeMercadoLibreItemId))].slice(
    0,
    Math.min(limit, 50),
  )
  if (ids.length === 0) return []

  const details: Array<{ body?: MlListingDetail }> = []
  for (const chunk of chunkArray(ids, 20)) {
    try {
      const partial = await fetchMlApi<Array<{ body?: MlListingDetail }>>(
        `/items?ids=${chunk.join(",")}`,
        accessToken,
      )
      details.push(...partial)
    } catch {
      // Ignore one failed chunk and keep remaining listings.
    }
  }

  const enriched = details
    .map((row) => row.body)
    .filter((row): row is MlListingDetail => Boolean(row))
    .map((row) => ({
      ...row,
      id: normalizeMercadoLibreItemId(row.id),
      thumbnail: row.secure_thumbnail ?? row.thumbnail,
    }))

  const uniqueById = new Map<string, MlListingDetail>()
  for (const row of enriched) {
    if (!uniqueById.has(row.id)) uniqueById.set(row.id, row)
  }
  return [...uniqueById.values()]
}

async function handleGet(url: URL) {
  const action = getParam(url, "action")
  const { connection } = await requireMlConnection()
  const accessToken = connection.accessToken
  const siteId = getParam(url, "siteId") || "MLB"

  if (action === "competition") {
    const listings = await loadSellerListings(accessToken, connection.mlUserId, 50)
    const catalogListings = listings.filter(
      (listing) => Boolean(listing.catalog_product_id) && listing.catalog_listing !== false,
    )

    const competitionData = await Promise.all(
      catalogListings.map(async (listing) => {
        try {
          const competition = await fetchMlApi<PriceToWinResponse>(
            `/items/${listing.id}/price_to_win?version=v2`,
            accessToken,
          )
          return {
            ...listing,
            competition,
          }
        } catch (error) {
          return {
            ...listing,
            competition: isNoWinnersError(error)
              ? ({
                  item_id: listing.id,
                  current_price: listing.price,
                  currency_id: "BRL",
                  price_to_win: null,
                  status: "listed",
                  reason: ["no_winners_found"],
                  visit_share: "minimum",
                  competitors_sharing_first_place: null,
                } as PriceToWinResponse)
              : null,
          }
        }
      }),
    )

    const rows = competitionData.map((row) => {
      const itemStatus = String(row.status ?? "")
        .trim()
        .toLowerCase()
      const comp = row.competition
      let competitionStatus = String(comp?.status ?? "listed").trim()
      if (itemStatus === "paused") {
        competitionStatus = "paused"
      }

      const compLower = competitionStatus.toLowerCase()
      return {
        itemId: row.id,
        title: row.title,
        thumbnail: row.thumbnail,
        status: row.status,
        price: row.price,
        availableQuantity: row.available_quantity,
        catalogProductId: row.catalog_product_id ?? null,
        competitionStatus,
        currentPrice: comp?.current_price ?? row.price,
        priceToWin: comp?.price_to_win ?? null,
        winnerPrice: comp?.winner?.price ?? null,
        winnerItemId: comp?.winner?.item_id ?? null,
        visitShare: comp?.visit_share ?? null,
        reasons: comp?.reason ?? [],
        competitorsSharingFirstPlace: comp?.competitors_sharing_first_place ?? null,
        _sortTier:
          itemStatus === "paused" || compLower === "paused"
            ? 100
            : compLower === "winning"
              ? 0
              : compLower === "sharing_first_place"
                ? 1
                : compLower === "competing"
                  ? 2
                  : compLower === "listed"
                    ? 3
                    : compLower === "not_listed"
                      ? 4
                      : 5,
      }
    })

    rows.sort((a, b) => {
      if (a._sortTier !== b._sortTier) return a._sortTier - b._sortTier
      return b.price - a.price
    })

    const publicRows = rows.map((row) => {
      const { _sortTier, ...rest } = row
      void _sortTier
      return rest
    })

    const summary = {
      total: publicRows.length,
      winning: publicRows.filter((r) => r.competitionStatus.toLowerCase() === "winning").length,
      sharingFirstPlace: publicRows.filter(
        (r) => r.competitionStatus.toLowerCase() === "sharing_first_place",
      ).length,
      competing: publicRows.filter((r) => r.competitionStatus.toLowerCase() === "competing").length,
      listed: publicRows.filter((r) => {
        const s = r.competitionStatus.toLowerCase()
        return s === "listed" || s === "not_listed"
      }).length,
      paused: publicRows.filter((r) => r.competitionStatus.toLowerCase() === "paused").length,
    }

    return jsonOk({
      summary,
      rows: publicRows,
    })
  }

  if (action === "products_search") {
    const q = getParam(url, "q")
    const productIdentifier = getParam(url, "product_identifier")
    const status = getParam(url, "status") || "active"
    const domainId = getParam(url, "domain_id")
    const limit = Math.min(toOptionalNumber(getParam(url, "limit")) ?? 10, 50)
    const offset = Math.max(toOptionalNumber(getParam(url, "offset")) ?? 0, 0)

    if (!q && !productIdentifier) {
      return jsonError("Informe q ou product_identifier para buscar produtos de catalogo.", 400)
    }

    const params = new URLSearchParams({
      status,
      site_id: siteId,
      limit: String(limit),
      offset: String(offset),
    })
    if (q) params.set("q", q)
    if (productIdentifier) params.set("product_identifier", productIdentifier)
    if (domainId) params.set("domain_id", domainId)

    const result = await fetchMlApi<unknown>(`/products/search?${params.toString()}`, accessToken)
    return jsonOk(result)
  }

  if (action === "product_detail") {
    const productId = getParam(url, "productId")
    if (!productId) return jsonError("productId obrigatorio.", 400)
    const result = await fetchMlApi<unknown>(`/products/${productId}`, accessToken)
    return jsonOk(result)
  }

  if (action === "product_items") {
    const productId = getParam(url, "productId")
    if (!productId) return jsonError("productId obrigatorio.", 400)
    const result = await fetchMlApi<unknown>(`/products/${productId}/items`, accessToken)
    return jsonOk(result)
  }

  if (action === "domains_required") {
    const result = await fetchMlApi<unknown>(
      `/catalog/dumps/domains/${siteId}/catalog_required`,
      accessToken,
    )
    return jsonOk(result)
  }

  if (action === "domains_only") {
    const result = await fetchMlApi<unknown>(
      `/catalog/dumps/domains/${siteId}/catalog_only`,
      accessToken,
    )
    return jsonOk(result)
  }

  if (action === "forewarning") {
    const result = await fetchMlApi<unknown>(
      `/users/${connection.mlUserId}/items/search?tags=catalog_forewarning`,
      accessToken,
    )
    return jsonOk(result)
  }

  if (action === "forewarning_date") {
    const itemId = getParam(url, "itemId")
    if (!itemId) return jsonError("itemId obrigatorio.", 400)
    const result = await fetchMlApi<unknown>(
      `/items/${itemId}/catalog_forewarning/date`,
      accessToken,
    )
    return jsonOk(result)
  }

  if (action === "sync_status") {
    const itemId = getParam(url, "itemId")
    if (!itemId) return jsonError("itemId obrigatorio.", 400)
    const result = await fetchMlApi<unknown>(`/public/buybox/sync/${itemId}`, accessToken)
    return jsonOk(result)
  }

  if (action === "brand_quota") {
    const result = await fetchMlApi<unknown>(
      `/catalog_suggestions/users/${connection.mlUserId}/quota`,
      accessToken,
    )
    return jsonOk(result)
  }

  if (action === "brand_domains") {
    const result = await fetchMlApi<unknown>(
      `/catalog_suggestions/domains/${siteId}/available/full`,
      accessToken,
    )
    return jsonOk(result)
  }

  if (action === "brand_technical_specs") {
    const domainId = getParam(url, "domainId")
    const part = getParam(url, "part")
    if (!domainId) return jsonError("domainId obrigatorio.", 400)
    const suffix = part === "input" ? "/input" : part === "output" ? "/output" : ""
    const result = await fetchMlApi<unknown>(
      `/domains/${domainId}/technical_specs${suffix}?channel_id=catalog_suggestions`,
      accessToken,
    )
    return jsonOk(result)
  }

  if (action === "brand_suggestions_search") {
    const limit = Math.min(toOptionalNumber(getParam(url, "limit")) ?? 20, 50)
    const offset = Math.max(toOptionalNumber(getParam(url, "offset")) ?? 0, 0)
    const result = await fetchMlApi<unknown>(
      `/catalog_suggestions/users/${connection.mlUserId}/suggestions/search?limit=${limit}&offset=${offset}`,
      accessToken,
    )
    return jsonOk(result)
  }

  if (action === "brand_suggestion_detail") {
    const suggestionId = getParam(url, "suggestionId")
    if (!suggestionId) return jsonError("suggestionId obrigatorio.", 400)
    const result = await fetchMlApi<unknown>(`/catalog_suggestions/${suggestionId}`, accessToken)
    return jsonOk(result)
  }

  if (action === "brand_suggestion_validations") {
    const suggestionId = getParam(url, "suggestionId")
    if (!suggestionId) return jsonError("suggestionId obrigatorio.", 400)
    const result = await fetchMlApi<unknown>(
      `/catalog_suggestions/${suggestionId}/validations`,
      accessToken,
    )
    return jsonOk(result)
  }

  return jsonError("Acao de catalogo invalida.", 400)
}

async function handlePost(request: Request, url: URL) {
  const action = getParam(url, "action")
  const { connection } = await requireMlConnection()
  const body = (await request.json()) as Record<string, unknown>

  if (action === "listing_direct") {
    const created = await requestMlApi<unknown>("/items", connection.accessToken, {
      method: "POST",
      body,
    })
    return jsonOk(created)
  }

  if (action === "listing_optin") {
    const created = await requestMlApi<unknown>("/items/catalog_listings", connection.accessToken, {
      method: "POST",
      body,
    })
    return jsonOk(created)
  }

  if (action === "sync_item") {
    const result = await requestMlApi<unknown>("/public/buybox/sync", connection.accessToken, {
      method: "POST",
      body,
    })
    return jsonOk(result)
  }

  if (action === "brand_validate") {
    const result = await requestMlApi<unknown>(
      "/catalog_suggestions/validate",
      connection.accessToken,
      {
        method: "POST",
        body,
      },
    )
    return jsonOk(result)
  }

  if (action === "brand_create_suggestion") {
    const result = await requestMlApi<unknown>("/catalog_suggestions", connection.accessToken, {
      method: "POST",
      body,
    })
    return jsonOk(result)
  }

  if (action === "brand_create_description") {
    const suggestionId = String(body.suggestionId ?? "").trim()
    const plainText = String(body.plain_text ?? "")
    if (!suggestionId) return jsonError("suggestionId obrigatorio.", 400)
    const result = await requestMlApi<unknown>(
      `/catalog_suggestions/${suggestionId}/description`,
      connection.accessToken,
      {
        method: "POST",
        body: { plain_text: plainText },
      },
    )
    return jsonOk(result)
  }

  return jsonError("Acao POST de catalogo invalida.", 400)
}

async function handlePut(request: Request, url: URL) {
  const action = getParam(url, "action")
  const { connection } = await requireMlConnection()
  const body = (await request.json()) as Record<string, unknown>

  if (action === "brand_update_suggestion") {
    const suggestionId = String(body.suggestionId ?? "").trim()
    if (!suggestionId) return jsonError("suggestionId obrigatorio.", 400)
    const payload = { ...body }
    delete payload.suggestionId
    const result = await requestMlApi<unknown>(
      `/catalog_suggestions/${suggestionId}`,
      connection.accessToken,
      {
        method: "PUT",
        body: payload,
      },
    )
    return jsonOk(result)
  }

  if (action === "brand_update_description") {
    const suggestionId = String(body.suggestionId ?? "").trim()
    const plainText = String(body.plain_text ?? "")
    if (!suggestionId) return jsonError("suggestionId obrigatorio.", 400)
    const result = await requestMlApi<unknown>(
      `/catalog_suggestions/${suggestionId}/description`,
      connection.accessToken,
      {
        method: "PUT",
        body: { plain_text: plainText },
      },
    )
    return jsonOk(result)
  }

  return jsonError("Acao PUT de catalogo invalida.", 400)
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    return await handleGet(url)
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message.includes("nao conectada")) {
      return jsonError("Conta do Mercado Livre nao conectada.", 404)
    }
    return jsonError(
      "Erro ao consultar modulo de catalogo.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    return await handlePost(request, url)
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message.includes("nao conectada")) {
      return jsonError("Conta do Mercado Livre nao conectada.", 404)
    }
    return jsonError(
      "Erro ao executar acao de catalogo.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url)
    return await handlePut(request, url)
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message.includes("nao conectada")) {
      return jsonError("Conta do Mercado Livre nao conectada.", 404)
    }
    return jsonError(
      "Erro ao executar atualizacao de catalogo.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
