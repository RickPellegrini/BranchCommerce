import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { getBalance } from "@/lib/mercadopago/simple-balance"

function isBalanceForbidden(detail: string): boolean {
  const d = detail.toLowerCase()
  return d.includes("403") || d.includes("forbidden") || d.includes("forbiddenapierror")
}

/** Resposta quando o MP nao libera GET .../mercadopago_account/balance (comum com OAuth ML). */
const BALANCE_UNAVAILABLE_PAYLOAD = {
  balanceUnavailable: true as const,
  availableBalance: null as null,
  unavailableBalance: null as null,
  totalAmount: null as null,
  currencyId: null as null,
}

export async function GET() {
  try {
    const { connection } = await requireMlConnection()

    try {
      const balance = await getBalance(connection.accessToken, connection.mlUserId)
      return jsonOk({ balanceUnavailable: false as const, ...balance })
    } catch (balanceErr) {
      const detail = balanceErr instanceof Error ? balanceErr.message : String(balanceErr)
      if (isBalanceForbidden(detail)) {
        console.warn(
          "[mp/balance] Endpoint de saldo retornou 403 (esperado para varios tokens de vendedor). UI usara estado neutro.",
        )
        return jsonOk(BALANCE_UNAVAILABLE_PAYLOAD)
      }
      throw balanceErr
    }
  } catch (error) {
    console.error("[mp/balance] Error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    const detail = error instanceof Error ? error.message : "Erro desconhecido"
    return jsonError("Erro ao consultar saldo Mercado Pago.", 500, detail)
  }
}
