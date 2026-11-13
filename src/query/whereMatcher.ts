/**
 * Where-clause matching for multi-row operations.
 *
 * Every bulk path (findMany, count, updateMany, deleteMany) decides which rows
 * it acts on with matchesWhere. Server-side filters only narrow the candidate
 * set; this matcher is the guarantee. It fails closed: a clause it does not
 * fully understand throws instead of matching everything.
 */

import { AdapterError, AdapterErrorCode } from '../types';

const OPERATORS = [
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'not_in',
  'contains',
  'starts_with',
  'ends_with',
] as const;

export type WhereOperator = (typeof OPERATORS)[number];

export interface WhereCondition {
  field: string;
  operator: WhereOperator;
  value: unknown;
  connector: 'AND' | 'OR';
  insensitive: boolean;
}

const CONDITION_KEYS = new Set([
  'field',
  'value',
  'operator',
  'connector',
  'mode',
]);

function reject(message: string, where: unknown): never {
  throw new AdapterError(
    AdapterErrorCode.VALIDATION_ERROR,
    `Unsupported where clause: ${message}`,
    { where },
    false,
    400
  );
}

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    value instanceof Date ||
    ['string', 'number', 'boolean'].includes(typeof value)
  );
}

/**
 * Normalize a Better Auth where clause (an array of conditions) or a plain
 * object of field/value equalities into a list of conditions. A missing where
 * clause is an empty list; callers decide whether that is allowed.
 */
export function normalizeWhere(where: unknown): WhereCondition[] {
  if (where === undefined || where === null) return [];

  if (!Array.isArray(where)) {
    if (typeof where !== 'object' || where instanceof Date) {
      reject('expected a list of conditions or an object', where);
    }
    return Object.entries(where as Record<string, unknown>).map(
      ([field, value]) => {
        if (!isScalar(value)) {
          reject(`field "${field}" has a non-scalar value`, where);
        }
        return {
          field,
          operator: 'eq' as const,
          value,
          connector: 'AND' as const,
          insensitive: false,
        };
      }
    );
  }

  return where.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      reject('a condition is not an object', where);
    }
    const condition = raw as Record<string, unknown>;
    const unknownKey = Object.keys(condition).find(
      key => !CONDITION_KEYS.has(key)
    );
    if (unknownKey) reject(`unknown condition key "${unknownKey}"`, where);

    const { field, value } = condition;
    const operator = condition.operator ?? 'eq';
    const connector = condition.connector ?? 'AND';
    const mode = condition.mode ?? 'sensitive';

    if (typeof field !== 'string' || field === '') {
      reject('a condition has no field', where);
    }
    if (!OPERATORS.includes(operator as WhereOperator)) {
      reject(`unknown operator "${String(operator)}"`, where);
    }
    if (connector !== 'AND' && connector !== 'OR') {
      reject(`unknown connector "${String(connector)}"`, where);
    }
    if (mode !== 'sensitive' && mode !== 'insensitive') {
      reject(`unknown mode "${String(mode)}"`, where);
    }
    if (!('value' in condition) || value === undefined) {
      reject(`field "${field}" has no value`, where);
    }
    if (operator === 'in' || operator === 'not_in') {
      if (!Array.isArray(value) || !value.every(isScalar)) {
        reject(`"${operator}" on "${field}" needs a list of values`, where);
      }
    } else if (!isScalar(value)) {
      reject(`field "${field}" has a non-scalar value`, where);
    }

    return {
      field,
      operator: operator as WhereOperator,
      value,
      connector,
      insensitive: mode === 'insensitive',
    };
  });
}

/** Timestamp of a Date or a parseable date string, else undefined. */
function toTime(value: unknown): number | undefined {
  const time =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'string'
        ? Date.parse(value)
        : NaN;
  return Number.isNaN(time) ? undefined : time;
}

/**
 * Equality across the types the API and Better Auth disagree on: ids arrive
 * as numbers from the API and strings from Better Auth, and dates arrive as
 * ISO strings from the API and Date objects from Better Auth.
 */
function equal(actual: unknown, expected: unknown, insensitive: boolean) {
  if (actual === null || actual === undefined) return expected === null;
  if (expected === null) return false;
  if (actual instanceof Date || expected instanceof Date) {
    const a = toTime(actual);
    return a !== undefined && a === toTime(expected);
  }
  const a = String(actual);
  const b = String(expected);
  return insensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** Ordering comparison; undefined when the two values cannot be ordered. */
function order(actual: unknown, expected: unknown): number | undefined {
  if (actual === null || actual === undefined || expected === null) {
    return undefined;
  }
  let a: unknown = actual;
  let b: unknown = expected;
  if (actual instanceof Date || expected instanceof Date) {
    a = toTime(actual);
    b = toTime(expected);
  } else if (typeof actual === 'number' || typeof expected === 'number') {
    a = Number(actual);
    b = Number(expected);
  }
  if (a === undefined || b === undefined) return undefined;
  if (typeof a === 'number' && typeof b === 'number') {
    return Number.isNaN(a) || Number.isNaN(b) ? undefined : a - b;
  }
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function matchesCondition(
  row: Record<string, unknown>,
  condition: WhereCondition
): boolean {
  const { field, operator, value, insensitive } = condition;
  if (!(field in row)) {
    // A field no row carries cannot be evaluated. Treating it as "no match"
    // would hide a typo or an unmapped column, so refuse the whole clause.
    reject(`rows have no field "${field}"`, condition);
  }
  const actual = row[field];
  const text = (v: unknown) =>
    insensitive ? String(v).toLowerCase() : String(v);

  switch (operator) {
    case 'eq':
      return equal(actual, value, insensitive);
    case 'ne':
      return !equal(actual, value, insensitive);
    case 'in':
      return (value as unknown[]).some(v => equal(actual, v, insensitive));
    case 'not_in':
      return !(value as unknown[]).some(v => equal(actual, v, insensitive));
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      const cmp = order(actual, value);
      if (cmp === undefined) return false;
      if (operator === 'lt') return cmp < 0;
      if (operator === 'lte') return cmp <= 0;
      if (operator === 'gt') return cmp > 0;
      return cmp >= 0;
    }
    case 'contains':
    case 'starts_with':
    case 'ends_with': {
      if (typeof actual !== 'string' || typeof value !== 'string') return false;
      if (operator === 'contains') return text(actual).includes(text(value));
      if (operator === 'starts_with') {
        return text(actual).startsWith(text(value));
      }
      return text(actual).endsWith(text(value));
    }
  }
}

/**
 * True when the row satisfies the where clause. Conditions fold left to
 * right, each joined to the result so far by its own connector, as Better
 * Auth's reference memory adapter does. An empty clause matches every row.
 */
export function matchesWhere(
  row: Record<string, unknown>,
  conditions: WhereCondition[]
): boolean {
  let result = true;
  conditions.forEach((condition, index) => {
    const matched = matchesCondition(row, condition);
    if (index === 0) result = matched;
    else if (condition.connector === 'OR') result = result || matched;
    else result = result && matched;
  });
  return result;
}

/**
 * Columns the API is known to hold under the same name Better Auth uses, so a
 * filter on them cannot be rejected or silently ignored.
 */
const FILTERABLE_FIELDS = new Set([
  'id',
  'userId',
  'providerId',
  'token',
  'identifier',
  'expiresAt',
]);
/** Fields whose values are integers in the API and safe to send as digits. */
const INTEGER_FIELDS = new Set(['id', 'userId']);
const MAX_IN_VALUES = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A string the API's query parser passes through untouched. It coerces digit
 * strings, booleans and "null" to other types, which turned a 21-digit Google
 * account id into an imprecise number and broke sign-in in 2.0.18.
 */
function isLiteralString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value !== '' &&
    value === value.trim() &&
    Number.isNaN(Number(value)) &&
    !['true', 'false', 'null'].includes(value.toLowerCase()) &&
    !value.includes('||') &&
    !value.includes(',')
  );
}

/**
 * `filter=` values that narrow the candidate rows on the server. Only a
 * superset of the true matches may come back, so this sends a condition only
 * when the API is known to compare it reliably, and nothing at all when any
 * condition is joined with OR. matchesWhere still decides every row.
 */
export function serverFilters(conditions: WhereCondition[]): string[] {
  if (conditions.some(c => c.connector === 'OR')) return [];

  const filters: string[] = [];
  for (const { field, operator, value, insensitive } of conditions) {
    if (insensitive || !FILTERABLE_FIELDS.has(field)) continue;

    if (operator === 'eq') {
      const isInteger =
        INTEGER_FIELDS.has(field) &&
        (typeof value === 'string' || typeof value === 'number') &&
        /^\d{1,15}$/.test(String(value));
      if (isInteger || isLiteralString(value)) {
        filters.push(`${field}||$eq||${String(value)}`);
      }
    } else if (operator === 'in') {
      const values = value as unknown[];
      if (
        values.length > 0 &&
        values.length <= MAX_IN_VALUES &&
        values.every(isLiteralString)
      ) {
        filters.push(`${field}||$in||${values.join(',')}`);
      }
    } else if (
      value instanceof Date &&
      ['lt', 'lte', 'gt', 'gte'].includes(operator)
    ) {
      // Widen the bound by a day so a timezone difference between this
      // process and the database can never exclude a true match.
      const upper = operator === 'lt' || operator === 'lte';
      const bound = new Date(value.getTime() + (upper ? DAY_MS : -DAY_MS));
      filters.push(
        `${field}||${upper ? '$lte' : '$gte'}||${bound.toISOString()}`
      );
    }
  }
  return filters;
}
