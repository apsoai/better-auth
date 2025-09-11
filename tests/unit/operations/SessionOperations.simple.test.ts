/**
 * Simple SessionOperations Test
 * 
 * Basic test to verify SessionOperations functionality
 */

import { SessionOperations } from '../../../src/operations/SessionOperations';
import { AdapterError } from '../../../src/types';
import type { ApsoAdapterConfig } from '../../../src/types';

import {
  createTestConfig,
  createMockLogger,
} from '../testUtils';

describe('SessionOperations - Simple', () => {
  let sessionOperations: SessionOperations;
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
      mapSessionToApi: jest.fn(),
      mapSessionFromApi: jest.fn(),
      getApiPath: jest.fn(),
      transformOutbound: jest.fn(),
      transformInbound: jest.fn(),
      validate: jest.fn(),
    } as any;

    // Create SessionOperations instance with mocked dependencies
    sessionOperations = new SessionOperations({
      httpClient: mockHttpClient,
      queryTranslator: mockQueryTranslator,
      responseNormalizer: mockResponseNormalizer,
      entityMapper: mockEntityMapper,
      config: mockConfig,
    });
  });

  describe('initialization', () => {
    it('should create SessionOperations instance', () => {
      expect(sessionOperations).toBeDefined();
      expect(sessionOperations).toBeInstanceOf(SessionOperations);
    });
  });

  describe('validation errors', () => {
    it('should throw ValidationError for missing sessionToken', async () => {
      await expect(
        sessionOperations.createSession({
          userId: 'user-123',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        } as any)
      ).rejects.toThrow(AdapterError);
    });

    it('should throw ValidationError for missing userId', async () => {
      await expect(
        sessionOperations.createSession({
          sessionToken: 'valid_session_token_123456',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        } as any)
      ).rejects.toThrow(AdapterError);
    });

    it('should throw ValidationError for missing expiresAt', async () => {
      await expect(
        sessionOperations.createSession({
          sessionToken: 'valid_session_token_123456',
          userId: 'user-123',
        } as any)
      ).rejects.toThrow(AdapterError);
    });

    it('should throw ValidationError for empty sessionToken in findSessionByToken', async () => {
      await expect(
        sessionOperations.findSessionByToken('')
      ).rejects.toThrow(AdapterError);
    });

    it('should throw ValidationError for empty ID in findSessionById', async () => {
      await expect(
        sessionOperations.findSessionById('')
      ).rejects.toThrow(AdapterError);
    });
  });
});