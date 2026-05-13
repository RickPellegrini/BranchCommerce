import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { getBalance } from "@/lib/mercadopago/simple-balance"
import { requireMpConnection } from "@/lib/mercadopago/server"

function isBalanceForbidden(detail: string): boolean {
  const d = detail.toLowerCase()
  return d.includes("403") || d.includes("forbidden") || d.includes("forbiddenapierror")
}

/** Resposta quando o MP nao libera GET .../mercadopago_account/balance. */
const BALANCE_UNAVAILABLE_PAYLOAD = {
  balanceUnavailable: true as const,
  availableBalance: null as null,
  unavailableBalance: null as null,
  totalAmount: null as null,
  currencyId: null as null,
}

export async function GET() {
  try {
    const mp = await requireMpConnection()

    try {
      const balance = await getBalance(mp.accessToken, mp.accountUserId)
      return jsonOk({
        balanceUnavailable: false as const,
        tokenSource: mp.source,
        ...balance,
      })
    } catch (balanceErr) {
      const detail = balanceErr instanceof Error ? balanceErr.message : String(balanceErr)
      if (isBalanceForbidden(detail)) {
        console.warn(
          `[mp/balance] 403 com token ${mp.source}. UI exibira CTA para conexao OAuth dedicada.`,
        )
        return jsonOk({ ...BALANCE_UNAVAILABLE_PAYLOAD, tokenSource: mp.source })
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
