import { FinancialDashboard, type ModuleKey } from "@/components/finance/financial-dashboard"
import type { AdminDocumentCategory } from "@/lib/administrativo/documents"
import { requireAdminAppUserOrRedirect } from "@/lib/auth/server"

export async function AuthenticatedModulePage({
  module,
  administrativeCategory,
}: {
  module: ModuleKey
  administrativeCategory?: AdminDocumentCategory
}) {
  await requireAdminAppUserOrRedirect()
  return (
    <FinancialDashboard initialModule={module} administrativeCategory={administrativeCategory} />
  )
}
