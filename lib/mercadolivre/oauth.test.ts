import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildMlAuthorizationUrl, generatePkce } from "./oauth"

vi.mock("@/lib/mercadolivre/config", () => ({
  getMercadoLivreConfig: () => ({
    authUrl: "https://auth.mercadolivre.com.br/authorization",
    apiUrl: "https://api.mercadolibre.com",
    clientId: "TEST_CLIENT_ID",
    clientSecret: "TEST_CLIENT_SECRET",
    redirectUri: "https://localhost:3000/api/ml/callback",
  }),
}))

describe("generatePkce", () => {
  it("generates verifier and challenge strings", () => {
    const { verifier, challenge } = generatePkce()
    expect(typeof verifier).toBe("string")
    expect(typeof challenge).toBe("string")
    expect(verifier.length).toBeGreaterThan(0)
    expect(challenge.length).toBeGreaterThan(0)
  })

  it("produces base64url safe characters (no +, /, =)", () => {
    const { verifier, challenge } = generatePkce()
    expect(verifier).not.toMatch(/[+/=]/)
    expect(challenge).not.toMatch(/[+/=]/)
  })

  it("generates different values each time", () => {
    const a = generatePkce()
    const b = generatePkce()
    expect(a.verifier).not.toBe(b.verifier)
    expect(a.challenge).not.toBe(b.challenge)
  })
})

describe("buildMlAuthorizationUrl", () => {
  beforeEach(() => {
    delete process.env.MERCADO_LIVRE_OAUTH_SCOPE
  })

  it("builds URL with required params", () => {
    const url = new URL(buildMlAuthorizationUrl("my-state"))
    expect(url.origin).toBe("https://auth.mercadolivre.com.br")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("client_id")).toBe("TEST_CLIENT_ID")
    expect(url.searchParams.get("redirect_uri")).toBe("https://localhost:3000/api/ml/callback")
    expect(url.searchParams.get("state")).toBe("my-state")
  })

  it("includes code_challenge when provided", () => {
    const url = new URL(buildMlAuthorizationUrl("state", "challenge123"))
    expect(url.searchParams.get("code_challenge")).toBe("challenge123")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
  })

  it("omits code_challenge when not provided", () => {
    const url = new URL(buildMlAuthorizationUrl("state"))
    expect(url.searchParams.has("code_challenge")).toBe(false)
    expect(url.searchParams.has("code_challenge_method")).toBe(false)
  })

  it("includes scope from env var when set", () => {
    process.env.MERCADO_LIVRE_OAUTH_SCOPE = "offline_access read"
    const url = new URL(buildMlAuthorizationUrl("state"))
    expect(url.searchParams.get("scope")).toBe("offline_access read")
  })
})
