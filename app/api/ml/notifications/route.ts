import { NextRequest } from "next/server"
import { jsonOk } from "@/lib/mercadolivre/http"

const ML_NOTIFICATION_IPS = new Set([
  "54.88.218.97",
  "18.215.140.160",
  "18.213.114.129",
  "18.206.34.84",
])

function extractIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  )
}

type MlNotification = {
  _id?: string
  resource: string
  user_id: number | string
  topic: string
  application_id?: number
  attempts?: number
  sent?: string
  received?: string
  actions?: string[]
}

async function processNotification(notification: MlNotification) {
  const { topic, resource, user_id } = notification
  const actions = notification.actions ?? []

  console.log(
    `[ml-webhook] Processing topic=${topic} resource=${resource} user=${user_id} actions=${actions.join(",")}`,
  )

  switch (topic) {
    case "orders_v2":
      console.log(`[ml-webhook] Order changed: ${resource}`)
      break

    case "items":
      console.log(`[ml-webhook] Item changed: ${resource}`)
      break

    case "payments":
      console.log(`[ml-webhook] Payment event: ${resource}`)
      break

    case "shipments":
      console.log(`[ml-webhook] Shipment event: ${resource}`)
      break

    case "catalog_item_competition_status":
      console.log(`[ml-webhook] Catalog competition changed: ${resource}`)
      break

    case "messages":
      console.log(`[ml-webhook] Message event: ${resource} actions=${actions.join(",")}`)
      break

    case "questions":
      console.log(`[ml-webhook] Question event: ${resource}`)
      break

    default:
      console.log(`[ml-webhook] Unhandled topic=${topic}: ${resource}`)
  }
}

export async function POST(request: NextRequest) {
  const ip = extractIp(request)
  const isProduction = process.env.NODE_ENV === "production"

  if (isProduction && ip && !ML_NOTIFICATION_IPS.has(ip)) {
    console.warn(`[ml-webhook] Rejected POST from untrusted IP: ${ip}`)
    return new Response("Forbidden", { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as MlNotification | null

  if (!payload || !payload.topic || !payload.resource) {
    console.warn("[ml-webhook] Invalid payload:", payload)
    return jsonOk({ received: true })
  }

  console.log(
    `[ml-webhook] Received: topic=${payload.topic} resource=${payload.resource} ` +
      `user_id=${payload.user_id} attempt=${payload.attempts ?? 1} ip=${ip ?? "unknown"}`,
  )

  try {
    await processNotification(payload)
  } catch (err) {
    console.error("[ml-webhook] Error processing notification:", err)
  }

  return jsonOk({ received: true })
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  console.log("[ml-webhook] Validation ping:", params)
  return jsonOk({ received: true, params })
}
