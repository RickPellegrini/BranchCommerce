import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

crons.cron("mercado pago report sync daily", "0 10 * * *", internal.mpCron.syncMercadoPagoReports, {
  reason: "daily",
})
crons.interval("branchnotify vtex", { seconds: 30 }, internal.monitorRun.runTick, {})

export default crons
