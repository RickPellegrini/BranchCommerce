import { randomUUID } from "crypto"

import { NextResponse } from "next/server"
import { MercadoPagoConfig, Payment } from "mercadopago"

import { getMercadoPagoConfig } from "@/lib/mercadopago/config"

type TestPaymentRequest = {
  token?: string
  paymentMethodId?: string
  issuerId?: string
  installments?: number
  email?: string
  identificationType?: string
  identificationNumber?: string
  qualitySecret?: string
}

const QUALITY_PAYMENT_AMOUNT = 10
const DEFAULT_NOTIFICATION_URL = "https://branchcommercehub.com/api/mp/notifications"

function maskCredential(value: string) {
  if (!value) return "(empty)"
  return `${value.slice(0, 10)}...${value.slice(-6)} (${value.length} chars)`
}

export async function GET() {
  const config = getMercadoPagoConfig()

  return NextResponse.json({
    publicKey: maskCredential(config.publicKey),
    accessToken: maskCredential(config.appAccessToken),
    publicKeyMode: config.publicKey.startsWith("TEST-") ? "test" : "production",
    accessTokenMode: config.appAccessToken.startsWith("TEST-") ? "test" : "production",
  })
}

export async function POST(request: Request) {
  try {
    const config = getMercadoPagoConfig()
    if (!config.appAccessToken) {
      return NextResponse.json(
        { error: "MERCADO_PAGO_ACCESS_TOKEN nao esta configurado." },
        { status: 500 },
      )
    }

    const body = (await request.json()) as TestPaymentRequest
    const expectedSecret = (process.env.MERCADO_PAGO_QUALITY_PAYMENT_SECRET ?? "").trim()
    const receivedSecret = (body.qualitySecret ?? "").trim()
    const requiresSecret =
      process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"
    if (requiresSecret && !expectedSecret) {
      return NextResponse.json(
        { error: "MERCADO_PAGO_QUALITY_PAYMENT_SECRET nao esta configurado." },
        { status: 503 },
      )
    }
    if (expectedSecret && receivedSecret !== expectedSecret) {
      return NextResponse.json(
        {
          error: "Pagamento de qualidade nao autorizado.",
          details: {
            expectedLength: expectedSecret.length,
            receivedLength: receivedSecret.length,
          },
        },
        { status: 403 },
      )
    }

    if (!body.token || !body.paymentMethodId || !body.email) {
      return NextResponse.json(
        { error: "Token do cartao, metodo de pagamento e email sao obrigatorios." },
        { status: 400 },
      )
    }

    const externalReference = `branchcommerce-quality-${Date.now()}`
    const notificationUrl = config.notificationUrl || DEFAULT_NOTIFICATION_URL

    const paymentPayload = {
      transaction_amount: QUALITY_PAYMENT_AMOUNT,
      token: body.token,
      description: "BranchCommerce test payment",
      external_reference: externalReference,
      notification_url: notificationUrl,
      installments: body.installments ?? 1,
      payment_method_id: body.paymentMethodId,
      issuer_id: body.issuerId ? Number(body.issuerId) : undefined,
      additional_info: {
        items: [
          {
            id: "branchcommerce-quality-test",
            title: "BranchCommerce quality test payment",
            description: "Production payment used to measure Mercado Pago integration quality",
            category_id: "services",
            quantity: 1,
            unit_price: QUALITY_PAYMENT_AMOUNT,
          },
        ],
      },
      payer: {
        email: body.email,
        identification:
          body.identificationType && body.identificationNumber
            ? {
                type: body.identificationType,
                number: body.identificationNumber,
              }
            : undefined,
      },
    }

    const client = new MercadoPagoConfig({
      accessToken: config.appAccessToken,
      options: {
        idempotencyKey: randomUUID(),
      },
    })
    const payment = new Payment(client)
    const payload = await payment.create({ body: paymentPayload })

    return NextResponse.json(payload)
  } catch (error) {
    const details =
      typeof error === "object" && error !== null && "cause" in error
        ? (error as { cause?: unknown }).cause
        : undefined
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message, details }, { status: 500 })
  }
}
