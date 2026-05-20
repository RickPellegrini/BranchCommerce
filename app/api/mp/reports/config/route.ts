import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { createSettlementReportConfig, getSettlementReportConfig } from "@/lib/mercadopago/reports"
import { requireMpOAuthConnection } from "@/lib/mercadopago/server"

function isMissingConfig(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("404") &&
    error.message.includes("config_not_found_for_user")
  )
}

export async function GET() {
  try {
    const mp = await requireMpOAuthConnection()
    const config = await getSettlementReportConfig(mp.accessToken)
    return jsonOk({ configured: true, config })
  } catch (error) {
    console.error("[mp/reports/config] GET error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message === "mercado_pago_oauth_required") {
      return jsonError("Mercado Pago OAuth nao conectado.", 409)
    }
    if (isMissingConfig(error)) {
      return jsonOk({
        configured: false,
        reason: "config_not_found_for_user",
        nextStep: "POST /api/mp/reports/config",
      })
    }
    return jsonError(
      "Erro ao consultar configuracao de relatorios Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}

export async function POST() {
  try {
    const mp = await requireMpOAuthConnection()
    const config = await createSettlementReportConfig(mp.accessToken)
    return jsonOk({ configured: true, config }, 201)
  } catch (error) {
    console.error("[mp/reports/config] POST error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message === "mercado_pago_oauth_required") {
      return jsonError("Mercado Pago OAuth nao conectado.", 409)
    }
    return jsonError(
      "Erro ao criar configuracao de relatorios Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
