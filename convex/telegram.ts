import { internalAction } from "./_generated/server"
import { v } from "convex/values"

export const sendMessage = internalAction({
  args: { chatId: v.string(), text: v.string() },
  handler: async (_ctx, { chatId, text }) => {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      console.warn("[branchnotify] TELEGRAM_BOT_TOKEN nao definido")
      return
    }
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error("[branchnotify] Telegram HTTP", res.status, err)
    }
  },
})
