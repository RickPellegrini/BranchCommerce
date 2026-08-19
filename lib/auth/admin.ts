const FALLBACK_ADMIN_EMAILS = ["branchcommerce77@gmail.com", "guinucleog3@hotmail.com"]

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getAdminEmails() {
  const fromEnv = process.env.ADMIN_EMAILS?.split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean)

  return new Set(fromEnv?.length ? fromEnv : FALLBACK_ADMIN_EMAILS.map(normalizeEmail))
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false
  return getAdminEmails().has(normalizeEmail(email))
}
