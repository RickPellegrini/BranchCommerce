import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { isAdminEmail } from "@/lib/auth/admin"

export default async function Home() {
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

  redirect("/dashboard")
}
