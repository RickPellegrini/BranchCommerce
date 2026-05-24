import { AuthenticatedModulePage } from "@/components/layout/authenticated-module-page"

export default async function DashboardPage() {
  return <AuthenticatedModulePage module="home" />
}
