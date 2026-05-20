import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { jsonError, jsonOk } from "@/lib/mercadolivre/http"

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
  return new ConvexHttpClient(convexUrl)
}

export async function GET() {
  try {
    const appUserId = await requireAuthenticatedAppUserId()
    const client = getConvexClient()
    const ledger = await client.query(api.mercadopago.getLedger, {
      appUserId,
      limit: 100,
    })
    return jsonOk(ledger)
  } catch (error) {
    console.error("[mp/ledger] GET error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    return jsonError(
      "Erro ao consultar ledger Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}

export async function POST(request: Request) {
  try {
    const appUserId = await requireAuthenticatedAppUserId()
    const body = (await request.json().catch(() => null)) as {
      balance?: unknown
      currencyId?: unknown
      anchoredAt?: unknown
      note?: unknown
    } | null

    const balance = Number(body?.balance)
    if (!Number.isFinite(balance)) {
      return jsonError("Informe balance numerico.", 400)
    }

    const anchoredAt =
      typeof body?.anchoredAt === "string" && body.anchoredAt
        ? body.anchoredAt
        : new Date().toISOString()

    const client = getConvexClient()
    await client.mutation(api.mercadopago.setBalanceAnchor, {
      appUserId,
      balance,
      currencyId: typeof body?.currencyId === "string" ? body.currencyId : "BRL",
      anchoredAt,
      note: typeof body?.note === "string" ? body.note : undefined,
    })

    const ledger = await client.query(api.mercadopago.getLedger, {
      appUserId,
      limit: 100,
    })
    return jsonOk(ledger)
  } catch (error) {
    console.error("[mp/ledger] POST error:", error)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    return jsonError(
      "Erro ao salvar ancora Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
