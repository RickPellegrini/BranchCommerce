export const dynamic = "force-dynamic"

import { jsonOk, jsonError } from "@/lib/mercadolivre/http"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { fetchMlApi } from "@/lib/mercadolivre/storage"

type MissedFeed = {
  _id: string
  resource: string
  user_id: number
  topic: string
  application_id: number
  attempts: number
  sent: string
  received: string
}

type MissedFeedsResponse = {
  messages: MissedFeed[]
}

export async function GET() {
  try {
    const { connection } = await requireMlConnection()
    const appId = process.env.MERCADO_LIVRE_CLIENT_ID

    if (!appId) {
      return jsonError("MERCADO_LIVRE_CLIENT_ID not configured", 500)
    }

    const data = await fetchMlApi<MissedFeedsResponse>(
      `/missed_feeds?app_id=${appId}&limit=50`,
      connection.accessToken,
    )

    const feeds = data.messages ?? []

    console.log(`[missed-feeds] Found ${feeds.length} missed notifications`)

    const byTopic = new Map<string, number>()
    for (const feed of feeds) {
      byTopic.set(feed.topic, (byTopic.get(feed.topic) ?? 0) + 1)
    }

    if (byTopic.size > 0) {
      console.log("[missed-feeds] By topic:", Object.fromEntries(byTopic))
    }

    return jsonOk({
      total: feeds.length,
      byTopic: Object.fromEntries(byTopic),
      feeds,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[missed-feeds] Error:", msg)
    return jsonError(msg, 500)
  }
}
