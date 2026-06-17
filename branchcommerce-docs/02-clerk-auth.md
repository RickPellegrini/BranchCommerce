# 02 — Autenticação com Clerk

## Objetivo

Proteger todo o dashboard com login Clerk e integrar com Convex para que as queries/mutations só rodem para usuários autenticados.

## Por que Clerk + Convex

Clerk emite JWTs que o Convex valida nativamente. Isso significa que dentro de qualquer query/mutation Convex você consegue acessar `ctx.auth.getUserIdentity()` sem precisar implementar nada.

## Arquivos a criar/editar

### 1. `app/layout.tsx` — providers globais

```tsx
import { ClerkProvider } from "@clerk/nextjs"
import { ConvexClientProvider } from "@/components/providers/convex-provider"
import "./globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

### 2. `components/providers/convex-provider.tsx`

```tsx
"use client"
import { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { useAuth } from "@clerk/nextjs"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
```

### 3. `convex/auth.config.ts`

```ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, // pega no Clerk Dashboard → JWT Templates → "convex"
      applicationID: "convex",
    },
  ],
}
```

### 4. `middleware.ts` (raiz do projeto)

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"])

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect()
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
```

### 5. Páginas de auth

```
app/sign-in/[[...sign-in]]/page.tsx
app/sign-up/[[...sign-up]]/page.tsx
```

```tsx
// sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs"
export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}
```

(mesmo padrão para sign-up)

## Configurar Clerk JWT Template para Convex

No dashboard do Clerk:

1. Vá em **JWT Templates**
2. Clique em **New Template** → escolha **Convex**
3. Salve o **Issuer Domain** que aparece (algo como `https://xxx.clerk.accounts.dev`)
4. Adicione no `.env.local`:
   ```
   CLERK_JWT_ISSUER_DOMAIN=https://xxx.clerk.accounts.dev
   ```

## Como usar `auth` dentro de queries/mutations Convex

```ts
// convex/products.ts (exemplo)
import { mutation } from "./_generated/server"
import { v } from "convex/values"

export const addProduct = mutation({
  args: { sku: v.string(), nome: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    return await ctx.db.insert("products", {
      ...args,
      userId: identity.subject, // ID do usuário Clerk
      createdAt: Date.now(),
    })
  },
})
```

## Critério de aceite

- [ ] `/dashboard` redireciona pra `/sign-in` se não logado
- [ ] Após login, vai para `/dashboard`
- [ ] `useUser()` do Clerk retorna o usuário no client
- [ ] `ctx.auth.getUserIdentity()` retorna identity no Convex
- [ ] Tentar mutation sem auth retorna erro 401
