import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import {
  downloadSettlementReport,
  listSettlementReports,
  parseSettlementReportCsv,
  searchSettlementReports,
  type MpSettlementReportListItem,
} from "@/lib/mercadopago/reports"
import { requireMpOAuthConnection } from "@/lib/mercadopago/server"

function reportFileName(report: MpSettlementReportListItem) {
  return report.file_name ?? null
}

function reportDate(report: MpSettlementReportListItem) {
  return report.generation_date ?? report.end_date ?? report.begin_date ?? ""
}

function pickLatestProcessed(reports: MpSettlementReportListItem[]) {
  return reports
    .filter((report) => reportFileName(report))
    .filter(
      (report) => !report.status || ["processed", "available", "finished"].includes(report.status),
    )
    .sort((a, b) => reportDate(b).localeCompare(reportDate(a)))[0]
}

export async function GET() {
  try {
    const mp = await requireMpOAuthConnection()

    const searched = await searchSettlementReports(mp.accessToken, { limit: 20, offset: 0 }).catch(
      () => null,
    )
    const listed = searched?.results?.length
      ? searched.results
      : await listSettlementReports(mp.accessToken)
    const latest = pickLatestProcessed(listed)
    const fileName = latest ? reportFileName(latest) : null

    if (!latest || !fileName) {
      return jsonOk({
        hasReport: false,
        reason: "no_processed_report",
        nextStep: "POST /api/mp/reports",
      })
    }

    const report = await downloadSettlementReport(mp.accessToken, fileName)
    const summary = parseSettlementReportCsv(report.body, {
      fileName,
      generatedAt: latest.generation_date ?? null,
    })

    return jsonOk({
      hasReport: true,
      balance: {
        availableBalance: summary.netAmount,
        unavailableBalance: 0,
        totalAmount: summary.netAmount,
        currencyId: "BRL",
      },
      summary,
    })
  } catch (error) {
    console.error("[mp/reports/latest-summary] GET error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message === "mercado_pago_oauth_required") {
      return jsonError("Mercado Pago OAuth nao conectado.", 409)
    }
    return jsonError(
      "Erro ao resumir relatorio Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
