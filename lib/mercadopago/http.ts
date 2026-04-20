export const MP_API = "https://api.mercadopago.com"

export async function mpFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${MP_API}${path}`
  const method = init?.method ?? "GET"
  console.log(`[mp] ${method} ${url}`)

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[mp] ${res.status} ${res.statusText} — ${body}`)
    throw new Error(`Mercado Pago API error: ${res.status} — ${body}`)
  }

  const data = (await res.json()) as T
  console.log(`[mp] Response OK for ${method} ${path}`)
  return data
}

export async function mpFetchRaw(path: string, accessToken: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${MP_API}${path}`
  console.log(`[mp] GET (raw) ${url}`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[mp] ${res.status} ${res.statusText} — ${body}`)
    throw new Error(`Mercado Pago API error: ${res.status} — ${body}`)
  }

  const text = await res.text()
  console.log(`[mp] Raw response OK for ${path} (${text.length} bytes)`)
  return text
}
