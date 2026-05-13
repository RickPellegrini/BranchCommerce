import { MP_API } from "./http"

export type MpProbeResult = {
  label: string
  url: string
  method: "GET"
  status: number | null
  ok: boolean
  body: string
  bodyTruncated: boolean
  contentType: string | null
  error: string | null
  /** Latencia em ms. */
  ms: number
}

const MAX_BODY_CHARS = 2_500

async function probe(label: string, url: string, accessToken: string): Promise<MpProbeResult> {
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    })
    const raw = await res.text()
    const ms = Date.now() - started
    const truncated = raw.length > MAX_BODY_CHARS
    console.log(
      `[mp-probe] ${label} → ${res.status} (${ms}ms, ${raw.length} bytes) ${truncated ? "[truncado]" : ""}`,
    )
    if (!res.ok) {
      console.warn(`[mp-probe] ${label} body: ${raw.slice(0, 400)}`)
    }
    return {
      label,
      url,
      method: "GET",
      status: res.status,
      ok: res.ok,
      body: truncated ? `${raw.slice(0, MAX_BODY_CHARS)}…` : raw,
      bodyTruncated: truncated,
      contentType: res.headers.get("content-type"),
      error: null,
      ms,
    }
  } catch (err) {
    const ms = Date.now() - started
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[mp-probe] ${label} threw: ${message}`)
    return {
      label,
      url,
      method: "GET",
      status: null,
      ok: false,
      body: "",
      bodyTruncated: false,
      contentType: null,
      error: message,
      ms,
    }
  }
}

/**
 * Probes the three balance/identity endpoints surfaced in the user's tickets,
 * plus a 1-row /v1/payments/search to confirm extract-read permission.
 *
 * - `userId` should be the OAuth mpUserId when available (sometimes /users/me
 *   itself is forbidden, so we still want to be able to test balance with the
 *   stored id).
 * - The full body of each response is returned so we can inspect whether MP
 *   answers with ForbiddenApiError, Unauthorized, ResourceNotFound, etc.
 */
export async function probeMpEndpoints(
  accessToken: string,
  userId: string | null,
): Promise<MpProbeResult[]> {
  const probes: Array<Promise<MpProbeResult>> = []

  probes.push(probe("users_me", `${MP_API}/users/me`, accessToken))

  if (userId) {
    probes.push(
      probe("balance_legacy", `${MP_API}/users/${userId}/mercadopago_account/balance`, accessToken),
    )
    probes.push(
      probe("balance_v1", `${MP_API}/v1/users/${userId}/mercadopago_account/balance`, accessToken),
    )
  } else {
    probes.push(
      Promise.resolve({
        label: "balance_legacy",
        url: `${MP_API}/users/{id}/mercadopago_account/balance`,
        method: "GET" as const,
        status: null,
        ok: false,
        body: "",
        bodyTruncated: false,
        contentType: null,
        error: "userId nao resolvido — pulando probe.",
        ms: 0,
      }),
    )
    probes.push(
      Promise.resolve({
        label: "balance_v1",
        url: `${MP_API}/v1/users/{id}/mercadopago_account/balance`,
        method: "GET" as const,
        status: null,
        ok: false,
        body: "",
        bodyTruncated: false,
        contentType: null,
        error: "userId nao resolvido — pulando probe.",
        ms: 0,
      }),
    )
  }

  probes.push(
    probe("payments_search", `${MP_API}/v1/payments/search?limit=1&offset=0`, accessToken),
  )

  return Promise.all(probes)
}

/**
 * Tries to extract a meaningful error code/message from a Mercado Pago error body.
 * Falls back to the raw text when the response is not JSON.
 */
export function summarizeProbeError(body: string): { code: string | null; message: string | null } {
  try {
    const parsed = JSON.parse(body) as {
      message?: string
      error?: string
      cause?: Array<{ code?: number | string; description?: string }>
    }
    return {
      code:
        parsed.error ??
        (parsed.cause && parsed.cause[0]?.code != null ? String(parsed.cause[0].code) : null),
      message: parsed.message ?? parsed.cause?.[0]?.description ?? null,
    }
  } catch {
    return { code: null, message: body.slice(0, 200) || null }
  }
}
