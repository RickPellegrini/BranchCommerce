import { jsonError } from "@/lib/mercadolivre/http"
import { downloadSettlementReport } from "@/lib/mercadopago/reports"
import { requireMpOAuthConnection } from "@/lib/mercadopago/server"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const fileName = url.searchParams.get("fileName")
    if (!fileName) return jsonError("Informe fileName.", 400)

    const mp = await requireMpOAuthConnection()
    const report = await downloadSettlementReport(mp.accessToken, fileName)

    return new Response(report.body, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Content-Disposition": `attachment; filename="${fileName.replaceAll('"', "")}"`,
        "Content-Type": report.contentType,
        Expires: "0",
        Pragma: "no-cache",
      },
    })
  } catch (error) {
    console.error("[mp/reports/download] GET error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message === "mercado_pago_oauth_required") {
      return jsonError("Mercado Pago OAuth nao conectado.", 409)
    }
    return jsonError(
      "Erro ao baixar relatorio Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
