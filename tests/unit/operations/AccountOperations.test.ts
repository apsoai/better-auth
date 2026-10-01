/**
 * AccountOperations unit tests
 *
 * Regression coverage: account lookups used to GET /accounts?limit=10000 and
 * filter in memory on every sign-in. They must filter server-side.
 */

import { AccountOperations } from '../../../src/operations/AccountOperations';

describe('AccountOperations - server-side filtering', () => {
  const account = {
    id: '1',
    userId: '7',
    accountId: 'gh-42',
    providerId: 'github',
  };
  let get: jest.Mock;
  let ops: AccountOperations;

  beforeEach(() => {
    get = jest.fn().mockResolvedValue({ status: 200, data: [account] });
    ops = new AccountOperations(
      { baseUrl: 'https://api.test' },
      { get } as any,
      { transformInbound: jest.fn((_: string, a: unknown) => a) } as any,
      { normalizeArrayResponse: jest.fn((r: any) => r.data) } as any
    );
  });

  const calledUrl = () => decodeURIComponent(get.mock.calls[0][0]);

  it('filters providerId server-side but matches accountId in memory', async () => {
    const result = await ops.findManyAccounts({
      where: { accountId: 'gh-42', providerId: 'github' },
    });

    expect(calledUrl()).toBe(
      'https://api.test/accounts?filter=providerId||$eq||github&limit=100&page=1'
    );
    expect(result).toEqual([account]);
  });

  it('finds a Google account whose 21-digit id the API cannot filter on', async () => {
    // Regression: 2.0.18 sent accountId||$eq||<id>; the API coerced the long
    // digit string to a number and matched nothing, breaking Google sign-in.
    const google = { id: '3', userId: '21', accountId: '100133098180415113425', providerId: 'google' };
    get.mockResolvedValue({ status: 200, data: [google] });

    const result = await ops.findManyAccounts({
      where: { accountId: '100133098180415113425', providerId: 'google' },
    });

    expect(calledUrl()).not.toContain('accountId');
    expect(result).toEqual([google]);
  });

  it('pages past the API 100-row cap to find the account', async () => {
    const filler = Array.from({ length: 100 }, (_, i) => ({ ...account, id: `f${i}`, accountId: `other-${i}` }));
    get
      .mockResolvedValueOnce({ status: 200, data: filler })
      .mockResolvedValueOnce({ status: 200, data: [account] });

    const result = await ops.findManyAccounts({ where: { accountId: 'gh-42', providerId: 'github' } });

    expect(get).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(get.mock.calls[1][0])).toContain('page=2');
    expect(result).toEqual([account]);
  });

  it('findAccountByUserId filters by userId', async () => {
    const found = await ops.findAccountByUserId('7');

    expect(calledUrl()).toBe(
      'https://api.test/accounts?filter=userId||$eq||7&limit=1'
    );
    expect(found).toEqual(account);
  });

  it('never requests the whole table', async () => {
    await ops.findManyAccounts({ where: { userId: '7' } });
    await ops.findAccountByUserId('7');
    for (const [url] of get.mock.calls)
      expect(url).not.toContain('limit=10000');
  });
});
