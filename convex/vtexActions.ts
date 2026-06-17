import { internalAction } from "./_generated/server"
import { v } from "convex/values"

import type { VtexProductState } from "./vtex"
import { fetchVtexProductState } from "./vtexFetch"

export const consultarSku = internalAction({
  args: { sku: v.string() },
  handler: async (_ctx, { sku }): Promise<VtexProductState | null> => {
    return fetchVtexProductState(sku)
  },
})
