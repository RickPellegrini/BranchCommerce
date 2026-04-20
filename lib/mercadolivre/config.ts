function requireEnv(
  name: "MERCADO_LIVRE_CLIENT_ID" | "MERCADO_LIVRE_CLIENT_SECRET" | "MERCADO_LIVRE_REDIRECT_URI",
) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`)
  }
  return value
}

export function getMercadoLivreConfig() {
  return {
    authUrl: "https://auth.mercadolivre.com.br/authorization",
    apiUrl: "https://api.mercadolibre.com",
    clientId: requireEnv("MERCADO_LIVRE_CLIENT_ID"),
    clientSecret: requireEnv("MERCADO_LIVRE_CLIENT_SECRET"),
    redirectUri: requireEnv("MERCADO_LIVRE_REDIRECT_URI"),
    notificationUrl: process.env.MERCADO_LIVRE_NOTIFICATION_URL ?? "",
  }
}
