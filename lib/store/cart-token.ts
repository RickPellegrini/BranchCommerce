import { createHash, randomBytes } from "crypto"

export const STORE_CART_COOKIE = "branch_store_cart"
export const STORE_CART_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function createStoreCartToken() {
  return randomBytes(32).toString("base64url")
}

export function hashStoreCartToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}
