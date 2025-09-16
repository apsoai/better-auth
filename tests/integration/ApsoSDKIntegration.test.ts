/**
 * Main Integration Tests for Apso SDK Integration
 *
 * Tests the full Better Auth adapter with real Apso SDK communication.
 * These tests only run when INTEGRATION_TESTS=true environment variable is set.
 */

import { IntegrationTestHelper, shouldRunIntegrationTests } from './setup';

// Skip all tests if integration tests are not enabled
const describeIntegration = shouldRunIntegrationTests()
  ? describe
  : describe.skip;

describeIntegration('Apso SDK Integration Tests', () => {
  let testHelper: IntegrationTestHelper;

  beforeAll(async () => {
    testHelper = new IntegrationTestHelper();

    // Verify API connectivity before running tests
    const isHealthy = await testHelper.healthCheck();
    if (!isHealthy) {
      throw new Error('API health check failed - cannot run integration tests');
    }
  }, 30000); // Extended timeout for health check

  afterAll(async () => {
    if (testHelper) {
      await testHelper.cleanup();
    }
  }, 15000);

  describe('Adapter Initialization', () => {
    it('should create adapter with real Apso SDK configuration', () => {
      const adapter = testHelper.getAdapter();
      expect(adapter).toBeDefined();
      expect(typeof adapter.create).toBe('function');
      expect(typeof adapter.findUnique).toBe('function');
      expect(typeof adapter.findMany).toBe('function');
      expect(typeof adapter.update).toBe('function');
      expect(typeof adapter.delete).toBe('function');
    });

    it('should use provided configuration values', () => {
      const config = testHelper.getConfig();
      expect(config.baseUrl).toBeDefined();
      expect(config.timeout).toBeGreaterThan(0);
      expect(config.retryConfig).toBeDefined();
    });
  });

  describe('User Operations with Real SDK', () => {
    it('should create a user via real API call', async () => {
      const adapter = testHelper.getAdapter();

      const { result: user, duration } = await testHelper.measureOperation(
        'create user',
        () =>
          testHelper.createTestUser({
            email: 'integration-test-user@example.com',
            name: 'Integration Test User',
          })
      );

      expect(user).toHaveValidEntityStructure();
      expect(user.email).toBe('integration-test-user@example.com');
      expect(user.name).toBe('Integration Test User');
      expect(duration).toCompleteWithin(5000); // Should complete within 5s
    });

    it('should find user by unique field via real API', async () => {
      const adapter = testHelper.getAdapter();
      const createdUser = await testHelper.createTestUser({
        email: 'findable-user@example.com',
      });

      const { result: foundUser, duration } = await testHelper.measureOperation(
        'find user by id',
        () => adapter.findUnique('user', { id: createdUser.id })
      );

      expect(foundUser).toHaveValidEntityStructure();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe('findable-user@example.com');
      expect(duration).toCompleteWithin(3000);
    });

    it('should find user by email via real API', async () => {
      const adapter = testHelper.getAdapter();
      const testEmail = 'email-findable-user@example.com';
      await testHelper.createTestUser({ email: testEmail });

      const { result: foundUser, duration } = await testHelper.measureOperation(
        'find user by email',
        () => adapter.findUnique('user', { email: testEmail })
      );

      expect(foundUser).toHaveValidEntityStructure();
      expect(foundUser.email).toBe(testEmail);
      expect(duration).toCompleteWithin(3000);
    });

    it('should update user via real API', async () => {
      const adapter = testHelper.getAdapter();
      const createdUser = await testHelper.createTestUser();

      const updateData = {
        name: 'Updated Name',
        emailVerified: new Date(),
      };

      const { result: updatedUser, duration } =
        await testHelper.measureOperation('update user', () =>
          adapter.update('user', { id: createdUser.id }, updateData)
        );

      expect(updatedUser).toHaveValidEntityStructure();
      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.emailVerified).toBeInstanceOf(Date);
      expect(duration).toCompleteWithin(3000);
    });

    it('should delete user via real API', async () => {
      const adapter = testHelper.getAdapter();
      const createdUser = await testHelper.createTestUser();

      const { duration } = await testHelper.measureOperation(
        'delete user',
        () => adapter.delete('user', { id: createdUser.id })
      );

      expect(duration).toCompleteWithin(3000);

      // Verify user was deleted
      await expect(
        adapter.findUnique('user', { id: createdUser.id })
      ).rejects.toThrow();
    });

    it('should handle email normalization correctly', async () => {
      const adapter = testHelper.getAdapter();
      const testEmail = 'Test.User+Tag@EXAMPLE.COM';
      const normalizedEmail = 'test.user+tag@example.com';

      const user = await testHelper.createTestUser({ email: testEmail });

      // Should normalize email during creation
      expect(user.email).toBe(normalizedEmail);

      // Should find by original email format
      const foundUser = await adapter.findUnique('user', { email: testEmail });
      expect(foundUser.id).toBe(user.id);
    });
  });

  describe('Session Operations with Real SDK', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await testHelper.createTestUser();
    });

    it('should create session via real API call', async () => {
      const adapter = testHelper.getAdapter();

      const { result: session, duration } = await testHelper.measureOperation(
        'create session',
        () =>
          testHelper.createTestSession(testUser.id, {
            sessionToken: 'integration-session-token',
          })
      );

      expect(session).toHaveValidEntityStructure();
      expect(session.userId).toBe(testUser.id);
      expect(session.sessionToken).toBe('integration-session-token');
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(duration).toCompleteWithin(3000);
    });

    it('should find session by token via real API', async () => {
      const sessionToken = 'findable-session-token';
      const createdSession = await testHelper.createTestSession(testUser.id, {
        sessionToken,
      });

      const adapter = testHelper.getAdapter();
      const { result: foundSession, duration } =
        await testHelper.measureOperation('find session by token', () =>
          adapter.findUnique('session', { sessionToken })
        );

      expect(foundSession).toHaveValidEntityStructure();
      expect(foundSession.id).toBe(createdSession.id);
      expect(foundSession.sessionToken).toBe(sessionToken);
      expect(foundSession.userId).toBe(testUser.id);
      expect(duration).toCompleteWithin(3000);
    });

    it('should update session expiration via real API', async () => {
      const adapter = testHelper.getAdapter();
      const session = await testHelper.createTestSession(testUser.id);
      const newExpiration = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

      const { result: updatedSession, duration } =
        await testHelper.measureOperation('update session expiration', () =>
          adapter.update(
            'session',
            { id: session.id },
            { expiresAt: newExpiration }
          )
        );

      expect(updatedSession.expiresAt.getTime()).toBe(newExpiration.getTime());
      expect(duration).toCompleteWithin(3000);
    });

    it('should delete session via real API', async () => {
      const adapter = testHelper.getAdapter();
      const session = await testHelper.createTestSession(testUser.id);

      const { duration } = await testHelper.measureOperation(
        'delete session',
        () => adapter.delete('session', { sessionToken: session.sessionToken })
      );

      expect(duration).toCompleteWithin(3000);

      // Verify session was deleted
      await expect(
        adapter.findUnique('session', { sessionToken: session.sessionToken })
      ).rejects.toThrow();
    });
  });

  describe('Account Operations with Real SDK', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await testHelper.createTestUser();
    });

    it('should create account via real API call', async () => {
      const adapter = testHelper.getAdapter();

      const { result: account, duration } = await testHelper.measureOperation(
        'create account',
        () =>
          testHelper.createTestAccount(testUser.id, {
            provider: 'github',
            type: 'oauth',
            providerAccountId: 'github-12345',
          })
      );

      expect(account).toHaveValidEntityStructure();
      expect(account.userId).toBe(testUser.id);
      expect(account.provider).toBe('github');
      expect(account.providerAccountId).toBe('github-12345');
      expect(duration).toCompleteWithin(3000);
    });

    it('should find account by provider info via real API', async () => {
      const adapter = testHelper.getAdapter();
      const providerAccountId = 'provider-findable-123';
      const provider = 'google';

      const createdAccount = await testHelper.createTestAccount(testUser.id, {
        provider,
        providerAccountId,
      });

      const { result: foundAccount, duration } =
        await testHelper.measureOperation('find account by provider', () =>
          adapter.findUnique('account', { provider, providerAccountId })
        );

      expect(foundAccount).toHaveValidEntityStructure();
      expect(foundAccount.id).toBe(createdAccount.id);
      expect(foundAccount.provider).toBe(provider);
      expect(foundAccount.providerAccountId).toBe(providerAccountId);
      expect(duration).toCompleteWithin(3000);
    });
  });

  describe('Verification Token Operations with Real SDK', () => {
    it('should create verification token via real API call', async () => {
      const adapter = testHelper.getAdapter();

      const { result: token, duration } = await testHelper.measureOperation(
        'create verification token',
        () =>
          testHelper.createTestVerificationToken({
            identifier: 'verification-test@example.com',
            token: 'verification-token-123',
          })
      );

      expect(token.identifier).toBe('verification-test@example.com');
      expect(token.token).toBe('verification-token-123');
      expect(token.expiresAt).toBeInstanceOf(Date);
      expect(duration).toCompleteWithin(3000);
    });

    it('should find verification token via real API', async () => {
      const adapter = testHelper.getAdapter();
      const identifier = 'findable-token@example.com';
      const tokenValue = 'findable-token-456';

      await testHelper.createTestVerificationToken({
        identifier,
        token: tokenValue,
      });

      const { result: foundToken, duration } =
        await testHelper.measureOperation('find verification token', () =>
          adapter.findUnique('verificationToken', {
            identifier,
            token: tokenValue,
          })
        );

      expect(foundToken.identifier).toBe(identifier);
      expect(foundToken.token).toBe(tokenValue);
      expect(duration).toCompleteWithin(3000);
    });
  });

  describe('Bulk Operations with Real SDK', () => {
    it('should handle batch user creation efficiently', async () => {
      const batchSize = 10;

      const { result: users, duration } = await testHelper.measureOperation(
        `create ${batchSize} users`,
        () => testHelper.createMultipleUsers(batchSize)
      );

      expect(users).toHaveLength(batchSize);
      users.forEach(user => {
        expect(user).toHaveValidEntityStructure();
      });

      // Should complete batch creation in reasonable time
      expect(duration).toCompleteWithin(15000); // 15s for 10 users
    });

    it('should handle findMany operations with real API', async () => {
      const adapter = testHelper.getAdapter();

      // Create multiple test users
      await testHelper.createMultipleUsers(5);

      const { result: users, duration } = await testHelper.measureOperation(
        'find many users',
        () =>
          adapter.findMany('user', {
            where: {
              email: {
                contains: testHelper.getConfig().testUserPrefix,
              },
            },
            take: 10,
          })
      );

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      users.forEach(user => {
        expect(user).toHaveValidEntityStructure();
        expect(user.email).toContain(testHelper.getConfig().testUserPrefix);
      });
      expect(duration).toCompleteWithin(5000);
    });
  });

  describe('Data Consistency with Real SDK', () => {
    it('should maintain referential integrity across operations', async () => {
      const adapter = testHelper.getAdapter();

      // Create user
      const user = await testHelper.createTestUser();

      // Create session linked to user
      const session = await testHelper.createTestSession(user.id);

      // Create account linked to user
      const account = await testHelper.createTestAccount(user.id);

      // Verify all relationships exist
      const foundSession = await adapter.findUnique('session', {
        sessionToken: session.sessionToken,
      });
      expect(foundSession.userId).toBe(user.id);

      const foundAccount = await adapter.findUnique('account', {
        id: account.id,
      });
      expect(foundAccount.userId).toBe(user.id);
    });

    it('should handle cascade deletion properly', async () => {
      const adapter = testHelper.getAdapter();

      // Create user with related data
      const user = await testHelper.createTestUser();
      const session = await testHelper.createTestSession(user.id);
      const account = await testHelper.createTestAccount(user.id);

      // Delete user (should cascade to related entities based on API implementation)
      await adapter.delete('user', { id: user.id });

      // Verify user is deleted
      await expect(
        adapter.findUnique('user', { id: user.id })
      ).rejects.toThrow();

      // Note: Cascade behavior depends on API implementation
      // Some APIs may require manual cleanup of related entities
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical authentication flow', async () => {
      const adapter = testHelper.getAdapter();

      // 1. User registration
      const user = await testHelper.createTestUser({
        email: 'auth-flow@example.com',
        name: 'Auth Flow User',
        emailVerified: null,
      });

      // 2. Email verification
      const verificationToken = await testHelper.createTestVerificationToken({
        identifier: 'auth-flow@example.com',
      });

      // 3. Complete email verification
      await adapter.update(
        'user',
        { id: user.id },
        {
          emailVerified: new Date(),
        }
      );

      // 4. Create session after login
      const session = await testHelper.createTestSession(user.id);

      // 5. Link OAuth account
      const account = await testHelper.createTestAccount(user.id, {
        provider: 'github',
        type: 'oauth',
      });

      // Verify complete flow
      const finalUser = await adapter.findUnique('user', { id: user.id });
      expect(finalUser.emailVerified).toBeInstanceOf(Date);

      const userSession = await adapter.findUnique('session', {
        sessionToken: session.sessionToken,
      });
      expect(userSession.userId).toBe(user.id);

      const userAccount = await adapter.findUnique('account', {
        id: account.id,
      });
      expect(userAccount.userId).toBe(user.id);
    });

    it('should handle concurrent operations safely', async () => {
      const adapter = testHelper.getAdapter();

      // Create multiple users concurrently
      const concurrentOperations = Array.from({ length: 5 }, (_, i) =>
        testHelper.createTestUser({
          email: `concurrent-${i}@example.com`,
        })
      );

      const { result: users, duration } = await testHelper.measureOperation(
        'concurrent user creation',
        () => Promise.all(concurrentOperations)
      );

      expect(users).toHaveLength(5);
      users.forEach((user, index) => {
        expect(user).toHaveValidEntityStructure();
        expect(user.email).toBe(`concurrent-${index}@example.com`);
      });

      // Should handle concurrent operations efficiently
      expect(duration).toCompleteWithin(10000);
    });
  });
});
