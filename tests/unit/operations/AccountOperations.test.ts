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

  it('findManyAccounts sends every where-clause field as a filter', async () => {
    const result = await ops.findManyAccounts({
      where: { accountId: 'gh-42', providerId: 'github' },
    });

    expect(calledUrl()).toBe(
      'https://api.test/accounts?filter=accountId||$eq||gh-42&filter=providerId||$eq||github&limit=100'
    );
    expect(result).toEqual([account]);
  });

  it('findManyAccounts fetches offset + limit rows for the in-memory pager', async () => {
    await ops.findManyAccounts({ pagination: { limit: 10, offset: 20 } });
    expect(calledUrl()).toBe('https://api.test/accounts?limit=30');
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
