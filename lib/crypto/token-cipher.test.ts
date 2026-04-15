import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { decryptToken, encryptToken, isEncrypted } from "./token-cipher"

describe("token-cipher", () => {
  const TEST_KEY = "a".repeat(64)

  beforeEach(() => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("encryptToken / decryptToken roundtrip", () => {
    it("encrypts and decrypts back to original", () => {
      const plain = "my-secret-token-12345"
      const encrypted = encryptToken(plain)
      expect(encrypted).not.toBe(plain)
      expect(decryptToken(encrypted)).toBe(plain)
    })

    it("produces different ciphertexts for the same plaintext (random IV)", () => {
      const plain = "same-token"
      const a = encryptToken(plain)
      const b = encryptToken(plain)
      expect(a).not.toBe(b)
    })

    it("handles empty string", () => {
      const encrypted = encryptToken("")
      expect(decryptToken(encrypted)).toBe("")
    })

    it("handles unicode content", () => {
      const plain = "token-açúcar-café-日本語"
      const encrypted = encryptToken(plain)
      expect(decryptToken(encrypted)).toBe(plain)
    })
  })

  describe("isEncrypted", () => {
    it("returns false for raw ML access tokens", () => {
      expect(isEncrypted("APP_USR-xxxx-yyyy-zzzz")).toBe(false)
    })

    it("returns false for raw TG- tokens", () => {
      expect(isEncrypted("TG-abc123-def456")).toBe(false)
    })

    it("returns true for properly encrypted token", () => {
      const encrypted = encryptToken("test-token")
      expect(isEncrypted(encrypted)).toBe(true)
    })

    it("returns false for short base64 strings", () => {
      const shortB64 = Buffer.from("short").toString("base64")
      expect(isEncrypted(shortB64)).toBe(false)
    })

    it("returns false for non-base64 strings", () => {
      expect(isEncrypted("not-base64!!!@@@")).toBe(false)
    })
  })

  describe("missing encryption key", () => {
    it("throws when TOKEN_ENCRYPTION_KEY is not set", () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "")
      expect(() => encryptToken("test")).toThrow("TOKEN_ENCRYPTION_KEY")
    })
  })
})
