import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { api } from "@/convex/_generated/api"
import { hashStoreCartToken, STORE_CART_COOKIE } from "@/lib/store/cart-token"
import { getStoreConvexClient } from "@/lib/store/convex-http"

export async function GET(request: NextRequest) {
  const orderNumber = request.nextUrl.searchParams.get("orderNumber")?.trim()
  if (!orderNumber) {
    return NextResponse.json({ ok: false, error: "Pedido obrigatorio." }, { status: 400 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(STORE_CART_COOKIE)?.value
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() || undefined
  const client = getStoreConvexClient()

  const order = await client.query(api.storeOrders.getPublicOrderStatus, {
    orderNumber,
    cartTokenHash: token ? hashStoreCartToken(token) : undefined,
    email,
  })

  if (!order) {
    return NextResponse.json({ ok: false, error: "Pedido nao encontrado." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, order })
}
