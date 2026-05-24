import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { FinancialDashboard, type ModuleKey } from "@/components/finance/financial-dashboard"
import { isAdminEmail } from "@/lib/auth/admin"

export async function AuthenticatedModulePage({ module }: { module: ModuleKey }) {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  const user = await currentUser()
  const primaryEmail = user?.emailAddresses.find(
    (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
  )?.emailAddress

  if (!isAdminEmail(primaryEmail)) {
    redirect("/unauthorized")
  }

  return <FinancialDashboard initialModule={module} />
}
