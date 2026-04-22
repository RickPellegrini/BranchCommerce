/**
 * IDs de anuncio ML podem vir como `MLB123` ou `MLB-123`. Sem normalizar, o mesmo item
 * entra duas vezes na busca (ativo + pausado ou merges) e a lista de catalogo duplica linhas.
 */
export function normalizeMercadoLibreItemId(raw: string): string {
  const m = raw.trim().match(/^(MLB)-?(\d+)$/i)
  return m ? `MLB${m[2]}` : raw.trim()
}
