import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { StoreAdminPage } from "@/components/store/storefront"
import { isAdminEmail } from "@/lib/auth/admin"

export default async function DashboardStorePage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await currentUser()
  const primaryEmail = user?.emailAddresses.find(
    (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
  )?.emailAddress

  if (!isAdminEmail(primaryEmail)) redirect("/sign-in")

  return <StoreAdminPage />
}
