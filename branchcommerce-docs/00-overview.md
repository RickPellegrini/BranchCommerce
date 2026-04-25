# 00 — Visão Geral do Projeto

## O que é

Bot que monitora SKUs específicos da **Eletro Club** e envia notificação no **Telegram** quando o produto volta ao estoque, com **Pix copia-e-cola já gerado** no valor exato (com desconto Pix de 5%).

## Stack

| Camada | Tecnologia | Motivo |
|---|---|---|
| Frontend | Next.js 15 (App Router) | Dashboard pra gerenciar SKUs |
| UI | shadcn/ui + Tailwind | Componentes prontos e estilizáveis |
| Ícones | lucide-react | Padrão moderno, leve |
| Auth | Clerk | Setup rápido, integra nativo com Convex |
| Backend + DB + Cron | Convex | Loop roda aqui, banco reativo, cron sem limite de plano free |
| Notificação | Telegram Bot API | Latência <1s vs 5s-1min do Discord |
| Pix | Geração local (BR Code EMV) | Sem dependência externa, funciona offline |
| Testes | Vitest | Cobertura completa das funcionalidades |
| Hospedagem | Vercel (front) + Convex Cloud (back) | Deploy em segundos, ambos free tier |

## Por que essa stack ganhou

**Convex resolve o problema de "onde rodar o loop"** — tem cron jobs nativos sem limite agressivo do Vercel Cron. O loop roda perto do banco, sem cold start, com retry automático.

**Clerk + Convex** têm integração nativa — você protege as queries/mutations sem precisar passar token manualmente.

**Telegram** ganhou de Discord/WhatsApp em latência real (medida pelo usuário: Discord demora 30s-1min, Telegram <1s).

## Fluxo end-to-end

```
[Você adiciona SKU no dashboard]
         ↓
[Convex salva no banco]
         ↓
[Convex Cron roda a cada 30s]
         ↓
[Bate na API VTEX da Eletro Club]
         ↓
[Compara IsAvailable com estado anterior]
         ↓
[Se mudou de false → true: RESTOCK!]
         ↓
[Convex action chama Telegram Bot API]
         ↓
[Telegram entrega: foto + preço + Pix]
         ↓
[Você abre, copia o Pix, paga]
```

## Estrutura de pastas final

```
projeto/
├── app/                        ← Next.js App Router
│   ├── (auth)/                 ← rotas Clerk (sign-in, sign-up)
│   ├── dashboard/              ← interface pra gerenciar SKUs
│   ├── layout.tsx              ← ClerkProvider + ConvexProvider
│   └── page.tsx                ← landing
├── components/
│   ├── ui/                     ← shadcn components
│   └── dashboard/              ← componentes específicos
├── convex/
│   ├── _generated/             ← auto-gerado
│   ├── schema.ts               ← tabelas
│   ├── products.ts             ← queries/mutations CRUD
│   ├── vtex.ts                 ← cliente da API VTEX
│   ├── telegram.ts             ← envio de notificações
│   ├── pix.ts                  ← gerador de BR Code
│   ├── monitor.ts              ← lógica de detecção
│   ├── crons.ts                ← agendamento
│   └── auth.config.ts          ← Clerk integration
├── lib/                        ← utils compartilhados
├── tests/
│   ├── pix.test.ts
│   ├── vtex.test.ts
│   └── monitor.test.ts
├── docs/                       ← esta pasta
├── .env.local
├── vitest.config.ts
└── package.json
```

## Critério de "pronto"

- [ ] Login funcionando com Clerk
- [ ] Dashboard lista, adiciona e remove SKUs
- [ ] Cron rodando a cada 30s no Convex
- [ ] Detecção de restock funcional (testes verdes)
- [ ] Notificação Telegram com foto, preço e Pix válido
- [ ] Pix copia-e-cola passa em validador real (validacaobrcode.com)
- [ ] Cobertura de testes >80% nas funcionalidades core
- [ ] Deploy em produção rodando

## Próximos MDs (ordem de implementação)

1. `01-setup.md` — inicializar projeto e instalar deps
2. `02-clerk-auth.md` — configurar autenticação
3. `03-convex-schema.md` — modelar o banco
4. `04-convex-vtex-client.md` — cliente VTEX
5. `05-pix-generator.md` — gerador de BR Code
6. `06-convex-telegram.md` — envio de notificações
7. `07-convex-monitor-cron.md` — loop de detecção
8. `08-frontend-dashboard.md` — UI do dashboard
9. `09-testing-strategy.md` — testes Vitest
10. `10-deploy.md` — deploy produção
