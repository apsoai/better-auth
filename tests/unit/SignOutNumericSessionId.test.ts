/**
 * Sign-out against an API whose session ids are integers.
 *
 * The Apso platform keys its auth tables with serial integers, where a
 * generated service uses uuids. Better Auth signs a user out by deleting the
 * session by token, and signs them out everywhere by deleting each of the
 * user's sessions. The rows below have the platform's shape; ids, tokens and
 * addresses are made up.
 */

import { ApsoAdapterFactory } from '../../src/adapter/ApsoAdapterFactory';
import { FakeCrudApi } from './fakeCrudApi';

const BASE = 'https://api.example.com';
const TOKEN = 'Zp3kQ9vXw2Lr7TnB5mYc8HsJ4aGfP6dQ';
const OTHER_TOKEN = 'Hs4JaGfP6dQZp3kQ9vXw2Lr7TnB5mYc8';

function setup() {
  const session = (id: number, token: string, userId: number) => ({
    id,
    created_at: '2026-11-16T20:55:01.000Z',
    updated_at: '2026-11-16T20:55:01.000Z',
    expiresAt: '2026-11-23T20:55:01.000Z',
    token,
    ipAddress: '203.0.113.7',
    userAgent: 'jest',
    userId,
  });
  const api = new FakeCrudApi(BASE, {
    sessions: [
      session(4812, TOKEN, 136),
      session(4813, OTHER_TOKEN, 136),
      session(4814, 'B5mYc8HsJ4aGfP6dQZp3kQ9vXw2Lr7Tn', 72),
    ],
  });
  const adapter = ApsoAdapterFactory.createAdapter({ baseUrl: BASE }) as any;
  api.mount(adapter);
  return { api, adapter };
}

describe('sign-out when session ids are integers', () => {
  test('deleting a session by token deletes its row', async () => {
    const { api, adapter } = setup();

    await adapter.delete({
      model: 'session',
      where: [{ field: 'token', value: TOKEN }],
    });

    expect(api.writesTo('sessions')).toEqual(['DELETE /sessions/4812']);
    expect(api.tables['sessions']!.map(r => r.id)).toEqual([4813, 4814]);
  });

  test('a session found by token can be refreshed by the id it came back with', async () => {
    const { api, adapter } = setup();
    const found = await adapter.findOne({
      model: 'session',
      where: [{ field: 'token', value: TOKEN }],
    });

    await adapter.update({
      model: 'session',
      where: { id: found.id },
      update: { expiresAt: new Date('2026-12-01T00:00:00.000Z') },
    });

    expect(api.writesTo('sessions')).toHaveLength(1);
    expect(api.writesTo('sessions')[0]).toMatch(/ \/sessions\/4812$/);
  });

  test('an empty id is still refused', async () => {
    const { adapter } = setup();
    await expect(adapter.sessionOperations.deleteSession('')).rejects.toThrow(
      'Session ID must be a non-empty string'
    );
    await expect(
      adapter.sessionOperations.deleteSession(undefined)
    ).rejects.toThrow('Session ID must be a non-empty string');
  });
});
