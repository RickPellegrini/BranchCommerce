/**
 * Converte mensagens brutas de erro (Convex, stack, request id) em texto só para o utilizador.
 */
export function sanitizeConvexErrorMessage(message: string): string {
  const raw = message.trim()
  if (!raw) return "Algo deu errado. Tente novamente."

  if (
    !raw.includes("[CONVEX") &&
    !raw.includes("[Request ID") &&
    !raw.includes("Uncaught Error") &&
    !raw.includes("Server Error") &&
    !raw.includes(" at handler") &&
    !raw.includes("Called by client")
  ) {
    return raw
  }

  let s = raw
  s = s.replace(/\[CONVEX[^\]]*\]\s*/g, "")
  s = s.replace(/\[Request ID:\s*[a-f0-9]+\]\s*/gi, "")
  s = s.replace(/\s*Called by client\.?\s*$/i, "")
  s = s.replace(/\bServer Error\s*/gi, " ")

  const body = /(?:Uncaught Error:\s*|Error:\s*)([\s\S]+?)(?:\s+at\s+\w+)/i.exec(s)
  if (body?.[1]) {
    const cleaned = body[1].replace(/\s+/g, " ").trim()
    if (cleaned.length > 0 && !/[./\\](?:ts|tsx|js|jsx)(?::\d+)?\b/.test(cleaned)) {
      return cleaned
    }
  }

  s = s.replace(/\s+at\s+handler\s*\([^)]*\)/gi, "")
  s = s.replace(/\s+at\s+\S+\s*\([^)]+\)/g, "")
  s = s.replace(/\s+at\s+[^\n]+/g, "")
  s = s.replace(/\s+/g, " ").trim()

  if (!s || /[./\\]convex\//i.test(s) || /\.ts:\d+/i.test(s)) {
    return "Não foi possível concluir a ação. Tente novamente."
  }
  return s
}
