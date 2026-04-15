import { describe, expect, it } from "vitest"

import { isAdminEmail } from "./admin"

describe("isAdminEmail", () => {
  it("recognizes admin emails", () => {
    expect(isAdminEmail("branchcommerce77@gmail.com")).toBe(true)
    expect(isAdminEmail("guinucleog3@hotmail.com")).toBe(true)
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
