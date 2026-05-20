import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import { getValidMpConnection } from "@/lib/mercadopago/storage"
import { requireMpOAuthConnection } from "@/lib/mercadopago/server"
import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import {
  createSettlementReport,
  createSettlementReportConfig,
  downloadSettlementReport,
  listSettlementReports,
  parseSettlementReportCsv,
  searchSettlementReports,
  type MpReportMovement,
  type MpSettlementReportListItem,
} from "@/lib/mercadopago/reports"

type SyncConnection = {
  appUserId: string
  accessToken: string
  accountUserId: string
}

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
  return new ConvexHttpClient(convexUrl)
}

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

function defaultReportWindow() {
  const end = new Date()
  const begin = new Date(end)
  begin.setDate(begin.getDate() - 90)
  return {
    beginDate: begin.toISOString().slice(0, 19),
    endDate: end.toISOString().slice(0, 19),
  }
}

function movementKey(fileName: string, movement: MpReportMovement) {
  return [
    fileName,
    movement.id,
    movement.date,
    movement.type,
    movement.amount.toFixed(2),
    movement.description,
  ].join("|")
}

async function ensureReportConfig(accessToken: string) {
  try {
    await createSettlementReportConfig(accessToken)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("already") && !message.includes("409")) {
      console.warn("[mp/reports/sync] config create skipped:", message)
    }
  }
}

async function syncReports(mp: SyncConnection) {
  const client = getConvexClient()
  const searched = await searchSettlementReports(mp.accessToken, { limit: 20, offset: 0 }).catch(
    () => null,
  )
  const listed = searched?.results?.length
    ? searched.results
    : await listSettlementReports(mp.accessToken)
  const latest = pickLatestProcessed(listed)
  const fileName = latest ? reportFileName(latest) : null

  if (!latest || !fileName) {
    await ensureReportConfig(mp.accessToken)
    const task = await createSettlementReport(mp.accessToken, defaultReportWindow())
    await client.mutation(api.mercadopago.addReportSyncRun, {
      appUserId: mp.appUserId,
      status: "pending",
      imported: 0,
      skipped: 0,
      message: `Relatorio solicitado. Task ${task.id}. Execute novamente quando estiver processed.`,
    })
    return {
      status: "pending" as const,
      task,
      message: "Relatorio solicitado. Tente sincronizar novamente em alguns minutos.",
    }
  }

  const report = await downloadSettlementReport(mp.accessToken, fileName)
  const summary = parseSettlementReportCsv(report.body, {
    fileName,
    generatedAt: latest.generation_date ?? null,
  })

  const result = await client.mutation(api.mercadopago.upsertReportMovements, {
    appUserId: mp.appUserId,
    mpUserId: mp.accountUserId,
    fileName,
    movements: summary.transactions.map((movement) => ({
      movementKey: movementKey(fileName, movement),
      sourceId: movement.raw.SOURCE_ID || movement.id,
      externalReference: movement.raw.EXTERNAL_REFERENCE || undefined,
      date: movement.date,
      description: movement.description,
      amount: movement.amount,
      type: movement.type,
      status: movement.status,
      rawJson: JSON.stringify(movement.raw),
    })),
  })

  const ledger = await client.query(api.mercadopago.getLedger, {
    appUserId: mp.appUserId,
    limit: 100,
  })

  return {
    status: "success" as const,
    fileName,
    imported: result.imported,
    skipped: result.skipped,
    ledger,
  }
}

export async function POST() {
  try {
    const mp = await requireMpOAuthConnection()
    const result = await syncReports(mp)
    return jsonOk(result)
  } catch (error) {
    console.error("[mp/reports/sync] POST error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message === "mercado_pago_oauth_required") {
      return jsonError("Mercado Pago OAuth nao conectado.", 409)
    }
    return jsonError(
      "Erro ao sincronizar reports Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET
    const authHeader = request.headers.get("authorization")
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return jsonError("Nao autorizado.", 401)
    }

    const appUserId = process.env.MP_SYNC_APP_USER_ID
    if (!appUserId) {
      return jsonError("MP_SYNC_APP_USER_ID nao definido.", 500)
    }

    const connection = await getValidMpConnection(appUserId)
    if (!connection) {
      return jsonError("Mercado Pago OAuth nao conectado.", 409)
    }

    const result = await syncReports({
      appUserId,
      accessToken: connection.accessToken,
      accountUserId: connection.mpUserId,
    })
    return jsonOk(result)
  } catch (error) {
    console.error("[mp/reports/sync] CRON error:", error)
    return jsonError(
      "Erro no cron de reports Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
