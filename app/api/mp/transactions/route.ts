import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { getTransactions, getTransactionsWindow } from "@/lib/mercadopago/simple-balance"
import { requireMpOAuthConnection } from "@/lib/mercadopago/server"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const rawWindow = url.searchParams.get("windowDays")
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 1000)
    const mp = await requireMpOAuthConnection()

    if (!rawWindow) {
      const transactions = await getTransactions(mp.accessToken, mp.accountUserId, limit)
      return jsonOk(transactions)
    }

    const parsed = Number(rawWindow)
    const windowDays = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 365)) : 180
    const result = await getTransactionsWindow(mp.accessToken, mp.accountUserId, {
      maxItems: limit,
      windowDays,
    })

    return jsonOk(result)
  } catch (error) {
    console.error("[mp/transactions] Error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message === "mercado_pago_oauth_required") {
      const url = new URL(request.url)
      const rawWindow = url.searchParams.get("windowDays")
      if (!rawWindow) {
        return jsonOk([])
      }
      return jsonOk({
        transactions: [],
        totalCredits: 0,
        totalDebits: 0,
        windowSinceIso: new Date().toISOString(),
      })
    }
    return jsonError(
      "Erro ao consultar transacoes Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
