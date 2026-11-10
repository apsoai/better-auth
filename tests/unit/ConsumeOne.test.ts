import { ApsoAdapterFactory } from '../../src/adapter/ApsoAdapterFactory';

// better-auth 1.6 calls adapter.consumeOne for password reset tokens; the
// adapter lacked it, so every reset returned 500 "consumeOne is not a function".
describe('consumeOne', () => {
  const make = (row: unknown) => {
    const adapter = ApsoAdapterFactory.createAdapter({
      baseUrl: 'https://api.example.com',
    }) as any;
    adapter.findOne = jest.fn().mockResolvedValue(row);
    adapter.delete = jest.fn().mockResolvedValue(row);
    return adapter;
  };
  const where = [{ field: 'id', value: 'v1' }];

  test('returns the row and deletes it by id', async () => {
    const adapter = make({ id: 7, value: 'u1' });
    expect(await adapter.consumeOne({ model: 'verification', where })).toEqual({
      id: 7,
      value: 'u1',
    });
    expect(adapter.delete).toHaveBeenCalledWith({
      model: 'verification',
      where: [{ field: 'id', value: '7' }],
    });
  });

  test('returns null and deletes nothing when no row matches', async () => {
    const adapter = make(null);
    expect(
      await adapter.consumeOne({ model: 'verification', where })
    ).toBeNull();
    expect(adapter.delete).not.toHaveBeenCalled();
  });

  test('is available inside a transaction', async () => {
    const adapter = make({ id: 'a' });
    await adapter.transaction((trx: any) =>
      trx.consumeOne({ model: 'verification', where })
    );
    expect(adapter.delete).toHaveBeenCalled();
  });
});
