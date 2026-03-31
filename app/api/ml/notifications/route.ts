import { jsonOk } from "@/lib/mercadolivre/http"

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  console.log("[Mercado Livre webhook] payload:", payload)
  return jsonOk({ received: true })
}

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  console.log("[Mercado Livre webhook] validation ping:", params)
  return jsonOk({ received: true, params })
}
