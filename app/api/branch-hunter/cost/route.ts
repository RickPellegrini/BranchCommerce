import { ConvexHttpClient } from "convex/browser"
import { NextRequest } from "next/server"

import { api } from "@/convex/_generated/api"

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-branch-hunter-key",
  }
}

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
  }
  return new ConvexHttpClient(convexUrl)
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  })
}

export async function POST(request: NextRequest) {
  try {
    const syncKey = String(process.env.BRANCH_HUNTER_SYNC_KEY ?? "").trim()
    if (!syncKey) {
      return Response.json(
        { ok: false, error: "BRANCH_HUNTER_SYNC_KEY nao configurado." },
        { status: 500, headers: corsHeaders() },
      )
    }

    const providedKey = String(request.headers.get("x-branch-hunter-key") ?? "").trim()
    if (!providedKey || providedKey !== syncKey) {
      return Response.json(
        { ok: false, error: "Chave de sincronizacao invalida." },
        { status: 401, headers: corsHeaders() },
      )
    }

    const body = (await request.json()) as {
      mlItemId?: string
      unitCost?: number
    }

    const mlItemId = String(body.mlItemId ?? "").trim()
    const unitCost = Number(body.unitCost)

    if (!mlItemId) {
      return Response.json(
        { ok: false, error: "mlItemId obrigatorio." },
        { status: 400, headers: corsHeaders() },
      )
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      return Response.json(
        { ok: false, error: "unitCost invalido." },
        { status: 400, headers: corsHeaders() },
      )
    }

    const client = getConvexClient()
    const result = await client.mutation(api.stock.upsertCostFromBranchHunter, {
      mlItemId,
      unitCost,
    })

    return Response.json(
      {
        ok: true,
        data: result,
      },
      { status: 200, headers: corsHeaders() },
    )
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao sincronizar custo do produto.",
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}
