import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import { getValidMpConnection } from "@/lib/mercadopago/storage"
import { requireMpOAuthConnection } from "@/lib/mercadopago/server"
import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import {
  createSettlementReport,
  createSettlementReportConfig,
  downloadSettlementReport,
  getSettlementReportTask,
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

function processedReportFileName(report: MpSettlementReportListItem | { file_name?: string }) {
  return report.file_name ?? null
}

function taskIdFromPendingRun(run: { taskId?: string; message?: string }) {
  if (run.taskId) return run.taskId
  const match = run.message?.match(/Task\s+(\d+)/i)
  return match?.[1] ?? null
}

function defaultReportWindow() {
  const end = new Date()
  const begin = new Date(end)
  begin.setDate(begin.getDate() - 90)
  return {
    beginDate: begin.toISOString().replace(/\.\d{3}Z$/, "Z"),
    endDate: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isMissingReportConfig(error: unknown) {
  const message = errorMessage(error).toLowerCase()
  return (
    message.includes("config_not_found") ||
    message.includes("config not found") ||
    message.includes("not found") ||
    message.includes("404")
  )
}

function isMissingReportTask(error: unknown) {
  const message = errorMessage(error).toLowerCase()
  return message.includes("task_not_found") || message.includes("task not found")
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
    const message = errorMessage(error)
    if (!message.includes("already") && !message.includes("409")) {
      console.warn("[mp/reports/sync] config create skipped:", message)
    }
  }
}

async function loadAvailableReports(accessToken: string) {
  try {
    const searched = await searchSettlementReports(accessToken, { limit: 20, offset: 0 })
    if (searched.results?.length) return searched.results
  } catch (error) {
    if (!isMissingReportConfig(error)) throw error
  }

  try {
    return await listSettlementReports(accessToken)
  } catch (error) {
    if (isMissingReportConfig(error)) return []
    throw error
  }
}

async function importReportFile(
  client: ConvexHttpClient,
  mp: SyncConnection,
  fileName: string,
  generatedAt: string | null,
  taskId?: string,
) {
  const report = await downloadSettlementReport(mp.accessToken, fileName)
  const summary = parseSettlementReportCsv(report.body, {
    fileName,
    generatedAt,
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

  if (taskId) {
    await client.mutation(api.mercadopago.updateReportSyncRunByTask, {
      appUserId: mp.appUserId,
      taskId,
      status: "success",
      fileName,
      imported: result.imported,
      skipped: result.skipped,
      message: `Task ${taskId} importada com sucesso.`,
    })
  }

  return {
    status: "success" as const,
    fileName,
    imported: result.imported,
    skipped: result.skipped,
    ledger,
  }
}

async function createPendingReport(client: ConvexHttpClient, mp: SyncConnection) {
  await ensureReportConfig(mp.accessToken)
  const task = await createSettlementReport(mp.accessToken, defaultReportWindow())
  await client.mutation(api.mercadopago.addReportSyncRun, {
    appUserId: mp.appUserId,
    status: "pending",
    taskId: String(task.id),
    imported: 0,
    skipped: 0,
    message: `Report em processamento. Task ${task.id}. O saldo sera atualizado automaticamente quando o arquivo oficial ficar disponivel.`,
  })
  return {
    status: "pending" as const,
    task,
    message: `Report em processamento. Task ${task.id}. O saldo sera atualizado automaticamente quando o arquivo oficial ficar disponivel.`,
  }
}

async function syncReports(mp: SyncConnection) {
  const client = getConvexClient()
  const pendingRun = await client.query(api.mercadopago.getLatestPendingReportSyncRun, {
    appUserId: mp.appUserId,
  })

  const pendingTaskId = pendingRun ? taskIdFromPendingRun(pendingRun) : null

  if (pendingTaskId) {
    try {
      const task = await getSettlementReportTask(mp.accessToken, pendingTaskId)
      const fileName = processedReportFileName(task)

      if (task.status === "processed" && fileName) {
        return importReportFile(client, mp, fileName, task.generation_date ?? null, pendingTaskId)
      }

      if (task.status === "failed") {
        await client.mutation(api.mercadopago.updateReportSyncRunByTask, {
          appUserId: mp.appUserId,
          taskId: String(task.id),
          status: "failed",
          imported: 0,
          skipped: 0,
          message: `Task ${task.id} falhou no Mercado Pago.`,
        })
        return {
          status: "failed" as const,
          task,
          message: `Task ${task.id} falhou no Mercado Pago. Tente gerar novamente.`,
        }
      }

      return {
        status: "pending" as const,
        task,
        message: `Report ainda em processamento (${task.status}). Task ${task.id}. O saldo sera atualizado automaticamente quando o arquivo oficial ficar disponivel.`,
      }
    } catch (error) {
      if (!isMissingReportTask(error)) throw error

      await client.mutation(api.mercadopago.updateReportSyncRunByTask, {
        appUserId: mp.appUserId,
        taskId: pendingTaskId,
        status: "failed",
        imported: 0,
        skipped: 0,
        message: `Task ${pendingTaskId} nao encontrada. Buscando ultimo report processado.`,
      })
    }
  }

  const listed = await loadAvailableReports(mp.accessToken)
  const latest = pickLatestProcessed(listed)
  const fileName = latest ? reportFileName(latest) : null

  if (!latest || !fileName) {
    return createPendingReport(client, mp)
  }

  const importedRun = await client.query(api.mercadopago.getSuccessfulReportSyncRunByFile, {
    appUserId: mp.appUserId,
    fileName,
  })

  if (importedRun) {
    return createPendingReport(client, mp)
  }

  return importReportFile(client, mp, fileName, latest.generation_date ?? null)
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
