import { auth } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { api } from "@/convex/_generated/api"
import { hashStoreCartToken, STORE_CART_COOKIE } from "@/lib/store/cart-token"
import { getStoreConvexClient } from "@/lib/store/convex-http"
import { getStoreServerKey } from "@/lib/store/server-key"

type CheckoutPayload = {
  customer?: {
    email?: string
    name?: string
    phone?: string
  }
  shippingAddress?: {
    name?: string
    phone?: string
    zipCode?: string
    street?: string
    number?: string
    complement?: string
    district?: string
    city?: string
    state?: string
  }
}

type MercadoPagoPreferenceResponse = {
  id: string
  init_point?: string
  sandbox_init_point?: string
}

function getMercadoPagoAccessToken() {
  return process.env.MERCADO_PAGO_STORE_ACCESS_TOKEN ?? process.env.MERCADO_PAGO_ACCESS_TOKEN ?? ""
}

function getRequiredString(value: string | undefined, field: string) {
  const clean = value?.trim()
  if (!clean) throw new Error(`${field} obrigatorio.`)
  return clean
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getMercadoPagoAccessToken()
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "Mercado Pago nao configurado para checkout da loja." },
        { status: 503 },
      )
    }

    const cookieStore = await cookies()
    const cartToken = cookieStore.get(STORE_CART_COOKIE)?.value
    if (!cartToken) {
      return NextResponse.json({ ok: false, error: "Carrinho nao encontrado." }, { status: 400 })
    }

    const body = (await request.json()) as CheckoutPayload
    const { userId } = await auth()
    const origin = new URL(request.url).origin
    const client = getStoreConvexClient()
    const serverKey = getStoreServerKey()

    const pending = await client.mutation(api.storeCheckout.createPendingOrder, {
      cartTokenHash: hashStoreCartToken(cartToken),
      clerkUserId: userId ?? undefined,
      customer: {
        email: getRequiredString(body.customer?.email, "Email"),
        name: getRequiredString(body.customer?.name, "Nome"),
        phone: body.customer?.phone?.trim() || undefined,
      },
      shippingAddress: {
        name: body.shippingAddress?.name?.trim() || getRequiredString(body.customer?.name, "Nome"),
        phone: body.shippingAddress?.phone?.trim() || body.customer?.phone?.trim() || undefined,
        zipCode: getRequiredString(body.shippingAddress?.zipCode, "CEP"),
        street: getRequiredString(body.shippingAddress?.street, "Rua"),
        number: getRequiredString(body.shippingAddress?.number, "Numero"),
        complement: body.shippingAddress?.complement?.trim() || undefined,
        district: getRequiredString(body.shippingAddress?.district, "Bairro"),
        city: getRequiredString(body.shippingAddress?.city, "Cidade"),
        state: getRequiredString(body.shippingAddress?.state, "UF"),
      },
    })

    if (!pending.order) throw new Error("Pedido nao foi criado.")

    const orderUrl = `${origin}/loja/pedido/${pending.order.orderNumber}`
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: pending.items.map((item) => ({
          id: String(item.storeProductId),
          title: item.titleSnapshot,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          currency_id: "BRL",
        })),
        payer: {
          name: body.customer?.name,
          email: body.customer?.email,
          phone: body.customer?.phone ? { number: body.customer.phone } : undefined,
        },
        shipments: {
          cost: pending.order.shippingTotal,
          mode: "not_specified",
        },
        external_reference: pending.order.orderNumber,
        notification_url:
          process.env.MERCADO_PAGO_STORE_NOTIFICATION_URL ??
          process.env.MERCADO_PAGO_NOTIFICATION_URL ??
          `${origin}/api/store/payments/mp-webhook`,
        back_urls: {
          success: orderUrl,
          pending: orderUrl,
          failure: `${origin}/loja/checkout?payment=failed`,
        },
        auto_return: "approved",
        metadata: {
          branch_channel: "storefront",
          order_number: pending.order.orderNumber,
        },
      }),
    })

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text().catch(() => "")
      throw new Error(`Mercado Pago recusou preference: ${mpResponse.status} ${errorText}`)
    }

    const preference = (await mpResponse.json()) as MercadoPagoPreferenceResponse
    await client.mutation(api.storeCheckout.attachPaymentPreference, {
      serverKey,
      orderId: pending.order._id,
      mpPreferenceId: preference.id,
    })

    return NextResponse.json({
      ok: true,
      orderNumber: pending.order.orderNumber,
      preferenceId: preference.id,
      initPoint: preference.init_point ?? preference.sandbox_init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[store/mp-preference] failed:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
