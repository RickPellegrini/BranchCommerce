import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { probeMpEndpoints, summarizeProbeError } from "@/lib/mercadopago/diagnostics"
import { requireMpConnection } from "@/lib/mercadopago/server"
import { getValidMpConnection } from "@/lib/mercadopago/storage"

function maskToken(token: string): string {
  if (!token) return "(vazio)"
  if (token.length <= 12) return `${token.slice(0, 3)}…(${token.length} chars)`
  return `${token.slice(0, 6)}…${token.slice(-4)} (${token.length} chars)`
}

/**
 * Endpoint somente-leitura para validar o acesso Mercado Pago sem expor tokens.
 * Prova identidade, pagamentos e os endpoints oficiais de Account Money Reports.
 */
export async function GET() {
  try {
    const appUserId = await requireAuthenticatedAppUserId()
    const oauthConnection = await getValidMpConnection(appUserId)
    const resolved = await requireMpConnection()

    const probes = await probeMpEndpoints(resolved.accessToken)

    const summary = probes.map((p) => {
      if (p.error) return { label: p.label, kind: "network_error" as const, detail: p.error }
      if (p.ok) return { label: p.label, kind: "ok" as const, status: p.status }
      const err = summarizeProbeError(p.body)
      let kind: "forbidden" | "unauthorized" | "not_found" | "rate_limited" | "other_error"
      if (p.status === 401) kind = "unauthorized"
      else if (p.status === 403) kind = "forbidden"
      else if (p.status === 404) kind = "not_found"
      else if (p.status === 429) kind = "rate_limited"
      else kind = "other_error"
      return { label: p.label, kind, status: p.status, code: err.code, message: err.message }
    })

    const connection = oauthConnection
      ? {
          source: "mp_oauth" as const,
          mpUserId: oauthConnection.mpUserId,
          scope: oauthConnection.scope ?? null,
          tokenType: oauthConnection.tokenType ?? null,
          liveMode: oauthConnection.liveMode ?? null,
          expiresAt: oauthConnection.expiresAt,
          updatedAt: oauthConnection.updatedAt,
          accessTokenPreview: maskToken(oauthConnection.accessToken),
        }
      : {
          source: resolved.source,
          mpUserId: resolved.accountUserId || null,
          scope: null,
          tokenType: null,
          liveMode: null,
          expiresAt: null,
          updatedAt: null,
          accessTokenPreview: maskToken(resolved.accessToken),
        }

    return jsonOk({
      tokenSource: resolved.source,
      connection,
      probes,
      summary,
    })
  } catch (error) {
    console.error("[mp/diagnostics] error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    return jsonError(
      "Erro ao executar diagnostico Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
