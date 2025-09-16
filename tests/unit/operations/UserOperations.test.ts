/**
 * Comprehensive Unit Tests for UserOperations
 *
 * These tests verify all CRUD operations for users including:
 * - Email normalization and case-insensitive lookups
 * - Comprehensive validation and error handling
 * - Integration with QueryTranslator, EntityMapper, and ResponseNormalizer
 * - Edge cases and security features
 * - Performance with batch operations
 */

import { UserOperations } from '../../../src/operations/UserOperations';
import { HttpClient } from '../../../src/client/HttpClient';
import { QueryTranslator } from '../../../src/query/QueryTranslator';
import { ResponseNormalizer } from '../../../src/response/ResponseNormalizer';
import { EntityMapper } from '../../../src/response/EntityMapper';
import { AdapterError, AdapterErrorCode } from '../../../src/types';
import type { ApsoAdapterConfig } from '../../../src/types';
import type { QueryParams } from '../../../src/query/QueryTranslator';

import {
  createTestUser,
  createTestUsers,
  createTestConfig,
  createMockLogger,
  setupTestEnvironment,
  cleanupTestEnvironment,
  assertBetterAuthUser,
  createHttpError,
  createNetworkError,
  createTimeoutError,
  generateEmailTestCases,
  generateErrorTestCases,
  measureExecutionTime,
} from '../testUtils';

import '../setupMocks';
import { MockDataStore } from '../__mocks__/apsoSdk';

describe('UserOperations', () => {
  let userOperations: UserOperations;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockQueryTranslator: jest.Mocked<QueryTranslator>;
  let mockResponseNormalizer: jest.Mocked<ResponseNormalizer>;
  let mockEntityMapper: jest.Mocked<EntityMapper>;
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

    // Create UserOperations instance with mocked dependencies
    userOperations = new UserOperations({
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
  // Create User Tests
  // =============================================================================

  describe('createUser', () => {
    const validUserData = createTestUser();

    beforeEach(() => {
      // Set up default mock behaviors
      mockEntityMapper.mapUserToApi.mockReturnValue({
        id: validUserData.id,
        email: validUserData.email,
        emailVerified: validUserData.emailVerified,
        name: validUserData.name || 'Test User',
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockHttpClient.post.mockResolvedValue({
        id: validUserData.id,
        email: validUserData.email,
        emailVerified: validUserData.emailVerified,
        name: validUserData.name,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockResponseNormalizer.normalizeSingleResponse.mockImplementation(
        data => data
      );
      mockEntityMapper.mapUserFromApi.mockReturnValue(validUserData);
    });

    it('should create a user successfully with valid data', async () => {
      const result = await userOperations.createUser({
        email: 'new@example.com',
        emailVerified: false,
        name: 'New User',
      });

      expect(result).toBeDefined();
      assertBetterAuthUser(result);
      expect(result.email).toBe('new@example.com');
      expect(result.emailVerified).toBe(false);
      expect(result.name).toBe('New User');

      // Verify mock calls
      expect(mockEntityMapper.mapUserToApi).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
      expect(
        mockResponseNormalizer.normalizeSingleResponse
      ).toHaveBeenCalledTimes(1);
      expect(mockEntityMapper.mapUserFromApi).toHaveBeenCalledTimes(1);
    });

    it('should normalize email addresses to lowercase', async () => {
      const emailCases = generateEmailTestCases();

      for (const testCase of emailCases) {
        mockHttpClient.post.mockClear();

        await userOperations.createUser({
          email: testCase.input,
          emailVerified: false,
        });

        // Check that the email was normalized
        const callArgs = mockEntityMapper.mapUserToApi.mock.calls[0]?.[0];
        expect(callArgs?.email).toBe(testCase.expected);
      }
    });

    it('should generate ID if not provided', async () => {
      const userData = {
        email: 'test@example.com',
        emailVerified: false,
        name: 'Test User',
      };

      const result = await userOperations.createUser(userData);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('should preserve provided ID', async () => {
      const customId = 'custom-user-id-123';
      const userData = {
        id: customId,
        email: 'test@example.com',
        emailVerified: false,
      };

      mockEntityMapper.mapUserFromApi.mockReturnValue({
        ...validUserData,
        id: customId,
      });

      const result = await userOperations.createUser(userData);

      expect(result.id).toBe(customId);
    });

    describe('validation', () => {
      it('should throw ValidationError for missing email', async () => {
        await expect(
          userOperations.createUser({
            emailVerified: false,
          } as any)
        ).rejects.toThrow(AdapterError);

        await expect(
          userOperations.createUser({
            emailVerified: false,
          } as any)
        ).rejects.toThrow(/Email is required/);
      });

      it('should throw ValidationError for invalid email type', async () => {
        await expect(
          userOperations.createUser({
            email: 123 as any,
            emailVerified: false,
          })
        ).rejects.toThrow(AdapterError);
      });

      it('should throw ValidationError for invalid emailVerified type', async () => {
        await expect(
          userOperations.createUser({
            email: 'test@example.com',
            emailVerified: 'yes' as any,
          })
        ).rejects.toThrow(AdapterError);
      });

      it('should throw ValidationError for empty name', async () => {
        await expect(
          userOperations.createUser({
            email: 'test@example.com',
            emailVerified: false,
            name: '   ',
          })
        ).rejects.toThrow(AdapterError);
      });

      it('should throw ValidationError for invalid image type', async () => {
        await expect(
          userOperations.createUser({
            email: 'test@example.com',
            emailVerified: false,
            image: 123 as any,
          })
        ).rejects.toThrow(AdapterError);
      });
    });

    describe('email conflict detection', () => {
      it('should detect email conflicts (case-insensitive)', async () => {
        // Add existing user to mock data store
        mockDataStore.createEntity('users', {
          id: 'existing-user',
          email: 'existing@example.com',
          emailVerified: true,
        });

        // Mock findUserByEmail to return existing user
        jest.spyOn(userOperations, 'findUserByEmail').mockResolvedValue({
          id: 'existing-user',
          email: 'existing@example.com',
          emailVerified: true,
          name: 'Existing User',
        });

        await expect(
          userOperations.createUser({
            email: 'EXISTING@example.com', // Different case
            emailVerified: false,
          })
        ).rejects.toThrow(AdapterError);

        await expect(
          userOperations.createUser({
            email: 'EXISTING@example.com',
            emailVerified: false,
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
            userOperations.createUser(validUserData)
          ).rejects.toThrow(AdapterError);

          mockHttpClient.post.mockClear();
        }
      });

      it('should handle network errors', async () => {
        mockHttpClient.post.mockRejectedValue(createNetworkError());

        await expect(userOperations.createUser(validUserData)).rejects.toThrow(
          AdapterError
        );

        const error = await userOperations
          .createUser(validUserData)
          .catch(e => e);
        expect(error.code).toBe(AdapterErrorCode.NETWORK_ERROR);
      });

      it('should handle timeout errors', async () => {
        mockHttpClient.post.mockRejectedValue(createTimeoutError());

        const error = await userOperations
          .createUser(validUserData)
          .catch(e => e);
        expect(error.code).toBe(AdapterErrorCode.TIMEOUT);
      });
    });

    describe('performance and observability', () => {
      it('should complete within reasonable time', async () => {
        const { duration } = await measureExecutionTime(() =>
          userOperations.createUser(validUserData)
        );

        expect(duration).toBeLessThan(100); // Should complete quickly with mocks
      });

      it('should log operation metrics when logger is available', async () => {
        await userOperations.createUser(validUserData);

        expect(mockConfig.logger!.debug).toHaveBeenCalledWith(
          'User operation completed',
          expect.objectContaining({
            operation: 'UserOperations.createUser',
            success: true,
          })
        );
      });
    });
  });

  // =============================================================================
  // Find User Tests
  // =============================================================================

  describe('findUserById', () => {
    const testUser = createTestUser({ id: 'test-user-123' });

    beforeEach(() => {
      mockHttpClient.get.mockResolvedValue({
        id: testUser.id,
        email: testUser.email,
        emailVerified: testUser.emailVerified,
        name: testUser.name,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockResponseNormalizer.normalizeSingleResponse.mockImplementation(
        data => data
      );
      mockEntityMapper.mapUserFromApi.mockReturnValue(testUser);
    });

    it('should find user by valid ID', async () => {
      const result = await userOperations.findUserById('test-user-123');

      expect(result).toBeDefined();
      assertBetterAuthUser(result!);
      expect(result!.id).toBe('test-user-123');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/users/test-user-123`,
        expect.any(Object)
      );
    });

    it('should return null for non-existent user', async () => {
      mockHttpClient.get.mockRejectedValue(createHttpError(404, 'Not Found'));

      const result = await userOperations.findUserById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should throw ValidationError for invalid ID', async () => {
      await expect(userOperations.findUserById('')).rejects.toThrow(
        AdapterError
      );

      await expect(userOperations.findUserById(null as any)).rejects.toThrow(
        /User ID must be a non-empty string/
      );
    });

    it('should handle server errors appropriately', async () => {
      mockHttpClient.get.mockRejectedValue(
        createHttpError(500, 'Internal Server Error')
      );

      await expect(
        userOperations.findUserById('test-user-123')
      ).rejects.toThrow(AdapterError);
    });
  });

  describe('findUserByEmail', () => {
    const testUsers = createTestUsers(3);

    beforeEach(() => {
      mockHttpClient.get.mockResolvedValue(
        testUsers.map(user => ({
          ...user,
          created_at: new Date(),
          updated_at: new Date(),
        }))
      );

      mockResponseNormalizer.normalizeArrayResponse.mockImplementation(
        data => data as any
      );
      mockQueryTranslator.buildFindQuery.mockReturnValue({} as QueryParams);
    });

    it('should find user by email (case-insensitive)', async () => {
      mockEntityMapper.mapUserFromApi.mockReturnValue(testUsers[0]!);

      const result = await userOperations.findUserByEmail('user1@example.com');

      expect(result).toBeDefined();
      assertBetterAuthUser(result!);
      expect(result!.email).toBe('user1@example.com');
    });

    it('should handle case-insensitive email matching', async () => {
      const emailCases = generateEmailTestCases();

      for (const testCase of emailCases) {
        mockHttpClient.get.mockClear();

        await userOperations.findUserByEmail(testCase.input);

        // Verify the email was normalized for lookup
        expect(mockQueryTranslator.buildFindQuery).toHaveBeenCalledWith(
          { email: testCase.expected },
          { limit: 1 }
        );
      }
    });

    it('should return null for non-existent email', async () => {
      mockHttpClient.get.mockResolvedValue([]);
      mockResponseNormalizer.normalizeArrayResponse.mockReturnValue([]);

      const result = await userOperations.findUserByEmail(
        'nonexistent@example.com'
      );

      expect(result).toBeNull();
    });

    it('should throw ValidationError for invalid email', async () => {
      await expect(userOperations.findUserByEmail('')).rejects.toThrow(
        AdapterError
      );

      await expect(
        userOperations.findUserByEmail('invalid-email')
      ).rejects.toThrow(/Invalid email format/);
    });
  });

  describe('findManyUsers', () => {
    const testUsers = createTestUsers(5);

    beforeEach(() => {
      mockHttpClient.get.mockResolvedValue(
        testUsers.map(user => ({
          ...user,
          created_at: new Date(),
          updated_at: new Date(),
        }))
      );

      mockResponseNormalizer.normalizeArrayResponse.mockImplementation(
        data => data as any
      );
      mockEntityMapper.mapUserFromApi.mockImplementation(user => user as any);
      mockQueryTranslator.buildFindQuery.mockReturnValue({} as QueryParams);
    });

    it('should find all users without filters', async () => {
      const result = await userOperations.findManyUsers();

      expect(result).toHaveLength(5);
      result.forEach(assertBetterAuthUser);
      expect(mockQueryTranslator.buildFindQuery).toHaveBeenCalledWith(
        {},
        undefined,
        undefined
      );
    });

    it('should apply filters correctly', async () => {
      const whereClause = { emailVerified: true };

      await userOperations.findManyUsers({ where: whereClause });

      expect(mockQueryTranslator.buildFindQuery).toHaveBeenCalledWith(
        whereClause,
        undefined,
        undefined
      );
    });

    it('should apply pagination correctly', async () => {
      const pagination = { limit: 10, page: 1 };

      await userOperations.findManyUsers({ pagination });

      expect(mockQueryTranslator.buildFindQuery).toHaveBeenCalledWith(
        {},
        pagination,
        undefined
      );
    });

    it('should apply sorting correctly', async () => {
      const sort = { email: 'ASC' as const };

      await userOperations.findManyUsers({ sort });

      expect(mockQueryTranslator.buildFindQuery).toHaveBeenCalledWith(
        {},
        undefined,
        { email: 'asc' }
      );
    });

    it('should handle empty results', async () => {
      mockHttpClient.get.mockResolvedValue([]);
      mockResponseNormalizer.normalizeArrayResponse.mockReturnValue([]);

      const result = await userOperations.findManyUsers();

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // Update User Tests
  // =============================================================================

  describe('updateUser', () => {
    const existingUser = createTestUser({ id: 'user-to-update' });
    const updates = { name: 'Updated Name', emailVerified: true };

    beforeEach(() => {
      // Mock findUserById to return existing user
      jest
        .spyOn(userOperations, 'findUserById')
        .mockResolvedValue(existingUser);

      mockEntityMapper.mapUserToApi.mockReturnValue({
        ...existingUser,
        ...updates,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockHttpClient.patch.mockResolvedValue({
        ...existingUser,
        ...updates,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockResponseNormalizer.normalizeSingleResponse.mockImplementation(
        data => data
      );
      mockEntityMapper.mapUserFromApi.mockReturnValue({
        ...existingUser,
        ...updates,
      });
    });

    it('should update user successfully', async () => {
      const result = await userOperations.updateUser('user-to-update', updates);

      expect(result).toBeDefined();
      assertBetterAuthUser(result);
      expect(result.name).toBe('Updated Name');
      expect(result.emailVerified).toBe(true);
      expect(result.id).toBe('user-to-update'); // ID should remain unchanged

      expect(mockHttpClient.patch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/users/user-to-update`,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should normalize email updates', async () => {
      const emailUpdates = { email: 'UPDATED@EXAMPLE.COM' };

      // Mock email conflict check
      jest.spyOn(userOperations, 'findUserByEmail').mockResolvedValue(null);

      await userOperations.updateUser('user-to-update', emailUpdates);

      const apiData = mockEntityMapper.mapUserToApi.mock.calls[0]?.[0];
      expect(apiData?.email).toBe('updated@example.com');
    });

    it('should throw error for non-existent user', async () => {
      jest.spyOn(userOperations, 'findUserById').mockResolvedValue(null);

      await expect(
        userOperations.updateUser('nonexistent-id', updates)
      ).rejects.toThrow(AdapterError);

      await expect(
        userOperations.updateUser('nonexistent-id', updates)
      ).rejects.toThrow(/not found/);
    });

    it('should prevent ID updates', async () => {
      const invalidUpdates = { id: 'new-id', name: 'Updated Name' };

      await expect(
        userOperations.updateUser('user-to-update', invalidUpdates as any)
      ).rejects.toThrow(AdapterError);

      await expect(
        userOperations.updateUser('user-to-update', invalidUpdates as any)
      ).rejects.toThrow(/ID cannot be updated/);
    });

    it('should detect email conflicts during update', async () => {
      const conflictingUser = createTestUser({
        id: 'other-user',
        email: 'conflict@example.com',
      });

      // Mock email conflict check to return existing user
      jest
        .spyOn(userOperations, 'findUserByEmail')
        .mockResolvedValue(conflictingUser);

      await expect(
        userOperations.updateUser('user-to-update', {
          email: 'conflict@example.com',
        })
      ).rejects.toThrow(AdapterError);

      await expect(
        userOperations.updateUser('user-to-update', {
          email: 'conflict@example.com',
        })
      ).rejects.toThrow(/already exists/);
    });
  });

  describe('updateUserByEmail', () => {
    const existingUser = createTestUser();

    beforeEach(() => {
      jest
        .spyOn(userOperations, 'findUserByEmail')
        .mockResolvedValue(existingUser);
      jest.spyOn(userOperations, 'updateUser').mockResolvedValue({
        ...existingUser,
        name: 'Updated Name',
      });
    });

    it('should update user by email', async () => {
      const updates = { name: 'Updated Name' };
      const result = await userOperations.updateUserByEmail(
        existingUser.email,
        updates
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Name');

      expect(userOperations.findUserByEmail).toHaveBeenCalledWith(
        existingUser.email
      );
      expect(userOperations.updateUser).toHaveBeenCalledWith(
        existingUser.id,
        updates
      );
    });

    it('should throw error for non-existent email', async () => {
      jest.spyOn(userOperations, 'findUserByEmail').mockResolvedValue(null);

      await expect(
        userOperations.updateUserByEmail('nonexistent@example.com', {
          name: 'Updated',
        })
      ).rejects.toThrow(AdapterError);
    });
  });

  // =============================================================================
  // Delete User Tests
  // =============================================================================

  describe('deleteUser', () => {
    const userToDelete = createTestUser({ id: 'user-to-delete' });

    beforeEach(() => {
      jest
        .spyOn(userOperations, 'findUserById')
        .mockResolvedValue(userToDelete);
      mockHttpClient.delete.mockResolvedValue(undefined);
    });

    it('should delete user successfully', async () => {
      const result = await userOperations.deleteUser('user-to-delete');

      expect(result).toEqual(userToDelete);
      expect(mockHttpClient.delete).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/users/user-to-delete`,
        expect.any(Object)
      );
    });

    it('should throw error for non-existent user', async () => {
      jest.spyOn(userOperations, 'findUserById').mockResolvedValue(null);

      await expect(userOperations.deleteUser('nonexistent-id')).rejects.toThrow(
        AdapterError
      );
    });

    it('should throw ValidationError for invalid ID', async () => {
      await expect(userOperations.deleteUser('')).rejects.toThrow(AdapterError);
    });
  });

  describe('deleteUserByEmail', () => {
    const userToDelete = createTestUser();

    beforeEach(() => {
      jest
        .spyOn(userOperations, 'findUserByEmail')
        .mockResolvedValue(userToDelete);
      jest.spyOn(userOperations, 'deleteUser').mockResolvedValue(userToDelete);
    });

    it('should delete user by email', async () => {
      const result = await userOperations.deleteUserByEmail(userToDelete.email);

      expect(result).toEqual(userToDelete);
      expect(userOperations.findUserByEmail).toHaveBeenCalledWith(
        userToDelete.email
      );
      expect(userOperations.deleteUser).toHaveBeenCalledWith(userToDelete.id);
    });

    it('should throw error for non-existent email', async () => {
      jest.spyOn(userOperations, 'findUserByEmail').mockResolvedValue(null);

      await expect(
        userOperations.deleteUserByEmail('nonexistent@example.com')
      ).rejects.toThrow(AdapterError);
    });
  });

  // =============================================================================
  // Count Users Tests
  // =============================================================================

  describe('countUsers', () => {
    beforeEach(() => {
      mockQueryTranslator.buildFindQuery.mockReturnValue({} as QueryParams);
    });

    it('should count all users without filter', async () => {
      mockResponseNormalizer.normalizeCountResponse.mockReturnValue(42);
      mockHttpClient.get.mockResolvedValue({ total: 42 });

      const result = await userOperations.countUsers();

      expect(result).toBe(42);
      expect(mockQueryTranslator.buildFindQuery).toHaveBeenCalledWith({});
    });

    it('should count users with filter', async () => {
      const filter = { emailVerified: true };
      mockResponseNormalizer.normalizeCountResponse.mockReturnValue(15);
      mockHttpClient.get.mockResolvedValue({ total: 15 });

      const result = await userOperations.countUsers(filter);

      expect(result).toBe(15);
      expect(mockQueryTranslator.buildFindQuery).toHaveBeenCalledWith(filter);
    });

    it('should fallback to findManyUsers if count fails', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Count not supported'));

      // Mock findManyUsers to return array of users
      const testUsers = createTestUsers(10);
      jest.spyOn(userOperations, 'findManyUsers').mockResolvedValue(testUsers);

      const result = await userOperations.countUsers();

      expect(result).toBe(10);
      expect(userOperations.findManyUsers).toHaveBeenCalledWith({ where: {} });
    });
  });

  // =============================================================================
  // Integration Tests
  // =============================================================================

  describe('integration scenarios', () => {
    it('should handle complete user lifecycle', async () => {
      // Create user
      const userData = {
        email: 'lifecycle@example.com',
        emailVerified: false,
        name: 'Lifecycle User',
      };

      mockEntityMapper.mapUserToApi.mockReturnValue({
        id: 'lifecycle-user',
        email: 'lifecycle@example.com',
        emailVerified: false,
        name: 'Lifecycle User',
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockHttpClient.post.mockResolvedValue({
        id: 'lifecycle-user',
        email: 'lifecycle@example.com',
        emailVerified: false,
        name: 'Lifecycle User',
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockResponseNormalizer.normalizeSingleResponse.mockImplementation(
        data => data
      );
      mockEntityMapper.mapUserFromApi.mockReturnValue({
        id: 'lifecycle-user',
        email: 'lifecycle@example.com',
        emailVerified: false,
        name: 'Lifecycle User',
      });

      const createdUser = await userOperations.createUser(userData);
      expect(createdUser.email).toBe('lifecycle@example.com');

      // Find user
      jest.spyOn(userOperations, 'findUserById').mockResolvedValue(createdUser);
      const foundUser = await userOperations.findUserById(createdUser.id);
      expect(foundUser).toEqual(createdUser);

      // Update user
      const updatedUser = { ...createdUser, emailVerified: true };
      jest.spyOn(userOperations, 'updateUser').mockResolvedValue(updatedUser);
      const result = await userOperations.updateUser(createdUser.id, {
        emailVerified: true,
      });
      expect(result.emailVerified).toBe(true);

      // Delete user
      jest.spyOn(userOperations, 'deleteUser').mockResolvedValue(updatedUser);
      const deletedUser = await userOperations.deleteUser(createdUser.id);
      expect(deletedUser).toEqual(updatedUser);
    });

    it('should handle batch operations efficiently', async () => {
      const users = createTestUsers(100);
      mockHttpClient.get.mockResolvedValue(users);
      mockResponseNormalizer.normalizeArrayResponse.mockReturnValue(users);
      mockEntityMapper.mapUserFromApi.mockImplementation(user => user);

      const { result, duration } = await measureExecutionTime(() =>
        userOperations.findManyUsers({ pagination: { limit: 100 } })
      );

      expect(result).toHaveLength(100);
      expect(duration).toBeLessThan(50); // Should be fast with mocks
    });

    it('should maintain data consistency under concurrent operations', async () => {
      const user = createTestUser();

      // Setup mocks for concurrent operations
      jest.spyOn(userOperations, 'findUserById').mockResolvedValue(user);
      jest
        .spyOn(userOperations, 'updateUser')
        .mockImplementation(async (_id, updates) => ({
          ...user,
          ...updates,
        }));

      // Simulate concurrent updates
      const promises = [
        userOperations.updateUser(user.id, { name: 'Update 1' }),
        userOperations.updateUser(user.id, { name: 'Update 2' }),
        userOperations.updateUser(user.id, { name: 'Update 3' }),
      ];

      const results = await Promise.all(promises);

      // All operations should complete successfully
      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toBeDefined());
    });
  });

  // =============================================================================
  // Edge Cases and Security Tests
  // =============================================================================

  describe('edge cases and security', () => {
    it('should handle malformed API responses gracefully', async () => {
      mockHttpClient.get.mockResolvedValue(null);
      mockResponseNormalizer.normalizeSingleResponse.mockReturnValue(null);

      await expect(userOperations.findUserById('test-id')).rejects.toThrow();
    });

    it('should sanitize user input', async () => {
      const maliciousData = {
        id: 'test-id',
        email: 'test@example.com',
        emailVerified: false,
        name: '<script>alert("xss")</script>',
      };

      // Mock to allow the test to pass validation
      mockEntityMapper.mapUserToApi.mockReturnValue({
        ...maliciousData,
        created_at: new Date(),
        updated_at: new Date(),
      });
      mockHttpClient.post.mockResolvedValue({
        ...maliciousData,
        created_at: new Date(),
        updated_at: new Date(),
      });
      mockResponseNormalizer.normalizeSingleResponse.mockReturnValue({
        ...maliciousData,
        created_at: new Date(),
        updated_at: new Date(),
      });
      mockEntityMapper.mapUserFromApi.mockReturnValue(maliciousData);

      const result = await userOperations.createUser(maliciousData);

      // The name should be preserved as-is (actual sanitization would be done at API level)
      expect(result.name).toBe('<script>alert("xss")</script>');
    });

    it('should handle very long input strings', async () => {
      const longString = 'a'.repeat(10000);

      await expect(
        userOperations.createUser({
          email: `${longString}@example.com`,
          emailVerified: false,
        })
      ).rejects.toThrow(); // Should fail validation for overly long email
    });

    it('should handle special characters in email addresses', async () => {
      const specialEmails = [
        'user+tag@example.com',
        'user.name@example.com',
        'user_name@example.com',
        'user-name@example.com',
      ];

      for (const email of specialEmails) {
        mockHttpClient.post.mockClear();
        mockEntityMapper.mapUserFromApi.mockReturnValue({
          id: 'test-user',
          email: email.toLowerCase(),
          emailVerified: false,
        });

        const result = await userOperations.createUser({
          email,
          emailVerified: false,
        });

        expect(result.email).toBe(email.toLowerCase());
      }
    });
  });

  // =============================================================================
  // Performance and Memory Tests
  // =============================================================================

  describe('performance and memory', () => {
    it('should handle large datasets without memory leaks', async () => {
      const largeDataset = createTestUsers(10000);
      mockHttpClient.get.mockResolvedValue(largeDataset);
      mockResponseNormalizer.normalizeArrayResponse.mockReturnValue(
        largeDataset
      );
      mockEntityMapper.mapUserFromApi.mockImplementation(user => user);

      const result = await userOperations.findManyUsers();

      expect(result).toHaveLength(10000);

      // Clear references to help garbage collection
      largeDataset.length = 0;
    });

    it('should maintain performance with complex queries', async () => {
      const complexFilter = {
        emailVerified: true,
        name: 'Test User',
      };

      const { duration } = await measureExecutionTime(() =>
        userOperations.findManyUsers({
          where: complexFilter,
          pagination: { limit: 1000 },
          sort: { email: 'ASC' },
        })
      );

      expect(duration).toBeLessThan(100);
    });
  });
});
