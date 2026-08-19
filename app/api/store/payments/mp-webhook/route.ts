import { NextRequest, NextResponse } from "next/server"

import { api } from "@/convex/_generated/api"
import { getStoreConvexClient } from "@/lib/store/convex-http"
import { getStoreServerKey } from "@/lib/store/server-key"

type MpWebhookPayload = {
  id?: string | number
  type?: string
  topic?: string
  action?: string
  resource?: string
  data?: { id?: string | number }
}

type MpPaymentResponse = {
  id: string | number
  status?: string
  status_detail?: string
  transaction_amount?: number
  external_reference?: string
  preference_id?: string
}

function getMercadoPagoAccessToken() {
  return process.env.MERCADO_PAGO_STORE_ACCESS_TOKEN ?? process.env.MERCADO_PAGO_ACCESS_TOKEN ?? ""
}

function mapPaymentStatus(status: string | undefined) {
  switch (status) {
    case "approved":
      return "paid" as const
    case "cancelled":
      return "cancelled" as const
    case "rejected":
    case "refunded":
    case "charged_back":
      return "failed" as const
    case "expired":
      return "expired" as const
    default:
      return "pending" as const
  }
}

function extractPaymentId(request: NextRequest, payload: MpWebhookPayload | null) {
  const params = request.nextUrl.searchParams
  const fromResource = payload?.resource?.match(/\/payments\/([^/?]+)/)?.[1]
  return (
    payload?.data?.id?.toString() ??
    payload?.id?.toString() ??
    params.get("data.id") ??
    params.get("id") ??
    fromResource ??
    ""
  )
}

export async function POST(request: NextRequest) {
  try {
    const text = await request.text().catch(() => "")
    const payload = text ? (JSON.parse(text) as MpWebhookPayload) : null
    const topic = payload?.type ?? payload?.topic ?? request.nextUrl.searchParams.get("topic")

    if (topic && topic !== "payment" && topic !== "payments") {
      return NextResponse.json({ ok: true, skipped: topic })
    }

    const paymentId = extractPaymentId(request, payload)
    if (!paymentId) {
      return NextResponse.json({ ok: true, skipped: "missing_payment_id" })
    }

    const accessToken = getMercadoPagoAccessToken()
    if (!accessToken) {
      console.warn("[store/mp-webhook] Mercado Pago token missing; payment not fetched.")
      return NextResponse.json({ ok: true, skipped: "missing_access_token" }, { status: 202 })
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    })

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text().catch(() => "")
      console.error("[store/mp-webhook] payment fetch failed:", paymentResponse.status, errorText)
      return NextResponse.json({ ok: true, skipped: "payment_fetch_failed" }, { status: 202 })
    }

    const payment = (await paymentResponse.json()) as MpPaymentResponse
    const client = getStoreConvexClient()
    const serverKey = getStoreServerKey()
    const result = await client.mutation(api.storeCheckout.applyMercadoPagoPayment, {
      serverKey,
      orderNumber: payment.external_reference || undefined,
      mpPreferenceId: payment.preference_id || undefined,
      mpPaymentId: String(payment.id),
      status: mapPaymentStatus(payment.status),
      rawStatus: payment.status_detail ?? payment.status,
      amount: payment.transaction_amount ?? 0,
    })

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error("[store/mp-webhook] failed:", error)
    return NextResponse.json({ ok: true, skipped: "handler_error" }, { status: 202 })
  }
}

export async function GET(request: NextRequest) {
  const paymentId = extractPaymentId(request, null)
  return NextResponse.json({ ok: true, received: true, paymentId })
}
