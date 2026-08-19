export function getStoreServerKey() {
  const key = process.env.STORE_SERVER_KEY ?? process.env.TOKEN_ENCRYPTION_KEY
  if (!key) {
    throw new Error("STORE_SERVER_KEY ou TOKEN_ENCRYPTION_KEY nao definido.")
  }
  return key
}
