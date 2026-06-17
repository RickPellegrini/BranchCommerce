"use client"

import { useAction, useMutation, useQuery } from "convex/react"
import { Copy, Loader2, Play, Plus, Trash2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"

import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { formatCurrency } from "@/lib/finance/calculations"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const addProductSchema = z.object({
  sku: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, "Apenas numeros, 1 a 12 digitos")
    .transform((s) => s),
  nome: z.string().trim().min(1, "Nome obrigatorio").max(200),
  quantidade: z.coerce
    .number()
    .int("Inteiro")
    .min(1)
    .max(99, "Ate 99")
    .refine((n) => n > 0, { message: "Minimo 1" }),
  precoMaximo: z.preprocess((v) => {
    if (v === "" || v == null) return undefined
    if (typeof v === "string") {
      const n = Number(v.replace(/\./g, "").replace(",", "."))
      return Number.isFinite(n) ? n : v
    }
    return v
  }, z.number().min(0, "Nao negativo").optional()),
})

const settingsSchema = z.object({
  telegramEnabled: z.boolean(),
  telegramChatId: z.string().optional(),
  pixChave: z.string().optional(),
  pixNome: z.string().optional(),
  pixCidade: z.string().optional(),
})

type BranchNotifyPageProps = {
  userId: string
}

type ProductWithStateRow = {
  product: Doc<"products">
  state: Doc<"productState"> | null
}

function formatBrl(n: number) {
  return formatCurrency(n)
}

function formatChecagem(ts: number) {
  try {
    return new Date(ts).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(ts)
  }
}

export function BranchNotifyPage({ userId }: BranchNotifyPageProps) {
  const [sku, setSku] = useState("")
  const [nome, setNome] = useState("")
  const [quantidade, setQuantidade] = useState("1")
  const [precoMax, setPrecoMax] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [tickLoading, setTickLoading] = useState(false)
  const [tickMessage, setTickMessage] = useState<string | null>(null)
  const [tickError, setTickError] = useState<string | null>(null)

  const runMonitorNow = useAction(api.monitorRun.runMonitorNow)
  const rows = useQuery(api.products.listWithState, { userId })
  const settings = useQuery(api.settings.get, { userId })
  const recent = useQuery(api.notifications.listRecent, { userId, limit: 20 })

  const [tgEnabled, setTgEnabled] = useState(false)
  const [tgChat, setTgChat] = useState("")
  const [pixChave, setPixChave] = useState("")
  const [pixNome, setPixNome] = useState("")
  const [pixCidade, setPixCidade] = useState("")

  const settingsHydrated = useRef(false)
  useEffect(() => {
    if (settings === undefined || settingsHydrated.current) return
    if (settings) {
      setTgEnabled(settings.telegramEnabled)
      setTgChat(settings.telegramChatId ?? "")
      setPixChave(settings.pixChave ?? "")
      setPixNome(settings.pixNome ?? "")
      setPixCidade(settings.pixCidade ?? "")
    }
    settingsHydrated.current = true
  }, [settings])

  const add = useMutation(api.products.add)
  const setAtivo = useMutation(api.products.setAtivo)
  const remove = useMutation(api.products.remove)
  const upsertSettings = useMutation(api.settings.upsert)

  const onAdd = useCallback(async () => {
    setFormError(null)
    setSaving(true)
    const parsed = addProductSchema.safeParse({
      sku,
      nome,
      quantidade,
      precoMaximo: precoMax || undefined,
    })
    if (!parsed.success) {
      setFormError(parsed.error.issues.map((i) => i.message).join(" · ") || "Dados invalidos")
      setSaving(false)
      return
    }
    try {
      await add({
        userId,
        sku: parsed.data.sku,
        nome: parsed.data.nome,
        quantidade: parsed.data.quantidade,
        precoMaximo: parsed.data.precoMaximo,
      })
      setSku("")
      setNome("")
      setQuantidade("1")
      setPrecoMax("")
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Falha ao adicionar")
    } finally {
      setSaving(false)
    }
  }, [add, userId, sku, nome, quantidade, precoMax])

  const onSaveSettings = useCallback(async () => {
    setSettingsError(null)
    const p = settingsSchema.safeParse({
      telegramEnabled: tgEnabled,
      telegramChatId: tgChat.trim() || undefined,
      pixChave: pixChave.trim() || undefined,
      pixNome: pixNome.trim() || undefined,
      pixCidade: pixCidade.trim() || undefined,
    })
    if (!p.success) {
      setSettingsError(p.error.issues.map((i) => i.message).join(" · ") || "Invalido")
      return
    }
    setSaving(true)
    try {
      await upsertSettings({ userId, ...p.data })
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "Falha ao salvar")
    } finally {
      setSaving(false)
    }
  }, [userId, upsertSettings, tgEnabled, tgChat, pixChave, pixNome, pixCidade])

  const onRunMonitorNow = useCallback(async () => {
    setTickError(null)
    setTickMessage(null)
    setTickLoading(true)
    try {
      const r = await runMonitorNow({ userId })
      setTickMessage(
        r.ok
          ? `Ciclo executado (cobre todos os utilizadores). ~${r.produtos} activo(s) teu(s). A lista abaixo actualiza em segundos.`
          : null,
      )
    } catch (e) {
      setTickError(e instanceof Error ? e.message : "Falha ao correr o monitor")
    } finally {
      setTickLoading(false)
    }
  }, [runMonitorNow, userId])

  if (rows === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">BranchNotify</h1>
        <p className="text-sm text-muted-foreground">
          Monitora produtos Eletro Club (VTEX). No hub, cada restock gera um item em &quot;Ultimas
          notificacoes&quot; com o Pix; isso e independente do Telegram. O Telegram e opcional
          (definicoes + token do bot no Convex). Samente ha notificacao de restock quando o stock
          passa de indisponivel a disponivel. Se o produto ja estava disponivel, o ciclo so
          actualiza preco/estado na tabela, sem linha nova em notificacoes.
        </p>
      </div>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Teste manual (temporario)</CardTitle>
          <CardDescription>
            Dispara o mesmo ciclo que o cron (fetch VTEX, actualiza tabela, notificacoes se
            restock). Remover o botao antes de produccao, se nao quiser a accao publica.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={tickLoading}
            onClick={() => void onRunMonitorNow()}
          >
            {tickLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Correr monitor agora
          </Button>
          {tickMessage && <p className="text-sm text-foreground max-w-2xl">{tickMessage}</p>}
          {tickError && <p className="text-sm text-destructive max-w-2xl">{tickError}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar monitoramento</CardTitle>
            <CardDescription>Numeric SKU only (1–12 algarismos) da Eletro Club</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="bn-sku" className="text-sm font-medium leading-none">
                  SKU
                </label>
                <Input
                  id="bn-sku"
                  inputMode="numeric"
                  placeholder="p.ex. 123"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.replace(/\D/g, "").slice(0, 12))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="bn-nome" className="text-sm font-medium leading-none">
                  Nome (referencia)
                </label>
                <Input id="bn-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="bn-qty" className="text-sm font-medium leading-none">
                  Qtd. no Pix
                </label>
                <Input
                  id="bn-qty"
                  inputMode="numeric"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="bn-max" className="text-sm font-medium leading-none">
                  Preco max. (opcional)
                </label>
                <Input
                  id="bn-max"
                  inputMode="decimal"
                  placeholder="ex. 1999,90"
                  value={precoMax}
                  onChange={(e) => setPrecoMax(e.target.value)}
                />
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button type="button" onClick={onAdd} disabled={saving} className="w-full sm:w-auto">
              <Plus className="size-4" />
              Adicionar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Definicoes: Pix e Telegram</CardTitle>
            <CardDescription>
              Configure a chave Pix. Telegram usa o bot (token no servidor) com o chat id.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-md border p-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Aviso no Telegram</p>
                <p className="text-xs text-muted-foreground">
                  Mensagem de texto; Chat ID requerido
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={tgEnabled ? "default" : "outline"}
                onClick={() => setTgEnabled((v) => !v)}
              >
                {tgEnabled ? "Activo" : "Off"}
              </Button>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Telegram chat id</span>
              <Input
                value={tgChat}
                onChange={(e) => setTgChat(e.target.value)}
                placeholder="numero"
              />
            </div>
            <Separator />
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Chave Pix</span>
              <Input value={pixChave} onChange={(e) => setPixChave(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Beneficiario (ate 25 char)</span>
                <Input value={pixNome} onChange={(e) => setPixNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Cidade (ate 15 char)</span>
                <Input value={pixCidade} onChange={(e) => setPixCidade(e.target.value)} />
              </div>
            </div>
            {settingsError && <p className="text-sm text-destructive">{settingsError}</p>}
            <Button type="button" variant="secondary" onClick={onSaveSettings} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Gravar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produtos monitorizados</CardTitle>
          <CardDescription>Deslize para desactivar sem apagar, ou apague a linha.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ainda nao tem SKUs. Adicione um SKU acima.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="whitespace-nowrap">Preco (VTEX)</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ product, state }: ProductWithStateRow) => (
                  <TableRow key={product._id}>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell>{product.nome}</TableCell>
                    <TableCell>
                      {state ? formatBrl(state.preco) : "—"}{" "}
                      {state && (
                        <span className="text-muted-foreground text-xs">
                          ({formatChecagem(state.ultimaChecagem)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{state ? (state.disponivel ? "Sim" : "Nao") : "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        type="button"
                        variant={product.ativo ? "default" : "secondary"}
                        onClick={() =>
                          void setAtivo({ userId, productId: product._id, ativo: !product.ativo })
                        }
                      >
                        {product.ativo ? "Activo" : "Pausado"}
                      </Button>
                    </TableCell>
                    <TableCell className="pr-2">
                      <Button
                        size="icon"
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm("Remover este monitor?")) {
                            void remove({ userId, productId: product._id })
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ultimas notificacoes (restock)</CardTitle>
          <CardDescription>Notificacoes in-app; Pix copiavel de cada linha.</CardDescription>
        </CardHeader>
        <CardContent>
          {recent === undefined ? (
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda nao ha alertas de restock.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((n: Doc<"notifications">) => (
                <li key={n._id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{n.nome}</p>
                      <p className="text-muted-foreground text-xs">
                        SKU {n.sku} · {formatBrl(n.preco)} (Pix 5%: {formatBrl(n.precoPix)})
                      </p>
                      {n.erro && (
                        <p className="mt-1 text-amber-700 text-xs dark:text-amber-400">{n.erro}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={!n.pixCode}
                      onClick={() => {
                        void navigator.clipboard.writeText(n.pixCode)
                      }}
                    >
                      <Copy className="size-3.5" />
                      &nbsp; Copiar Pix
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
