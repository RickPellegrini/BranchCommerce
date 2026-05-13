import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import {
  computeBalanceFromExtract,
  fetchOfficialBalance,
  type OfficialBalanceProbe,
} from "@/lib/mercadopago/simple-balance"
import { requireMpConnection } from "@/lib/mercadopago/server"

type BalanceSource = "official" | "computed_from_extract" | "unavailable"

type BalanceSuccessPayload = {
  balanceSource: BalanceSource
  balanceUnavailable: boolean
  tokenSource: "mp_oauth" | "mp_app_token" | "ml_token_fallback"
  availableBalance: number | null
  unavailableBalance: number | null
  totalAmount: number | null
  currencyId: string | null
  /** Razao retornada pelo endpoint oficial (forbidden, unauthorized, ...). */
  officialReason: string
  /** Probes raw das chamadas ao MP — uteis na UI/console. */
  officialProbes: OfficialBalanceProbe[]
  /** Metadados do calculo a partir do extrato, quando aplicavel. */
  computed: {
    windowSinceIso: string
    itemsScanned: number
    releasedCredits: number
    pendingCredits: number
    debits: number
    pagesFetched: number
  } | null
  computedError: string | null
}

export async function GET() {
  try {
    const mp = await requireMpConnection()

    const official = await fetchOfficialBalance(mp.accessToken, mp.accountUserId)

    if (official.balance) {
      const payload: BalanceSuccessPayload = {
        balanceSource: "official",
        balanceUnavailable: false,
        tokenSource: mp.source,
        availableBalance: official.balance.availableBalance,
        unavailableBalance: official.balance.unavailableBalance,
        totalAmount: official.balance.totalAmount,
        currencyId: official.balance.currencyId,
        officialReason: official.reason,
        officialProbes: official.probes,
        computed: null,
        computedError: null,
      }
      return jsonOk(payload)
    }

    console.warn(
      `[mp/balance] endpoint oficial nao retornou saldo (reason=${official.reason}, userId=${official.resolvedUserId || "?"}, tokenSource=${mp.source}). Calculando a partir do extrato.`,
    )

    const accountUserId = mp.accountUserId || official.resolvedUserId
    if (!accountUserId) {
      const payload: BalanceSuccessPayload = {
        balanceSource: "unavailable",
        balanceUnavailable: true,
        tokenSource: mp.source,
        availableBalance: null,
        unavailableBalance: null,
        totalAmount: null,
        currencyId: null,
        officialReason: official.reason,
        officialProbes: official.probes,
        computed: null,
        computedError: "userId_unresolved",
      }
      return jsonOk(payload)
    }

    try {
      const computed = await computeBalanceFromExtract(mp.accessToken, accountUserId, {
        windowDays: 365,
      })
      const payload: BalanceSuccessPayload = {
        balanceSource: "computed_from_extract",
        balanceUnavailable: false,
        tokenSource: mp.source,
        availableBalance: computed.balance.availableBalance,
        unavailableBalance: computed.balance.unavailableBalance,
        totalAmount: computed.balance.totalAmount,
        currencyId: computed.balance.currencyId,
        officialReason: official.reason,
        officialProbes: official.probes,
        computed: {
          windowSinceIso: computed.windowSinceIso,
          itemsScanned: computed.itemsScanned,
          releasedCredits: computed.releasedCredits,
          pendingCredits: computed.pendingCredits,
          debits: computed.debits,
          pagesFetched: computed.pagesFetched,
        },
        computedError: null,
      }
      return jsonOk(payload)
    } catch (computedErr) {
      const detail = computedErr instanceof Error ? computedErr.message : String(computedErr)
      console.error("[mp/balance] computed-from-extract falhou:", detail)
      const payload: BalanceSuccessPayload = {
        balanceSource: "unavailable",
        balanceUnavailable: true,
        tokenSource: mp.source,
        availableBalance: null,
        unavailableBalance: null,
        totalAmount: null,
        currencyId: null,
        officialReason: official.reason,
        officialProbes: official.probes,
        computed: null,
        computedError: detail,
      }
      return jsonOk(payload)
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
