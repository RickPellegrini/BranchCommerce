import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { jsonError, jsonOk } from "@/lib/mercadolivre/http"

type SyncProvider = "all" | "mercado_livre" | "mercado_pago" | "stock"

const FRESHNESS_MS = 10 * 60 * 1000
const MP_REPORT_FRESHNESS_MS = 30 * 60 * 1000

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
  return new ConvexHttpClient(convexUrl)
}

async function markSync(
  client: ConvexHttpClient,
  appUserId: string,
  provider: SyncProvider,
  status: "running" | "success" | "failed",
  args: { startedAt?: number; finishedAt?: number; message?: string; stats?: unknown } = {},
) {
  await client.mutation(api.mercadopago.upsertSyncStatus, {
    appUserId,
    provider,
    status,
    lastStartedAt: args.startedAt,
    lastFinishedAt: args.finishedAt,
    lastSuccessAt: status === "success" ? args.finishedAt : undefined,
    message: args.message,
    statsJson: args.stats ? JSON.stringify(args.stats) : undefined,
  })
}

async function callInternal(request: Request, path: string) {
  const url = new URL(request.url)
  const response = await fetch(`${url.origin}${path}`, {
    method: "POST",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `Falha em ${path}`)
  }
  return payload.data
}

function isFresh(statuses: Array<{ provider: string; lastSuccessAt?: number }>) {
  const all = statuses.find((status) => status.provider === "all")
  return Boolean(all?.lastSuccessAt && Date.now() - all.lastSuccessAt < FRESHNESS_MS)
}

function isProviderFresh(
  statuses: Array<{ provider: string; lastStartedAt?: number; lastSuccessAt?: number }>,
  provider: SyncProvider,
  freshnessMs: number,
) {
  const status = statuses.find((item) => item.provider === provider)
  const lastRunAt = status?.lastStartedAt ?? status?.lastSuccessAt
  return Boolean(lastRunAt && Date.now() - lastRunAt < freshnessMs)
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  let appUserId = ""
  const client = getConvexClient()

  try {
    appUserId = await requireAuthenticatedAppUserId()
    const url = new URL(request.url)
    const force = url.searchParams.get("force") === "1"
    const statuses = await client.query(api.mercadopago.getSyncStatuses, { appUserId })

    if (!force && isFresh(statuses)) {
      return jsonOk({
        skipped: true,
        reason: "fresh",
        freshnessMs: FRESHNESS_MS,
        statuses,
      })
    }

    await markSync(client, appUserId, "all", "running", {
      startedAt,
      message: "Sincronizacao geral em andamento.",
    })

    const results: Record<string, unknown> = {}

    try {
      await markSync(client, appUserId, "stock", "running", { startedAt })
      results.stock = await callInternal(request, "/api/stock/sync-ml")
      results.stockSales = await callInternal(request, "/api/stock/reconcile-sales")
      await markSync(client, appUserId, "stock", "success", {
        startedAt,
        finishedAt: Date.now(),
        message: "Estoque e vendas sincronizados com Mercado Livre.",
        stats: {
          stock: results.stock,
          sales: results.stockSales,
        },
      })
    } catch (error) {
      await markSync(client, appUserId, "stock", "failed", {
        startedAt,
        finishedAt: Date.now(),
        message: error instanceof Error ? error.message : "Erro no sync de estoque.",
      })
      results.stock = { ok: false, error: error instanceof Error ? error.message : String(error) }
    }

    if (!force && isProviderFresh(statuses, "mercado_pago", MP_REPORT_FRESHNESS_MS)) {
      results.mercadoPago = { skipped: true, reason: "fresh" }
    } else {
      try {
        await markSync(client, appUserId, "mercado_pago", "running", { startedAt })
        results.mercadoPago = await callInternal(request, "/api/mp/reports/sync")
        await markSync(client, appUserId, "mercado_pago", "success", {
          startedAt,
          finishedAt: Date.now(),
          message: "Mercado Pago sincronizado.",
          stats: results.mercadoPago,
        })
      } catch (error) {
        await markSync(client, appUserId, "mercado_pago", "failed", {
          startedAt,
          finishedAt: Date.now(),
          message: error instanceof Error ? error.message : "Erro no sync Mercado Pago.",
        })
        results.mercadoPago = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }

    const finishedAt = Date.now()
    await markSync(client, appUserId, "all", "success", {
      startedAt,
      finishedAt,
      message: "Sincronizacao geral concluida.",
      stats: results,
    })

    return jsonOk({ skipped: false, startedAt, finishedAt, results })
  } catch (error) {
    if (appUserId) {
      await markSync(client, appUserId, "all", "failed", {
        startedAt,
        finishedAt: Date.now(),
        message: error instanceof Error ? error.message : "Erro desconhecido",
      }).catch(() => undefined)
    }
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    return jsonError(
      "Erro ao sincronizar dados externos.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
