/**
 * The URL of every filtered list request, checked at the fetch boundary for
 * both query dialects.
 *
 * The adapter has two kinds of target. The Apso platform server reads the
 * nestjsx syntax and must see exactly what it saw before the `queryDialect`
 * option existed: the default URLs below are the ones the adapter sent
 * before, byte for byte. A generated service that accepts the PostgREST
 * syntax only answers 400 to those, so `queryDialect: 'postgrest'` sends the
 * second form.
 *
 * Fixtures are shaped like production values: a 21-digit Google account id,
 * an email with a plus sign and mixed case, identifiers holding commas,
 * parentheses, dots and characters that need URL encoding.
 */

import { ApsoAdapterFactory } from '../../src/adapter/ApsoAdapterFactory';
import { ConfigValidator } from '../../src/utils/ConfigValidator';
import { contentRangeTotal, listUrl, scanUrl } from '../../src/query/listUrl';

const KEY = 'q7Lk0V+3mXw9Zr/1TtYcB2nE8uHsJ4aGfP6dQxWvS5o=';
const BASE = 'https://api.staging.example.invalid';
const GOOGLE_SUB = '100133098180415113425'; // 21 digits
const SESSION_TOKEN = 'Zp3kQ9vXw2Lr7TnB5mYc8HsJ4aGfP6dQ';
const DIGIT_TOKEN = '00123456789012345678'; // valid token, all digits
const OAUTH_STATE = 'reset-password:a(1),b.2 &=?#+/%';
const PHONE = '+15551234567';

type Adapter = any;
interface Case {
  name: string;
  run: (adapter: Adapter) => Promise<unknown>;
  nestjsx: string;
  postgrest: string;
}

const CASES: Case[] = [
  {
    name: 'user by email with a plus sign and mixed case',
    run: a =>
      a.findOne({
        model: 'user',
        where: [{ field: 'email', value: 'Maria.Lopez+Billing@Example.COM' }],
      }),
    nestjsx: `${BASE}/users?filter=email%7C%7C%24eqL%7C%7Cmaria.lopez%2Bbilling%40example.com&limit=1`,
    postgrest: `${BASE}/users?email=ilike.maria.lopez%2Bbilling%40example.com&limit=1`,
  },
  {
    name: 'user by email with an underscore, a wildcard in ilike',
    run: a =>
      a.findOne({
        model: 'user',
        where: [{ field: 'email', value: 'dev_ops@example.com' }],
      }),
    nestjsx: `${BASE}/users?filter=email%7C%7C%24eqL%7C%7Cdev_ops%40example.com&limit=1`,
    postgrest: `${BASE}/users?email=ilike.dev%5C_ops%40example.com&limit=1`,
  },
  {
    name: 'Google account by a 21-digit account id (matched in memory)',
    run: a =>
      a.findOne({
        model: 'account',
        where: [
          { field: 'accountId', value: GOOGLE_SUB },
          { field: 'providerId', value: 'google' },
        ],
      }),
    nestjsx: `${BASE}/accounts?filter=providerId%7C%7C%24eq%7C%7Cgoogle&limit=100&page=1`,
    postgrest: `${BASE}/accounts?providerId=eq.google&limit=100`,
  },
  {
    name: 'accounts of a user',
    run: a =>
      a.findMany({
        model: 'account',
        where: [{ field: 'userId', value: '21' }],
      }),
    nestjsx: `${BASE}/accounts?filter=userId%7C%7C%24eq%7C%7C21&limit=100&page=1`,
    postgrest: `${BASE}/accounts?userId=eq.21&limit=100`,
  },
  {
    name: 'accounts of a user for one provider',
    run: a =>
      a.findMany({
        model: 'account',
        where: [
          { field: 'userId', value: '21' },
          { field: 'providerId', value: 'credential' },
        ],
      }),
    nestjsx: `${BASE}/accounts?filter=userId%7C%7C%24eq%7C%7C21&filter=providerId%7C%7C%24eq%7C%7Ccredential&limit=100&page=1`,
    postgrest: `${BASE}/accounts?userId=eq.21&providerId=eq.credential&limit=100`,
  },
  {
    name: 'one account by user id',
    // This lookup throws after its request in both dialects (it reads a
    // status field from the response body). Only the URL is under test.
    run: a =>
      a
        .findOne({
          model: 'account',
          where: [{ field: 'userId', value: '21' }],
        })
        .catch(() => undefined),
    nestjsx: `${BASE}/accounts?filter=userId%7C%7C%24eq%7C%7C21&limit=1`,
    postgrest: `${BASE}/accounts?userId=eq.21&limit=1`,
  },
  {
    name: 'session by token',
    run: a =>
      a.findOne({
        model: 'session',
        where: [{ field: 'token', value: SESSION_TOKEN }],
      }),
    nestjsx: `${BASE}/sessions?filter=token%7C%7Ceq%7C%7C${SESSION_TOKEN}&limit=1`,
    postgrest: `${BASE}/sessions?token=eq.${SESSION_TOKEN}&limit=1`,
  },
  {
    name: 'session by a token made of digits, which must stay a string',
    run: a =>
      a.findOne({
        model: 'session',
        where: [{ field: 'token', value: DIGIT_TOKEN }],
      }),
    nestjsx: `${BASE}/sessions?filter=token%7C%7Ceq%7C%7C${DIGIT_TOKEN}&limit=1`,
    postgrest: `${BASE}/sessions?and=(token.eq.%22${DIGIT_TOKEN}%22)&limit=1`,
  },
  {
    name: 'verifications by an identifier with commas, parentheses, dots and reserved URL characters',
    run: a =>
      a.findMany({
        model: 'verification',
        where: [{ field: 'identifier', value: OAUTH_STATE }],
      }),
    nestjsx: `${BASE}/verifications?filter=identifier%7C%7Ceq%7C%7Creset-password%3Aa(1)%2Cb.2%20%26%3D%3F%23%2B%2F%25&limit=10`,
    postgrest: `${BASE}/verifications?identifier=eq.reset-password%3Aa(1)%2Cb.2%20%26%3D%3F%23%2B%2F%25&limit=10`,
  },
  {
    name: 'verifications by a phone number, which must keep its plus sign',
    run: a =>
      a.findMany({
        model: 'verification',
        where: [{ field: 'identifier', value: PHONE }],
        limit: 1,
      }),
    nestjsx: `${BASE}/verifications?filter=identifier%7C%7Ceq%7C%7C%2B15551234567&limit=10`,
    postgrest: `${BASE}/verifications?and=(identifier.eq.%22%2B15551234567%22)&limit=10`,
  },
  {
    name: 'one verification by an email identifier with mixed case',
    run: a =>
      a.findOne({
        model: 'verification',
        where: [
          { field: 'identifier', value: 'Maria.Lopez+Billing@Example.COM' },
        ],
      }),
    // This call site has always left the || separators unencoded.
    nestjsx: `${BASE}/verifications?filter=identifier||eq||maria.lopez%2Bbilling%40example.com&limit=1`,
    postgrest: `${BASE}/verifications?identifier=eq.maria.lopez%2Bbilling%40example.com&limit=1`,
  },
  {
    name: 'one verification by token',
    run: a =>
      a.findOne({
        model: 'verification',
        where: [{ field: 'token', value: 'aB3_x-9.Zq7' }],
      }),
    nestjsx: `${BASE}/verifications?filter=identifier%7C%7Ceq%7C%7CaB3_x-9.Zq7&limit=1`,
    postgrest: `${BASE}/verifications?identifier=eq.aB3_x-9.Zq7&limit=1`,
  },
  {
    name: 'user by id (rows filtered in memory)',
    run: a =>
      a.findOne({ model: 'user', where: [{ field: 'id', value: '21' }] }),
    nestjsx: `${BASE}/users`,
    postgrest: `${BASE}/users?id=eq.21&limit=100`,
  },
  {
    name: 'sessions of a user (rows filtered in memory)',
    run: a =>
      a.findMany({
        model: 'session',
        where: [{ field: 'userId', value: '21' }],
      }),
    nestjsx: `${BASE}/sessions`,
    postgrest: `${BASE}/sessions?userId=eq.21&limit=100`,
  },
];

describe('list request URLs', () => {
  const realFetch = global.fetch;
  let sent: Array<{ url: string; headers: Record<string, string> }>;

  function mockFetch(postgrest: boolean, total = 0) {
    sent = [];
    global.fetch = jest.fn(async (url: any, init: any = {}) => {
      const headers: Record<string, string> = {};
      new Headers(init.headers).forEach((v, k) => (headers[k] = v));
      sent.push({ url: String(url), headers });
      // No rows: each lookup ends after its first request.
      return postgrest
        ? new Response('[]', {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Content-Range': `*/${total}`,
            },
          })
        : new Response(
            JSON.stringify({
              data: [],
              count: 0,
              total,
              page: 1,
              pageCount: 0,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
    }) as any;
  }
  afterEach(() => {
    global.fetch = realFetch;
  });

  const adapter = (options: Record<string, unknown> = {}): Adapter =>
    ApsoAdapterFactory.createAdapter({
      baseUrl: BASE,
      apiKey: KEY,
      ...options,
    });

  describe.each([
    ['no queryDialect', {}],
    ["queryDialect: 'nestjsx'", { queryDialect: 'nestjsx' }],
  ])(
    '%s: the nestjsx URLs the platform server has always received',
    (_, options) => {
      test.each(CASES)('$name', async ({ run, nestjsx }) => {
        mockFetch(false);
        await run(adapter(options));
        expect(sent.map(r => r.url)).toEqual([nestjsx]);
        expect(sent[0]!.headers).not.toHaveProperty('x-crud-dialect');
        expect(sent[0]!.headers['authorization']).toBe(`Bearer ${KEY}`);
      });
    }
  );

  describe("queryDialect: 'postgrest'", () => {
    test.each(CASES)('$name', async ({ run, postgrest }) => {
      mockFetch(true);
      await run(
        adapter({ queryDialect: 'postgrest', authHeader: 'x-api-key' })
      );
      expect(sent.map(r => r.url)).toEqual([postgrest]);
      expect(sent[0]!.headers['x-crud-dialect']).toBe('postgrest');
      expect(sent[0]!.headers['x-api-key']).toBe(KEY);
      // No request may carry a nestjsx parameter.
      const params = [...new URL(sent[0]!.url).searchParams.keys()];
      expect(params).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^(filter|page|s|join|sort|fields)$/),
        ])
      );
    });

    test('accounts page with offset', async () => {
      // 100 rows per page until a short page: the second request skips 100.
      sent = [];
      const page = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        userId: 21,
        accountId: `gh-${i}`,
        providerId: 'github',
      }));
      global.fetch = jest.fn(async (url: any) => {
        sent.push({ url: String(url), headers: {} });
        const body = sent.length === 1 ? page : [];
        return new Response(JSON.stringify(body), {
          status: sent.length === 1 ? 206 : 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any;
      const rows = await adapter({ queryDialect: 'postgrest' }).findMany({
        model: 'account',
        where: [{ field: 'providerId', value: 'github' }],
      });
      expect(sent.map(r => r.url)).toEqual([
        `${BASE}/accounts?providerId=eq.github&limit=100`,
        `${BASE}/accounts?providerId=eq.github&limit=100&offset=100`,
      ]);
      expect(rows).toHaveLength(100);
    });

    test('a list is read as a bare array', async () => {
      global.fetch = jest.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                id: 88,
                userId: 21,
                token: SESSION_TOKEN,
                expiresAt: '2030-01-01T00:00:00.000Z',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
      ) as any;
      const session = await adapter({ queryDialect: 'postgrest' }).findOne({
        model: 'session',
        where: [{ field: 'token', value: SESSION_TOKEN }],
      });
      expect(session).toMatchObject({ token: SESSION_TOKEN });
    });

    test('count asks for the total alone and reads it from Content-Range', async () => {
      mockFetch(true, 42);
      const total = await adapter({ queryDialect: 'postgrest' }).count({
        model: 'user',
        where: [{ field: 'emailVerified', value: true }],
      });
      expect(total).toBe(42);
      expect(sent.map(r => r.url)).toEqual([
        `${BASE}/users?emailVerified=eq.true&limit=0`,
      ]);
      expect(sent[0]!.headers['prefer']).toBe('count=exact');
    });
  });

  test('count in the default dialect is the request it was before', async () => {
    mockFetch(false, 42);
    await adapter().count({ model: 'user' });
    expect(sent.map(r => r.url)).toEqual([`${BASE}/users`]);
    expect(sent[0]!.headers).not.toHaveProperty('prefer');
  });
});

describe('listUrl', () => {
  const nestjsx = { baseUrl: BASE };
  const postgrest = { baseUrl: BASE, queryDialect: 'postgrest' as const };

  test.each([
    // value, sent as
    ['google', 'providerId=eq.google'],
    ['21', 'providerId=eq.21'],
    ['a,b(c).d', 'providerId=eq.a%2Cb(c).d'],
    ['not.eq.x', 'providerId=eq.not.eq.x'],
    // The service would read these back as a number, a boolean or null.
    [GOOGLE_SUB, `and=(providerId.eq.%22${GOOGLE_SUB}%22)`],
    ['0042', 'and=(providerId.eq.%220042%22)'],
    ['1e5', 'and=(providerId.eq.%221e5%22)'],
    ['null', 'and=(providerId.eq.%22null%22)'],
    ['TRUE', 'and=(providerId.eq.%22TRUE%22)'],
    [' padded ', 'and=(providerId.eq.%22%20padded%20%22)'],
  ])('postgrest equality on %p', (value, expected) => {
    expect(
      listUrl(postgrest, 'accounts', {
        filters: [{ field: 'providerId', op: '$eq', value }],
      })
    ).toBe(`${BASE}/accounts?${expected}`);
  });

  test('postgrest: two values that need quoting share one group', () => {
    expect(
      listUrl(postgrest, 'accounts', {
        filters: [
          { field: 'accountId', op: '$eq', value: GOOGLE_SUB },
          { field: 'providerId', op: '$eq', value: 'google' },
          { field: 'scope', op: '$eq', value: '007' },
        ],
        limit: 1,
      })
    ).toBe(
      `${BASE}/accounts?providerId=eq.google&and=(accountId.eq.%22${GOOGLE_SUB}%22%2Cscope.eq.%22007%22)&limit=1`
    );
  });

  test('postgrest: ilike escapes its wildcards', () => {
    expect(
      listUrl(postgrest, 'users', {
        filters: [
          { field: 'email', op: '$eqL', value: '50%_off\\x@example.com' },
        ],
      })
    ).toBe(`${BASE}/users?email=ilike.50%5C%25%5C_off%5C%5Cx%40example.com`);
  });

  test("nestjsx: operator spelling and encoding are the call site's own", () => {
    const value = 'a b+c@x.io';
    expect(
      listUrl(nestjsx, 'verifications', {
        filters: [{ field: 'identifier', op: 'eq', value }],
        limit: 1,
      })
    ).toBe(
      `${BASE}/verifications?filter=${encodeURIComponent(`identifier||eq||${value}`)}&limit=1`
    );
    expect(
      listUrl(nestjsx, 'verifications', {
        filters: [{ field: 'identifier', op: 'eq', value }],
        limit: 100,
        rawSeparators: true,
      })
    ).toBe(
      `${BASE}/verifications?filter=identifier||eq||${encodeURIComponent(value)}&limit=100`
    );
    expect(
      listUrl(nestjsx, 'accounts', { filters: [], limit: 100, page: 3 })
    ).toBe(`${BASE}/accounts?limit=100&page=3`);
  });

  test('scanUrl: bare in nestjsx; id, userId and the largest page in postgrest', () => {
    const where = {
      id: '21',
      userId: 7,
      email: 'a@b.c',
      expiresAt: new Date(),
    };
    expect(scanUrl(nestjsx, 'sessions', where)).toBe(`${BASE}/sessions`);
    expect(scanUrl(postgrest, 'sessions', where)).toBe(
      `${BASE}/sessions?id=eq.21&userId=eq.7&limit=100`
    );
    expect(scanUrl(postgrest, 'sessions')).toBe(`${BASE}/sessions?limit=100`);
  });

  test.each([
    ['0-9/42', 42],
    ['*/42', 42],
    ['*/0', 0],
    ['0-9/*', undefined],
    [null, undefined],
  ])('contentRangeTotal(%p)', (header, expected) => {
    expect(contentRangeTotal(header)).toBe(expected);
  });
});

describe('queryDialect validation', () => {
  test.each(['nestjsx', 'postgrest', undefined])('accepts %p', queryDialect => {
    const result = ConfigValidator.validateConfig({
      baseUrl: BASE,
      apiKey: KEY,
      ...(queryDialect && { queryDialect }),
    } as any);
    expect(result.errors.filter(e => e.field === 'queryDialect')).toEqual([]);
  });

  test('refuses another value', () => {
    const result = ConfigValidator.validateConfig({
      baseUrl: BASE,
      apiKey: KEY,
      queryDialect: 'odata',
    } as any);
    expect(result.errors.map(e => e.field)).toContain('queryDialect');
  });
});
