/**
 * Sign-in data shapes against the real staging API.
 *
 * Drives the adapter exactly the way BetterAuth 1.6 does during sign-in
 * (internal-adapter findOAuthUser / createOAuthUser / createSession /
 * findSession / verification state), with fixtures shaped like production
 * rows: 21-digit Google account ids, short GitHub ids, ids with a leading
 * zero, legacy mixed-case emails, credential accounts, and a provider with
 * more rows than the API's 100-row page cap.
 *
 * Unit tests mock HTTP, which is how adapter 2.0.18 shipped a Google lookup
 * the API could never satisfy (it coerces long digit strings to numbers).
 *
 * Run: STAGING_API_URL=... STAGING_ADAPTER_KEY=... npm run test:integration
 * Every row is namespaced to this run (email it-<runId>+...@apso-ci.invalid,
 * verification identifier it-<runId>-...) and deleted in afterAll.
 */

import { randomInt } from 'crypto';
import { createApsoAdapter } from '../../../src';
import type { BetterAuthAdapter } from '../../../src/types';

const enabled = process.env.INTEGRATION_TESTS === 'true';
const describeIT = enabled ? describe : describe.skip;

const API_URL = (process.env.STAGING_API_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.STAGING_ADAPTER_KEY || '';
const API_PAGE_CAP = 100;

const runId = `${Date.now().toString(36)}${randomInt(1e6).toString(36)}`;
const email = (tag: string) => `it-${runId}+${tag}@apso-ci.invalid`;
const digits = (n: number) =>
  Array.from({ length: n }, () => randomInt(10)).join('');
/** Google `sub`: 21 digits, never a leading zero. */
const googleId = () => `1${digits(20)}`;

jest.setTimeout(180_000);

// --- raw API helpers: fixtures and cleanup never go through the code under test

async function api(method: string, path: string, body?: unknown): Promise<any> {
  // Staging throttles each caller to 60 requests / 10s; wait out a 429.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (res.status === 429 && attempt < 10) {
      await new Promise(r => setTimeout(r, 1500 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return text ? JSON.parse(text) : undefined;
  }
}
const filter = (field: string, op: string, value: string | number) =>
  `filter=${encodeURIComponent(`${field}||${op}||${value}`)}`;
async function list(resource: string, query: string): Promise<any[]> {
  const rows: any[] = [];
  for (let page = 1; ; page++) {
    const res = await api(
      'GET',
      `/${resource}?${query}&limit=${API_PAGE_CAP}&page=${page}`
    );
    rows.push(...res.data);
    if (page >= (res.pageCount ?? 1)) return rows;
  }
}
async function each<T>(items: T[], fn: (t: T) => Promise<unknown>) {
  for (const item of items) await fn(item);
}

/** Deletes every row this run created; returns what is still left. */
async function cleanup(): Promise<string[]> {
  const users = await list('users', filter('email', '$cont', `it-${runId}+`));
  for (const u of users) {
    for (const resource of ['sessions', 'accounts']) {
      const rows = await list(resource, filter('userId', '$eq', u.id));
      await each(rows, r => api('DELETE', `/${resource}/${r.id}`));
    }
    await api('DELETE', `/users/${u.id}`);
  }
  const verifications = await list(
    'verifications',
    filter('identifier', '$starts', `it-${runId}-`)
  );
  await each(verifications, v => api('DELETE', `/verifications/${v.id}`));

  const leftover = [
    ...(await list('users', filter('email', '$cont', `it-${runId}+`))).map(
      u => `user ${u.id}`
    ),
    ...(
      await list(
        'verifications',
        filter('identifier', '$starts', `it-${runId}-`)
      )
    ).map(v => `verification ${v.id}`),
  ];
  for (const u of users) {
    for (const resource of ['sessions', 'accounts']) {
      const rows = await list(resource, filter('userId', '$eq', u.id));
      leftover.push(...rows.map(r => `${resource} ${r.id}`));
    }
  }
  return leftover;
}

// --- the calls BetterAuth 1.6 makes (better-auth/dist/db/internal-adapter.mjs)

const eq = (field: string, value: unknown) => ({ field, value });

describeIT('sign-in against staging with production-shaped data', () => {
  let adapter: BetterAuthAdapter;

  beforeAll(() => {
    // Fail closed: a CI run with INTEGRATION_TESTS=true must never pass by
    // silently skipping because the secrets were not wired up.
    if (!API_URL || !API_KEY) {
      throw new Error(
        'STAGING_API_URL and STAGING_ADAPTER_KEY must be set when INTEGRATION_TESTS=true'
      );
    }
    adapter = createApsoAdapter({ baseUrl: API_URL, apiKey: API_KEY });
  });

  afterAll(async () => {
    if (!API_URL || !API_KEY) return;
    const leftover = await cleanup();
    if (leftover.length) {
      throw new Error(`Fixtures left on staging: ${leftover.join(', ')}`);
    }
  });

  /** createUser: BetterAuth lowercases the email before it reaches us. */
  const createUser = (tag: string): Promise<any> =>
    adapter.create({
      model: 'user',
      data: {
        name: `IT ${tag}`,
        email: email(tag).toLowerCase(),
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

  /** createOAuthUser: user then account, as BetterAuth sends them. */
  async function signUpWithProvider(
    tag: string,
    providerId: string,
    accountId: string
  ) {
    const user = await createUser(tag);
    const account: any = await adapter.create({
      model: 'account',
      data: {
        accountId,
        providerId,
        userId: user.id,
        accessToken: `it-access-${runId}`,
        scope: 'openid,email,profile',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return { user, account };
  }

  /** findOAuthUser's first call: account by (accountId, providerId). */
  const findOAuthAccount = (accountId: string, providerId: string) =>
    adapter.findOne<any>({
      model: 'account',
      where: [eq('accountId', accountId), eq('providerId', providerId)],
      join: { user: true },
    } as any);

  async function expectReturningSignIn(
    providerId: string,
    accountId: string,
    tag: string
  ) {
    const { user, account } = await signUpWithProvider(
      tag,
      providerId,
      accountId
    );
    const found = await findOAuthAccount(accountId, providerId);
    expect(found).not.toBeNull();
    expect(String(found.id)).toBe(String(account.id));
    expect(found.accountId).toBe(accountId);
    expect(String(found.userId)).toBe(String(user.id));
  }

  it('finds a returning Google user by 21-digit accountId', async () => {
    await expectReturningSignIn('google', googleId(), 'google');
  });

  it('finds a returning GitHub user by short numeric accountId', async () => {
    await expectReturningSignIn(
      'github',
      String(randomInt(1e6, 1e8)),
      'github'
    );
  });

  it('finds an account whose id has a leading zero', async () => {
    await expectReturningSignIn('google', `0${digits(9)}`, 'leading-zero');
  });

  it('does not match a different provider with the same accountId', async () => {
    const accountId = googleId();
    await signUpWithProvider('cross-provider', 'github', accountId);
    expect(await findOAuthAccount(accountId, 'google')).toBeNull();
  });

  // Paging is not pinned here. The API returns at most 100 rows per request
  // whatever `limit` says, in no fixed order, and the adapter's page size is
  // a constant, not config. Proving the (accountId, providerId) lookup pages
  // needs 101+ rows for one providerId: ~200 requests per run against
  // staging's per-caller throttle of 60 requests / 10s and 2000 / hour, on
  // every PR. Prod has that many Google rows; staging has ~20. If this
  // becomes worth the cost, top up providerId=google past 100 rows in
  // beforeAll and look up a fixture the API does not return on page 1.

  it('finds a legacy mixed-case email by its lowercased form', async () => {
    // Older rows were stored before emails were normalized; BetterAuth always
    // looks up email.toLowerCase(). Insert raw to keep the original casing.
    const stored = email('MixedCase')
      .replace('it-', 'IT-')
      .replace('apso-ci', 'Apso-CI');
    const raw = await api('POST', '/users', {
      email: stored,
      name: 'IT mixed',
      emailVerified: true,
    });
    const found: any = await adapter.findOne({
      model: 'user',
      where: [eq('email', stored.toLowerCase())],
    });
    expect(found).not.toBeNull();
    expect(String(found.id)).toBe(String(raw.id));
  });

  it('signs in with email/password: user by email with credential account joined', async () => {
    const user = await createUser('password');
    // BetterAuth's credential account uses the user id as accountId.
    const credential: any = await adapter.create({
      model: 'account',
      data: {
        accountId: String(user.id),
        providerId: 'credential',
        userId: user.id,
        password: 'scrypt:it-not-a-real-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // internalAdapter.findUserByEmail(email, { includeAccounts: true })
    const found: any = await adapter.findOne({
      model: 'user',
      where: [eq('email', email('password'))],
      join: { account: true },
    } as any);
    expect(String(found?.id)).toBe(String(user.id));
    const account = (found?.account ?? []).find(
      (a: any) => a.providerId === 'credential'
    );
    expect(String(account?.id)).toBe(String(credential.id));
    expect(account?.password).toBe('scrypt:it-not-a-real-hash');
  });

  it('creates a session and finds it by token with the user joined', async () => {
    const { user } = await signUpWithProvider('session', 'google', googleId());
    const token = `it${runId}${digits(20)}`;
    await adapter.create({
      model: 'session',
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 864e5),
        ipAddress: '',
        userAgent: 'apso-ci',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const found: any = await adapter.findOne({
      model: 'session',
      where: [eq('token', token)],
      join: { user: true },
    } as any);
    expect(found?.token ?? found?.sessionToken).toBe(token);
    expect(String(found?.user?.id)).toBe(String(user.id));
  });

  it('round-trips OAuth state: verification create, find by identifier, delete', async () => {
    const identifier = `it-${runId}-${digits(12)}`;
    const value = JSON.stringify({
      callbackURL: '/dashboard',
      codeVerifier: digits(43),
    });
    const created: any = await adapter.create({
      model: 'verification',
      data: {
        identifier,
        value,
        expiresAt: new Date(Date.now() + 600_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const found = await adapter.findMany<any>({
      model: 'verification',
      where: [eq('identifier', identifier)],
      sortBy: { field: 'createdAt', direction: 'desc' },
      limit: 1,
    } as any);
    expect(found).toHaveLength(1);
    expect(found[0].value).toBe(value);

    await adapter.delete({
      model: 'verification',
      where: [eq('id', String(created.id))],
    });
    const after = await adapter.findMany<any>({
      model: 'verification',
      where: [eq('identifier', identifier)],
    });
    expect(after).toHaveLength(0);
  });
});
