"use client"

import { Capacitor, registerPlugin } from "@capacitor/core"
import { Download, PackageCheck, Puzzle, ShieldCheck, Smartphone } from "lucide-react"
import type { MouseEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ExternalBrowserPlugin {
  open(options: { url: string }): Promise<void>
}

const ExternalBrowser = registerPlugin<ExternalBrowserPlugin>("ExternalBrowser")

const artifacts = [
  {
    href: "/downloads/branch-commerce-android.apk",
    icon: Smartphone,
    title: "Aplicativo Android",
    description: "APK oficial assinado para instalar no celular.",
    detail: "APK oficial assinado - Android",
    download: "branch-commerce-android.apk",
  },
  {
    href: "/api/branch-hunter/download",
    icon: Puzzle,
    title: "Extensao Branch Hunter",
    description: "Pacote ZIP pronto para instalar no navegador.",
    detail: "Chrome, Edge e navegadores Chromium",
    download: "branch-hunter-extension.zip",
  },
] as const

export function AdminDownloadCenter() {
  async function handleDownload(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (Capacitor.getPlatform() !== "android" || !Capacitor.isPluginAvailable("ExternalBrowser")) {
      return
    }

    event.preventDefault()
    const url = new URL(href, window.location.origin).toString()

    try {
      await ExternalBrowser.open({ url })
    } catch {
      window.location.assign(url)
    }
  }

  return (
    <Card className="min-w-0 border-primary/15 bg-primary/[0.035]">
      <CardHeader className="min-w-0 pb-2">
        <CardDescription className="flex items-center gap-2 font-medium text-primary">
          <PackageCheck className="size-4 shrink-0" />
          Central de downloads
        </CardDescription>
        <CardTitle className="text-base">Aplicativos e ferramentas oficiais</CardTitle>
        <CardDescription>
          Baixe os pacotes aprovados da Branch Commerce em um unico lugar.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3 md:grid-cols-2">
        {artifacts.map((artifact) => {
          const Icon = artifact.icon

          return (
            <article
              key={artifact.href}
              className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{artifact.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {artifact.description}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex min-w-0 flex-col gap-3 border-t pt-3">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" />
                  <span className="min-w-0 break-words">{artifact.detail}</span>
                </p>
                <Button asChild className="w-full">
                  <a
                    href={artifact.href}
                    download={artifact.download}
                    onClick={(event) => void handleDownload(event, artifact.href)}
                  >
                    <Download className="size-4" />
                    Baixar
                  </a>
                </Button>
              </div>
            </article>
          )
        })}
      </CardContent>
    </Card>
  )
}
