type MpEnvName =
  | "MERCADO_PAGO_CLIENT_ID"
  | "MERCADO_PAGO_CLIENT_SECRET"
  | "MERCADO_PAGO_REDIRECT_URI"

function requireEnv(name: MpEnvName) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`)
  }
  return value
}

/**
 * Endpoints oficiais do Mercado Pago. Autorizacao usa o dominio .com.br
 * porque a conta do vendedor e brasileira; o resto da API e .com.
 */
export function getMercadoPagoConfig() {
  return {
    authUrl: "https://auth.mercadopago.com.br/authorization",
    apiUrl: "https://api.mercadopago.com",
    clientId: requireEnv("MERCADO_PAGO_CLIENT_ID"),
    clientSecret: requireEnv("MERCADO_PAGO_CLIENT_SECRET"),
    redirectUri: requireEnv("MERCADO_PAGO_REDIRECT_URI"),
    notificationUrl: process.env.MERCADO_PAGO_NOTIFICATION_URL ?? "",
    /**
     * Token de aplicacao (APP_USR-...). Usado como fallback quando o usuario
     * ainda nao conectou via OAuth; serve para a conta do proprio dono do app.
     */
    appAccessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "",
    publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY ?? "",
  }
}
