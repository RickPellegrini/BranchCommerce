import { parseVtexResponse, type VtexProductState } from "./vtex"

const VTEX_BASE = "https://www.eletroclub.com.br"

/**
 * Cliente HTTP VTEX (Eletro Club). Reutilizado pelo `monitorRun` (sem ação aninhada) e `vtexActions`.
 */
export async function fetchVtexProductState(sku: string): Promise<VtexProductState | null> {
  const url = `${VTEX_BASE}/api/catalog_system/pub/products/search?fq=skuId:${encodeURIComponent(sku)}`
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; branchnotify/1.0)",
        Accept: "application/json",
      },
    })
    if (!res.ok) {
      console.warn(`[vtex] HTTP ${res.status} for SKU ${sku}`)
      return null
    }
    const data: unknown = await res.json()
    return parseVtexResponse(sku, data)
  } catch (e) {
    console.error(`[vtex] Erro ao consultar SKU ${sku}:`, e)
    return null
  }
}
