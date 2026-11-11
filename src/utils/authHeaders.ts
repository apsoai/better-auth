/**
 * The one place the adapter turns its API key into a request header.
 *
 * `Authorization` carries the key as a bearer token, which is what the Apso
 * platform server checks. Any other header name (`x-api-key` for
 * Apso-generated services and the hosted gateway) carries the bare key: those
 * targets compare the header value to the key itself, so a `Bearer ` prefix
 * makes every request fail.
 */
export function buildAuthHeaders(config: {
  apiKey?: string;
  authHeader?: string;
  queryDialect?: 'nestjsx' | 'postgrest';
}): Record<string, string> {
  // A service that still accepts both query syntaxes picks one per request
  // from the query string, and a list with no filter gives it nothing to go
  // on. Naming the dialect also makes it answer with a bare array.
  const headers: Record<string, string> =
    config.queryDialect === 'postgrest'
      ? { 'X-Crud-Dialect': 'postgrest' }
      : {};
  if (!config.apiKey) return headers;
  const name = config.authHeader || 'Authorization';
  headers[name] =
    name.toLowerCase() === 'authorization'
      ? `Bearer ${config.apiKey}`
      : config.apiKey;
  return headers;
}
