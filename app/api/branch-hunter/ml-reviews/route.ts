import { NextRequest } from "next/server"

import {
  getAnyValidMlConnection,
  getValidMlConnectionByMlUserId,
  requestMlApi,
} from "@/lib/mercadolivre/storage"

const ALLOWED_ORIGINS = [
  "chrome-extension://",
  "https://branchcommercehub.com",
  "http://localhost:3000",
]

function getAllowedOrigin(request?: NextRequest): string {
  const origin = request?.headers.get("origin") ?? ""
  if (ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
    return origin
  }
  return ALLOWED_ORIGINS[0]
}

function corsHeaders(request?: NextRequest) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(request),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-branch-hunter-key",
    Vary: "Origin",
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
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

type MlProductItemsPayload = {
  results?: Array<{
    item_id?: string
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
        { status: 500, headers: corsHeaders(request) },
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
        { status: 401, headers: corsHeaders(request) },
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
        { status: 400, headers: corsHeaders(request) },
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

    if (reviewsById.size === 0) {
      const catalogLikeId = resolvedCatalogProductId || itemId
      try {
        const productItems = await requestMlApi<MlProductItemsPayload>(
          `/products/${encodeURIComponent(catalogLikeId)}/items`,
          connection.accessToken,
          { method: "GET" },
        )
        if (debugMode) {
          debugAttempts.push({
            step: "product_items_fallback",
            catalogLikeId,
            ok: true,
            candidateCount: Array.isArray(productItems.results) ? productItems.results.length : 0,
          })
        }
        const candidateItems = (productItems.results ?? [])
          .map((row) => String(row.item_id ?? "").trim())
          .filter(Boolean)
          .slice(0, 5)

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
          }
        }
      } catch {
        if (debugMode) {
          debugAttempts.push({
            step: "product_items_fallback",
            catalogLikeId,
            ok: false,
          })
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
      { status: 200, headers: corsHeaders(request) },
    )
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao buscar reviews do Mercado Livre.",
      },
      { status: 500, headers: corsHeaders(request) },
    )
  }
}
