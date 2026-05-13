<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Formatação (Prettier)

Ao criar ou alterar ficheiros `.ts`, `.tsx`, `.js` ou `.jsx`, executar `npx prettier --write` nesses ficheiros antes de concluir o trabalho (regra detalhada em `.cursor/rules/prettier-after-edits.mdc`).

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Notes |
|---------|---------|-------|
| Next.js dev | `npm run dev` | Runs on port 3000 (Turbopack) |
| Convex dev | `CONVEX_AGENT_MODE=anonymous npx convex dev` | Creates isolated deployment; must run concurrently with Next.js |

### Gotchas

- **Node.js 20** is required (`@types/node` is `^20`; CI uses Node 20). Run `nvm use 20` before any command.
- **Clerk production keys** are domain-locked to `branchcommerce8.com`. The sign-in/sign-up pages render blank on `localhost` because Clerk JS refuses to load. Server-side rendering still works (HTTP 200). To test authenticated flows locally, Clerk development keys would be needed.
- **Convex agent mode**: Cloud agents must use `CONVEX_AGENT_MODE=anonymous` when running `npx convex dev` to avoid conflicting with the user's dev deployment. This creates an isolated anonymous deployment.
- **`.env.local`** is not committed. Cloud agents must create it from injected environment secrets before starting services. Required vars: `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `TOKEN_ENCRYPTION_KEY`, `CONVEX_DEPLOYMENT`.
- **Standard commands** are in `package.json` scripts — see `docs/guia-setup-ci.md` for the full CI/CD reference.

### Running checks

- Lint: `npm run lint` (ESLint, `--max-warnings 0`)
- Format: `npm run format:check` / `npm run format`
- Typecheck: `npm run typecheck`
- Tests: `npm run test` (Vitest, 246 tests) and `npm run test:jest` (Jest smoke, 1 test)
- Build: `npm run build`
