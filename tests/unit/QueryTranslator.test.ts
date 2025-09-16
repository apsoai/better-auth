/**
 * QueryTranslator Unit Tests
 *
 * Tests the QueryTranslator class for proper translation of Better Auth
 * queries to Apso SDK QueryParams format.
 */

import {
  QueryTranslator,
  QueryBuildOptions,
  QueryParams,
} from '../../src/query/QueryTranslator';

describe('QueryTranslator', () => {
  let translator: QueryTranslator;

  beforeEach(() => {
    translator = new QueryTranslator({
      emailNormalization: true,
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });
  });

  describe('translateWhere', () => {
    it('should translate simple equality conditions', () => {
      const where = { id: '123', name: 'test' };
      const result = translator.translateWhere(where);

      expect(result).toEqual({
        filter: {
          id: '123',
          name: 'test',
        },
      });
    });

    it('should handle null values', () => {
      const where = { deletedAt: null };
      const result = translator.translateWhere(where);

      expect(result).toEqual({
        filter: {
          deletedAt: null,
        },
      });
    });

    it('should normalize email fields', () => {
      const where = { email: 'TEST@EXAMPLE.COM' };
      const result = translator.translateWhere(where);

      expect(result).toEqual({
        filter: {
          email: 'test@example.com',
        },
      });
    });

    it('should handle OR conditions', () => {
      const where = {
        OR: [{ status: 'active' }, { status: 'pending' }],
      };
      const result = translator.translateWhere(where);

      // Should use the first OR condition since QueryParams structure is limited
      expect(result).toEqual({
        or: {
          status: 'active',
        },
      });
    });

    it('should handle AND conditions', () => {
      const where = {
        AND: [{ status: 'active' }, { verified: true }],
      };
      const result = translator.translateWhere(where);

      expect(result).toEqual({
        filter: {
          status: 'active',
          verified: true,
        },
      });
    });

    it('should handle complex operators', () => {
      const where = {
        age: { gt: 18, lt: 65 },
        createdAt: { gte: '2023-01-01' },
      };
      const result = translator.translateWhere(where);

      expect(result).toEqual({
        filter: {
          age: { gt: 18, lt: 65 },
          createdAt: { gte: '2023-01-01' },
        },
      });
    });
  });

  describe('buildQuery', () => {
    it('should build complete query with all options', () => {
      const options: QueryBuildOptions = {
        where: { status: 'active' },
        select: ['id', 'name', 'email'],
        pagination: { page: 2, limit: 10 },
        sort: { createdAt: 'desc', name: 'asc' },
      };

      const result = translator.buildQuery(options);

      expect(result).toEqual({
        filter: { status: 'active' },
        fields: ['id', 'name', 'email'],
        page: 2,
        limit: 10,
        sort: { createdAt: 'DESC', name: 'ASC' },
      });
    });

    it('should handle empty options', () => {
      const result = translator.buildQuery({});
      expect(result).toEqual({});
    });

    it('should validate field names in select', () => {
      const options: QueryBuildOptions = {
        select: ['id', 'DROP TABLE users--', 'name'],
      };

      const result = translator.buildQuery(options);

      expect(result).toEqual({
        fields: ['id', 'name'], // Invalid field should be filtered out
      });
    });

    it('should enforce pagination limits', () => {
      const options: QueryBuildOptions = {
        pagination: { page: 0, limit: 2000, offset: -1 },
      };

      const result = translator.buildQuery(options);

      expect(result).toEqual({
        page: 1, // Minimum page
        limit: 1000, // Maximum limit
        offset: 0, // Minimum offset
      });
    });
  });

  describe('addTenantScope', () => {
    it('should add tenant scope when configured', () => {
      const translatorWithTenant = new QueryTranslator({
        tenantConfig: {
          enabled: true,
          scopeField: 'tenantId',
          getScopeValue: () => 'tenant-123',
        },
      });

      const query: QueryParams = {
        filter: { status: 'active' },
      };

      const result = translatorWithTenant.addTenantScope(query);

      expect(result).toEqual({
        filter: {
          status: 'active',
          tenantId: 'tenant-123',
        },
      });
    });

    it('should not modify query when multi-tenancy is disabled', () => {
      const query: QueryParams = {
        filter: { status: 'active' },
      };

      const result = translator.addTenantScope(query);

      expect(result).toEqual(query);
    });

    it('should use provided tenant ID over config', () => {
      const translatorWithTenant = new QueryTranslator({
        tenantConfig: {
          enabled: true,
          scopeField: 'workspaceId',
          getScopeValue: () => 'default-tenant',
        },
      });

      const query: QueryParams = {
        filter: { status: 'active' },
      };

      const result = translatorWithTenant.addTenantScope(
        query,
        'custom-tenant'
      );

      expect(result).toEqual({
        filter: {
          status: 'active',
          workspaceId: 'custom-tenant',
        },
      });
    });
  });

  describe('email normalization', () => {
    it('should normalize Gmail addresses correctly', () => {
      const where = {
        email: 'test.user+spam@gmail.com',
        identifier: 'ANOTHER@GOOGLEMAIL.COM',
      };

      const result = translator.translateWhere(where);

      expect(result.filter?.email).toBe('testuser@gmail.com');
      expect(result.filter?.identifier).toBe('another@gmail.com');
    });

    it('should handle email arrays', () => {
      const where = {
        email: ['TEST1@EXAMPLE.COM', 'test2@gmail.com', 'non-email-value'],
      };

      const result = translator.translateWhere(where);

      expect(result.filter?.email).toEqual([
        'test1@example.com',
        'test2@gmail.com',
        'non-email-value', // Non-string values preserved
      ]);
    });

    it('should skip normalization when disabled', () => {
      const translatorNoNorm = new QueryTranslator({
        emailNormalization: false,
      });

      const where = { email: 'TEST@EXAMPLE.COM' };
      const result = translatorNoNorm.translateWhere(where);

      expect(result).toEqual({
        filter: {
          email: 'TEST@EXAMPLE.COM', // Not normalized
        },
      });
    });
  });

  describe('field validation', () => {
    const testCases = [
      { field: 'validField', expected: true },
      { field: 'field_123', expected: true },
      { field: 'Field123', expected: true },
      { field: '', expected: false },
      { field: '123field', expected: false }, // Can't start with number
      { field: 'field-name', expected: false }, // No dashes
      { field: 'field with spaces', expected: false },
      { field: 'DROP TABLE users--', expected: false }, // SQL injection
      { field: 'SELECT * FROM', expected: false },
      { field: 'a'.repeat(51), expected: false }, // Too long
    ];

    testCases.forEach(({ field, expected }) => {
      it(`should ${expected ? 'accept' : 'reject'} field name: "${field}"`, () => {
        const options: QueryBuildOptions = {
          select: [field],
        };

        const result = translator.buildQuery(options);

        if (expected) {
          expect(result.fields).toContain(field);
        } else {
          expect(result.fields || []).not.toContain(field);
        }
      });
    });
  });
});
