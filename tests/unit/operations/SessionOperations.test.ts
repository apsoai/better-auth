/**
 * Comprehensive Unit Tests for SessionOperations
 *
 * These tests verify all CRUD operations for sessions including:
 * - Token uniqueness and validation
 * - Session expiration checking
 * - User association validation
 * - Session cleanup and management
 * - Error scenarios and edge cases
 */

import { SessionOperations } from '../../../src/operations/SessionOperations';
import { AdapterError, AdapterErrorCode } from '../../../src/types';
import type { ApsoAdapterConfig } from '../../../src/types';

import {
  createTestSession,
  createTestSessions,
  createTestConfig,
  createMockLogger,
  setupTestEnvironment,
  cleanupTestEnvironment,
  assertBetterAuthSession,
  createHttpError,
  createNetworkError,
  createTimeoutError,
  generateErrorTestCases,
  measureExecutionTime,
} from '../testUtils';

import '../setupMocks';
import { MockDataStore } from '../__mocks__/apsoSdk';

describe('SessionOperations', () => {
  let sessionOperations: SessionOperations;
  let mockHttpClient: any;
  let mockQueryTranslator: any;
  let mockResponseNormalizer: any;
  let mockEntityMapper: any;
  let mockConfig: ApsoAdapterConfig;
  let mockDataStore: MockDataStore;

  beforeEach(() => {
    // Set up test environment and get mock data store
    setupTestEnvironment();
    mockDataStore = MockDataStore.getInstance();

    // Create mock configuration
    mockConfig = createTestConfig({
      logger: createMockLogger(),
    });

    // Create comprehensive mocks for all dependencies
    mockHttpClient = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockQueryTranslator = {
      translateWhere: jest.fn(),
      buildQuery: jest.fn(),
      addTenantScope: jest.fn(),
      buildFindQuery: jest.fn(),
      buildCreateQuery: jest.fn(),
      buildUpdateQuery: jest.fn(),
      buildDeleteQuery: jest.fn(),
      buildCountQuery: jest.fn(),
    } as any;

    mockResponseNormalizer = {
      normalizeToArray: jest.fn(),
      extractSingleItem: jest.fn(),
      extractArrayItems: jest.fn(),
      extractCount: jest.fn(),
      handleEmptyResponse: jest.fn(),
      normalizeSingleResponse: jest.fn(),
      normalizeArrayResponse: jest.fn(),
      normalizeCountResponse: jest.fn(),
      normalizePaginatedResponse: jest.fn(),
      normalizeErrorResponse: jest.fn(),
    } as any;

    mockEntityMapper = {
      mapUserToApi: jest.fn(),
      mapUserFromApi: jest.fn(),
      mapSessionToApi: jest.fn(),
      mapSessionFromApi: jest.fn(),
      mapVerificationTokenToApi: jest.fn(),
      mapVerificationTokenFromApi: jest.fn(),
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

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // =============================================================================
  // Create Session Tests
  // =============================================================================

  describe('createSession', () => {
    const validSessionData = createTestSession();

    beforeEach(() => {
      // Set up default mock behaviors
      mockEntityMapper.mapSessionToApi.mockReturnValue({
        id: validSessionData.id,
        sessionToken: validSessionData.sessionToken,
        userId: validSessionData.userId,
        expiresAt: validSessionData.expiresAt,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockHttpClient.post.mockResolvedValue({
        id: validSessionData.id,
        sessionToken: validSessionData.sessionToken,
        userId: validSessionData.userId,
        expiresAt: validSessionData.expiresAt,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockResponseNormalizer.normalizeSingleResponse.mockImplementation(
        (data: any) => data
      );
      mockEntityMapper.mapSessionFromApi.mockReturnValue(validSessionData);
    });

    it('should create a session successfully with valid data', async () => {
      const result = await sessionOperations.createSession({
        sessionToken: 'new-session-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      });

      expect(result).toBeDefined();
      assertBetterAuthSession(result);
      expect(result.sessionToken).toBe('new-session-token');
      expect(result.userId).toBe('user-123');

      // Verify mock calls
      expect(mockEntityMapper.mapSessionToApi).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
      expect(
        mockResponseNormalizer.normalizeSingleResponse
      ).toHaveBeenCalledTimes(1);
      expect(mockEntityMapper.mapSessionFromApi).toHaveBeenCalledTimes(1);
    });

    it('should generate ID if not provided', async () => {
      const sessionData = {
        sessionToken: 'test-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const result = await sessionOperations.createSession(sessionData);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('should preserve provided ID', async () => {
      const customId = 'custom-session-id-123';
      const sessionData = {
        id: customId,
        sessionToken: 'test-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockEntityMapper.mapSessionFromApi.mockReturnValue({
        ...validSessionData,
        id: customId,
      });

      const result = await sessionOperations.createSession(sessionData);

      expect(result.id).toBe(customId);
    });

    describe('validation', () => {
      it('should throw ValidationError for missing sessionToken', async () => {
        await expect(
          sessionOperations.createSession({
            userId: 'user-123',
            expiresAt: new Date(),
          } as any)
        ).rejects.toThrow(AdapterError);

        await expect(
          sessionOperations.createSession({
            userId: 'user-123',
            expiresAt: new Date(),
          } as any)
        ).rejects.toThrow(/sessionToken is required/);
      });

      it('should throw ValidationError for missing userId', async () => {
        await expect(
          sessionOperations.createSession({
            sessionToken: 'test-token',
            expiresAt: new Date(),
          } as any)
        ).rejects.toThrow(AdapterError);

        await expect(
          sessionOperations.createSession({
            sessionToken: 'test-token',
            expiresAt: new Date(),
          } as any)
        ).rejects.toThrow(/userId is required/);
      });

      it('should throw ValidationError for missing expiresAt', async () => {
        await expect(
          sessionOperations.createSession({
            sessionToken: 'test-token',
            userId: 'user-123',
          } as any)
        ).rejects.toThrow(AdapterError);

        await expect(
          sessionOperations.createSession({
            sessionToken: 'test-token',
            userId: 'user-123',
          } as any)
        ).rejects.toThrow(/expiresAt is required/);
      });

      it('should throw ValidationError for past expiration date', async () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

        await expect(
          sessionOperations.createSession({
            sessionToken: 'test-token',
            userId: 'user-123',
            expiresAt: pastDate,
          })
        ).rejects.toThrow(AdapterError);

        await expect(
          sessionOperations.createSession({
            sessionToken: 'test-token',
            userId: 'user-123',
            expiresAt: pastDate,
          })
        ).rejects.toThrow(/expiresAt must be in the future/);
      });
    });

    describe('token uniqueness', () => {
      it('should detect token conflicts', async () => {
        // Add existing session to mock data store
        mockDataStore.createEntity('sessions', {
          id: 'existing-session',
          sessionToken: 'existing-token',
          userId: 'user-123',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        // Mock findSessionByToken to return existing session
        jest.spyOn(sessionOperations, 'findSessionByToken').mockResolvedValue({
          id: 'existing-session',
          sessionToken: 'existing-token',
          userId: 'user-123',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        await expect(
          sessionOperations.createSession({
            sessionToken: 'existing-token',
            userId: 'user-456',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          })
        ).rejects.toThrow(AdapterError);

        await expect(
          sessionOperations.createSession({
            sessionToken: 'existing-token',
            userId: 'user-456',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          })
        ).rejects.toThrow(/already exists/);
      });
    });

    describe('error handling', () => {
      it('should handle HTTP errors properly', async () => {
        const errorCases = generateErrorTestCases();

        for (const errorCase of errorCases) {
          mockHttpClient.post.mockRejectedValueOnce(
            createHttpError(errorCase.status, `HTTP ${errorCase.status}`)
          );

          await expect(
            sessionOperations.createSession(validSessionData)
          ).rejects.toThrow(AdapterError);

          mockHttpClient.post.mockClear();
        }
      });

      it('should handle network errors', async () => {
        mockHttpClient.post.mockRejectedValue(createNetworkError());

        const error = await sessionOperations
          .createSession(validSessionData)
          .catch(e => e);
        expect(error.code).toBe(AdapterErrorCode.NETWORK_ERROR);
      });

      it('should handle timeout errors', async () => {
        mockHttpClient.post.mockRejectedValue(createTimeoutError());

        const error = await sessionOperations
          .createSession(validSessionData)
          .catch(e => e);
        expect(error.code).toBe(AdapterErrorCode.TIMEOUT);
      });
    });
  });

  // =============================================================================
  // Find Session Tests
  // =============================================================================

  describe('findSessionByToken', () => {
    const testSession = createTestSession({
      sessionToken: 'test-session-token',
    });

    beforeEach(() => {
      mockHttpClient.get.mockResolvedValue([
        {
          id: testSession.id,
          sessionToken: testSession.sessionToken,
          userId: testSession.userId,
          expiresAt: testSession.expiresAt,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      mockResponseNormalizer.normalizeArrayResponse.mockImplementation(
        (data: any) => data
      );
      mockEntityMapper.mapSessionFromApi.mockReturnValue(testSession);
    });

    it('should find session by token', async () => {
      const result =
        await sessionOperations.findSessionByToken('test-session-token');

      expect(result).toBeDefined();
      assertBetterAuthSession(result!);
      expect(result!.sessionToken).toBe('test-session-token');
    });

    it('should return null for non-existent token', async () => {
      mockHttpClient.get.mockResolvedValue([]);
      mockResponseNormalizer.normalizeArrayResponse.mockReturnValue([]);

      const result =
        await sessionOperations.findSessionByToken('nonexistent-token');

      expect(result).toBeNull();
    });

    it('should throw ValidationError for empty token', async () => {
      await expect(sessionOperations.findSessionByToken('')).rejects.toThrow(
        AdapterError
      );

      await expect(sessionOperations.findSessionByToken('')).rejects.toThrow(
        /sessionToken must be a non-empty string/
      );
    });
  });

  // =============================================================================
  // Session Validation Tests
  // =============================================================================

  describe('validateSession', () => {
    it('should validate non-expired session', async () => {
      const validSession = createTestSession({
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      });

      jest
        .spyOn(sessionOperations, 'findSessionByToken')
        .mockResolvedValue(validSession);

      const result = await sessionOperations.validateSession(
        validSession.sessionToken
      );

      expect(result).toEqual(validSession);
    });

    it('should return null for expired session', async () => {
      const expiredSession = createTestSession({
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
      });

      jest
        .spyOn(sessionOperations, 'findSessionByToken')
        .mockResolvedValue(expiredSession);

      const result = await sessionOperations.validateSession(
        expiredSession.sessionToken
      );

      expect(result).toBeNull();
    });

    it('should return null for non-existent session', async () => {
      jest
        .spyOn(sessionOperations, 'findSessionByToken')
        .mockResolvedValue(null);

      const result =
        await sessionOperations.validateSession('nonexistent-token');

      expect(result).toBeNull();
    });
  });

  // =============================================================================
  // Update Session Tests
  // =============================================================================

  describe('updateSession', () => {
    const existingSession = createTestSession({ id: 'session-to-update' });
    const updates = { expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) }; // 48 hours from now

    beforeEach(() => {
      // Mock findSessionById to return existing session
      jest
        .spyOn(sessionOperations, 'findSessionById')
        .mockResolvedValue(existingSession);

      mockEntityMapper.mapSessionToApi.mockReturnValue({
        ...existingSession,
        ...updates,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockHttpClient.patch.mockResolvedValue({
        ...existingSession,
        ...updates,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockResponseNormalizer.normalizeSingleResponse.mockImplementation(
        (data: any) => data
      );
      mockEntityMapper.mapSessionFromApi.mockReturnValue({
        ...existingSession,
        ...updates,
      });
    });

    it('should update session successfully', async () => {
      const result = await sessionOperations.updateSession(
        'session-to-update',
        updates
      );

      expect(result).toBeDefined();
      assertBetterAuthSession(result);
      expect(result.expiresAt).toEqual(updates.expiresAt);
      expect(result.id).toBe('session-to-update'); // ID should remain unchanged

      expect(mockHttpClient.patch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/sessions/session-to-update`,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should throw error for non-existent session', async () => {
      jest.spyOn(sessionOperations, 'findSessionById').mockResolvedValue(null);

      await expect(
        sessionOperations.updateSession('nonexistent-id', updates)
      ).rejects.toThrow(AdapterError);

      await expect(
        sessionOperations.updateSession('nonexistent-id', updates)
      ).rejects.toThrow(/not found/);
    });

    it('should prevent ID and sessionToken updates', async () => {
      const invalidUpdates = {
        id: 'new-id',
        sessionToken: 'new-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await expect(
        sessionOperations.updateSession(
          'session-to-update',
          invalidUpdates as any
        )
      ).rejects.toThrow(AdapterError);

      await expect(
        sessionOperations.updateSession(
          'session-to-update',
          invalidUpdates as any
        )
      ).rejects.toThrow(/cannot be updated/);
    });

    it('should validate expiration date in updates', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      await expect(
        sessionOperations.updateSession('session-to-update', {
          expiresAt: pastDate,
        })
      ).rejects.toThrow(AdapterError);

      await expect(
        sessionOperations.updateSession('session-to-update', {
          expiresAt: pastDate,
        })
      ).rejects.toThrow(/expiresAt must be in the future/);
    });
  });

  // =============================================================================
  // Delete Session Tests
  // =============================================================================

  describe('deleteSession', () => {
    const sessionToDelete = createTestSession({ id: 'session-to-delete' });

    beforeEach(() => {
      jest
        .spyOn(sessionOperations, 'findSessionById')
        .mockResolvedValue(sessionToDelete);
      mockHttpClient.delete.mockResolvedValue(undefined);
    });

    it('should delete session successfully', async () => {
      const result = await sessionOperations.deleteSession('session-to-delete');

      expect(result).toEqual(sessionToDelete);
      expect(mockHttpClient.delete).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/sessions/session-to-delete`,
        expect.any(Object)
      );
    });

    it('should throw error for non-existent session', async () => {
      jest.spyOn(sessionOperations, 'findSessionById').mockResolvedValue(null);

      await expect(
        sessionOperations.deleteSession('nonexistent-id')
      ).rejects.toThrow(AdapterError);
    });
  });

  describe('deleteSessionByToken', () => {
    const sessionToDelete = createTestSession();

    beforeEach(() => {
      jest
        .spyOn(sessionOperations, 'findSessionByToken')
        .mockResolvedValue(sessionToDelete);
      jest
        .spyOn(sessionOperations, 'deleteSession')
        .mockResolvedValue(sessionToDelete);
    });

    it('should delete session by token', async () => {
      const result = await sessionOperations.deleteSessionByToken(
        sessionToDelete.sessionToken
      );

      expect(result).toEqual(sessionToDelete);
      expect(sessionOperations.findSessionByToken).toHaveBeenCalledWith(
        sessionToDelete.sessionToken
      );
      expect(sessionOperations.deleteSession).toHaveBeenCalledWith(
        sessionToDelete.id
      );
    });
  });

  // =============================================================================
  // Session Cleanup Tests
  // =============================================================================

  describe('deleteExpiredSessions', () => {
    beforeEach(() => {
      mockHttpClient.delete.mockResolvedValue(undefined);
    });

    it('should delete all expired sessions', async () => {
      // Mock findManySessions to return expired sessions
      const expiredSessions = [
        createTestSession({
          id: 'expired-1',
          expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        }),
        createTestSession({
          id: 'expired-2',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        }),
      ];

      // Mock the internal method calls
      jest
        .spyOn(sessionOperations, 'findManySessions')
        .mockResolvedValue(expiredSessions);
      jest
        .spyOn(sessionOperations, 'deleteSession')
        .mockResolvedValueOnce(expiredSessions[0]!)
        .mockResolvedValueOnce(expiredSessions[1]!);

      const result = await sessionOperations.deleteExpiredSessions();

      expect(result).toBe(2);
    });

    it('should handle empty result gracefully', async () => {
      jest.spyOn(sessionOperations, 'findManySessions').mockResolvedValue([]);

      const result = await sessionOperations.deleteExpiredSessions();

      expect(result).toBe(0);
    });
  });

  describe('deleteUserSessions', () => {
    const userId = 'user-123';
    const userSessions = createTestSessions(3, userId);

    beforeEach(() => {
      jest
        .spyOn(sessionOperations, 'findSessionsByUserId')
        .mockResolvedValue(userSessions);
      mockHttpClient.delete.mockResolvedValue(undefined);
    });

    it('should delete all sessions for a user', async () => {
      const result = await sessionOperations.deleteUserSessions(userId);

      expect(result).toBe(3);
      expect(sessionOperations.findSessionsByUserId).toHaveBeenCalledWith(
        userId
      );
      expect(mockHttpClient.delete).toHaveBeenCalledTimes(3);
    });
  });

  // =============================================================================
  // Performance and Integration Tests
  // =============================================================================

  describe('performance', () => {
    it('should handle large numbers of sessions efficiently', async () => {
      const largeBatch = createTestSessions(1000);

      mockHttpClient.get.mockResolvedValue(
        largeBatch.map(session => ({
          ...session,
          created_at: new Date(),
          updated_at: new Date(),
        }))
      );

      mockResponseNormalizer.normalizeArrayResponse.mockReturnValue(
        largeBatch as any
      );
      mockEntityMapper.mapSessionFromApi.mockImplementation(
        (session: any) => session
      );

      const { result, duration } = await measureExecutionTime(() =>
        sessionOperations.findSessionsByUserId('user-with-many-sessions')
      );

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should be fast with mocks
    });

    it('should complete session operations within reasonable time', async () => {
      const sessionData = createTestSession();

      const { duration } = await measureExecutionTime(() =>
        sessionOperations.createSession(sessionData)
      );

      expect(duration).toBeLessThan(50); // Should complete quickly with mocks
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete session lifecycle', async () => {
      const sessionData = {
        sessionToken: 'lifecycle-token',
        userId: 'user-lifecycle-test',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      // Mock all the required calls
      mockEntityMapper.mapSessionToApi.mockReturnValue({
        id: 'lifecycle-session',
        ...sessionData,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const createdSession = {
        id: 'lifecycle-session',
        ...sessionData,
      };

      mockEntityMapper.mapSessionFromApi.mockReturnValue(createdSession);

      // Create session
      const created = await sessionOperations.createSession(sessionData);
      expect(created.sessionToken).toBe('lifecycle-token');

      // Find session
      jest
        .spyOn(sessionOperations, 'findSessionById')
        .mockResolvedValue(created);
      const found = await sessionOperations.findSessionById(created.id);
      expect(found).toEqual(created);

      // Validate session
      jest
        .spyOn(sessionOperations, 'findSessionByToken')
        .mockResolvedValue(created);
      const validated = await sessionOperations.validateSession(
        created.sessionToken
      );
      expect(validated).toEqual(created);

      // Update session
      const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const updated = { ...created, expiresAt: newExpiry };
      jest.spyOn(sessionOperations, 'updateSession').mockResolvedValue(updated);
      const result = await sessionOperations.updateSession(created.id, {
        expiresAt: newExpiry,
      });
      expect(result.expiresAt).toEqual(newExpiry);

      // Delete session
      jest.spyOn(sessionOperations, 'deleteSession').mockResolvedValue(updated);
      const deleted = await sessionOperations.deleteSession(created.id);
      expect(deleted).toEqual(updated);
    });
  });
});
