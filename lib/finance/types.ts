export type CategoryKind = "income" | "expense"
export type ExpenseType = "fixed" | "variable"
export type TransactionPeriodicity =
  | "one_time"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
export type FinancialPeriod = "day" | "week" | "month"
export type BillStatus = "paid" | "pending" | "overdue"
export type BillKind = "payable" | "receivable"

export type FinancialCategory = {
  id: string
  name: string
  kind: CategoryKind
}

/** Comprovante anexado a um lançamento (local `File` ou já persistido no Convex). */
export type AnexoLancamento = {
  id: string
  file?: File
  uploadedAt: number
  fileName?: string
  mimeType?: string
  byteSize?: number
  remoteUrl?: string | null
  convexAttachmentId?: string
}

export type PaymentMethod = "pix" | "debit" | "credit"
export type PayStatus = "none" | "pending" | "paid"

export type FinancialTransaction = {
  id: string
  kind: CategoryKind
  amount: number
  date: string
  description: string
  categoryId: string
  origin?: string
  expenseType?: ExpenseType
  periodicity?: TransactionPeriodicity
  paymentMethod?: PaymentMethod
  installmentPlanId?: string
  installmentIndex?: number
  installmentCount?: number
  payStatus?: PayStatus
  linkedSourceTransactionId?: string
}

export type FinancialBill = {
  id: string
  title: string
  amount: number
  dueDate: string
  status: BillStatus
  kind: BillKind
  categoryId: string
}

export type TransactionFilters = {
  startDate?: string
  endDate?: string
  categoryId?: string
  kind?: "all" | CategoryKind
}

export type MonthlyEvolutionPoint = {
  monthLabel: string
  income: number
  expense: number
  result: number
}
