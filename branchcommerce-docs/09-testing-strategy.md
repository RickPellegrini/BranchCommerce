# 09 — Estratégia de Testes (Vitest)

## Objetivo

Cobertura completa das **funcionalidades core** (não da UI). Garantir que Pix, parser VTEX e lógica de detecção de restock são à prova de bala antes de subir pra produção.

## Escopo dos testes

| Módulo | Tipo | Por quê |
|---|---|---|
| `convex/pix.ts` | Unitário puro | Função determinística, falha aqui = Pix inválido = perde compra |
| `convex/vtex.ts` (parser) | Unitário puro | Mudança no formato da API VTEX precisa ser detectada |
| `convex/monitor.ts` (lógica) | Unitário com mocks | Detecção de restock é o coração do sistema |
| `convex/telegram.ts` | Integração com mock fetch | Garantir que payloads HTTP estão corretos |

**Fora de escopo:** componentes React, páginas, navegação. Cobrir UI traria custo alto e baixo retorno pra esse projeto.

## Setup

`vitest.config.ts` (já criado no setup):

```ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["convex/**/*.ts", "lib/**/*.ts"],
      exclude: [
        "convex/_generated/**",
        "convex/schema.ts",
        "convex/crons.ts",
        "convex/auth.config.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
})
```

## Estrutura de pastas de teste

```
tests/
├── pix.test.ts              ← gerador de BR Code
├── vtex-parser.test.ts      ← parseVtexResponse com fixtures
├── monitor-logic.test.ts    ← detecção de restock
├── telegram.test.ts         ← payloads HTTP
└── fixtures/
    ├── vtex-disponivel.json     ← resposta real com IsAvailable: true
    ├── vtex-esgotado.json       ← resposta com IsAvailable: false
    ├── vtex-vazio.json          ← array vazio (produto oculto)
    └── vtex-multi-seller.json   ← múltiplos sellers
```

## Casos de teste obrigatórios

### `pix.test.ts` (já especificado em 05-pix-generator.md)

7 casos cobrindo: header, GUI, valor, CRC, truncagem, normalização, determinismo.

### `vtex-parser.test.ts`

```ts
import { describe, it, expect } from "vitest"
import { parseVtexResponse } from "@/convex/vtex"
import vtexDisponivel from "./fixtures/vtex-disponivel.json"
import vtexEsgotado from "./fixtures/vtex-esgotado.json"
import vtexVazio from "./fixtures/vtex-vazio.json"
import vtexMultiSeller from "./fixtures/vtex-multi-seller.json"

describe("parseVtexResponse", () => {
  it("retorna disponivel=true quando IsAvailable é true", () => {
    const r = parseVtexResponse("25463", vtexDisponivel)
    expect(r.disponivel).toBe(true)
    expect(r.preco).toBeGreaterThan(0)
  })

  it("retorna disponivel=false quando IsAvailable é false", () => {
    const r = parseVtexResponse("25463", vtexEsgotado)
    expect(r.disponivel).toBe(false)
  })

  it("retorna estado vazio quando array é vazio", () => {
    const r = parseVtexResponse("99999", vtexVazio)
    expect(r.disponivel).toBe(false)
    expect(r.preco).toBe(0)
    expect(r.imagemUrl).toBeNull()
  })

  it("retorna estado vazio quando data não é array", () => {
    const r = parseVtexResponse("99999", null)
    expect(r.disponivel).toBe(false)
  })

  it("pega o primeiro seller quando há múltiplos", () => {
    const r = parseVtexResponse("25463", vtexMultiSeller)
    expect(r.preco).toBeGreaterThan(0)
  })

  it("usa Price como fallback quando ListPrice ausente", () => {
    const data = [{
      productName: "Test",
      items: [{
        itemId: "123",
        sellers: [{ commertialOffer: { IsAvailable: true, Price: 100 } }]
      }]
    }]
    const r = parseVtexResponse("123", data)
    expect(r.precoOriginal).toBe(100)
  })

  it("retorna imagemUrl null quando não há imagens", () => {
    const data = [{
      productName: "Test",
      items: [{
        itemId: "123",
        images: [],
        sellers: [{ commertialOffer: { IsAvailable: true, Price: 50 } }]
      }]
    }]
    const r = parseVtexResponse("123", data)
    expect(r.imagemUrl).toBeNull()
  })

  it("usa SKU passado quando productName ausente", () => {
    const r = parseVtexResponse("25463", [{ items: [] }])
    expect(r.nomeProduto).toBe("SKU 25463")
  })
})
```

### `monitor-logic.test.ts`

A lógica de detecção precisa ser extraída numa função pura pra testar sem mockar Convex inteiro:

```ts
// convex/monitor-logic.ts (NOVO arquivo, pra facilitar testes)
export type EstadoAnterior = { disponivel: boolean } | null
export type EstadoAtual = { disponivel: boolean; preco: number }
export type ProdutoConfig = { precoMaximo?: number }

export function detectarRestock(
  anterior: EstadoAnterior,
  atual: EstadoAtual,
  config: ProdutoConfig
): { restock: boolean; motivo?: string } {
  // primeira execução assume disponível pra evitar falso positivo
  const eraDisponivel = anterior?.disponivel ?? true

  if (!atual.disponivel) return { restock: false, motivo: "produto sem estoque" }
  if (eraDisponivel) return { restock: false, motivo: "já estava disponível" }

  if (config.precoMaximo && atual.preco > config.precoMaximo) {
    return { restock: false, motivo: `preço ${atual.preco} acima do máximo ${config.precoMaximo}` }
  }

  return { restock: true }
}
```

```ts
// tests/monitor-logic.test.ts
import { describe, it, expect } from "vitest"
import { detectarRestock } from "@/convex/monitor-logic"

describe("detectarRestock", () => {
  it("detecta restock quando estado muda de false → true", () => {
    const r = detectarRestock(
      { disponivel: false },
      { disponivel: true, preco: 100 },
      {}
    )
    expect(r.restock).toBe(true)
  })

  it("não detecta restock se já estava disponível", () => {
    const r = detectarRestock(
      { disponivel: true },
      { disponivel: true, preco: 100 },
      {}
    )
    expect(r.restock).toBe(false)
  })

  it("não detecta restock se ainda está esgotado", () => {
    const r = detectarRestock(
      { disponivel: false },
      { disponivel: false, preco: 0 },
      {}
    )
    expect(r.restock).toBe(false)
  })

  it("não detecta restock no primeiro check (anterior null)", () => {
    const r = detectarRestock(
      null,
      { disponivel: true, preco: 100 },
      {}
    )
    expect(r.restock).toBe(false)
    expect(r.motivo).toBe("já estava disponível")
  })

  it("respeita preço máximo", () => {
    const r = detectarRestock(
      { disponivel: false },
      { disponivel: true, preco: 600 },
      { precoMaximo: 500 }
    )
    expect(r.restock).toBe(false)
    expect(r.motivo).toContain("acima do máximo")
  })

  it("permite restock quando preço bate exato no máximo", () => {
    const r = detectarRestock(
      { disponivel: false },
      { disponivel: true, preco: 500 },
      { precoMaximo: 500 }
    )
    expect(r.restock).toBe(true)
  })
})
```

### `telegram.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock global do fetch
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  })
  process.env.TELEGRAM_BOT_TOKEN = "test_token_123"
})

describe("payload do Telegram", () => {
  it("envia POST para sendPhoto quando há imagemUrl", async () => {
    // ... testar que fetch foi chamado com URL correta
  })

  it("usa fallback sendMessage quando sendPhoto falha", async () => {
    // ... testar fallback
  })

  it("trunca caption em 1024 chars", async () => {
    // ... testar limite
  })

  it("não vaza token nos logs em caso de erro", async () => {
    // ... validar que erro logado não contém token
  })
})
```

## Como rodar

```bash
# Roda todos os testes
pnpm test

# Modo watch (durante desenvolvimento)
pnpm test --watch

# Com UI visual
pnpm test:ui

# Cobertura completa
pnpm test:coverage
# Abre coverage/index.html no browser pra ver relatório
```

## CI (opcional, recomendado)

Criar `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage
```

## Critério de aceite

- [ ] `pnpm test` roda sem erros
- [ ] Cobertura >= 80% nas funcionalidades core
- [ ] Todos os casos de teste especificados implementados
- [ ] Fixtures VTEX salvas em `tests/fixtures/`
- [ ] Pix gerado em teste validado em validador externo
- [ ] CI rodando verde (se habilitado)
