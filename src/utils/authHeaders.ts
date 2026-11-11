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
}): Record<string, string> {
  if (!config.apiKey) return {};
  const name = config.authHeader || 'Authorization';
  return {
    [name]:
      name.toLowerCase() === 'authorization'
        ? `Bearer ${config.apiKey}`
        : config.apiKey,
  };
}
