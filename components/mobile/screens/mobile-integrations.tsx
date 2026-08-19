"use client"

import { CheckCircle2, Link2, LoaderCircle, RefreshCw, Unplug, WalletCards } from "lucide-react"
import { useEffect, useState } from "react"

import { MobileHero, MobilePage, MobileSection } from "@/components/mobile/mobile-ui"
import { cn } from "@/lib/utils"

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: string }
type Connection = { connected: boolean; mlNickname?: string | null; source?: string }
type SyncStatus = {
  provider: string
  status: "running" | "success" | "failed"
  lastSuccessAt?: number
  message?: string
}

async function loadApi<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" })
  const body = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !body.ok || body.data === undefined) {
    throw new Error(body.error || "Não foi possível carregar as integrações.")
  }
  return body.data
}

function formatSyncTime(value?: number) {
  if (!value) return "Ainda não sincronizado"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

export function MobileIntegrationsScreen() {
  const [ml, setMl] = useState<Connection | null>(null)
  const [mp, setMp] = useState<Connection | null>(null)
  const [statuses, setStatuses] = useState<SyncStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function load(clearFeedback = true) {
    setLoading(true)
    if (clearFeedback) setFeedback(null)
    try {
      const [nextMl, nextMp, nextStatuses] = await Promise.all([
        loadApi<Connection>("/api/ml/account"),
        loadApi<Connection>("/api/mp/account"),
        loadApi<SyncStatus[]>("/api/sync/status"),
      ])
      setMl(nextMl)
      setMp(nextMp)
      setStatuses(nextStatuses)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao carregar.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function syncAll() {
    setSyncing(true)
    setFeedback(null)
    try {
      const response = await fetch("/api/sync/all?force=1", { method: "POST" })
      const body = (await response.json()) as ApiEnvelope<unknown>
      if (!response.ok || !body.ok) throw new Error(body.error || "A sincronização falhou.")
      setFeedback("Dados atualizados com sucesso.")
      await load(false)
      setFeedback("Dados atualizados com sucesso.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "A sincronização falhou.")
    } finally {
      setSyncing(false)
    }
  }

  const allStatus = statuses.find((status) => status.provider === "all")

  return (
    <MobilePage>
      <MobileHero
        eyebrow="Conexões"
        title="Seus canais trabalhando juntos."
        description="Confira o que está conectado e atualize estoque, vendas e pagamentos em um toque."
        action={
          <button
            type="button"
            onClick={() => void syncAll()}
            disabled={syncing || loading || !ml?.connected}
            className="mobile-tap mt-1 inline-flex items-center gap-2 rounded-2xl bg-[var(--mobile-accent)] px-4 text-sm font-black text-[#17352a] disabled:opacity-50"
          >
            {syncing ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sincronizar agora
          </button>
        }
      />

      {feedback && (
        <div className="rounded-2xl bg-[var(--mobile-card)] px-4 py-3 text-sm font-semibold shadow-sm">
          {feedback}
        </div>
      )}

      <MobileSection title="Canais conectados">
        <div className="grid gap-3">
          <ConnectionCard
            name="Mercado Livre"
            detail={ml?.mlNickname || "Anúncios, pedidos e estoque"}
            connected={Boolean(ml?.connected)}
            loading={loading}
            href="/api/ml/connect"
            icon={Link2}
          />
          <ConnectionCard
            name="Mercado Pago"
            detail="Pagamentos e conciliação financeira"
            connected={Boolean(mp?.connected)}
            loading={loading}
            href="/api/mp/connect"
            icon={WalletCards}
          />
        </div>
      </MobileSection>

      <MobileSection title="Última atualização">
        <div className="rounded-[1.5rem] border border-black/5 bg-[var(--mobile-card)] p-4 dark:border-white/8">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-2xl",
                allStatus?.status === "failed"
                  ? "bg-red-500/10 text-red-600"
                  : "bg-emerald-600/10 text-emerald-700",
              )}
            >
              <RefreshCw
                className={cn("size-5", allStatus?.status === "running" && "animate-spin")}
              />
            </span>
            <div>
              <p className="text-sm font-bold">{formatSyncTime(allStatus?.lastSuccessAt)}</p>
              <p className="mt-1 text-xs leading-relaxed text-current/50">
                {allStatus?.message ||
                  "Sincronize para garantir que os números estejam atualizados."}
              </p>
            </div>
          </div>
        </div>
      </MobileSection>
    </MobilePage>
  )
}

function ConnectionCard({
  name,
  detail,
  connected,
  loading,
  href,
  icon: Icon,
}: {
  name: string
  detail: string
  connected: boolean
  loading: boolean
  href: string
  icon: typeof Link2
}) {
  return (
    <article className="rounded-[1.5rem] border border-black/5 bg-[var(--mobile-card)] p-4 shadow-sm dark:border-white/8">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-current/6">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{name}</p>
          <p className="truncate text-xs text-current/50">{detail}</p>
        </div>
        {loading ? (
          <LoaderCircle className="size-5 animate-spin text-current/35" />
        ) : connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2.5 py-1 text-[0.68rem] font-bold text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Conectado
          </span>
        ) : (
          <Unplug className="size-5 text-current/30" />
        )}
      </div>
      {!loading && !connected && (
        <a
          href={href}
          className="mobile-tap mt-4 flex items-center justify-center rounded-2xl bg-[var(--mobile-ink)] px-4 text-sm font-bold text-[var(--mobile-surface)]"
        >
          Conectar {name}
        </a>
      )}
    </article>
  )
}
