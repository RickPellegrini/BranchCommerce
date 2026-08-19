"use client"

import { App } from "@capacitor/app"
import { Browser } from "@capacitor/browser"
import { Capacitor, type PluginListenerHandle, SystemBars, SystemBarsStyle } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import { Network } from "@capacitor/network"
import { useEffect, useState } from "react"

const OFFICIAL_HOST = "branchcommercehub.com"

const mobileRoutes: Array<[string, string]> = [
  ["/financeiro", "/mobile/financeiro"],
  ["/estoque", "/mobile/estoque"],
  ["/mercado-livre", "/mobile/vendas"],
  ["/branch-hunter", "/mobile/hunter"],
  ["/administrativo", "/mobile/administrativo"],
  ["/ti", "/mobile/integracoes"],
  ["/conta", "/mobile/conta"],
]

function resolveMobileRoute(route: string): string {
  const url = new URL(route, window.location.origin)
  if (url.searchParams.get("view") === "desktop") {
    return `${url.pathname}${url.search}${url.hash}`
  }
  if (url.pathname.startsWith("/mobile")) return `${url.pathname}${url.search}${url.hash}`

  if (url.pathname === "/dashboard") {
    const integrationReturn = [...url.searchParams.keys()].some(
      (key) => key.startsWith("ml_") || key.startsWith("mp_"),
    )
    return `${integrationReturn ? "/mobile/integracoes" : "/mobile"}${url.search}${url.hash}`
  }

  for (const [webPath, mobilePath] of mobileRoutes) {
    if (url.pathname === webPath || url.pathname.startsWith(`${webPath}/`)) {
      return `${mobilePath}${url.pathname.slice(webPath.length)}${url.search}${url.hash}`
    }
  }

  return `${url.pathname}${url.search}${url.hash}`
}

function isAndroidNativeAuthCallback(rawUrl: string): boolean {
  if (Capacitor.getPlatform() !== "android") return false

  try {
    const url = new URL(rawUrl)
    return (
      url.protocol === "branchcommerce:" &&
      url.hostname === "mobile-auth" &&
      url.pathname === "/callback"
    )
  } catch {
    return false
  }
}

function resolveAppRoute(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)

    if (url.protocol === "branchcommerce:") {
      const hostPath = url.hostname ? `/${url.hostname}` : ""
      return `${hostPath}${url.pathname}${url.search}${url.hash}` || "/"
    }

    if (
      url.protocol === "https:" &&
      (url.hostname === OFFICIAL_HOST || url.hostname.endsWith(`.${OFFICIAL_HOST}`))
    ) {
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    return null
  }

  return null
}

export function MobileRuntime() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    document.documentElement.dataset.nativeApp = Capacitor.getPlatform()
    const handles: PluginListenerHandle[] = []
    let disposed = false

    const keepHandle = async (handlePromise: Promise<PluginListenerHandle>) => {
      const handle = await handlePromise
      if (disposed) {
        await handle.remove()
        return
      }
      handles.push(handle)
    }

    const openRoute = (rawUrl: string) => {
      // MainActivity owns this one-time Clerk ticket on Android.
      if (isAndroidNativeAuthCallback(rawUrl)) return

      const route = resolveAppRoute(rawUrl)
      if (!route) return

      if (rawUrl.startsWith("branchcommerce:")) {
        void Browser.close().catch(() => undefined)
      }

      window.location.assign(resolveMobileRoute(route))
    }

    void SystemBars.setStyle({ style: SystemBarsStyle.Light }).catch(() => undefined)
    const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const mobileEntry = resolveMobileRoute(currentRoute)
    if (mobileEntry !== currentRoute) {
      window.location.replace(mobileEntry)
      return
    }
    void Network.getStatus().then((status) => setIsOffline(!status.connected))
    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) openRoute(launch.url)
    })
    void keepHandle(App.addListener("appUrlOpen", ({ url }) => openRoute(url)))
    void keepHandle(
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back()
        else void App.minimizeApp()
      }),
    )
    void keepHandle(
      Network.addListener("networkStatusChange", (status) => setIsOffline(!status.connected)),
    )

    const provideHapticFeedback = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest("button, a[href], [role='button']"))
        return
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
    }

    document.addEventListener("pointerup", provideHapticFeedback, { passive: true })

    return () => {
      disposed = true
      document.removeEventListener("pointerup", provideHapticFeedback)
      delete document.documentElement.dataset.nativeApp
      for (const handle of handles) void handle.remove()
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="mobile-offline-banner" role="status">
      Sem conexão. Algumas informações podem estar desatualizadas.
    </div>
  )
}
