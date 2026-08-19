import { StoreAdminPage } from "@/components/store/storefront"
import { requireAdminAppUserOrRedirect } from "@/lib/auth/server"

export default async function DashboardStorePage() {
  await requireAdminAppUserOrRedirect()
  return <StoreAdminPage />
}
