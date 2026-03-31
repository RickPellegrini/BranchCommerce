import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { requestMlApi } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"

type UpdateListingBody = {
  title?: string
  price?: number
  availableQuantity?: number
  status?: "active" | "paused" | "closed"
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const payload = (await request.json()) as UpdateListingBody

    const updatePayload: Record<string, unknown> = {}
    if (typeof payload.title === "string" && payload.title.trim()) {
      updatePayload.title = payload.title.trim()
    }
    if (typeof payload.price === "number" && payload.price >= 0) {
      updatePayload.price = payload.price
    }
    if (
      typeof payload.availableQuantity === "number" &&
      Number.isInteger(payload.availableQuantity) &&
      payload.availableQuantity >= 0
    ) {
      updatePayload.available_quantity = payload.availableQuantity
    }
    if (payload.status && ["active", "paused", "closed"].includes(payload.status)) {
      updatePayload.status = payload.status
    }

    if (Object.keys(updatePayload).length === 0) {
      return jsonError("Nenhum campo valido para atualizar anuncio.", 400)
    }

    const { connection } = await requireMlConnection()
    const updated = await requestMlApi<Record<string, unknown>>(
      `/items/${id}`,
      connection.accessToken,
      {
        method: "PUT",
        body: updatePayload,
      },
    )

    return jsonOk(updated)
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message.includes("nao conectada")) {
      return jsonError("Conta do Mercado Livre nao conectada.", 404)
    }
    return jsonError(
      "Erro ao atualizar anuncio do Mercado Livre.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
