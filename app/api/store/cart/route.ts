import { auth } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  createStoreCartToken,
  hashStoreCartToken,
  STORE_CART_COOKIE,
  STORE_CART_MAX_AGE_SECONDS,
} from "@/lib/store/cart-token"
import { getStoreConvexClient } from "@/lib/store/convex-http"

function setCartCookie(response: NextResponse, token: string, request: NextRequest) {
  response.cookies.set(STORE_CART_COOKIE, token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: STORE_CART_MAX_AGE_SECONDS,
  })
  return response
}

async function getCartToken() {
  const cookieStore = await cookies()
  const existing = cookieStore.get(STORE_CART_COOKIE)?.value
  return existing || createStoreCartToken()
}

export async function GET(request: NextRequest) {
  const token = await getCartToken()
  const tokenHash = hashStoreCartToken(token)
  const { userId } = await auth()
  const client = getStoreConvexClient()

  const cart = await client.mutation(api.storeCart.ensureCart, {
    cartTokenHash: tokenHash,
    clerkUserId: userId ?? undefined,
  })

  return setCartCookie(NextResponse.json(cart), token, request)
}

export async function POST(request: NextRequest) {
  const token = await getCartToken()
  const tokenHash = hashStoreCartToken(token)
  const { userId } = await auth()
  const body = (await request.json()) as { storeProductId?: string; quantity?: number }

  if (!body.storeProductId) {
    return NextResponse.json({ ok: false, error: "Produto obrigatorio." }, { status: 400 })
  }

  const client = getStoreConvexClient()
  const cart = await client.mutation(api.storeCart.addItem, {
    cartTokenHash: tokenHash,
    clerkUserId: userId ?? undefined,
    storeProductId: body.storeProductId as Id<"storeProducts">,
    quantity: body.quantity ?? 1,
  })

  return setCartCookie(NextResponse.json(cart), token, request)
}

export async function PATCH(request: NextRequest) {
  const token = await getCartToken()
  const tokenHash = hashStoreCartToken(token)
  const body = (await request.json()) as { storeProductId?: string; quantity?: number }

  if (!body.storeProductId || body.quantity === undefined) {
    return NextResponse.json(
      { ok: false, error: "Produto e quantidade obrigatorios." },
      { status: 400 },
    )
  }

  const client = getStoreConvexClient()
  const cart = await client.mutation(api.storeCart.updateItem, {
    cartTokenHash: tokenHash,
    storeProductId: body.storeProductId as Id<"storeProducts">,
    quantity: body.quantity,
  })

  return setCartCookie(NextResponse.json(cart), token, request)
}

export async function DELETE(request: NextRequest) {
  const token = await getCartToken()
  const tokenHash = hashStoreCartToken(token)
  const storeProductId = request.nextUrl.searchParams.get("storeProductId")

  if (!storeProductId) {
    return NextResponse.json({ ok: false, error: "Produto obrigatorio." }, { status: 400 })
  }

  const client = getStoreConvexClient()
  const cart = await client.mutation(api.storeCart.removeItem, {
    cartTokenHash: tokenHash,
    storeProductId: storeProductId as Id<"storeProducts">,
  })

  return setCartCookie(NextResponse.json(cart), token, request)
}
