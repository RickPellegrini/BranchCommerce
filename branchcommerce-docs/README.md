# 📚 BranchCommerce — Documentação do Projeto

Sistema de monitoramento de restock da **Eletro Club** com notificação Telegram + Pix copia-e-cola gerado automaticamente.

## Stack

- **Frontend:** Next.js 15 (App Router) + shadcn/ui + lucide-react
- **Auth:** Clerk
- **Backend + DB + Cron:** Convex
- **Notificação:** Telegram Bot API
- **Testes:** Vitest (cobertura completa das funcionalidades core)
- **Hospedagem:** Vercel (front) + Convex Cloud (back) — ambos free tier

## Como ler estes documentos

Os MDs estão numerados na **ordem de implementação**. Leia em sequência ao construir, ou pule pro tópico que precisa.

| #   | Doc                                           | O que tem                                                 |
| --- | --------------------------------------------- | --------------------------------------------------------- |
| 00  | [Overview](./00-overview.md)                  | Visão geral, stack, fluxo end-to-end, estrutura de pastas |
| 01  | [Setup](./01-setup.md)                        | Inicialização do projeto, dependências, env vars          |
| 02  | [Clerk Auth](./02-clerk-auth.md)              | Configuração do login + integração Convex                 |
| 03  | [Schema Convex](./03-convex-schema.md)        | Tabelas do banco e índices                                |
| 04  | [Cliente VTEX](./04-convex-vtex-client.md)    | Função que consulta a API da Eletro Club                  |
| 05  | [Pix Generator](./05-pix-generator.md)        | Gerador de BR Code (EMV) sem dependências                 |
| 06  | [Telegram](./06-convex-telegram.md)           | Envio de notificações                                     |
| 07  | [Monitor + Cron](./07-convex-monitor-cron.md) | Loop de detecção de restock                               |
| 08  | [Dashboard](./08-frontend-dashboard.md)       | UI: lista, adicionar SKU, settings, histórico             |
| 09  | [Testes](./09-testing-strategy.md)            | Estratégia Vitest + casos de teste                        |
| 10  | [Deploy](./10-deploy.md)                      | Vercel + Convex prod + Clerk prod                         |

## Como usar com Cursor / Claude Code / IA

1. Abra o projeto no Cursor (ou outra IDE com IA)
2. Adicione esta pasta `docs/` ao contexto
3. Para implementar uma feature, peça à IA:
   > "Implemente o que está em `docs/05-pix-generator.md`"
4. A IA vai ter todos os detalhes de arquitetura, código de exemplo e critérios de aceite

## Ordem recomendada de implementação

```
01 (setup) → 02 (auth) → 03 (schema)
                              ↓
   ┌──────────────────────────┼──────────────────┐
   ↓                          ↓                  ↓
05 (pix)              04 (vtex)          06 (telegram)
   ↓                          ↓                  ↓
   └──────────┬───────────────┴──────────────────┘
              ↓
        07 (monitor + cron)
              ↓
        08 (dashboard)
              ↓
        09 (testes)
              ↓
        10 (deploy)
```

Cada etapa tem **critério de aceite** — só passe pra próxima quando o checklist estiver verde.

## O que esse projeto faz (resumo de uma frase)

Você cadastra SKUs da Eletro Club no dashboard, e quando algum produto que estava esgotado volta ao estoque, você recebe no Telegram a foto, o preço e o **Pix copia-e-cola já no valor exato com o desconto Pix de 5%** — em menos de 1 minuto após a Eletro Club repor.

## Custo total: $0/mês

Free tier de Vercel + Convex + Clerk + Telegram cobre o uso pessoal completamente.
