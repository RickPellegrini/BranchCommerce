import { NextRequest } from "next/server"

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

function ok(data: unknown = { received: true }) {
  return Response.json(
    { ok: true, data },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  )
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
  try {
    const text = await request.text().catch(() => "")
    const payload = text ? (JSON.parse(text) as MpNotification) : null

    if (!payload) {
      console.warn("[mp-webhook] Empty or invalid payload")
      return ok()
    }

    console.log(
      `[mp-webhook] Received: topic=${payload.topic ?? payload.type} resource=${payload.resource ?? payload.data?.id ?? ""} user=${payload.user_id ?? ""}`,
    )

    await processNotification(payload)
  } catch (err) {
    console.error("[mp-webhook] Error processing notification:", err)
  }

  return ok()
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  console.log("[mp-webhook] Validation ping:", params)
  return ok({ received: true, params })
}

export async function OPTIONS() {
  return ok()
}
