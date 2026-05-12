import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { getTransactions, getTransactionsWindow } from "@/lib/mercadopago/simple-balance"

export async function GET(request: Request) {
  try {
    const { connection } = await requireMlConnection()

    const url = new URL(request.url)
    const rawWindow = url.searchParams.get("windowDays")
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 1000)

    // Modo legado: sem windowDays, retorna apenas array (compat com chamadas antigas).
    if (!rawWindow) {
      const transactions = await getTransactions(connection.accessToken, connection.mlUserId, limit)
      return jsonOk(transactions)
    }

    const parsed = Number(rawWindow)
    const windowDays = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 365)) : 180
    const result = await getTransactionsWindow(connection.accessToken, connection.mlUserId, {
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
