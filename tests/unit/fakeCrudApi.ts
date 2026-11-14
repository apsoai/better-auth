/**
 * In-memory stand-in for an Apso CRUD REST API, mounted on the adapter's
 * HttpClient.request so tests can assert on the exact requests the adapter
 * sends. It mirrors the parts of the real API that matter for bulk operations:
 * a default page of 5 rows, a 100-row page cap, AND-ed `filter=` params (also
 * as a condition on a request by id) and the query-string coercion of digit
 * strings to numbers.
 */

export interface RecordedRequest {
  method: string;
  url: string;
  body?: unknown;
}

type Row = Record<string, any>;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 100;

/** The real API coerces query-string scalars: number, boolean, null. */
function coerce(raw: string): unknown {
  if (raw === 'null' || raw === '') return null;
  const n = Number(raw);
  if (!isNaN(n)) return n;
  if (raw.toLowerCase() === 'true') return true;
  if (raw.toLowerCase() === 'false') return false;
  return raw;
}

function compare(op: string, actual: any, expected: any): boolean {
  switch (op.replace(/^\$/, '')) {
    case 'eq':
      // A text column compared with a coerced number matches only when the
      // number round-trips to the same text (a 21-digit id does not).
      return typeof actual === 'string' && typeof expected === 'number'
        ? actual === String(expected)
        : actual === expected;
    case 'lt':
      return actual < expected;
    case 'lte':
      return actual <= expected;
    case 'gt':
      return actual > expected;
    case 'gte':
      return actual >= expected;
    case 'in':
      return (expected as unknown[]).includes(actual);
    case 'isnull':
      return actual === null || actual === undefined;
    default:
      throw Object.assign(new Error(`Invalid comparison operator ${op}`), {
        statusCode: 400,
      });
  }
}

export class FakeCrudApi {
  readonly requests: RecordedRequest[] = [];
  readonly tables: Record<string, Row[]>;

  constructor(
    private readonly baseUrl: string,
    tables: Record<string, Row[]>
  ) {
    this.tables = tables;
  }

  /** Requests that changed data, in the order sent. */
  get writes(): RecordedRequest[] {
    return this.requests.filter(r => r.method !== 'GET');
  }

  writesTo(table: string): string[] {
    return this.writes
      .filter(r => r.url.startsWith(`${this.baseUrl}/${table}/`))
      .map(r => `${r.method} ${r.url.slice(this.baseUrl.length)}`)
      .sort();
  }

  mount(adapter: any): void {
    adapter.httpClient.request = jest.fn(async (config: any) =>
      this.handle(config.method, config.url, config.body)
    );
  }

  private handle(method: string, url: string, body?: unknown): unknown {
    this.requests.push({ method, url, ...(body !== undefined && { body }) });
    const parsed = new URL(url);
    const [, table, id] = parsed.pathname.split('/');
    const rows = this.tables[(table ?? '').toLowerCase()];
    if (!rows) {
      throw Object.assign(new Error(`HTTP 404: Cannot ${method} ${url}`), {
        statusCode: 404,
      });
    }

    if (id !== undefined) {
      const index = rows.findIndex(r => String(r.id) === id);
      if (index === -1) {
        throw Object.assign(new Error(`HTTP 404: ${table} not found`), {
          statusCode: 404,
        });
      }
      // A filter next to the id is a condition on the row, as on the real
      // API: 404 when the row does not meet it.
      for (const filter of parsed.searchParams.getAll('filter')) {
        const [field, op, raw] = filter.split('||');
        if (!compare(op!, rows[index]![field!], coerce(raw ?? ''))) {
          throw Object.assign(new Error(`HTTP 404: ${table} not found`), {
            statusCode: 404,
          });
        }
      }
      if (method === 'GET') return { ...rows[index] };
      if (method === 'PATCH') {
        // JSON round trip, as over the wire (Dates become ISO strings).
        Object.assign(rows[index]!, JSON.parse(JSON.stringify(body)));
        return { ...rows[index] };
      }
      if (method === 'DELETE') return rows.splice(index, 1)[0];
    }

    if (method === 'GET') {
      let result = rows.slice();
      for (const filter of parsed.searchParams.getAll('filter')) {
        const [field, op, raw] = filter.split('||');
        const expected =
          op!.replace(/^\$/, '') === 'in'
            ? raw!.split(',').map(coerce)
            : coerce(raw!);
        result = result.filter(r => compare(op!, r[field!], expected));
      }
      const sort = parsed.searchParams.get('sort');
      if (sort) {
        const [field, order] = sort.split(',');
        result.sort(
          (a, b) =>
            (a[field!] < b[field!] ? -1 : a[field!] > b[field!] ? 1 : 0) *
            (order === 'DESC' ? -1 : 1)
        );
      }
      const limit = Math.min(
        Number(parsed.searchParams.get('limit')) || DEFAULT_LIMIT,
        MAX_LIMIT
      );
      const page = Number(parsed.searchParams.get('page')) || 1;
      const data = result.slice((page - 1) * limit, page * limit);
      return {
        data: data.map(r => ({ ...r })),
        count: data.length,
        total: result.length,
        page,
        pageCount: Math.ceil(result.length / limit),
      };
    }

    throw new Error(`FakeCrudApi: unsupported ${method} ${url}`);
  }
}
