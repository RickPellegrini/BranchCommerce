import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { getBalance } from "@/lib/mercadopago/simple-balance"

export async function GET() {
  try {
    const { connection } = await requireMlConnection()

    const balance = await getBalance(
      connection.accessToken,
      connection.mlUserId,
    )

    return jsonOk(balance)
  } catch (error) {
    console.error("[mp/balance] Error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    return jsonError(
      "Erro ao consultar saldo Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
