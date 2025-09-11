/**
 * Simple UserOperations Test
 * 
 * Basic test to verify our setup is working
 */

import { UserOperations } from '../../../src/operations/UserOperations';
import { AdapterError } from '../../../src/types';
import type { ApsoAdapterConfig } from '../../../src/types';

import {
  createTestConfig,
  createMockLogger,
} from '../testUtils';

describe('UserOperations - Simple', () => {
  let userOperations: UserOperations;
  let mockConfig: ApsoAdapterConfig;

  beforeEach(() => {
    // Create mock configuration
    mockConfig = createTestConfig({
      logger: createMockLogger(),
    });

    // Create simple mocks for all dependencies
    const mockHttpClient = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as any;

    const mockQueryTranslator = {
      translateWhere: jest.fn(),
      buildQuery: jest.fn(),
      addTenantScope: jest.fn(),
      buildFindQuery: jest.fn(),
    } as any;

    const mockResponseNormalizer = {
      normalizeSingleResponse: jest.fn(),
      normalizeArrayResponse: jest.fn(),
      normalizeCountResponse: jest.fn(),
    } as any;

    const mockEntityMapper = {
      mapUserToApi: jest.fn(),
      mapUserFromApi: jest.fn(),
      getApiPath: jest.fn(),
      transformOutbound: jest.fn(),
      transformInbound: jest.fn(),
      validate: jest.fn(),
    } as any;

    // Create UserOperations instance with mocked dependencies
    userOperations = new UserOperations({
      httpClient: mockHttpClient,
      queryTranslator: mockQueryTranslator,
      responseNormalizer: mockResponseNormalizer,
      entityMapper: mockEntityMapper,
      config: mockConfig,
    });
  });

  describe('initialization', () => {
    it('should create UserOperations instance', () => {
      expect(userOperations).toBeDefined();
      expect(userOperations).toBeInstanceOf(UserOperations);
    });
  });

  describe('validation errors', () => {
    it('should throw ValidationError for missing email', async () => {
      await expect(
        userOperations.createUser({
          emailVerified: false,
        } as any)
      ).rejects.toThrow(AdapterError);
    });

    it('should throw ValidationError for invalid ID in findUserById', async () => {
      await expect(
        userOperations.findUserById('')
      ).rejects.toThrow(AdapterError);
    });

    it('should throw ValidationError for invalid email in findUserByEmail', async () => {
      await expect(
        userOperations.findUserByEmail('')
      ).rejects.toThrow(AdapterError);
    });
  });
});