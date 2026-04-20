import { describe, expect, it } from "vitest"
import { sanitizeConvexErrorMessage } from "./sanitize-convex-error"

describe("sanitizeConvexErrorMessage", () => {
  it("extrai só a mensagem útil de um erro Convex típico", () => {
    const raw = `[CONVEX M(stock:applyKanbanMove)] [Request ID: fa4aa21f87d33148] Server Error Uncaught Error: Sem unidades em estoque. Ajuste a quantidade no produto antes de colocar em No estoque. at handler (../convex/stock.ts:258:10) Called by client`
    expect(sanitizeConvexErrorMessage(raw)).toBe(
      "Sem unidades em estoque. Ajuste a quantidade no produto antes de colocar em No estoque.",
    )
  })

  it("mantém mensagens já limpas", () => {
    expect(sanitizeConvexErrorMessage("Produto inválido.")).toBe("Produto inválido.")
  })
})
