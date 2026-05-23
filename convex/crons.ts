import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

crons.cron("mercado pago report sync daily", "0 10 * * *", internal.mpCron.syncMercadoPagoReports, {
  reason: "daily",
})

export default crons
