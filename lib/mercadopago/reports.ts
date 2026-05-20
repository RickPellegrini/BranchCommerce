import { MP_API, mpFetch } from "./http"

export type MpSettlementReportColumn =
  | "SOURCE_ID"
  | "EXTERNAL_REFERENCE"
  | "USER_ID"
  | "TRANSACTION_TYPE"
  | "TRANSACTION_AMOUNT"
  | "TRANSACTION_CURRENCY"
  | "SETTLEMENT_NET_AMOUNT"
  | "SETTLEMENT_CURRENCY"
  | "TRANSACTION_DATE"
  | "SETTLEMENT_DATE"
  | "FEE_AMOUNT"
  | "REAL_AMOUNT"
  | "DESCRIPTION"
  | "MONEY_RELEASE_DATE"
  | "IS_RELEASED"
  | "PAYMENT_METHOD"
  | "PAYMENT_METHOD_TYPE"

type MpReportColumn = { key: MpSettlementReportColumn }

export type MpSettlementReportConfig = {
  file_name_prefix: string
  display_timezone?: string
  scheduled: boolean
  columns: MpReportColumn[]
  report_translation?: string
  header_language?: string
  frequency?: {
    hour: number
    value: number
    type: "daily" | "weekly" | "monthly"
  }
}

export type MpSettlementReportTask = {
  id: number
  user_id: number
  begin_date: string
  end_date: string
  created_from: string
  is_test: boolean
  is_reserve: boolean
  status: "pending" | "processing" | "processed" | "failed" | string
  report_type: string
  generation_date?: string
  report_id?: number
  last_modified?: string
  retries?: number
  account_id?: number
  currency_id?: string
  format?: string
  file_name?: string
}

export type MpSettlementReportListItem = {
  id?: number
  report_id?: number
  task_id?: number
  file_name?: string
  status?: string
  report_type?: string
  generation_date?: string
  begin_date?: string
  end_date?: string
}

export type MpSettlementReportSearch = {
  paging: { limit: number; offset: number; total: number }
  results: MpSettlementReportListItem[]
}

export type MpReportMovement = {
  id: string
  date: string
  description: string
  amount: number
  type: "credit" | "debit"
  status: string
  raw: Record<string, string>
}

export type MpReportSummary = {
  fileName: string
  generatedAt: string | null
  rows: number
  totalCredits: number
  totalDebits: number
  netAmount: number
  transactions: MpReportMovement[]
}

export const DEFAULT_SETTLEMENT_REPORT_COLUMNS: MpSettlementReportColumn[] = [
  "SOURCE_ID",
  "EXTERNAL_REFERENCE",
  "USER_ID",
  "TRANSACTION_TYPE",
  "TRANSACTION_AMOUNT",
  "TRANSACTION_CURRENCY",
  "SETTLEMENT_NET_AMOUNT",
  "SETTLEMENT_CURRENCY",
  "TRANSACTION_DATE",
  "SETTLEMENT_DATE",
  "FEE_AMOUNT",
  "REAL_AMOUNT",
  "DESCRIPTION",
  "MONEY_RELEASE_DATE",
  "IS_RELEASED",
  "PAYMENT_METHOD",
  "PAYMENT_METHOD_TYPE",
]

export function buildDefaultSettlementReportConfig(): MpSettlementReportConfig & {
  separator: string
  include_withdraw: boolean
  refund_detailed: boolean
  shipping_detail: boolean
  coupon_detailed: boolean
  show_chargeback_cancel: boolean
  show_fee_prevision: boolean
} {
  return {
    columns: DEFAULT_SETTLEMENT_REPORT_COLUMNS.map((key) => ({ key })),
    file_name_prefix: "branchcommerce-account-money",
    frequency: {
      hour: 0,
      value: 1,
      type: "monthly",
    },
    separator: ";",
    display_timezone: "GMT-03",
    report_translation: "pt",
    header_language: "pt",
    scheduled: false,
    include_withdraw: true,
    refund_detailed: false,
    shipping_detail: false,
    coupon_detailed: false,
    show_chargeback_cancel: true,
    show_fee_prevision: true,
  }
}

export async function getSettlementReportConfig(accessToken: string) {
  return mpFetch<MpSettlementReportConfig>("/v1/account/settlement_report/config", accessToken, {
    cache: "no-store",
  })
}

export async function createSettlementReportConfig(accessToken: string) {
  return mpFetch<MpSettlementReportConfig>("/v1/account/settlement_report/config", accessToken, {
    method: "POST",
    body: JSON.stringify(buildDefaultSettlementReportConfig()),
  })
}

export async function createSettlementReport(
  accessToken: string,
  args: { beginDate: string; endDate: string },
) {
  return mpFetch<MpSettlementReportTask>("/v1/account/settlement_report", accessToken, {
    method: "POST",
    body: JSON.stringify({
      begin_date: args.beginDate,
      end_date: args.endDate,
    }),
  })
}

export async function getSettlementReportTask(accessToken: string, taskId: string) {
  return mpFetch<MpSettlementReportTask>(
    `/v1/account/settlement_report/task/${encodeURIComponent(taskId)}`,
    accessToken,
    { cache: "no-store" },
  )
}

export async function listSettlementReports(accessToken: string) {
  return mpFetch<MpSettlementReportListItem[]>("/v1/account/settlement_report/list", accessToken, {
    cache: "no-store",
  })
}

export async function searchSettlementReports(
  accessToken: string,
  args: { limit?: number; offset?: number } = {},
) {
  const params = new URLSearchParams()
  if (args.limit) params.set("limit", String(args.limit))
  if (args.offset) params.set("offset", String(args.offset))
  const query = params.toString()
  return mpFetch<MpSettlementReportSearch>(
    `/v1/account/settlement_report/search${query ? `?${query}` : ""}`,
    accessToken,
    { cache: "no-store" },
  )
}

export async function downloadSettlementReport(accessToken: string, fileName: string) {
  const url = `${MP_API}/v1/account/settlement_report/${encodeURIComponent(fileName)}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "text/csv,application/octet-stream,*/*",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Mercado Pago report download error: ${response.status} — ${body}`)
  }

  return {
    contentType: response.headers.get("content-type") ?? "text/csv; charset=utf-8",
    body: await response.text(),
  }
}

function parseCsvLine(line: string, separator: string) {
  const values: string[] = []
  let current = ""
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      i += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === separator && !quoted) {
      values.push(current.trim())
      current = ""
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

function detectSeparator(headerLine: string) {
  return headerLine.split(";").length >= headerLine.split(",").length ? ";" : ","
}

function parseAmount(value: string | undefined) {
  if (!value) return 0
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value) return value
  }
  return ""
}

export function parseSettlementReportCsv(
  csv: string,
  metadata: { fileName: string; generatedAt?: string | null },
): MpReportSummary {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return {
      fileName: metadata.fileName,
      generatedAt: metadata.generatedAt ?? null,
      rows: 0,
      totalCredits: 0,
      totalDebits: 0,
      netAmount: 0,
      transactions: [],
    }
  }

  const separator = detectSeparator(lines[0])
  const headers = parseCsvLine(lines[0], separator)
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, separator)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  })

  const transactions: MpReportMovement[] = rows.map((row, index) => {
    const sourceId = pick(row, ["SOURCE_ID", "source_id", "Id da fonte", "ID da fonte"])
    const transactionDate = pick(row, [
      "SETTLEMENT_DATE",
      "settlement_date",
      "MONEY_RELEASE_DATE",
      "money_release_date",
      "Data de liquidacao",
      "Data de liquidação",
      "Data de liberacao",
      "Data de liberação",
      "TRANSACTION_DATE",
      "transaction_date",
      "Data da transacao",
      "Data da transação",
    ])
    const description = pick(row, [
      "DESCRIPTION",
      "description",
      "Descricao",
      "Descrição",
      "TRANSACTION_TYPE",
      "transaction_type",
    ])
    const amount = parseAmount(
      pick(row, [
        "REAL_AMOUNT",
        "real_amount",
        "SETTLEMENT_NET_AMOUNT",
        "settlement_net_amount",
        "TRANSACTION_AMOUNT",
        "transaction_amount",
      ]),
    )

    return {
      id: sourceId || `${metadata.fileName}:${index}`,
      date: transactionDate || metadata.generatedAt || new Date().toISOString(),
      description: description || "Movimento Mercado Pago",
      amount: Math.abs(amount),
      type: amount >= 0 ? "credit" : "debit",
      status: pick(row, ["IS_RELEASED", "is_released"]) || "processed",
      raw: row,
    }
  })

  const totalCredits = transactions
    .filter((transaction) => transaction.type === "credit")
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const totalDebits = transactions
    .filter((transaction) => transaction.type === "debit")
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  return {
    fileName: metadata.fileName,
    generatedAt: metadata.generatedAt ?? null,
    rows: rows.length,
    totalCredits,
    totalDebits,
    netAmount: totalCredits - totalDebits,
    transactions,
  }
}
