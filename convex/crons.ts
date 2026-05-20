import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

crons.cron(
  "mercado pago report sync morning",
  "0 10 * * *",
  internal.mpCron.syncMercadoPagoReports,
  { reason: "morning" },
)

crons.cron(
  "mercado pago report sync afternoon",
  "0 16 * * *",
  internal.mpCron.syncMercadoPagoReports,
  { reason: "afternoon" },
)

crons.cron(
  "mercado pago report sync evening",
  "0 22 * * *",
  internal.mpCron.syncMercadoPagoReports,
  { reason: "evening" },
)

export default crons
