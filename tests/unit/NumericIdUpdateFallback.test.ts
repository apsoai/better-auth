import { ApsoAdapterFactory } from '../../src/adapter/ApsoAdapterFactory';

// Prod Sentry PLATFORM-CLIENT-3J: BetterAuth refreshes a session by token
// (where: [{ field: 'token', ... }]). The adapter looked the session up, got a
// numeric id from the API, and passed it to updateSession, which only accepts
// strings, so every session refresh failed.
describe('update by a non-id field with a numeric record id', () => {
  const make = () => {
    const adapter = ApsoAdapterFactory.createAdapter({ baseUrl: 'https://api.example.com' }) as any;
    adapter.findOne = jest.fn().mockResolvedValue({ id: 42, token: 'tok' });
    return adapter;
  };

  test('session refresh by token passes a string id', async () => {
    const adapter = make();
    const updateSession = jest
      .spyOn(adapter.sessionOperations, 'updateSession')
      .mockResolvedValue({ id: '42' });

    await adapter.update({
      model: 'session',
      where: [{ field: 'token', value: 'tok' }],
      update: { expiresAt: new Date() },
    });

    expect(updateSession).toHaveBeenCalledWith('42', expect.any(Object));
  });

  test('user update by another field passes a string id', async () => {
    const adapter = make();
    const updateUser = jest
      .spyOn(adapter.userOperations, 'updateUser')
      .mockResolvedValue({ id: '42' });

    await adapter.update({
      model: 'user',
      where: [{ field: 'name', value: 'Matt' }],
      update: { name: 'Matt C' },
    });

    expect(updateUser).toHaveBeenCalledWith('42', expect.any(Object));
  });
});
