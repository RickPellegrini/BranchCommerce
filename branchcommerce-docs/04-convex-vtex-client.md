# 04 — Cliente VTEX (Eletro Club)

## Objetivo

Função pura que recebe um SKU e retorna estado normalizado do produto na Eletro Club.

## Arquitetura

```
consultarSku(sku)
    ↓
fetch VTEX API (/api/catalog_system/pub/products/search?fq=skuId:XXX)
    ↓
parseVtexResponse() ← pura, testável
    ↓
{ disponivel, preco, precoOriginal, nome, imagem, link }
```

A separação entre **fetch** e **parse** é crítica para testar — testes unitários do parser não dependem de rede.

## Arquivo: `convex/vtex.ts`

```ts
"use node" // necessário porque usa fetch nativo Node

import { action, internalAction } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"

const VTEX_BASE = "https://www.eletroclub.com.br"

export type VtexProductState = {
  sku: string
  disponivel: boolean
  preco: number
  precoOriginal: number
  nomeProduto: string
  imagemUrl: string | null
  link: string
}

// PURO — testável sem mocks de rede
export function parseVtexResponse(sku: string, data: unknown): VtexProductState {
  const empty: VtexProductState = {
    sku, disponivel: false, preco: 0, precoOriginal: 0,
    nomeProduto: `SKU ${sku}`, imagemUrl: null, link: "",
  }

  if (!Array.isArray(data) || data.length === 0) return empty

  const produto = data[0] as any
  const items = produto.items ?? []
  const item = items.find((i: any) => i.itemId === sku)
  if (!item) return empty

  const seller = item.sellers?.[0]
  const offer = seller?.commertialOffer
  if (!offer) return empty

  return {
    sku,
    disponivel: Boolean(offer.IsAvailable),
    preco: offer.Price ?? 0,
    precoOriginal: offer.ListPrice ?? offer.Price ?? 0,
    nomeProduto: produto.productName ?? `SKU ${sku}`,
    imagemUrl: item.images?.[0]?.imageUrl ?? null,
    link: produto.link ?? "",
  }
}

// I/O — chamado pelo cron e por testes integrados
export const consultarSku = internalAction({
  args: { sku: v.string() },
  handler: async (_ctx, { sku }): Promise<VtexProductState | null> => {
    const url = `${VTEX_BASE}/api/catalog_system/pub/products/search?fq=skuId:${sku}`
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; restock-bot/1.0)",
          "Accept": "application/json",
        },
      })
      if (!res.ok) {
        console.warn(`[VTEX] HTTP ${res.status} para SKU ${sku}`)
        return null
      }
      const data = await res.json()
      return parseVtexResponse(sku, data)
    } catch (e) {
      console.error(`[VTEX] Erro ao consultar SKU ${sku}:`, e)
      return null
    }
  },
})
```

## Casos especiais (cobrir em teste)

| Cenário | Retorno esperado |
|---|---|
| Array vazio (produto oculto/sem estoque) | `disponivel: false`, todos zeros |
| `IsAvailable: true` mas `AvailableQuantity: 0` | `disponivel: true` (segue a flag) |
| Múltiplos sellers | Pega o primeiro |
| Sem imagens | `imagemUrl: null` |
| `ListPrice` ausente | Cai pra `Price` |
| Erro de rede / timeout | `null` (não derruba o cron) |

## Anti-detecção (importante!)

A VTEX pode banir IPs que fazem polling agressivo. Mitigações:

- User-Agent realista (acima)
- Não passar de 1 req/30s por SKU
- Se receber `429 Too Many Requests`, dobrar o intervalo (backoff)
- Convex faz requests de IPs rotativos (vantagem sobre VPS único)

## Critério de aceite

- [ ] `parseVtexResponse` testável isoladamente
- [ ] Testes cobrem todos os casos especiais acima
- [ ] `consultarSku` retorna `null` em erro de rede (não throw)
- [ ] Logs informativos sem vazar dados sensíveis
