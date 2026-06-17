# 06 — Notificação Telegram

## Objetivo

Action Convex que recebe os dados do restock e envia 2 mensagens no Telegram do usuário: foto+preço e Pix copia-e-cola separado.

## Por que 2 mensagens

A primeira mostra o produto com foto pra você decidir rápido se vai comprar.
A segunda traz só o Pix em `<code>` — fácil de tocar e copiar no celular sem pegar o resto da mensagem junto.

## Arquivo: `convex/telegram.ts`

```ts
"use node"

import { internalAction } from "./_generated/server"
import { v } from "convex/values"

const TELEGRAM_API = "https://api.telegram.org/bot"

type SendMessageParams = {
  chatId: string
  text: string
}

type SendPhotoParams = {
  chatId: string
  photoUrl: string
  caption: string
}

async function sendMessage({ chatId, text }: SendMessageParams): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado")

  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  })
  return res.ok
}

async function sendPhoto({ chatId, photoUrl, caption }: SendPhotoParams): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado")

  const res = await fetch(`${TELEGRAM_API}${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption: caption.slice(0, 1024), // limite Telegram
      parse_mode: "HTML",
    }),
  })
  return res.ok
}

export const enviarRestockAlert = internalAction({
  args: {
    chatId: v.string(),
    nome: v.string(),
    sku: v.string(),
    preco: v.number(),
    quantidade: v.number(),
    precoPix: v.number(),
    pixCode: v.string(),
    imagemUrl: v.optional(v.string()),
    link: v.string(),
  },
  handler: async (_ctx, args): Promise<{ sucesso: boolean; erro?: string }> => {
    const total = args.preco * args.quantidade
    const horario = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })

    const caption =
      `🚨 <b>RESTOCK!</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📦 <b>${args.nome}</b>\n` +
      `💰 Preço: <b>R$ ${args.preco.toFixed(2)}</b>\n` +
      `🛒 ${args.quantidade}x = <b>R$ ${total.toFixed(2)}</b>\n` +
      `💳 Pix (−5%): <b>R$ ${args.precoPix.toFixed(2)}</b>\n` +
      `🔗 <a href="${args.link}">Abrir produto</a>\n` +
      `⏰ ${horario}`

    try {
      // Mensagem 1: foto + preço (ou texto se não houver foto)
      let primeiraEnviada = false
      if (args.imagemUrl) {
        primeiraEnviada = await sendPhoto({
          chatId: args.chatId,
          photoUrl: args.imagemUrl,
          caption,
        })
      }
      if (!primeiraEnviada) {
        await sendMessage({ chatId: args.chatId, text: caption })
      }

      // Mensagem 2: Pix copia-e-cola separado
      await sendMessage({
        chatId: args.chatId,
        text: `💳 <b>PIX — R$ ${args.precoPix.toFixed(2)}</b>\n\n<code>${args.pixCode}</code>`,
      })

      return { sucesso: true }
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e)
      console.error("[Telegram] erro:", erro)
      return { sucesso: false, erro }
    }
  },
})
```

## Configuração inicial do bot

1. No Telegram, fale com **@BotFather**
2. `/newbot` → escolha nome e username
3. Copie o token retornado
4. Configure no Convex:
   ```bash
   npx convex env set TELEGRAM_BOT_TOKEN "123456:ABC..."
   ```

## Como o usuário descobre o `chatId`

1. Usuário fala com **@userinfobot** no Telegram
2. Recebe o ID
3. Cola no dashboard (página de settings)
4. Salvo em `userSettings.telegramChatId`

> ⚠️ Antes de o bot conseguir mandar mensagem para o usuário, o usuário **precisa abrir o bot e enviar `/start`** uma vez. Telegram bloqueia mensagens não solicitadas.

## Casos de erro a tratar

| Erro Telegram | Causa | Tratamento |
|---|---|---|
| `400 chat not found` | chatId errado ou não deu /start | Marcar config como inválida, alertar no dashboard |
| `403 bot was blocked` | Usuário bloqueou o bot | Pausar monitoramento, marcar config |
| `429 too many requests` | Rate limit | Backoff exponencial |
| `5xx` | Telegram fora do ar | Retry 3x com backoff |

## Critério de aceite

- [ ] `TELEGRAM_BOT_TOKEN` no env do Convex (não no front)
- [ ] Mensagens chegam em <2s no Telegram
- [ ] Foto chega quando há `imagemUrl`
- [ ] Fallback para texto puro funciona
- [ ] Pix em `<code>` é tocável e copia inteiro
- [ ] Erros logados sem vazar token
