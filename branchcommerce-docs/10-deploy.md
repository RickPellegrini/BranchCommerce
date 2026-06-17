# 10 — Deploy em Produção

## Objetivo

Publicar o sistema em produção: Convex Cloud (backend + cron) + Vercel (frontend).

## Checklist pré-deploy

- [ ] Todos os testes passando (`pnpm test:coverage`)
- [ ] Build local funcionando (`pnpm build`)
- [ ] `.env.example` criado com todas as vars (sem valores)
- [ ] `.gitignore` ignora `.env.local`, `convex/_generated/`, `node_modules/`
- [ ] Pix testado em validador externo (validacaobrcode.com)
- [ ] Telegram funcionando em dev com bot real

## 1. Deploy do Convex (backend)

```bash
# Promove dev → prod
npx convex deploy
```

Isso cria um deployment **production** separado. Anote a URL:

```
https://xxx-prod.convex.cloud
```

### Configurar env vars de prod no Convex

```bash
npx convex env set --prod TELEGRAM_BOT_TOKEN "seu_token_real"
```

> Use bots **diferentes** pra dev e prod — assim você pode testar em dev sem misturar com alertas reais.

## 2. Deploy do Frontend (Vercel)

### a. Push pro GitHub

```bash
git init
git add .
git commit -m "initial commit"
gh repo create branchcommerce --private --source=. --push
```

### b. Importar na Vercel

1. https://vercel.com/new
2. Selecionar o repo
3. Framework: **Next.js** (auto-detectado)
4. Adicionar env vars:

| Variable                              | Valor                            | Onde pegar                                       |
| ------------------------------------- | -------------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_CONVEX_URL`              | `https://xxx-prod.convex.cloud`  | Convex Dashboard → Settings                      |
| `CONVEX_DEPLOY_KEY`                   | `prod:xxx\|...`                  | Convex Dashboard → Settings → Deploy Keys        |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`   | `pk_live_...`                    | Clerk Dashboard (criar instância **Production**) |
| `CLERK_SECRET_KEY`                    | `sk_live_...`                    | Clerk Dashboard                                  |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`       | `/sign-in`                       | constante                                        |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`       | `/sign-up`                       | constante                                        |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard`                     | constante                                        |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard`                     | constante                                        |
| `CLERK_JWT_ISSUER_DOMAIN`             | `https://xxx.clerk.accounts.dev` | Clerk JWT Templates → convex                     |

5. **Build Command:** `npx convex deploy --cmd 'pnpm build'`
   Esse comando garante que o Convex faz deploy **antes** do Next.js buildar (necessário pra `_generated` estar atualizado).

6. Click **Deploy**

### c. Configurar Clerk pra produção

No Clerk Dashboard:

1. Criar **Production instance** (separada da dev)
2. Em **Domains**, adicionar `seu-dominio.vercel.app`
3. Em **JWT Templates**, criar template "convex" (igual ao dev)
4. Atualizar `CLERK_JWT_ISSUER_DOMAIN` no Vercel com o issuer de prod

## 3. Verificações pós-deploy

### a. Smoke test funcional

1. Abrir `https://seu-dominio.vercel.app`
2. Sign up com email novo
3. Adicionar um SKU real (ex: `25463`)
4. Configurar Telegram chat ID + Pix em settings
5. Aguardar 1-2 min
6. Verificar logs do Convex:
   ```bash
   npx convex logs --prod
   ```
7. Verificar que estado do produto aparece no card (em estoque ou esgotado)

### b. Testar restock

Difícil testar restock real (depende do produto esgotar). Para validar end-to-end:

1. Adicionar SKU que está **esgotado**
2. Aguardar primeira execução do cron (30s)
3. Manualmente via Convex Dashboard, editar `productState.disponivel = false`
4. Aguardar próxima execução
5. Adicionar produto que **está disponível** com mesmo SKU em outro slot
6. Telegram deve receber alerta

Ou: usar um SKU que você sabe que vai voltar (acompanha um restock anunciado).

### c. Monitorar uptime

Configurar **UptimeRobot** (gratuito):

1. Criar monitor HTTP no endpoint `https://seu-dominio.vercel.app`
2. Intervalo de 5 min
3. Alerta por email se cair

Para o Convex, criar endpoint `/api/health` que retorna `{ ok: true, lastCheck: timestamp }` consultando a última execução do cron, e monitorar isso.

## 4. Custos esperados

| Serviço   | Plano | Limite                | Custo      |
| --------- | ----- | --------------------- | ---------- |
| Convex    | Free  | 1M function calls/mês | $0         |
| Vercel    | Hobby | 100GB bandwidth       | $0         |
| Clerk     | Free  | 10k MAU               | $0         |
| Telegram  | —     | Ilimitado             | $0         |
| **Total** |       |                       | **$0/mês** |

### Quando vai precisar pagar

- **Convex**: passar de ~10 SKUs simultâneos a 30s. Solução: subir intervalo pra 60s ou Convex Pro ($25/mês — 10M calls).
- **Vercel**: nunca, esse projeto é leve.
- **Clerk**: só se virar SaaS com >10k usuários.

## 5. Manutenção contínua

### Atualizar dependências mensalmente

```bash
pnpm update --interactive --latest
pnpm test
pnpm build
```

### Logs e debugging

```bash
# Ver logs do Convex em tempo real
npx convex logs --prod --tail

# Ver última execução do cron
npx convex run --prod monitor:verificarTodosOsProdutos
```

### Backup do banco Convex

Convex faz backups automáticos diários. Pra exportar manualmente:

```bash
npx convex export --prod backup-$(date +%Y%m%d).zip
```

Recomendado fazer 1x por mês.

## 6. Rollback rápido

Se um deploy quebrar produção:

```bash
# Vercel: rollback via dashboard (1 clique no deploy anterior)

# Convex: rollback via dashboard
# Settings → Deployments → Promote previous deployment
```

## Critério de aceite final

- [ ] URL de produção acessível
- [ ] Login + signup funcionando
- [ ] Cron executando a cada 30s (verificar logs)
- [ ] SKU adicionado mostra estado em tempo real no card
- [ ] Restock simulado dispara Telegram
- [ ] Pix recebido no Telegram pago em banco real funciona
- [ ] UptimeRobot configurado
- [ ] Domínio customizado (opcional, ex: `restock.seudominio.com`)

---

## 🎉 Done!

A partir daqui, é só adicionar SKUs no dashboard e esperar os restocks chegarem no Telegram.
