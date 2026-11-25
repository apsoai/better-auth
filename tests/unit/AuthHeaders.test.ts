/**
 * How the adapter key leaves the process, checked at the fetch boundary.
 *
 * Two real targets read it differently:
 *  - the Apso platform server (the Apso web app's own sign-in) reads
 *    `Authorization: Bearer <key>` and answers 401 to any `x-api-key` value
 *    that is not one of its own workspace keys;
 *  - Apso-generated services and the hosted gateway read a bare `x-api-key`
 *    and treat `Authorization: Bearer` as a user token (apsoai/cli#207).
 * So every request must carry the key in exactly one header, in the right
 * form. Fixtures are shaped like production rows (21-digit Google ids), per
 * the rule adopted after 2.0.18 broke Google sign-in.
 */

import { ApsoAdapterFactory } from '../../src/adapter/ApsoAdapterFactory';
import { ConfigValidator } from '../../src/utils/ConfigValidator';
import { buildAuthHeaders } from '../../src/utils/authHeaders';

// Shaped like BETTER_AUTH_SECRET: 32 random bytes, base64, with + / and =.
const KEY = 'q7Lk0V+3mXw9Zr/1TtYcB2nE8uHsJ4aGfP6dQxWvS5o=';
const GOOGLE_SUB = '100133098180415113425'; // 21 digits
const GITHUB_ID = '9919';
const BASE = 'https://api.staging.example.invalid';

describe('buildAuthHeaders', () => {
  test.each([
    [undefined, { Authorization: `Bearer ${KEY}` }],
    ['Authorization', { Authorization: `Bearer ${KEY}` }],
    ['authorization', { authorization: `Bearer ${KEY}` }],
    ['x-api-key', { 'x-api-key': KEY }],
    ['X-API-Key', { 'X-API-Key': KEY }],
  ])('authHeader %p', (authHeader, expected) => {
    expect(
      buildAuthHeaders({ apiKey: KEY, ...(authHeader && { authHeader }) })
    ).toEqual(expected);
  });

  test('no key, no credential header', () => {
    expect(buildAuthHeaders({ authHeader: 'x-api-key' })).toEqual({});
  });
});

describe('credential header on every sign-in request', () => {
  const realFetch = global.fetch;
  let sent: Array<{ url: string; headers: Record<string, string> }>;

  const rows: Record<string, unknown> = {
    accounts: {
      id: 3,
      userId: 21,
      accountId: GOOGLE_SUB,
      providerId: 'google',
    },
    users: { id: 21, email: 'Legacy.User@gmail.com', emailVerified: true },
    sessions: {
      id: 88,
      userId: 21,
      token: 'Zp3kQ9vXw2Lr7TnB5mYc8HsJ4aGfP6dQ',
      expiresAt: '2030-01-01T00:00:00.000Z',
    },
    verifications: {
      id: 7,
      identifier: 'reset-password:abc',
      value: '21',
      expiresAt: '2030-01-01T00:00:00.000Z',
    },
  };

  beforeEach(() => {
    sent = [];
    global.fetch = jest.fn(async (url: any, init: any = {}) => {
      const headers: Record<string, string> = {};
      new Headers(init.headers).forEach((v, k) => (headers[k] = v));
      sent.push({ url: String(url), headers });
      const path = new URL(String(url)).pathname.split('/')[1] || '';
      const row = rows[path] ?? {};
      const isList = init.method === undefined || init.method === 'GET';
      const byId = /\/\d+$/.test(new URL(String(url)).pathname);
      return new Response(JSON.stringify(isList && !byId ? [row] : row), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  /** The adapter calls BetterAuth makes for an OAuth and a password sign-in. */
  async function signIn(authHeader?: string) {
    const adapter = ApsoAdapterFactory.createAdapter({
      baseUrl: BASE,
      apiKey: KEY,
      ...(authHeader && { authHeader }),
    }) as any;
    const steps: Array<[string, () => Promise<unknown>]> = [
      [
        'google account lookup',
        () =>
          adapter.findOne({
            model: 'account',
            where: [
              { field: 'accountId', value: GOOGLE_SUB },
              { field: 'providerId', value: 'google' },
            ],
          }),
      ],
      [
        'github account lookup',
        () =>
          adapter.findOne({
            model: 'account',
            where: [
              { field: 'accountId', value: GITHUB_ID },
              { field: 'providerId', value: 'github' },
            ],
          }),
      ],
      [
        'user by email',
        () =>
          adapter.findOne({
            model: 'user',
            where: [{ field: 'email', value: 'Legacy.User@gmail.com' }],
          }),
      ],
      [
        'create account',
        () =>
          adapter.create({
            model: 'account',
            data: { userId: '21', accountId: GOOGLE_SUB, providerId: 'google' },
          }),
      ],
      [
        'create session',
        () =>
          adapter.create({
            model: 'session',
            data: {
              userId: '21',
              token: 'Zp3kQ9vXw2Lr7TnB5mYc8HsJ4aGfP6dQ',
              expiresAt: new Date('2030-01-01T00:00:00.000Z'),
            },
          }),
      ],
      [
        'session by token',
        () =>
          adapter.findOne({
            model: 'session',
            where: [
              { field: 'token', value: 'Zp3kQ9vXw2Lr7TnB5mYc8HsJ4aGfP6dQ' },
            ],
          }),
      ],
      [
        'create verification',
        () =>
          adapter.create({
            model: 'verification',
            data: {
              identifier: 'reset-password:abc',
              value: '21',
              expiresAt: new Date('2030-01-01T00:00:00.000Z'),
            },
          }),
      ],
      [
        'consume verification',
        () =>
          adapter.consumeOne({
            model: 'verification',
            where: [{ field: 'id', value: '7' }],
          }),
      ],
    ];
    for (const [name, run] of steps) {
      const before = sent.length;
      // Response shapes are not under test here; only what was sent.
      await run().catch(() => undefined);
      if (sent.length === before) throw new Error(`${name} sent no request`);
    }
    const entities = new Set(
      sent.map(r => new URL(r.url).pathname.split('/')[1])
    );
    expect([...entities].sort()).toEqual([
      'accounts',
      'sessions',
      'users',
      'verifications',
    ]);
  }

  test('default: Authorization: Bearer <key> and no x-api-key (platform server)', async () => {
    await signIn();
    for (const r of sent) {
      expect([r.url, r.headers['authorization']]).toEqual([
        r.url,
        `Bearer ${KEY}`,
      ]);
      // The platform server answers 401 to an unknown x-api-key.
      expect(r.headers).not.toHaveProperty('x-api-key');
    }
  });

  test.each(['x-api-key', 'X-API-Key'])(
    'authHeader %p: bare key and no Authorization (generated services, gateway)',
    async authHeader => {
      await signIn(authHeader);
      for (const r of sent) {
        expect([r.url, r.headers['x-api-key']]).toEqual([r.url, KEY]);
        // A generated service reads Authorization as a user token and
        // refuses the request when it fails.
        expect(r.headers).not.toHaveProperty('authorization');
      }
    }
  );

  test('health check sends the same header as the operations', async () => {
    await ConfigValidator.validateHealthCheck({
      baseUrl: BASE,
      apiKey: KEY,
      authHeader: 'x-api-key',
    } as any);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent[0]!.headers['x-api-key']).toBe(KEY);
    expect(sent[0]!.headers).not.toHaveProperty('authorization');
  });
});
