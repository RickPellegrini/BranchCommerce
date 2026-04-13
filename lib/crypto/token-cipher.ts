import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT = "branchcommerce-token-salt-v1"

function deriveKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY nao definido. Gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    )
  }
  return scryptSync(secret, SALT, 32)
}

export function encryptToken(plaintext: string): string {
  const key = deriveKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString("base64")
}

export function decryptToken(ciphertext: string): string {
  const key = deriveKey()
  const data = Buffer.from(ciphertext, "base64")

  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}

export function isEncrypted(value: string): boolean {
  if (!value.startsWith("APP_USR") && !value.startsWith("TG-")) {
    try {
      const buf = Buffer.from(value, "base64")
      return buf.length > IV_LENGTH + AUTH_TAG_LENGTH
    } catch {
      return false
    }
  }
  return false
}
