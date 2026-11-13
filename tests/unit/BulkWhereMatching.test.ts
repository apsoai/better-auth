import { ApsoAdapterFactory } from '../../src/adapter/ApsoAdapterFactory';
import { FakeCrudApi } from './fakeCrudApi';

// Bulk operations act only on rows that match the where clause. Every where
// clause below is the exact shape Better Auth 1.6 sends from its internal
// adapter (better-auth/dist/db/internal-adapter.mjs), named in each test.

const BASE = 'https://api.example.com';
const NOW = new Date('2026-11-11T12:00:00.000Z');
const USER_COUNT = 130;
/** The user every targeted operation acts on. Its rows sit past page 1. */
const TARGET = '77';

const pad = (n: number, width: number) => String(n).padStart(width, '0');
/** Google account ids are 21 digits, beyond Number.MAX_SAFE_INTEGER. */
const googleId = (userId: number) => `10823456789012345${pad(userId, 4)}`;

function seed() {
  const users = [];
  const accounts = [];
  const sessions = [];
  for (let u = 1; u <= USER_COUNT; u++) {
    users.push({
      id: u,
      email: `user${u}@example.com`,
      emailVerified: u % 2 === 0,
      name: `User ${u}`,
      created_at: `2026-01-01T00:00:${pad(u % 60, 2)}.000Z`,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    accounts.push({
      id: accounts.length + 1,
      userId: u,
      accountId: String(u),
      providerId: 'credential',
      password: `salt${u}:hash${u}`,
    });
    accounts.push({
      id: accounts.length + 1,
      userId: u,
      accountId: googleId(u),
      providerId: 'google',
      password: null,
    });
    if (u % 3 === 2) {
      accounts.push({
        id: accounts.length + 1,
        userId: u,
        accountId: String(4100000 + u),
        providerId: 'github',
        password: null,
      });
    }
    sessions.push({
      id: sessions.length + 1,
      token: `tok${pad(u, 4)}activeAAAAAAAAAAAAAAAAAAAAAA`,
      userId: u,
      expiresAt: '2026-11-18T12:00:00.000Z',
      ipAddress: '203.0.113.7',
      userAgent: 'jest',
    });
    sessions.push({
      id: sessions.length + 1,
      token: `tok${pad(u, 4)}expiredBBBBBBBBBBBBBBBBBBBBB`,
      userId: u,
      expiresAt: '2026-11-01T12:00:00.000Z',
      ipAddress: '203.0.113.7',
      userAgent: 'jest',
    });
  }

  const verifications = [];
  for (let i = 1; i <= 150; i++) {
    verifications.push({
      id: i,
      identifier: `oauth-state-${i}`,
      value: `{"n":${i}}`,
      // Every third row expired an hour before NOW.
      expiresAt:
        i % 3 === 0 ? '2026-11-11T11:00:00.000Z' : '2026-11-11T13:00:00.000Z',
      created_at: '2026-11-11T10:00:00.000Z',
      updated_at: '2026-11-11T10:00:00.000Z',
    });
  }
  // Three rows for one identifier, the newest in the middle.
  ['09:00', '09:30', '09:15'].forEach((time, index) =>
    verifications.push({
      id: 151 + index,
      identifier: 'reset-password:tokenabc',
      value: TARGET,
      expiresAt: '2026-11-11T13:00:00.000Z',
      created_at: `2026-11-11T${time}:00.000Z`,
      updated_at: `2026-11-11T${time}:00.000Z`,
    })
  );

  const organizations = [];
  for (let i = 1; i <= 7; i++) {
    organizations.push({
      id: i,
      slug: `org-${i}`,
      plan: i <= 2 ? 'team' : 'free',
    });
  }

  return { users, accounts, sessions, verifications, organizations };
}

function setup() {
  const api = new FakeCrudApi(BASE, seed());
  const adapter = ApsoAdapterFactory.createAdapter({ baseUrl: BASE }) as any;
  api.mount(adapter);
  return { api, adapter };
}

const snapshot = (rows: unknown[]) => JSON.parse(JSON.stringify(rows));

describe('updateMany', () => {
  test('updatePassword: account [userId, providerId=credential] patches only that row', async () => {
    const { api, adapter } = setup();
    const before = snapshot(api.tables.accounts!);
    const target = before.find(
      (a: any) => a.userId === 77 && a.providerId === 'credential'
    );

    const updated = await adapter.updateMany({
      model: 'account',
      where: [
        { field: 'userId', value: TARGET },
        { field: 'providerId', value: 'credential' },
      ],
      update: { password: 'newsalt:newhash' },
    });

    expect(updated).toBe(1);
    expect(api.writes).toEqual([
      {
        method: 'PATCH',
        url: `${BASE}/accounts/${target.id}`,
        body: { password: 'newsalt:newhash', updated_at: expect.any(Date) },
      },
    ]);
    // Every other row, including the same user's Google account and every
    // other user's password, is byte-for-byte unchanged.
    const expected = before.map((a: any) =>
      a.id === target.id
        ? { ...a, password: 'newsalt:newhash', updated_at: expect.any(String) }
        : a
    );
    expect(api.tables.accounts).toEqual(expected);
    expect(
      new Set(
        api.tables
          .accounts!.filter(a => a.providerId === 'credential')
          .map(a => a.password)
      ).size
    ).toBe(USER_COUNT);
  });

  test('matches rows on every page, not only the first', async () => {
    const { api, adapter } = setup();
    const updated = await adapter.updateMany({
      model: 'account',
      where: [{ field: 'providerId', value: 'github' }],
      update: { scope: 'read:user' },
    });
    const github = api.tables.accounts!.filter(a => a.providerId === 'github');
    expect(github.length).toBeGreaterThan(5);
    expect(updated).toBe(github.length);
    expect(api.writesTo('accounts')).toEqual(
      github.map(a => `PATCH /accounts/${a.id}`).sort()
    );
  });

  test('session and user rows are matched the same way', async () => {
    const { api, adapter } = setup();
    expect(
      await adapter.updateMany({
        model: 'session',
        where: [{ field: 'userId', value: TARGET }],
        update: { expiresAt: new Date('2027-01-01T00:00:00.000Z') },
      })
    ).toBe(2);
    expect(api.writesTo('sessions')).toEqual([
      'PATCH /sessions/153',
      'PATCH /sessions/154',
    ]);

    expect(
      await adapter.updateMany({
        model: 'user',
        where: [{ field: 'email', value: 'user77@example.com' }],
        update: { name: 'Renamed' },
      })
    ).toBe(1);
    expect(api.writesTo('users')).toEqual(['PATCH /users/77']);
  });

  test('a plain-object where clause is an equality match on each key', async () => {
    const { api, adapter } = setup();
    const updated = await adapter.updateMany({
      model: 'user',
      where: { emailVerified: false },
      update: { emailVerified: true },
    });
    expect(updated).toBe(USER_COUNT / 2);
    expect(api.tables.users!.every(u => u.emailVerified)).toBe(true);
  });

  test('a clause that matches nothing sends no writes', async () => {
    const { api, adapter } = setup();
    expect(
      await adapter.updateMany({
        model: 'account',
        where: [
          { field: 'userId', value: '9999' },
          { field: 'providerId', value: 'credential' },
        ],
        update: { password: 'x' },
      })
    ).toBe(0);
    expect(api.writes).toEqual([]);
  });
});

describe('deleteMany', () => {
  test('deleteUser / deleteAccounts: account [userId] deletes only that user accounts', async () => {
    const { api, adapter } = setup();
    const mine = api.tables.accounts!.filter(a => a.userId === 77);
    const total = api.tables.accounts!.length;
    expect(mine.map(a => a.providerId).sort()).toEqual([
      'credential',
      'github',
      'google',
    ]);

    const deleted = await adapter.deleteMany({
      model: 'account',
      where: [{ field: 'userId', value: TARGET }],
    });

    expect(deleted).toBe(3);
    expect(api.writesTo('accounts')).toEqual(
      mine.map(a => `DELETE /accounts/${a.id}`).sort()
    );
    expect(api.tables.accounts).toHaveLength(total - 3);
    expect(api.tables.accounts!.some(a => a.userId === 77)).toBe(false);
  });

  test('deleteUserSessions: session [userId] deletes every session of that user and no other', async () => {
    const { api, adapter } = setup();
    const total = api.tables.sessions!.length;

    const deleted = await adapter.deleteMany({
      model: 'session',
      where: [{ field: 'userId', value: TARGET }],
    });

    expect(deleted).toBe(2);
    expect(api.writesTo('sessions')).toEqual([
      'DELETE /sessions/153',
      'DELETE /sessions/154',
    ]);
    expect(api.tables.sessions).toHaveLength(total - 2);
  });

  test('deleteSessions: session [token in [...]] deletes exactly those tokens', async () => {
    const { api, adapter } = setup();
    const tokens = [3, 77, 129].map(
      u => `tok${pad(u, 4)}activeAAAAAAAAAAAAAAAAAAAAAA`
    );

    const deleted = await adapter.deleteMany({
      model: 'session',
      where: [{ field: 'token', value: tokens, operator: 'in' }],
    });

    expect(deleted).toBe(3);
    expect(api.writesTo('sessions')).toEqual([
      'DELETE /sessions/153',
      'DELETE /sessions/257',
      'DELETE /sessions/5',
    ]);
  });

  test('verification cleanup: [expiresAt lt now] deletes every expired row and no live one', async () => {
    const { api, adapter } = setup();
    const expired = api.tables
      .verifications!.filter(v => new Date(v.expiresAt) < NOW)
      .map(v => `DELETE /verifications/${v.id}`)
      .sort();
    expect(expired).toHaveLength(50);

    const deleted = await adapter.deleteMany({
      model: 'verification',
      where: [{ field: 'expiresAt', value: NOW, operator: 'lt' }],
    });

    expect(deleted).toBe(50);
    expect(api.writesTo('verifications')).toEqual(expired);
    expect(
      api.tables.verifications!.every(v => new Date(v.expiresAt) >= NOW)
    ).toBe(true);
  });

  test('consumeVerificationValue: verification [identifier] deletes only that identifier', async () => {
    const { api, adapter } = setup();
    const deleted = await adapter.deleteMany({
      model: 'verification',
      where: [{ field: 'identifier', value: 'reset-password:tokenabc' }],
    });
    expect(deleted).toBe(3);
    expect(api.writesTo('verifications')).toEqual([
      'DELETE /verifications/151',
      'DELETE /verifications/152',
      'DELETE /verifications/153',
    ]);
  });

  test('user rows: deletes the matched users and their sessions only', async () => {
    const { api, adapter } = setup();
    const deleted = await adapter.deleteMany({
      model: 'user',
      where: [{ field: 'email', value: 'user77@example.com' }],
    });
    expect(deleted).toBe(1);
    expect(api.writesTo('users')).toEqual(['DELETE /users/77']);
    expect(api.writesTo('sessions')).toEqual([
      'DELETE /sessions/153',
      'DELETE /sessions/154',
    ]);
  });
});

describe('findMany', () => {
  test('listSessions: session [userId, expiresAt gt now] returns only active sessions of that user', async () => {
    const { adapter } = setup();
    const sessions = await adapter.findMany({
      model: 'session',
      where: [
        { field: 'userId', value: TARGET },
        { field: 'expiresAt', value: NOW, operator: 'gt' },
      ],
    });
    expect(sessions.map((s: any) => s.token)).toEqual([
      'tok0077activeAAAAAAAAAAAAAAAAAAAAAA',
    ]);
    expect(sessions[0].expiresAt).toBeInstanceOf(Date);
  });

  test('listSessions without the expiry filter returns both sessions', async () => {
    const { adapter } = setup();
    const sessions = await adapter.findMany({
      model: 'session',
      where: [{ field: 'userId', value: TARGET }],
    });
    expect(sessions).toHaveLength(2);
  });

  test('findSessions: session [token in [...], expiresAt gt now]', async () => {
    const { adapter } = setup();
    const sessions = await adapter.findMany({
      model: 'session',
      where: [
        {
          field: 'token',
          operator: 'in',
          value: [
            'tok0077activeAAAAAAAAAAAAAAAAAAAAAA',
            'tok0077expiredBBBBBBBBBBBBBBBBBBBBB',
            'tok0120activeAAAAAAAAAAAAAAAAAAAAAA',
          ],
        },
        { field: 'expiresAt', value: NOW, operator: 'gt' },
      ],
    });
    expect(sessions.map((s: any) => s.token).sort()).toEqual([
      'tok0077activeAAAAAAAAAAAAAAAAAAAAAA',
      'tok0120activeAAAAAAAAAAAAAAAAAAAAAA',
    ]);
  });

  test('findAccounts: account [userId] returns that user accounts with the 21-digit id intact', async () => {
    const { adapter } = setup();
    const accounts = await adapter.findMany({
      model: 'account',
      where: [{ field: 'userId', value: TARGET }],
    });
    expect(
      accounts.map((a: any) => [a.providerId, a.accountId, a.userId]).sort()
    ).toEqual([
      ['credential', '77', '77'],
      ['github', '4100077', '77'],
      ['google', '108234567890123450077', '77'],
    ]);
  });

  test('account [accountId, providerId] finds a 21-digit Google id', async () => {
    const { api, adapter } = setup();
    const accounts = await adapter.findMany({
      model: 'account',
      where: [
        { field: 'accountId', value: googleId(77) },
        { field: 'providerId', value: 'google' },
      ],
    });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].userId).toBe('77');
    // The id is matched in memory; the API would coerce it to a number.
    expect(api.requests.some(r => r.url.includes('accountId'))).toBe(false);
  });

  test('findVerificationValue: verification [identifier] sortBy createdAt desc limit 1 returns the newest', async () => {
    const { adapter } = setup();
    const rows = await adapter.findMany({
      model: 'verification',
      where: [{ field: 'identifier', value: 'reset-password:tokenabc' }],
      sortBy: { field: 'createdAt', direction: 'desc' },
      limit: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: '152', value: TARGET });
    expect(rows[0].expiresAt).toBeInstanceOf(Date);
  });

  test('listUsers: where, sortBy, limit and offset', async () => {
    const { adapter } = setup();
    const users = await adapter.findMany({
      model: 'user',
      where: [{ field: 'email', value: 'user12', operator: 'starts_with' }],
      sortBy: { field: 'email', direction: 'desc' },
      limit: 3,
      offset: 1,
    });
    // user12 and user120..user129 match. Descending, "user12@" sorts first
    // and is skipped by the offset.
    expect(users.map((u: any) => u.email)).toEqual([
      'user129@example.com',
      'user128@example.com',
      'user127@example.com',
    ]);
  });

  test('no where clause returns every row across pages', async () => {
    const { adapter } = setup();
    expect(await adapter.findMany({ model: 'user' })).toHaveLength(USER_COUNT);
  });
});

describe('count', () => {
  test('countTotalUsers: counts matching rows, not the first page', async () => {
    const { adapter } = setup();
    expect(await adapter.count({ model: 'user' })).toBe(USER_COUNT);
    expect(
      await adapter.count({
        model: 'user',
        where: [{ field: 'emailVerified', value: true }],
      })
    ).toBe(USER_COUNT / 2);
    expect(
      await adapter.count({
        model: 'account',
        where: [
          { field: 'userId', value: TARGET },
          { field: 'providerId', value: 'credential' },
        ],
      })
    ).toBe(1);
  });
});

describe('models the adapter has no special handling for', () => {
  test('updateMany and deleteMany touch only matching rows of that model', async () => {
    const { api, adapter } = setup();
    expect(
      await adapter.updateMany({
        model: 'organization',
        where: [{ field: 'plan', value: 'team' }],
        update: { plan: 'business' },
      })
    ).toBe(2);
    expect(
      await adapter.deleteMany({
        model: 'organization',
        where: [{ field: 'slug', value: 'org-7' }],
      })
    ).toBe(1);
    expect(api.writesTo('organizations')).toEqual([
      'DELETE /organizations/7',
      'PATCH /organizations/1',
      'PATCH /organizations/2',
    ]);
    expect(api.writes).toHaveLength(3);
    expect(api.tables.users).toHaveLength(USER_COUNT);
  });

  test('findMany and count filter in memory', async () => {
    const { adapter } = setup();
    const where = [{ field: 'plan', value: 'free' }];
    expect(
      await adapter.findMany({ model: 'organization', where })
    ).toHaveLength(5);
    expect(await adapter.count({ model: 'organization', where })).toBe(5);
  });
});

describe('find one row, then act on it', () => {
  test('update account [userId, providerId] patches the credential row, not the first row of that user', async () => {
    const { api, adapter } = setup();
    const google = api.tables.accounts!.find(
      a => a.userId === 77 && a.providerId === 'google'
    )!;
    await adapter.update({
      model: 'account',
      where: [
        { field: 'userId', value: TARGET },
        { field: 'providerId', value: 'google' },
      ],
      update: { scope: 'openid' },
    });
    expect(api.writesTo('accounts')).toEqual([`PATCH /accounts/${google.id}`]);
  });

  test('findOne session and user by a field with no dedicated lookup', async () => {
    const { adapter } = setup();
    const session = await adapter.findOne({
      model: 'session',
      where: [
        { field: 'userId', value: TARGET },
        { field: 'expiresAt', value: NOW, operator: 'gt' },
      ],
    });
    expect(session.token).toBe('tok0077activeAAAAAAAAAAAAAAAAAAAAAA');

    const user = await adapter.findOne({
      model: 'user',
      where: [{ field: 'name', value: 'User 77' }],
    });
    expect(user.id).toBe('77');
  });

  test('update and delete on another model act on the matching row, not the first row', async () => {
    const { api, adapter } = setup();
    await adapter.update({
      model: 'organization',
      where: [{ field: 'slug', value: 'org-6' }],
      update: { plan: 'team' },
    });
    await adapter.delete({
      model: 'organization',
      where: [{ field: 'slug', value: 'org-7' }],
    });
    expect(api.writes.map(r => `${r.method} ${r.url}`)).toEqual([
      `PATCH ${BASE}/organizations/6`,
      `DELETE ${BASE}/organizations/7`,
    ]);
    await expect(
      adapter.delete({
        model: 'organization',
        where: [{ field: 'slug', value: 'org-none' }],
      })
    ).rejects.toThrow();
    expect(api.writes).toHaveLength(2);
  });
});

describe('fails closed', () => {
  const cases: Array<[string, unknown]> = [
    ['an empty where array', []],
    ['an empty where object', {}],
    ['no where clause', undefined],
    [
      'an unknown operator',
      [{ field: 'userId', value: TARGET, operator: 'regex' }],
    ],
    [
      'an unknown connector',
      [{ field: 'userId', value: TARGET, connector: 'XOR' }],
    ],
    ['an unknown mode', [{ field: 'userId', value: TARGET, mode: 'fuzzy' }]],
    [
      'an unknown condition key',
      [{ field: 'userId', value: TARGET, not: true }],
    ],
    ['a condition without a field', [{ value: TARGET }]],
    [
      '"in" without an array',
      [{ field: 'userId', value: TARGET, operator: 'in' }],
    ],
    ['an operator object in a plain where', { userId: { $gt: 5 } }],
    ['a field the rows do not have', [{ field: 'tenantId', value: 'x' }]],
    ['a where clause that is not a list or object', 'userId=77'],
  ];

  test.each(cases)(
    'updateMany and deleteMany reject %s',
    async (_name, where) => {
      for (const model of [
        'account',
        'session',
        'user',
        'verification',
        'organization',
      ]) {
        const { api, adapter } = setup();
        await expect(
          adapter.updateMany({ model, where, update: { name: 'x' } })
        ).rejects.toThrow();
        await expect(adapter.deleteMany({ model, where })).rejects.toThrow();
        expect(api.writes).toEqual([]);
      }
    }
  );

  test('findMany and count reject a clause they cannot evaluate', async () => {
    const { adapter } = setup();
    const where = [{ field: 'userId', value: TARGET, operator: 'regex' }];
    await expect(
      adapter.findMany({ model: 'session', where })
    ).rejects.toThrow();
    await expect(adapter.count({ model: 'session', where })).rejects.toThrow();
  });

  test('stops without writing when the API keeps returning new full pages', async () => {
    const { adapter } = setup();
    let next = 1;
    adapter.httpClient.request = jest.fn(async (config: any) => {
      if (config.method !== 'GET') throw new Error('write attempted');
      return Array.from({ length: 100 }, () => ({
        id: next++,
        userId: 77,
        accountId: 'a',
        providerId: 'credential',
      }));
    });
    await expect(
      adapter.deleteMany({
        model: 'account',
        where: [{ field: 'userId', value: TARGET }],
      })
    ).rejects.toThrow();
    const methods = adapter.httpClient.request.mock.calls.map(
      (c: any[]) => c[0].method
    );
    expect(methods.every((m: string) => m === 'GET')).toBe(true);
  });

  test('an API that ignores filters and paging still cannot widen the match', async () => {
    const { api, adapter } = setup();
    const all = api.tables.accounts!;
    adapter.httpClient.request = jest.fn(async (config: any) => {
      api.requests.push({ method: config.method, url: config.url });
      return config.method === 'GET' ? all.map(a => ({ ...a })) : {};
    });
    const updated = await adapter.updateMany({
      model: 'account',
      where: [
        { field: 'userId', value: TARGET },
        { field: 'providerId', value: 'credential' },
      ],
      update: { password: 'x' },
    });
    const target = all.find(
      a => a.userId === 77 && a.providerId === 'credential'
    )!;
    expect(updated).toBe(1);
    expect(api.writes).toEqual([
      { method: 'PATCH', url: `${BASE}/accounts/${target.id}` },
    ]);
  });
});

describe('server-side narrowing', () => {
  test('sends equality filters the API compares reliably and pages with a stable order', async () => {
    const { api, adapter } = setup();
    await adapter.updateMany({
      model: 'account',
      where: [
        { field: 'userId', value: TARGET },
        { field: 'providerId', value: 'credential' },
      ],
      update: { password: 'x' },
    });
    const gets = api.requests.filter(r => r.method === 'GET');
    expect(gets).toHaveLength(1);
    const params = new URL(gets[0]!.url).searchParams;
    expect(params.getAll('filter')).toEqual([
      'userId||$eq||77',
      'providerId||$eq||credential',
    ]);
    expect(params.get('limit')).toBe('100');
    expect(params.get('page')).toBe('1');
    expect(params.get('sort')).toBe('id,ASC');
  });

  test('sends no filter when any condition is joined with OR', async () => {
    const { api, adapter } = setup();
    const rows = await adapter.findMany({
      model: 'account',
      where: [
        { field: 'userId', value: TARGET },
        { field: 'userId', value: '78', connector: 'OR' },
      ],
    });
    expect(new Set(rows.map((a: any) => a.userId))).toEqual(
      new Set(['77', '78'])
    );
    expect(api.requests.every(r => !r.url.includes('filter='))).toBe(true);
  });
});
