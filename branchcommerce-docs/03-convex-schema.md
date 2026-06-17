# 03 — Schema Convex

## Objetivo

Modelar as tabelas do banco com tipagem forte e índices eficientes.

## Decisões de modelagem

**Por que separar `products` e `priceHistory` (e não armazenar tudo num doc só):**

- Produto muda raro (nome, SKU)
- Preço/disponibilidade mudam toda checagem (se acumular num array vai estourar 1MB)

**Por que `notifications` é tabela separada:**

- Auditoria — saber quando enviou e o que enviou
- Idempotência — não notificar duas vezes o mesmo evento
- UI: mostra histórico de notificações no dashboard

## Arquivo: `convex/schema.ts`

```ts
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // Produtos sendo monitorados
  products: defineTable({
    userId: v.string(), // Clerk user ID dono do monitor
    sku: v.string(), // SKU da Eletro Club (ex: "25463")
    nome: v.string(), // Nome amigável (ex: "Air Fryer Philco 8L")
    quantidade: v.number(), // Quantas unidades quer comprar
    precoMaximo: v.optional(v.number()), // Não notificar se preço acima disso
    ativo: v.boolean(), // Pode pausar sem deletar
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_sku", ["sku"])
    .index("by_user_ativo", ["userId", "ativo"]),

  // Estado atual de cada SKU (sobrescrito a cada checagem)
  productState: defineTable({
    sku: v.string(),
    disponivel: v.boolean(),
    preco: v.number(),
    precoOriginal: v.number(), // ListPrice
    imagemUrl: v.optional(v.string()),
    link: v.optional(v.string()),
    nomeProduto: v.optional(v.string()), // Nome oficial vindo da VTEX
    ultimaChecagem: v.number(),
  }).index("by_sku", ["sku"]),

  // Histórico de notificações enviadas
  notifications: defineTable({
    userId: v.string(),
    productId: v.id("products"),
    sku: v.string(),
    nome: v.string(),
    preco: v.number(),
    precoPix: v.number(), // Com 5% desconto
    pixCode: v.string(), // BR Code gerado
    enviadoEm: v.number(),
    sucesso: v.boolean(),
    erro: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_recent", ["userId", "enviadoEm"]),

  // Configurações do usuário (chave Pix, Telegram chat ID, etc)
  userSettings: defineTable({
    userId: v.string(),
    telegramChatId: v.optional(v.string()),
    pixChave: v.optional(v.string()),
    pixNome: v.optional(v.string()),
    pixCidade: v.optional(v.string()),
  }).index("by_user", ["userId"]),
})
```

## Operações típicas (referência)

```ts
// Listar produtos do usuário logado
const produtos = await ctx.db
  .query("products")
  .withIndex("by_user_ativo", (q) => q.eq("userId", uid).eq("ativo", true))
  .collect()

// Buscar estado de um SKU
const estado = await ctx.db
  .query("productState")
  .withIndex("by_sku", (q) => q.eq("sku", sku))
  .first()

// Últimas 20 notificações
const notifs = await ctx.db
  .query("notifications")
  .withIndex("by_user_recent", (q) => q.eq("userId", uid))
  .order("desc")
  .take(20)
```

## Validações no banco

| Campo            | Validação                      | Onde                      |
| ---------------- | ------------------------------ | ------------------------- |
| `sku`            | Apenas dígitos, 3-10 chars     | Mutation `addProduct`     |
| `quantidade`     | >= 1 e <= 99                   | Mutation `addProduct`     |
| `precoMaximo`    | >= 0                           | Mutation `addProduct`     |
| `pixChave`       | CPF/email/telefone/UUID válido | Mutation `updateSettings` |
| `telegramChatId` | Numérico, com sinal opcional   | Mutation `updateSettings` |

## Critério de aceite

- [ ] `npx convex dev` aplica o schema sem erros
- [ ] Documentos visíveis no dashboard Convex
- [ ] Índices criados (verificar em Convex Dashboard → Schema)
- [ ] Tentar inserir doc malformado retorna erro de tipo
