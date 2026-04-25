# 01 — Setup Inicial

## Objetivo

Criar projeto Next.js com todas as dependências configuradas e rodando.

## Pré-requisitos

- Node.js 20+
- pnpm (recomendado) ou npm
- Conta no [Convex](https://convex.dev)
- Conta no [Clerk](https://clerk.com)
- Bot do Telegram criado via [@BotFather](https://t.me/BotFather)
- Chat ID descoberto via [@userinfobot](https://t.me/userinfobot)

## Comandos de inicialização

```bash
# 1. Criar projeto Next
pnpm create next-app@latest restock-eletroclub \
  --typescript --tailwind --app --src-dir=false \
  --import-alias="@/*" --eslint

cd restock-eletroclub

# 2. Instalar Convex
pnpm add convex
pnpm dlx convex dev   # primeira execução: cria projeto no Convex Cloud

# 3. Instalar Clerk
pnpm add @clerk/nextjs @clerk/clerk-react

# 4. Instalar shadcn/ui (CLI faz a config do Tailwind)
pnpm dlx shadcn@latest init

# 5. Instalar componentes shadcn que vamos usar
pnpm dlx shadcn@latest add button card dialog form input label \
  table toast badge separator skeleton

# 6. Instalar lucide-react
pnpm add lucide-react

# 7. Instalar Vitest + utilitários de teste
pnpm add -D vitest @vitest/ui @vitest/coverage-v8 \
  @testing-library/react @testing-library/jest-dom \
  jsdom happy-dom

# 8. Tipos auxiliares
pnpm add -D @types/node
```

## Variáveis de ambiente (`.env.local`)

```bash
# Convex (preenchido automaticamente pelo `convex dev`)
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
CONVEX_DEPLOYMENT=dev:xxx

# Clerk (pega no dashboard do Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs (usar defaults)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Telegram (env do Convex, não do Next — configurar via `npx convex env set`)
# TELEGRAM_BOT_TOKEN=123456:ABC...
# (não precisa estar aqui — só no Convex)
```

## Configurar env vars no Convex

```bash
npx convex env set TELEGRAM_BOT_TOKEN "seu_token_do_botfather"
```

> **Importante:** o token do Telegram fica **só no Convex**, nunca no front. As mutations que disparam Telegram rodam server-side dentro do Convex.

## Configuração do `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["convex/**/*.ts", "lib/**/*.ts"],
      exclude: ["convex/_generated/**"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
})
```

## Scripts no `package.json`

```json
{
  "scripts": {
    "dev": "next dev",
    "convex": "convex dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Como rodar em dev

Você precisa de **2 terminais** abertos simultaneamente:

```bash
# Terminal 1: Next.js
pnpm dev

# Terminal 2: Convex (mantém sync de schema/funções)
pnpm convex
```

## Critério de aceite

- [ ] `pnpm dev` abre `http://localhost:3000` sem erros
- [ ] `pnpm convex` sincroniza sem erros
- [ ] `pnpm test` roda (mesmo sem testes ainda)
- [ ] shadcn instalado: `components/ui/button.tsx` existe
- [ ] Variáveis de ambiente preenchidas
