import { auth, currentUser } from "@clerk/nextjs/server"

export async function requireAuthenticatedAppUserId() {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Usuario nao autenticado.")
  }
  return userId
}

export async function getCurrentUserEmail() {
  const user = await currentUser()
  return (
    user?.emailAddresses.find((emailAddress) => emailAddress.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null
  )
}
