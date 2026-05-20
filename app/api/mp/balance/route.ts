import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { requireMpOAuthConnection } from "@/lib/mercadopago/server"

type BalanceSource = "reports" | "unavailable"

type BalancePayload = {
  balanceSource: BalanceSource
  balanceUnavailable: boolean
  tokenSource: "mp_oauth" | "none"
  availableBalance: number | null
  unavailableBalance: number | null
  totalAmount: number | null
  currencyId: string | null
  /** Razao da indisponibilidade do saldo direto. */
  officialReason: string
  officialProbes: []
  reportsAvailable: boolean
  reportsConfigUrl: string
}

/**
 * O endpoint historico de balance do Mercado Pago retorna 403/404 para esta
 * conta. O caminho oficial para extrato financeiro e via Account Money Reports.
 * Mantemos este endpoint como contrato de UI, mas ele nao tenta mais chamar o
 * balance legado; ele orienta o frontend a usar /api/mp/reports.
 */
export async function GET() {
  try {
    await requireMpOAuthConnection()

    const payload: BalancePayload = {
      balanceSource: "reports",
      balanceUnavailable: true,
      tokenSource: "mp_oauth",
      availableBalance: null,
      unavailableBalance: null,
      totalAmount: null,
      currencyId: null,
      officialReason: "use_account_money_reports",
      officialProbes: [],
      reportsAvailable: true,
      reportsConfigUrl: "/api/mp/reports/config",
    }
    return jsonOk(payload)
  } catch (error) {
    console.error("[mp/balance] Error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message === "mercado_pago_oauth_required") {
      const payload: BalancePayload = {
        balanceSource: "unavailable",
        balanceUnavailable: true,
        tokenSource: "none",
        availableBalance: null,
        unavailableBalance: null,
        totalAmount: null,
        currencyId: null,
        officialReason: "unauthorized",
        officialProbes: [],
        reportsAvailable: false,
        reportsConfigUrl: "/api/mp/reports/config",
      }
      return jsonOk(payload)
    }
    const detail = error instanceof Error ? error.message : "Erro desconhecido"
    return jsonError("Erro ao consultar saldo Mercado Pago.", 500, detail)
  }
}
