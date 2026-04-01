import { NextRequest } from "next/server"

import {
  getAnyValidMlConnection,
  getValidMlConnectionByMlUserId,
  requestMlApi,
} from "@/lib/mercadolivre/storage"

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-branch-hunter-key",
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  })
}

type MlReviewsPayload = {
  paging?: {
    total?: number
    offset?: number
    limit?: number
  }
  reviews?: Array<{
    id?: number
    date_created?: string
    status?: string
    title?: string
    content?: string
    rate?: number
    buying_date?: string
  }>
  rating_average?: number
  rating_levels?: Record<string, number>
}

type MlItemPayload = {
  id?: string
  parent_item_id?: string
  catalog_product_id?: string
}

type MlCatalogSearchPayload = {
  results?: Array<{
    id?: string
  }>
}

async function fetchItemPayload(itemId: string, accessToken: string) {
  try {
    return await requestMlApi<MlItemPayload>(
      `/items/${encodeURIComponent(itemId)}`,
      accessToken,
      { method: "GET" },
    )
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const syncKey = String(process.env.BRANCH_HUNTER_SYNC_KEY ?? "").trim()
    if (!syncKey) {
      return Response.json(
        { ok: false, error: "BRANCH_HUNTER_SYNC_KEY nao configurado." },
        { status: 500, headers: corsHeaders() },
      )
    }

    const { searchParams } = new URL(request.url)
    const isDev = process.env.NODE_ENV !== "production"
    const providedKeyFromHeader = String(request.headers.get("x-branch-hunter-key") ?? "").trim()
    const providedKeyFromQuery = String(searchParams.get("key") ?? "").trim()
    const providedKey =
      providedKeyFromHeader || (isDev ? providedKeyFromQuery : "")
    if (!providedKey || providedKey !== syncKey) {
      return Response.json(
        {
          ok: false,
          error: "Chave de sincronizacao invalida.",
          hint: isDev
            ? "Envie x-branch-hunter-key no header ou ?key=... na query (somente em dev)."
            : "Envie x-branch-hunter-key no header.",
        },
        { status: 401, headers: corsHeaders() },
      )
    }
    const mlUserId = String(searchParams.get("mlUserId") ?? "").trim()
    const itemId = String(searchParams.get("itemId") ?? "").trim()
    const catalogProductId = String(searchParams.get("catalogProductId") ?? "").trim()
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50"), 1), 100)
    const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0)
    const debugMode = searchParams.get("debug") === "1"

    if (!itemId) {
      return Response.json(
        { ok: false, error: "itemId obrigatorio." },
        { status: 400, headers: corsHeaders() },
      )
    }

    let connection
    try {
      connection = mlUserId
        ? await getValidMlConnectionByMlUserId(mlUserId)
        : await getAnyValidMlConnection()
    } catch {
      connection = await getAnyValidMlConnection()
    }
    const itemPayload = await fetchItemPayload(itemId, connection.accessToken)
    const resolvedCatalogProductId =
      catalogProductId || String(itemPayload?.catalog_product_id ?? "").trim() || null
    const resolvedParentItemId = String(itemPayload?.parent_item_id ?? "").trim() || null

    const targetItemIds = [itemId, resolvedParentItemId].filter(
      (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index,
    )

    const reviewsById = new Map<number | string, NonNullable<MlReviewsPayload["reviews"]>[number]>()
    let ratingAverage: number | undefined
    let ratingLevels: Record<string, number> | undefined
    let pagingTotal = 0
    const debugAttempts: Array<Record<string, unknown>> = []

    for (const targetItemId of targetItemIds) {
      for (const catalogCandidate of [resolvedCatalogProductId, null]) {
        const query = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
        })
        if (catalogCandidate) {
          query.set("catalog_product_id", catalogCandidate)
        }

        try {
          const payload = await requestMlApi<MlReviewsPayload>(
            `/reviews/item/${encodeURIComponent(targetItemId)}?${query.toString()}`,
            connection.accessToken,
            { method: "GET" },
          )
          if (debugMode) {
            debugAttempts.push({
              step: "reviews_by_item",
              targetItemId,
              catalogCandidate: catalogCandidate ?? null,
              ok: true,
              total: Number(payload.paging?.total ?? 0),
              reviewsCount: Array.isArray(payload.reviews) ? payload.reviews.length : 0,
              ratingAverage: payload.rating_average ?? null,
            })
          }

          if (typeof payload.rating_average === "number" && ratingAverage === undefined) {
            ratingAverage = payload.rating_average
          }
          if (payload.rating_levels && !ratingLevels) {
            ratingLevels = payload.rating_levels
          }
          const currentTotal = Number(payload.paging?.total ?? 0)
          if (Number.isFinite(currentTotal)) {
            pagingTotal = Math.max(pagingTotal, currentTotal)
          }

          for (const review of payload.reviews ?? []) {
            const key = review.id ?? `${review.date_created ?? "no-date"}:${review.title ?? ""}`
            if (!reviewsById.has(key)) {
              reviewsById.set(key, review)
            }
          }
        } catch {
          if (debugMode) {
            debugAttempts.push({
              step: "reviews_by_item",
              targetItemId,
              catalogCandidate: catalogCandidate ?? null,
              ok: false,
            })
          }
          // Try next target/candidate without failing the full endpoint.
        }
      }
    }

    // Catalog page fallback:
    // if item-level attempts returned empty, treat current id as potential catalog_product_id
    // and resolve candidate item ids through official search endpoint.
    if (reviewsById.size === 0) {
      const catalogLikeId = resolvedCatalogProductId || itemId
      const siteId = catalogLikeId.slice(0, 3).toUpperCase()
      if (siteId.length === 3) {
        try {
          const catalogSearch = await requestMlApi<MlCatalogSearchPayload>(
            `/sites/${siteId}/search?catalog_product_id=${encodeURIComponent(catalogLikeId)}&limit=5`,
            connection.accessToken,
            { method: "GET" },
          )
          if (debugMode) {
            debugAttempts.push({
              step: "catalog_search",
              siteId,
              catalogLikeId,
              ok: true,
              candidateCount: Array.isArray(catalogSearch.results) ? catalogSearch.results.length : 0,
            })
          }
          const candidateItems = (catalogSearch.results ?? [])
            .map((row) => String(row.id ?? "").trim())
            .filter(Boolean)

          for (const candidateItemId of candidateItems) {
            const query = new URLSearchParams({
              limit: String(limit),
              offset: String(offset),
              catalog_product_id: catalogLikeId,
            })
            try {
              const payload = await requestMlApi<MlReviewsPayload>(
                `/reviews/item/${encodeURIComponent(candidateItemId)}?${query.toString()}`,
                connection.accessToken,
                { method: "GET" },
              )
              if (debugMode) {
                debugAttempts.push({
                  step: "reviews_by_catalog_candidate_item",
                  candidateItemId,
                  catalogLikeId,
                  ok: true,
                  total: Number(payload.paging?.total ?? 0),
                  reviewsCount: Array.isArray(payload.reviews) ? payload.reviews.length : 0,
                  ratingAverage: payload.rating_average ?? null,
                })
              }
              if (typeof payload.rating_average === "number" && ratingAverage === undefined) {
                ratingAverage = payload.rating_average
              }
              if (payload.rating_levels && !ratingLevels) {
                ratingLevels = payload.rating_levels
              }
              const currentTotal = Number(payload.paging?.total ?? 0)
              if (Number.isFinite(currentTotal)) {
                pagingTotal = Math.max(pagingTotal, currentTotal)
              }
              for (const review of payload.reviews ?? []) {
                const key = review.id ?? `${review.date_created ?? "no-date"}:${review.title ?? ""}`
                if (!reviewsById.has(key)) {
                  reviewsById.set(key, review)
                }
              }
            } catch {
              if (debugMode) {
                debugAttempts.push({
                  step: "reviews_by_catalog_candidate_item",
                  candidateItemId,
                  catalogLikeId,
                  ok: false,
                })
              }
              // Try next candidate item.
            }
          }
        } catch {
          if (debugMode) {
            debugAttempts.push({
              step: "catalog_search",
              siteId,
              catalogLikeId,
              ok: false,
            })
          }
          // Keep response stable even if catalog search fails.
        }
      }
    }

    const mergedReviews = Array.from(reviewsById.values())
      .filter((review) => Boolean(review.date_created))
      .sort((a, b) => {
        const left = new Date(a.date_created ?? 0).getTime()
        const right = new Date(b.date_created ?? 0).getTime()
        return right - left
      })

    const payload: MlReviewsPayload = {
      paging: {
        total: pagingTotal || mergedReviews.length,
        offset,
        limit,
      },
      reviews: mergedReviews,
      rating_average: ratingAverage,
      rating_levels: ratingLevels,
    }

    return Response.json(
      {
        ok: true,
        data: payload,
        ...(debugMode
          ? {
              debug: {
                itemId,
                resolvedParentItemId,
                resolvedCatalogProductId,
                targetItemIds,
                attempts: debugAttempts,
              },
            }
          : {}),
      },
      { status: 200, headers: corsHeaders() },
    )
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao buscar reviews do Mercado Livre.",
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}
