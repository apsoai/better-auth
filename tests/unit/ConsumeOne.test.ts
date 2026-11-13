import { ApsoAdapterFactory } from '../../src/adapter/ApsoAdapterFactory';

// better-auth 1.6 calls adapter.consumeOne({ where: [{ field: 'id' }] }) for
// password reset tokens. 2.0.20 lacked the method (500); 2.0.21 routed it
// through findOne, which has no id lookup for verification rows (always
// "Invalid token"). It must fetch by id. The row is then deleted with one
// DELETE by id, whose answer says whether this caller consumed it.
describe('consumeOne', () => {
  const make = (row: unknown) => {
    const adapter = ApsoAdapterFactory.createAdapter({
      baseUrl: 'https://api.example.com',
    }) as any;
    adapter.httpClient.get = jest.fn().mockResolvedValue(row);
    adapter.findOne = jest.fn().mockResolvedValue(row);
    adapter.httpClient.delete = jest.fn().mockResolvedValue(row);
    return adapter;
  };
  const byId = [{ field: 'id', value: '7' }];
  const apiRow = {
    id: 7,
    identifier: 'reset-password:abc',
    value: 'u1',
    expiresAt: '2030-01-01T00:00:00.000Z',
  };

  test('fetches the verification row by id, deletes it, returns it', async () => {
    const adapter = make(apiRow);
    const row = await adapter.consumeOne({
      model: 'verification',
      where: byId,
    });
    expect(adapter.httpClient.get.mock.calls[0][0]).toBe(
      'https://api.example.com/verifications/7'
    );
    expect(row).toMatchObject({ id: 7, value: 'u1' });
    expect(row.expiresAt).toBeInstanceOf(Date);
    expect(adapter.httpClient.delete.mock.calls.map((c: any) => c[0])).toEqual([
      'https://api.example.com/verifications/7',
    ]);
  });

  test('returns null and deletes nothing when the row is gone', async () => {
    const adapter = make(null);
    adapter.httpClient.get = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    expect(
      await adapter.consumeOne({ model: 'verification', where: byId })
    ).toBeNull();
    expect(adapter.httpClient.delete).not.toHaveBeenCalled();
  });

  test('falls back to findOne without an id, and works in a transaction', async () => {
    const adapter = make(apiRow);
    const where = [{ field: 'identifier', value: 'reset-password:abc' }];
    await adapter.transaction((trx: any) =>
      trx.consumeOne({ model: 'verification', where })
    );
    expect(adapter.findOne).toHaveBeenCalled();
    expect(adapter.httpClient.delete).toHaveBeenCalledTimes(1);
  });
});
