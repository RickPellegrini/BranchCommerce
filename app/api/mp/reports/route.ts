import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { createSettlementReport, searchSettlementReports } from "@/lib/mercadopago/reports"
import { requireMpOAuthConnection } from "@/lib/mercadopago/server"

function clampInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(Math.trunc(parsed), max))
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = clampInt(url.searchParams.get("limit"), 50, 500)
    const offset = clampInt(url.searchParams.get("offset"), 0, 10_000)
    const mp = await requireMpOAuthConnection()
    const reports = await searchSettlementReports(mp.accessToken, { limit, offset })
    return jsonOk(reports)
  } catch (error) {
    console.error("[mp/reports] GET error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message === "mercado_pago_oauth_required") {
      return jsonError("Mercado Pago OAuth nao conectado.", 409)
    }
    return jsonError(
      "Erro ao consultar relatorios Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      beginDate?: unknown
      endDate?: unknown
    } | null

    if (!body || !isIsoDateTime(body.beginDate) || !isIsoDateTime(body.endDate)) {
      return jsonError("Informe beginDate e endDate em ISO datetime.", 400)
    }

    const mp = await requireMpOAuthConnection()
    const task = await createSettlementReport(mp.accessToken, {
      beginDate: body.beginDate,
      endDate: body.endDate,
    })
    return jsonOk(task, 202)
  } catch (error) {
    console.error("[mp/reports] POST error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message === "mercado_pago_oauth_required") {
      return jsonError("Mercado Pago OAuth nao conectado.", 409)
    }
    return jsonError(
      "Erro ao solicitar relatorio Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
