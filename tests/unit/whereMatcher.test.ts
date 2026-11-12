import {
  matchesWhere,
  normalizeWhere,
  serverFilters,
} from '../../src/query/whereMatcher';

const row = {
  id: 42,
  userId: 7,
  email: 'Ada@Example.com',
  accountId: '108234567890123456789',
  providerId: 'google',
  expiresAt: '2026-11-11T12:00:00.000Z',
  password: null,
  loginCount: 10,
};
const match = (where: unknown) => matchesWhere(row, normalizeWhere(where));
const NOON = new Date('2026-11-11T12:00:00.000Z');
const LATER = new Date('2026-11-11T12:00:01.000Z');
const EARLIER = new Date('2026-11-11T11:59:59.000Z');

describe('matchesWhere', () => {
  // [description, where clause, expected]
  const cases: Array<[string, unknown, boolean]> = [
    [
      'eq is the default operator',
      [{ field: 'providerId', value: 'google' }],
      true,
    ],
    [
      'eq compares a numeric id with a string',
      [{ field: 'userId', value: '7' }],
      true,
    ],
    [
      'eq does not match a different id',
      [{ field: 'userId', value: '70' }],
      false,
    ],
    [
      'eq keeps a 21-digit id exact',
      [{ field: 'accountId', value: '108234567890123456788' }],
      false,
    ],
    [
      'eq null matches a null column',
      [{ field: 'password', value: null }],
      true,
    ],
    [
      'eq null does not match a value',
      [{ field: 'providerId', value: null }],
      false,
    ],
    [
      'eq compares a Date with an ISO string',
      [{ field: 'expiresAt', value: NOON }],
      true,
    ],
    [
      'eq is case sensitive',
      [{ field: 'email', value: 'ada@example.com' }],
      false,
    ],
    [
      'eq insensitive mode',
      [{ field: 'email', value: 'ada@example.com', mode: 'insensitive' }],
      true,
    ],
    [
      'ne',
      [{ field: 'providerId', value: 'credential', operator: 'ne' }],
      true,
    ],
    [
      'ne same value',
      [{ field: 'providerId', value: 'google', operator: 'ne' }],
      false,
    ],
    [
      'gt on dates',
      [{ field: 'expiresAt', value: EARLIER, operator: 'gt' }],
      true,
    ],
    [
      'gt is strict',
      [{ field: 'expiresAt', value: NOON, operator: 'gt' }],
      false,
    ],
    ['gte', [{ field: 'expiresAt', value: NOON, operator: 'gte' }], true],
    [
      'lt on dates',
      [{ field: 'expiresAt', value: LATER, operator: 'lt' }],
      true,
    ],
    [
      'lt is strict',
      [{ field: 'expiresAt', value: NOON, operator: 'lt' }],
      false,
    ],
    ['lte', [{ field: 'expiresAt', value: NOON, operator: 'lte' }], true],
    [
      'gt on numbers is numeric, not textual',
      [{ field: 'loginCount', value: 9, operator: 'gt' }],
      true,
    ],
    [
      'lt never matches a null column',
      [{ field: 'password', value: 'z', operator: 'lt' }],
      false,
    ],
    ['in', [{ field: 'userId', value: ['3', '7'], operator: 'in' }], true],
    [
      'in without the value',
      [{ field: 'userId', value: ['3', '8'], operator: 'in' }],
      false,
    ],
    [
      'in with an empty list matches nothing',
      [{ field: 'userId', value: [], operator: 'in' }],
      false,
    ],
    [
      'not_in',
      [{ field: 'userId', value: ['3', '8'], operator: 'not_in' }],
      true,
    ],
    [
      'not_in with the value',
      [{ field: 'userId', value: [7], operator: 'not_in' }],
      false,
    ],
    [
      'contains',
      [{ field: 'email', value: '@Example', operator: 'contains' }],
      true,
    ],
    [
      'contains is case sensitive',
      [{ field: 'email', value: '@example', operator: 'contains' }],
      false,
    ],
    [
      'contains insensitive',
      [
        {
          field: 'email',
          value: '@example',
          operator: 'contains',
          mode: 'insensitive',
        },
      ],
      true,
    ],
    [
      'starts_with',
      [{ field: 'email', value: 'Ada', operator: 'starts_with' }],
      true,
    ],
    [
      'ends_with',
      [{ field: 'email', value: '.org', operator: 'ends_with' }],
      false,
    ],
    [
      'AND needs every condition',
      [
        { field: 'userId', value: '7' },
        { field: 'providerId', value: 'credential' },
      ],
      false,
    ],
    [
      'OR needs one condition',
      [
        { field: 'userId', value: '8' },
        { field: 'providerId', value: 'google', connector: 'OR' },
      ],
      true,
    ],
    [
      'OR with no true condition',
      [
        { field: 'userId', value: '8' },
        { field: 'providerId', value: 'x', connector: 'OR' },
      ],
      false,
    ],
    [
      'connectors fold left to right',
      [
        { field: 'userId', value: '8' },
        { field: 'providerId', value: 'google', connector: 'OR' },
        { field: 'id', value: '1', connector: 'AND' },
      ],
      false,
    ],
    [
      'plain object is AND of equalities',
      { userId: 7, providerId: 'google' },
      true,
    ],
    ['plain object mismatch', { userId: 7, providerId: 'credential' }, false],
    ['empty clause matches', [], true],
  ];

  test.each(cases)('%s', (_name, where, expected) => {
    expect(match(where)).toBe(expected);
  });

  test('refuses a field the row does not have, even after a false condition', () => {
    expect(() =>
      match([
        { field: 'userId', value: '8' },
        { field: 'tenantId', value: 'x' },
      ])
    ).toThrow(/no field "tenantId"/);
  });
});

describe('serverFilters', () => {
  const filters = (where: unknown) => serverFilters(normalizeWhere(where));

  test('sends ids as digits and literal strings as they are', () => {
    expect(
      filters([
        { field: 'userId', value: '77' },
        { field: 'providerId', value: 'credential' },
      ])
    ).toEqual(['userId||$eq||77', 'providerId||$eq||credential']);
  });

  test('never sends a value the API would coerce or a column it may not have', () => {
    expect(
      filters([
        { field: 'accountId', value: '108234567890123456789' },
        { field: 'token', value: '12345' },
        { field: 'identifier', value: 'true' },
        { field: 'identifier', value: 'a||b' },
        { field: 'email', value: 'ada@example.com' },
        { field: 'providerId', value: 'Google', mode: 'insensitive' },
        { field: 'userId', value: '9007199254740993000' },
        { field: 'providerId', value: 'x', operator: 'ne' },
      ])
    ).toEqual([]);
  });

  test('widens date bounds by a day in the safe direction', () => {
    expect(
      filters([{ field: 'expiresAt', value: NOON, operator: 'lt' }])
    ).toEqual(['expiresAt||$lte||2026-11-12T12:00:00.000Z']);
    expect(
      filters([{ field: 'expiresAt', value: NOON, operator: 'gt' }])
    ).toEqual(['expiresAt||$gte||2026-11-10T12:00:00.000Z']);
  });

  test('sends "in" only for a short list of literal strings', () => {
    expect(
      filters([{ field: 'token', value: ['abc', 'def'], operator: 'in' }])
    ).toEqual(['token||$in||abc,def']);
    expect(
      filters([{ field: 'token', value: ['abc', '123'], operator: 'in' }])
    ).toEqual([]);
    expect(
      filters([{ field: 'token', value: ['a,b'], operator: 'in' }])
    ).toEqual([]);
  });
});
