const ADMIN_EMAILS = new Set([
  "branchcommerce77@gmail.com",
  "guinucleog3@hotmail.com",
]);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return ADMIN_EMAILS.has(normalizeEmail(email));
}
