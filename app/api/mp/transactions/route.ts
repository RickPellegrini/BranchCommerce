import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { getTransactions, getTransactionsWindow } from "@/lib/mercadopago/simple-balance"
import { requireMpConnection } from "@/lib/mercadopago/server"

export async function GET(request: Request) {
  try {
    const mp = await requireMpConnection()

    const url = new URL(request.url)
    const rawWindow = url.searchParams.get("windowDays")
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 1000)

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
    return jsonError(
      "Erro ao consultar transacoes Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
