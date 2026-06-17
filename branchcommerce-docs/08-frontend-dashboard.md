# 08 — Dashboard Frontend

## Objetivo

Interface mínima e funcional pra:

1. Ver lista de SKUs sendo monitorados (com estado em tempo real graças ao Convex reativo)
2. Adicionar novo SKU
3. Pausar/remover SKU
4. Configurar settings (Telegram chat ID, chave Pix, dados pessoais)
5. Ver histórico de notificações

## Páginas

```
app/
├── page.tsx                    ← landing pública (CTA "entrar")
├── sign-in/[[...sign-in]]/     ← Clerk
├── sign-up/[[...sign-up]]/     ← Clerk
└── dashboard/
    ├── layout.tsx               ← sidebar + header
    ├── page.tsx                 ← lista de SKUs (home do dashboard)
    ├── settings/page.tsx        ← Telegram + Pix config
    └── notifications/page.tsx   ← histórico
```

## Componentes shadcn a usar

- `Card` — card de cada SKU
- `Dialog` — modal de adicionar SKU
- `Form` + `Input` + `Label` — formulários
- `Button` — ações
- `Badge` — status (Em estoque / Esgotado)
- `Table` — histórico de notificações
- `Skeleton` — loading
- `Toast` (sonner) — feedback de ações

## Página principal: `app/dashboard/page.tsx`

```tsx
"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Pause, Play } from "lucide-react"
import { AddProductDialog } from "@/components/dashboard/add-product-dialog"
import { useState } from "react"

export default function DashboardPage() {
  const produtos = useQuery(api.products.listarMeus)
  const togglePause = useMutation(api.products.toggleAtivo)
  const remove = useMutation(api.products.remover)
  const [open, setOpen] = useState(false)

  if (!produtos) return <SkeletonGrid />

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium">Produtos monitorados</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-2" /> Adicionar SKU
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {produtos.map((p) => (
          <ProductCard
            key={p._id}
            produto={p}
            onTogglePause={() => togglePause({ id: p._id })}
            onRemove={() => remove({ id: p._id })}
          />
        ))}
      </div>

      <AddProductDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
```

## Componente do card: `components/dashboard/product-card.tsx`

```tsx
"use client"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, Pause, Play, Package, ExternalLink } from "lucide-react"

export function ProductCard({ produto, onTogglePause, onRemove }: any) {
  // Estado em tempo real graças à reatividade do Convex
  const estado = useQuery(api.products.getEstado, { sku: produto.sku })

  const disponivel = estado?.disponivel ?? false
  const preco = estado?.preco ?? 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{produto.nome}</CardTitle>
          <p className="text-xs text-muted-foreground">SKU {produto.sku}</p>
        </div>
        <Badge variant={disponivel ? "default" : "secondary"}>
          {disponivel ? "Em estoque" : "Esgotado"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-medium">R$ {preco.toFixed(2)}</span>
          {produto.precoMaximo && (
            <span className="text-xs text-muted-foreground">máx R$ {produto.precoMaximo}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={onTogglePause}>
            {produto.ativo ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove}>
            <Trash2 className="size-4" />
          </Button>
          {estado?.link && (
            <Button variant="ghost" size="icon" asChild>
              <a href={estado.link} target="_blank" rel="noopener">
                <ExternalLink className="size-4" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

## Modal de adicionar: `components/dashboard/add-product-dialog.tsx`

```tsx
"use client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState } from "react"

export function AddProductDialog({ open, onOpenChange }: any) {
  const adicionar = useMutation(api.products.adicionar)
  const [sku, setSku] = useState("")
  const [nome, setNome] = useState("")
  const [qtd, setQtd] = useState("1")
  const [precoMax, setPrecoMax] = useState("")

  const handleSubmit = async () => {
    await adicionar({
      sku: sku.trim(),
      nome: nome.trim(),
      quantidade: Number(qtd),
      precoMaximo: precoMax ? Number(precoMax) : undefined,
    })
    setSku("")
    setNome("")
    setQtd("1")
    setPrecoMax("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar produto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sku">SKU (número que aparece em ?sku= na URL)</Label>
            <Input
              id="sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="25463"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome amigável</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Air Fryer 8L"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qtd">Quantidade</Label>
              <Input
                id="qtd"
                type="number"
                min="1"
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="precoMax">Preço máx (opcional)</Label>
              <Input
                id="precoMax"
                type="number"
                step="0.01"
                value={precoMax}
                onChange={(e) => setPrecoMax(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!sku || !nome}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## Página de settings: `app/dashboard/settings/page.tsx`

Form simples com 4 campos:

- Telegram Chat ID (com botão "Como descobrir?" abrindo dialog explicativo)
- Chave Pix (CPF/email/celular/aleatória)
- Nome (max 25)
- Cidade (max 15)

Validações no client antes de salvar.

## Página de notificações: `app/dashboard/notifications/page.tsx`

Tabela shadcn com colunas:

- Data/hora
- Produto
- Preço
- Pix gerado (botão copiar)
- Status (sucesso/erro)

Limita às últimas 50.

## Estado vazio (empty states)

| Tela                   | Quando                   | O que mostrar                                                                                               |
| ---------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Dashboard sem produtos | `produtos.length === 0`  | Card grande com `Package` + texto "Você ainda não monitora nenhum produto" + botão "Adicionar primeiro SKU" |
| Settings incompletas   | `!chatId \|\| !pixChave` | Banner amarelo no topo do dashboard avisando que monitor não vai notificar até completar                    |
| Sem notificações       | `notifs.length === 0`    | "Nenhuma notificação ainda. Quando algum produto entrar em estoque, aparecerá aqui."                        |

## Reatividade — vantagem do Convex

`useQuery` é reativo: quando o cron atualiza `productState`, **o card re-renderiza automaticamente** sem refresh. Você vê em tempo real o produto mudar de "Esgotado" pra "Em estoque" sem fazer nada.

## Critério de aceite

- [ ] Login obrigatório pra acessar `/dashboard`
- [ ] Adicionar/remover/pausar SKU funciona
- [ ] Card atualiza em tempo real quando estado muda no banco
- [ ] Settings salva e valida
- [ ] Histórico de notificações lista corretamente
- [ ] Mobile responsivo (Tailwind breakpoints)
- [ ] Empty states implementados
- [ ] Loading com Skeleton
