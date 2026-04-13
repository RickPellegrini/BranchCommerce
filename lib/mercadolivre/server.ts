import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { getValidMlConnection } from "@/lib/mercadolivre/storage"

export async function requireMlConnection() {
  const appUserId = await requireAuthenticatedAppUserId()
  const connection = await getValidMlConnection(appUserId)
  return { appUserId, connection }
}
