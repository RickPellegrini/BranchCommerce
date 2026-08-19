import { afterEach, describe, expect, it, vi } from "vitest"

import { isAdminEmail } from "./admin"

describe("isAdminEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("recognizes admin emails", () => {
    expect(isAdminEmail("branchcommerce77@gmail.com")).toBe(true)
    expect(isAdminEmail("guinucleog3@hotmail.com")).toBe(true)
  })

  it("recognizes admins configured through ADMIN_EMAILS", () => {
    vi.stubEnv("ADMIN_EMAILS", "rick@example.com, socio@example.com")

    expect(isAdminEmail("rick@example.com")).toBe(true)
    expect(isAdminEmail("SOCIO@example.com")).toBe(true)
    expect(isAdminEmail("branchcommerce77@gmail.com")).toBe(false)
  })

  it("rejects non-admin email", () => {
    expect(isAdminEmail("random@example.com")).toBe(false)
  })

  it("normalizes to lowercase", () => {
    expect(isAdminEmail("BranchCommerce77@Gmail.com")).toBe(true)
  })

  it("trims whitespace", () => {
    expect(isAdminEmail("  branchcommerce77@gmail.com  ")).toBe(true)
  })

  it("returns false for null", () => {
    expect(isAdminEmail(null)).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(isAdminEmail(undefined)).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isAdminEmail("")).toBe(false)
  })
})
