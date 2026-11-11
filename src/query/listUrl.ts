/**
 * The one place the adapter builds the URL of a list request.
 *
 * Two query dialects, chosen by the `queryDialect` option:
 *
 *  - `nestjsx` (the default): `filter=field||eq||value`, `limit`, `page`. The
 *    Apso platform server reads this. The output is byte-identical to what
 *    each call site built by hand before this file existed, including the
 *    operator spelling (`eq`, `$eq`, `$eqL`) and which characters are encoded.
 *  - `postgrest`: `field=eq.value`, `limit`, `offset`. A generated service
 *    that accepts the PostgREST syntax only answers 400 to a nestjsx filter.
 */

export type QueryDialect = 'nestjsx' | 'postgrest';

export interface ListFilter {
  field: string;
  /**
   * The nestjsx operator exactly as the call site has always sent it. `eq`
   * and `$eq` are equality, `$eqL` is case-insensitive equality.
   */
  op: 'eq' | '$eq' | '$eqL';
  value: string | number | boolean;
}

export interface ListQuery {
  filters?: ListFilter[];
  limit?: number;
  /** 1-based page. nestjsx sends `page`; PostgREST sends `offset`. */
  page?: number;
  /**
   * nestjsx only: encode the value but leave `||` as it is. One call site
   * (verification tokens by identifier) has always sent it that way.
   */
  rawSeparators?: boolean;
}

interface DialectConfig {
  baseUrl: string;
  queryDialect?: QueryDialect;
}

/** Largest page a generated service returns. */
const SCAN_LIMIT = 100;

/**
 * Would the service read this string back changed if it were sent as
 * `field=eq.value`? @apso/postgrest-request trims such a value and turns
 * `null`, `true`, `false` and anything `Number()` accepts into that type, so
 * `+15551234567`, `0042` and a 21-digit provider account id stop matching a
 * text column. A number that prints back as the same digits (`21`) is safe.
 */
function needsQuoting(value: string): boolean {
  const asNumber = Number(value);
  return (
    value !== value.trim() ||
    /^(null|true|false)$/i.test(value) ||
    (value !== '' && !Number.isNaN(asNumber) && String(asNumber) !== value)
  );
}

function postgrestQuery(query: ListQuery): string {
  const parts: string[] = [];
  const quoted: string[] = [];
  for (const { field, op, value } of query.filters ?? []) {
    if (op === '$eqL') {
      // ilike is a pattern match: escape its wildcards so the value is
      // compared literally.
      // ponytail: `*` is always a wildcard in this syntax and cannot be
      // escaped, so a value holding `*` can match other rows; callers keep
      // their in-memory comparison.
      const literal = String(value).replace(/[\\%_]/g, '\\$&');
      parts.push(`${field}=ilike.${encodeURIComponent(literal)}`);
    } else if (typeof value === 'string' && needsQuoting(value)) {
      // A double-quoted value inside a group is taken as a string, unchanged.
      quoted.push(`${field}.eq."${value.replace(/[\\"]/g, '\\$&')}"`);
    } else {
      parts.push(`${field}=eq.${encodeURIComponent(String(value))}`);
    }
  }
  if (quoted.length) {
    parts.push(`and=${encodeURIComponent(`(${quoted.join(',')})`)}`);
  }
  if (query.limit !== undefined) parts.push(`limit=${query.limit}`);
  if (query.page !== undefined && query.page > 1) {
    parts.push(`offset=${(query.page - 1) * (query.limit ?? 0)}`);
  }
  return parts.join('&');
}

function nestjsxQuery(query: ListQuery): string {
  const parts = (query.filters ?? []).map(({ field, op, value }) =>
    query.rawSeparators
      ? `filter=${field}||${op}||${encodeURIComponent(String(value))}`
      : `filter=${encodeURIComponent(`${field}||${op}||${String(value)}`)}`
  );
  if (query.limit !== undefined) parts.push(`limit=${query.limit}`);
  if (query.page !== undefined) parts.push(`page=${query.page}`);
  return parts.join('&');
}

/** URL of a filtered list request in the configured dialect. */
export function listUrl(
  config: DialectConfig,
  apiPath: string,
  query: ListQuery
): string {
  const search =
    config.queryDialect === 'postgrest'
      ? postgrestQuery(query)
      : nestjsxQuery(query);
  return `${config.baseUrl}/${apiPath}${search ? `?${search}` : ''}`;
}

/**
 * URL of a list request whose rows the caller filters in memory.
 *
 * nestjsx: the bare collection URL, as before. PostgREST: a generated service
 * returns 25 rows to a list with no `limit`, so ask for the largest page and
 * narrow by `id` and `userId` on the server when the caller filters on them.
 * ponytail: still one page of 100 rows; page through it when a caller needs
 * more than 100 matches.
 */
export function scanUrl(
  config: DialectConfig,
  apiPath: string,
  where: Record<string, unknown> = {}
): string {
  if (config.queryDialect !== 'postgrest') {
    return `${config.baseUrl}/${apiPath}`;
  }
  const filters: ListFilter[] = [];
  for (const field of ['id', 'userId']) {
    const value = where?.[field];
    if (typeof value === 'string' || typeof value === 'number') {
      filters.push({ field, op: 'eq', value });
    }
  }
  return listUrl(config, apiPath, { filters, limit: SCAN_LIMIT });
}

/** The total in a `Content-Range` header: 42 for `0-9/42` and for `*\/42`. */
export function contentRangeTotal(header: string | null): number | undefined {
  const total = /\/(\d+)$/.exec(header ?? '')?.[1];
  return total === undefined ? undefined : Number(total);
}
