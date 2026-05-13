import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { fetchOfficialBalance, type OfficialBalanceProbe } from "@/lib/mercadopago/simple-balance"
import { requireMpConnection } from "@/lib/mercadopago/server"

type BalanceSource = "official" | "unavailable"

type BalancePayload = {
  balanceSource: BalanceSource
  balanceUnavailable: boolean
  tokenSource: "mp_oauth" | "mp_app_token" | "ml_token_fallback"
  availableBalance: number | null
  unavailableBalance: number | null
  totalAmount: number | null
  currencyId: string | null
  /** Razao retornada pelo endpoint oficial (ok, forbidden, unauthorized, ...). */
  officialReason: string
  /** Probes raw das chamadas ao MP — uteis na UI/console. */
  officialProbes: OfficialBalanceProbe[]
}

/**
 * Saldo MP: regra rigida — fonte oficial ou indisponivel.
 * Nenhum fallback calculado por extrato/pagamentos. Quando o endpoint oficial
 * retorna 401/403/erro, devolvemos `balanceUnavailable: true` para a UI
 * mostrar o empty-state com CTA, em vez de simular um numero. O extrato
 * continua disponivel em /api/mp/transactions, mas para fins informativos.
 */
export async function GET() {
  try {
    const mp = await requireMpConnection()

    const official = await fetchOfficialBalance(mp.accessToken, mp.accountUserId)

    if (official.balance) {
      const payload: BalancePayload = {
        balanceSource: "official",
        balanceUnavailable: false,
        tokenSource: mp.source,
        availableBalance: official.balance.availableBalance,
        unavailableBalance: official.balance.unavailableBalance,
        totalAmount: official.balance.totalAmount,
        currencyId: official.balance.currencyId,
        officialReason: official.reason,
        officialProbes: official.probes,
      }
      return jsonOk(payload)
    }

    console.warn(
      `[mp/balance] indisponivel (reason=${official.reason}, userId=${official.resolvedUserId || "?"}, tokenSource=${mp.source}).`,
    )

    const payload: BalancePayload = {
      balanceSource: "unavailable",
      balanceUnavailable: true,
      tokenSource: mp.source,
      availableBalance: null,
      unavailableBalance: null,
      totalAmount: null,
      currencyId: null,
      officialReason: official.reason,
      officialProbes: official.probes,
    }
    return jsonOk(payload)
  } catch (error) {
    console.error("[mp/balance] Error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    const detail = error instanceof Error ? error.message : "Erro desconhecido"
    return jsonError("Erro ao consultar saldo Mercado Pago.", 500, detail)
  }
}
