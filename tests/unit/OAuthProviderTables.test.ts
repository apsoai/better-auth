/**
 * What Better Auth 1.7's OAuth provider (@better-auth/oauth-provider, used by
 * @better-auth/mcp) and the organization plugin ask of the adapter, checked
 * against an in-memory CRUD API.
 *
 * The rows are shaped like the ones a generated Apso service returned in a
 * full sign-in from an MCP client (Better Auth 1.7.23): uuid primary keys, a
 * session with created_at / updated_at and the organization plugin's
 * activeOrganizationId, a refresh token with its null rotation columns, and
 * an authorization code stored as a verification row whose value is a JSON
 * string. Ids, tokens and addresses are made up.
 */

import { ApsoAdapterFactory } from '../../src/adapter/ApsoAdapterFactory';
import { FakeCrudApi } from './fakeCrudApi';

const BASE = 'https://api.example.com';

const ANA = '6b1f0c52-9d3e-4c7a-8f21-0a4d5e6f7a81';
const ACME = 'c2a94f10-5e7b-4d38-9a66-1b2c3d4e5f90';
const GLOBEX = 'd3b05a21-6f8c-4e49-8b77-2c3d4e5f6a01';
const SESSION = 'e4c16b32-7a9d-4f5a-9c88-3d4e5f6a7b12';
const SESSION_TOKEN = 'Zp3kQ9vXw2Lr7TnB5mYc8HsJ4aGfP6dQ';
const CLIENT_ID = 'hQ7mXw2Lr9TnB5vYc8ZsJ4aGfP6dKe3u';
const REFRESH = 'f5d27c43-8bae-4a6b-8d99-4e5f6a7b8c23';
const CODE = 'a6e38d54-9cbf-4b7c-9eaa-5f6a7b8c9d34';
const MCP_URL = 'https://api.example.com/mcp';

function seed() {
  return {
    users: [
      {
        id: ANA,
        created_at: '2026-11-13T15:01:07.412Z',
        updated_at: '2026-11-13T15:01:07.412Z',
        email: 'ana-mhx1k2j3@example.test',
        emailVerified: false,
        name: 'ana',
        image: null,
      },
    ],
    sessions: [
      {
        id: SESSION,
        created_at: '2026-11-13T15:01:07.598Z',
        updated_at: '2026-11-13T15:01:08.120Z',
        expiresAt: '2026-11-20T15:01:07.590Z',
        token: SESSION_TOKEN,
        ipAddress: '',
        userAgent: '',
        activeOrganizationId: ACME,
        userId: ANA,
      },
    ],
    organizations: [
      {
        id: ACME,
        name: 'Acme',
        slug: 'acme-mhx1k2j3',
        logo: null,
        metadata: null,
        createdAt: '2026-11-13T15:01:07.901Z',
      },
      {
        id: GLOBEX,
        name: 'Globex',
        slug: 'globex-mhx1k2j3',
        logo: null,
        metadata: null,
        createdAt: '2026-11-13T15:01:08.455Z',
      },
    ],
    members: [
      {
        id: '0a7f49e5-1dc0-4c8d-8fbb-6a7b8c9d0e45',
        organizationId: ACME,
        userId: ANA,
        role: 'admin',
        createdAt: '2026-11-13T15:01:07.950Z',
      },
      {
        id: '1b805af6-2ed1-4d9e-90cc-7b8c9d0e1f56',
        organizationId: GLOBEX,
        userId: ANA,
        role: 'member',
        createdAt: '2026-11-13T15:01:08.500Z',
      },
    ],
    oauthrefreshtokens: [
      {
        id: REFRESH,
        token: 'k1Vx0mQ8tYb3Zr6WcN9uHs2JfLpD4aGe7oTiXw5SyBA',
        clientId: CLIENT_ID,
        sessionId: SESSION,
        userId: ANA,
        referenceId: ACME,
        authorizationCodeId: 'p8Lk0V3mXw9Zr1TtYcB2nE8uHsJ4aGfP6dQxWvS5oCD',
        resources: [MCP_URL],
        requestedUserInfoClaims: null,
        expiresAt: '2026-12-13T15:01:09.000Z',
        createdAt: '2026-11-13T15:01:09.000Z',
        revoked: null,
        rotatedAt: null,
        rotationReplayResponse: null,
        rotationReplayExpiresAt: null,
        authTime: '2026-11-13T15:01:07.598Z',
        confirmation: null,
        scopes: ['openid', 'offline_access'],
      },
    ],
    verifications: [
      {
        id: CODE,
        created_at: '2026-11-13T15:01:09.000Z',
        updated_at: '2026-11-13T15:01:09.000Z',
        identifier: 'u9Mn1W4nYx0As2UuZdC3oF9vItK5bHgQ7eRyXwT6pDE',
        value: JSON.stringify({
          type: 'authorization_code',
          query: {
            response_type: 'code',
            client_id: CLIENT_ID,
            redirect_uri: 'http://localhost:53682/callback',
            scope: 'openid offline_access',
            state: '7c91d2e3-4f5a-4b6c-8d7e-9f0a1b2c3d4e',
            code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
            code_challenge_method: 'S256',
            resource: MCP_URL,
          },
          userId: ANA,
          sessionId: SESSION,
          referenceId: ACME,
          authTime: 1794582067598,
          resource: [MCP_URL],
        }),
        expiresAt: '2026-11-13T15:11:09.000Z',
      },
    ],
    ratelimits: [
      {
        id: '2c916b07-3fe2-4ea0-a1dd-8c9d0e1f2a67',
        key: '203.0.113.7/sign-in/email',
        count: 2,
        lastRequest: 1794582067598,
      },
    ],
  };
}

function setup() {
  const api = new FakeCrudApi(BASE, seed());
  const newAdapter = () => {
    const adapter = ApsoAdapterFactory.createAdapter({ baseUrl: BASE }) as any;
    api.mount(adapter);
    return adapter;
  };
  return { api, adapter: newAdapter(), newAdapter };
}

describe('session rows', () => {
  test('a session read from the API has its sign-in time and the plugin fields', async () => {
    const { adapter } = setup();
    const session = await adapter.findOne({
      model: 'session',
      where: [{ field: 'token', value: SESSION_TOKEN }],
    });
    // The OAuth provider stamps a grant's authTime from session.createdAt.
    expect(session.createdAt).toEqual(new Date('2026-11-13T15:01:07.598Z'));
    expect(session.updatedAt).toEqual(new Date('2026-11-13T15:01:08.120Z'));
    expect(session.activeOrganizationId).toBe(ACME);
    expect(session).toMatchObject({ token: SESSION_TOKEN, userId: ANA });
    expect(session).not.toHaveProperty('created_at');
  });

  test('setting the active organization sends that field to the API', async () => {
    const { adapter, api } = setup();
    await adapter.update({
      model: 'session',
      where: [{ field: 'token', value: SESSION_TOKEN }],
      update: { activeOrganizationId: GLOBEX },
    });
    expect(api.writes).toHaveLength(1);
    expect(api.writes[0]).toMatchObject({
      method: 'PATCH',
      body: { activeOrganizationId: GLOBEX },
    });
    expect(api.tables.sessions![0]).toMatchObject({
      activeOrganizationId: GLOBEX,
      token: SESSION_TOKEN,
      userId: ANA,
    });
  });
});

describe('join', () => {
  test('findOne member with join user attaches the user the member names', async () => {
    const { adapter } = setup();
    const member = await adapter.findOne({
      model: 'member',
      where: [
        { field: 'userId', value: ANA },
        { field: 'organizationId', value: ACME },
      ],
      join: { user: true },
    });
    expect(member).toMatchObject({ role: 'admin', organizationId: ACME });
    expect(member.user).toMatchObject({
      id: ANA,
      email: 'ana-mhx1k2j3@example.test',
    });
  });

  test('findMany member with join organization attaches each organization', async () => {
    const { adapter } = setup();
    const members = await adapter.findMany({
      model: 'member',
      where: [{ field: 'userId', value: ANA }],
      join: { organization: true },
    });
    expect(
      members.map((m: any) => [m.role, m.organization?.name]).sort()
    ).toEqual([
      ['admin', 'Acme'],
      ['member', 'Globex'],
    ]);
  });

  test('without join, and with a join set to false, rows come back as they are', async () => {
    const { adapter, api } = setup();
    const where = [{ field: 'userId', value: ANA }];
    const plain = await adapter.findMany({ model: 'member', where });
    const off = await adapter.findMany({
      model: 'member',
      where,
      join: { organization: false },
    });
    expect(off).toEqual(plain);
    expect(plain[0]).not.toHaveProperty('organization');
    expect(api.requests.every(r => r.url.includes('/members'))).toBe(true);
  });

  test('a join the row holds no id for is left out', async () => {
    const { adapter } = setup();
    const organization = await adapter.findOne({
      model: 'organization',
      where: [{ field: 'slug', value: 'acme-mhx1k2j3' }],
      join: { member: true },
    });
    expect(organization).toMatchObject({ id: ACME, name: 'Acme' });
    expect(organization).not.toHaveProperty('member');
  });
});

describe('incrementOne', () => {
  const rotation = (revoked: Date) => ({
    model: 'oauthRefreshToken',
    where: [
      { field: 'id', value: REFRESH },
      { field: 'revoked', operator: 'eq', value: null },
    ],
    increment: {},
    set: { revoked, rotatedAt: revoked },
  });

  test('refresh token rotation marks the token revoked and returns the row', async () => {
    const { adapter, api } = setup();
    const at = new Date('2026-11-13T15:05:00.000Z');
    const row = await adapter.incrementOne(rotation(at));
    expect(row).toMatchObject({ id: REFRESH, clientId: CLIENT_ID });
    // The condition travels with the update, so the service decides.
    expect(api.writesTo('oauthrefreshtokens')).toEqual([
      `PATCH /oauthrefreshtokens/${REFRESH}?filter=${encodeURIComponent('revoked||$isnull')}`,
    ]);
    expect(api.tables.oauthrefreshtokens![0]!.revoked).toBe(at.toISOString());
  });

  test('two auth app processes that both read the token: one rotates it, the other gets null', async () => {
    // Two adapters on one API stand for two processes. Both reads are
    // answered before either PATCH is sent. The API answers 404 to the PATCH
    // whose condition no longer holds, as a generated service does.
    const { api, newAdapter } = setup();
    const first = new Date('2026-11-13T15:05:00.000Z');
    const second = new Date('2026-11-13T15:05:01.000Z');
    const results = await Promise.all([
      newAdapter().incrementOne(rotation(first)),
      newAdapter().incrementOne(rotation(second)),
    ]);
    expect(api.requests.map(r => r.method)).toEqual([
      'GET',
      'GET',
      'PATCH',
      'PATCH',
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter(r => r === null)).toHaveLength(1);
    expect(api.tables.oauthrefreshtokens![0]!.revoked).toBe(
      first.toISOString()
    );
  });

  test('client key rotation under queryDialect postgrest sends the stored keys as the condition', async () => {
    const sent: Array<{ method: string; url: string }> = [];
    const client = {
      id: '3da27c18-40f3-4fb1-b2ee-9d0e1f2a3b78',
      clientId: CLIENT_ID,
      jwks: '{"keys":[{"kty":"OKP","crv":"Ed25519","x":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo","kid":"k1"}]}',
    };
    const adapter = ApsoAdapterFactory.createAdapter({
      baseUrl: BASE,
      queryDialect: 'postgrest',
    }) as any;
    adapter.httpClient.request = jest.fn(async (config: any) => {
      sent.push({ method: config.method, url: config.url });
      return config.method === 'GET' ? [client] : { ...client, ...config.body };
    });
    const next =
      '{"keys":[{"kty":"OKP","crv":"Ed25519","x":"k2x","kid":"k2"}]}';
    const row = await adapter.incrementOne({
      model: 'oauthClient',
      where: [
        { field: 'clientId', value: CLIENT_ID },
        { field: 'jwks', value: client.jwks },
      ],
      increment: {},
      set: { jwks: next },
    });
    expect(row).toMatchObject({ jwks: next });
    expect(sent[1]).toEqual({
      method: 'PATCH',
      url: `${BASE}/oauthclients/${client.id}?clientId=eq.${CLIENT_ID}&jwks=eq.${encodeURIComponent(client.jwks)}`,
    });
  });

  test('a token that is already revoked matches nothing and is not written', async () => {
    const { adapter, api } = setup();
    await adapter.incrementOne(rotation(new Date('2026-11-13T15:05:00.000Z')));
    const again = await adapter.incrementOne(
      rotation(new Date('2026-11-13T15:06:00.000Z'))
    );
    expect(again).toBeNull();
    expect(api.writes).toHaveLength(1);
    expect(api.tables.oauthrefreshtokens![0]!.revoked).toBe(
      '2026-11-13T15:05:00.000Z'
    );
  });

  test('adds to a counter and sets the other fields in one update', async () => {
    const { adapter, api } = setup();
    await adapter.incrementOne({
      model: 'rateLimit',
      where: [{ field: 'key', value: '203.0.113.7/sign-in/email' }],
      increment: { count: 1 },
      set: { lastRequest: 1794582070000 },
    });
    expect(api.writes).toHaveLength(1);
    expect(api.writes[0]!.body).toEqual({
      count: 3,
      lastRequest: 1794582070000,
    });
    // The counter is written only where it still holds the value read.
    expect(decodeURIComponent(api.writes[0]!.url)).toContain(
      'filter=count||$eq||2'
    );
  });

  test('two processes that add to one counter at the same time: both additions count', async () => {
    const { api, newAdapter } = setup();
    const add = () =>
      newAdapter().incrementOne({
        model: 'rateLimit',
        where: [{ field: 'key', value: '203.0.113.7/sign-in/email' }],
        increment: { count: 1 },
      });
    const rows = await Promise.all([add(), add()]);
    expect(api.tables.ratelimits![0]!.count).toBe(4);
    expect(rows.map((r: any) => r.count).sort()).toEqual([3, 4]);
  });

  test('a condition the service cannot be asked to check is matched here, then updated by id', async () => {
    const { adapter, api } = setup();
    const row = await adapter.incrementOne({
      model: 'rateLimit',
      where: [
        { field: 'key', value: '203.0.113.7/sign-in/email' },
        { field: 'count', operator: 'lt', value: 5 },
      ],
      increment: {},
      set: { lastRequest: 1794582070000 },
    });
    expect(row).toMatchObject({ count: 2, lastRequest: 1794582070000 });
    expect(api.writes.map(w => w.url)).toEqual([
      `${BASE}/ratelimits/2c916b07-3fe2-4ea0-a1dd-8c9d0e1f2a67`,
    ]);
  });

  test('no matching row returns null', async () => {
    const { adapter, api } = setup();
    const row = await adapter.incrementOne({
      model: 'oauthRefreshToken',
      where: [{ field: 'id', value: CODE }],
      increment: {},
      set: { revoked: new Date() },
    });
    expect(row).toBeNull();
    expect(api.writes).toHaveLength(0);
  });
});

describe('consumeOne on an authorization code', () => {
  const byId = { model: 'verification', where: [{ field: 'id', value: CODE }] };

  test('returns the code row and deletes it with one DELETE by id', async () => {
    const { adapter, api } = setup();
    const row = await adapter.consumeOne(byId);
    expect(JSON.parse(row.value)).toMatchObject({
      type: 'authorization_code',
      userId: ANA,
      referenceId: ACME,
    });
    expect(row.expiresAt).toBeInstanceOf(Date);
    expect(api.requests.map(r => `${r.method} ${r.url}`)).toEqual([
      `GET ${BASE}/verifications/${CODE}`,
      `DELETE ${BASE}/verifications/${CODE}`,
    ]);
    expect(api.tables.verifications).toHaveLength(0);
  });

  test('a second exchange of the same code gets null', async () => {
    const { adapter } = setup();
    await adapter.consumeOne(byId);
    expect(await adapter.consumeOne(byId)).toBeNull();
  });

  test('two auth app processes that both read the code: one gets it, the other null', async () => {
    // Two adapters on one API stand for two processes. Both GETs are answered
    // before either DELETE is sent. The API answers 404 to the DELETE that
    // comes second, as a generated service does.
    const { api, newAdapter } = setup();
    const results = await Promise.all([
      newAdapter().consumeOne(byId),
      newAdapter().consumeOne(byId),
    ]);
    expect(api.requests.map(r => r.method)).toEqual([
      'GET',
      'GET',
      'DELETE',
      'DELETE',
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter(r => r === null)).toHaveLength(1);
  });

  test('a DELETE that fails for another reason is an error, not a consumed code', async () => {
    const { adapter, api } = setup();
    const request = adapter.httpClient.request;
    adapter.httpClient.request = jest.fn(async (config: any) => {
      if (config.method === 'DELETE') {
        // The message alone would read as a missing row; the status decides.
        throw Object.assign(new Error('relation "verification" not found'), {
          statusCode: 500,
        });
      }
      return request(config);
    });
    await expect(adapter.consumeOne(byId)).rejects.toThrow();
    expect(api.tables.verifications).toHaveLength(1);
  });
});

describe('HttpClient', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  test('a 404 from the service on DELETE reaches consumeOne as null', async () => {
    // The response a generated service sends for a row that is already gone.
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: any, init: any = {}) => {
      calls.push(`${init.method ?? 'GET'} ${url}`);
      return init.method === 'DELETE'
        ? new Response(
            JSON.stringify({
              statusCode: 404,
              message: 'verification not found',
              error: 'Not Found',
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        : new Response(JSON.stringify(seed().verifications[0]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
    }) as any;
    const adapter = ApsoAdapterFactory.createAdapter({ baseUrl: BASE }) as any;
    expect(
      await adapter.consumeOne({
        model: 'verification',
        where: [{ field: 'id', value: CODE }],
      })
    ).toBeNull();
    expect(calls).toEqual([
      `GET ${BASE}/verifications/${CODE}`,
      `DELETE ${BASE}/verifications/${CODE}`,
    ]);
  });

  test('an error response carries its HTTP status', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ message: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
    ) as any;
    const adapter = ApsoAdapterFactory.createAdapter({ baseUrl: BASE }) as any;
    await expect(
      adapter.httpClient.get(`${BASE}/verifications/${CODE}`)
    ).rejects.toMatchObject({
      message: 'Too Many Requests',
      statusCode: 429,
    });
  });
});
