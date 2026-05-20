import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { getSettlementReportTask } from "@/lib/mercadopago/reports"
import { requireMpOAuthConnection } from "@/lib/mercadopago/server"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { taskId } = await context.params
    if (!taskId) return jsonError("Informe o taskId.", 400)

    const mp = await requireMpOAuthConnection()
    const task = await getSettlementReportTask(mp.accessToken, taskId)
    return jsonOk(task)
  } catch (error) {
    console.error("[mp/reports/task] GET error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message === "mercado_pago_oauth_required") {
      return jsonError("Mercado Pago OAuth nao conectado.", 409)
    }
    return jsonError(
      "Erro ao consultar task de relatorio Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
