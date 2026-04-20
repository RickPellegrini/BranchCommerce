# Como configurar o CI/CD no BranchCommerce

Este guia acompanha o workflow [`.github/workflows/ci-pipeline.yml`](../.github/workflows/ci-pipeline.yml).

## 1. Adicionar o arquivo no projeto

O pipeline já está em:

```
.github/workflows/ci-pipeline.yml
```

## 2. Ferramentas (devDependencies)

O projeto usa:

- **ESLint** + `eslint-config-next`
- **Prettier** — formatação
- **Vitest** — suite principal de testes (`lib/`, `features/`, `convex/`)
- **Jest** — opcional; smoke em `__tests__/jest/` e script `test:jest`

Instalação (se clonar do zero):

```bash
npm install
```

Pacotes extras citados no template original (`@testing-library/react`, etc.) já estão no `package.json` quando aplicável.

## 3. Scripts no `package.json`

| Script                 | Descrição                                  |
| ---------------------- | ------------------------------------------ |
| `npm run lint`         | `eslint . --max-warnings 0`                |
| `npm run format:check` | `prettier --check .`                       |
| `npm run format`       | `prettier --write .` (corrigir formatação) |
| `npm run typecheck`    | `tsc --noEmit`                             |
| `npm run test`         | `vitest run --coverage` (suite real)       |
| `npm run test:jest`    | Jest smoke (`__tests__/jest/`)             |
| `npm run test:watch`   | Vitest em modo watch                       |
| `npm run build`        | Build Next.js                              |

## 4. Configurar secrets no GitHub

Em **Settings → Secrets and variables → Actions**:

| Secret              | Descrição                   |
| ------------------- | --------------------------- |
| `VERCEL_TOKEN`      | Token da API da Vercel      |
| `VERCEL_ORG_ID`     | ID da organização na Vercel |
| `VERCEL_PROJECT_ID` | ID do projeto na Vercel     |

Para obter valores: `npx vercel link` no repositório.

Sem esses secrets, o job **Deploy** falha na `main` até configurar ou desativar o passo no workflow.

## 5. O que o pipeline faz

```
Push/PR → Lint → Testes → Build → Deploy
              ↘ Segurança ↗
```

- **Lint**: ESLint + Prettier check + TypeScript (`tsc --noEmit`)
- **Testes**: **Vitest** com cobertura (pasta `coverage/`)
- **Build**: `next build` e artefato `.next/`
- **Segurança**: `npm audit --audit-level=high` (não bloqueia o fluxo se falhar)
- **Deploy**: só em push na `main`, via action Vercel

### Nota: Vitest vs Jest

A base de código roda testes com **Vitest** (incl. `convex-test`). O workflow executa `npm run test` (Vitest). O **Jest** permanece disponível para evolução ou smoke (`npm run test:jest`).

## 6. Antes do primeiro CI verde

1. Corrigir **ESLint** até `npm run lint` passar (hoje podem existir avisos/erros herdados).
2. Rodar **`npx prettier --write .`** uma vez e commitar, ou ajustar `.prettierignore`.
3. **`npx convex deploy`** no ambiente Convex para funções novas baterem com o cliente.

## 7. Badge no README (opcional)

```markdown
![CI/CD](https://github.com/RickPellegrini/BranchCommerce/actions/workflows/ci-pipeline.yml/badge.svg)
```

(Substitua usuário/repo se for fork.)
