import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { getTransactions } from "@/lib/mercadopago/simple-balance"

export async function GET(request: Request) {
  try {
    const { connection } = await requireMlConnection()

    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 100)

    const transactions = await getTransactions(connection.accessToken, limit)

    return jsonOk(transactions)
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
