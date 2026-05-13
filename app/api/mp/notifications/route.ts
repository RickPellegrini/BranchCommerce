import { NextRequest } from "next/server"

import { jsonOk } from "@/lib/mercadolivre/http"

type MpNotification = {
  id?: number | string
  type?: string
  topic?: string
  action?: string
  user_id?: number | string
  api_version?: string
  data?: { id?: string | number }
  resource?: string
}

async function processNotification(notification: MpNotification) {
  const topic = notification.topic ?? notification.type ?? "unknown"
  const resource =
    notification.resource ?? (notification.data?.id ? String(notification.data.id) : "")

  console.log(
    `[mp-webhook] Processing topic=${topic} action=${notification.action ?? ""} resource=${resource} user=${notification.user_id ?? ""}`,
  )

  switch (topic) {
    case "payment":
    case "payments":
      console.log(`[mp-webhook] Payment event: ${resource}`)
      break
    case "merchant_order":
      console.log(`[mp-webhook] Merchant order event: ${resource}`)
      break
    case "chargebacks":
    case "chargeback":
      console.log(`[mp-webhook] Chargeback event: ${resource}`)
      break
    default:
      console.log(`[mp-webhook] Unhandled topic=${topic}: ${resource}`)
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as MpNotification | null

  if (!payload) {
    console.warn("[mp-webhook] Invalid payload")
    return jsonOk({ received: true })
  }

  console.log(
    `[mp-webhook] Received: topic=${payload.topic ?? payload.type} resource=${payload.resource ?? payload.data?.id ?? ""} user=${payload.user_id ?? ""}`,
  )

  try {
    await processNotification(payload)
  } catch (err) {
    console.error("[mp-webhook] Error processing notification:", err)
  }

  return jsonOk({ received: true })
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  console.log("[mp-webhook] Validation ping:", params)
  return jsonOk({ received: true, params })
}
