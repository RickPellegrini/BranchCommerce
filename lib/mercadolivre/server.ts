import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { fetchMlApi, getValidMlConnection } from "@/lib/mercadolivre/storage"

export async function requireMlConnection() {
  const appUserId = await requireAuthenticatedAppUserId()
  const connection = await getValidMlConnection(appUserId)
  return { appUserId, connection }
}

export async function fetchMlWithConnection<T>(path: string) {
  const { connection } = await requireMlConnection()
  return fetchMlApi<T>(path, connection.accessToken)
}
