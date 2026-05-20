import { v } from "convex/values"

import { internalAction } from "./_generated/server"

export const syncMercadoPagoReports = internalAction({
  args: {
    reason: v.optional(v.string()),
  },
  handler: async (_, args) => {
    const appUrl = process.env.APP_URL ?? "https://branchcommercehub.com"
    const secret = process.env.CRON_SECRET

    if (!secret) {
      throw new Error("CRON_SECRET nao definido no Convex.")
    }

    const url = new URL("/api/mp/reports/sync", appUrl)
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        "User-Agent": `branchcommerce-convex-cron/${args.reason ?? "scheduled"}`,
      },
    })

    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Mercado Pago sync failed: ${response.status} ${text.slice(0, 500)}`)
    }

    return {
      ok: true,
      status: response.status,
      body: text.slice(0, 1000),
    }
  },
})
