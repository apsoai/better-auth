/**
 * Data Integrity Integration Tests
 *
 * Tests data consistency, cleanup utilities, and referential integrity
 * with real API operations and data validation.
 */

import { IntegrationTestHelper, shouldRunIntegrationTests } from './setup';

// Skip all tests if integration tests are not enabled
const describeIntegration = shouldRunIntegrationTests()
  ? describe
  : describe.skip;

describeIntegration('Data Integrity Integration Tests', () => {
  let testHelper: IntegrationTestHelper;

  beforeAll(async () => {
    testHelper = new IntegrationTestHelper();

    // Verify API connectivity
    const isHealthy = await testHelper.healthCheck();
    if (!isHealthy) {
      throw new Error(
        'API health check failed - cannot run data integrity tests'
      );
    }
  }, 30000);

  afterAll(async () => {
    if (testHelper) {
      await testHelper.cleanup();
    }
  }, 15000);

  describe('Entity Relationship Integrity', () => {
    it('should maintain user-session relationships correctly', async () => {
      const adapter = testHelper.getAdapter();

      // Create user
      const user = await testHelper.createTestUser({
        email: 'relationship-test@example.com',
      });

      // Create multiple sessions for the user
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const session = await testHelper.createTestSession(user.id, {
          sessionToken: `session-${i}-${Date.now()}`,
        });
        sessions.push(session);
      }

      // Verify all sessions are linked to the correct user
      for (const session of sessions) {
        const foundSession = await adapter.findUnique('session', {
          sessionToken: session.sessionToken,
        });

        expect(foundSession).toHaveValidEntityStructure();
        expect(foundSession.userId).toBe(user.id);
        expect(foundSession.sessionToken).toBe(session.sessionToken);
      }

      // Verify user can be found
      const foundUser = await adapter.findUnique('user', { id: user.id });
      expect(foundUser).toHaveValidEntityStructure();
      expect(foundUser.email).toBe(user.email);
    });

    it('should maintain user-account relationships correctly', async () => {
      const adapter = testHelper.getAdapter();

      // Create user
      const user = await testHelper.createTestUser({
        email: 'account-relationship@example.com',
      });

      // Create multiple accounts for the user
      const providers = ['github', 'google', 'facebook'];
      const accounts = [];

      for (const provider of providers) {
        const account = await testHelper.createTestAccount(user.id, {
          provider,
          type: 'oauth',
          providerAccountId: `${provider}-${Date.now()}`,
        });
        accounts.push(account);
      }

      // Verify all accounts are linked correctly
      for (const account of accounts) {
        const foundAccount = await adapter.findUnique('account', {
          id: account.id,
        });

        expect(foundAccount).toHaveValidEntityStructure();
        expect(foundAccount.userId).toBe(user.id);
        expect(foundAccount.provider).toBe(account.provider);
        expect(foundAccount.providerAccountId).toBe(account.providerAccountId);
      }

      // Verify user exists
      const foundUser = await adapter.findUnique('user', { id: user.id });
      expect(foundUser.id).toBe(user.id);
    });

    it('should handle verification token relationships correctly', async () => {
      const adapter = testHelper.getAdapter();

      // Create multiple verification tokens for the same identifier
      const identifier = `verification-integrity-${Date.now()}@example.com`;
      const tokens = [];

      for (let i = 0; i < 3; i++) {
        const token = await testHelper.createTestVerificationToken({
          identifier,
          token: `token-${i}-${Date.now()}`,
          expiresAt: new Date(Date.now() + (i + 1) * 60 * 60 * 1000), // Different expiration times
        });
        tokens.push(token);
      }

      // Verify all tokens exist and have correct data
      for (const token of tokens) {
        const foundToken = await adapter.findUnique('verificationToken', {
          identifier: token.identifier,
          token: token.token,
        });

        expect(foundToken.identifier).toBe(identifier);
        expect(foundToken.token).toBe(token.token);
        expect(foundToken.expiresAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('Data Consistency Under Concurrent Operations', () => {
    it('should maintain consistency during concurrent user creation', async () => {
      const adapter = testHelper.getAdapter();
      const userCount = 10;

      // Create users concurrently
      const userPromises = Array.from({ length: userCount }, (_, i) =>
        testHelper.createTestUser({
          email: `concurrent-user-${i}-${Date.now()}@example.com`,
          name: `Concurrent User ${i}`,
        })
      );

      const users = await Promise.all(userPromises);

      // Verify all users were created with unique IDs and emails
      expect(users).toHaveLength(userCount);

      const userIds = new Set(users.map(u => u.id));
      const userEmails = new Set(users.map(u => u.email));

      expect(userIds.size).toBe(userCount); // All IDs should be unique
      expect(userEmails.size).toBe(userCount); // All emails should be unique

      // Verify each user can be retrieved
      for (const user of users) {
        const foundUser = await adapter.findUnique('user', { id: user.id });
        expect(foundUser).toHaveValidEntityStructure();
        expect(foundUser.email).toBe(user.email);
      }
    });

    it('should maintain session uniqueness during concurrent creation', async () => {
      const adapter = testHelper.getAdapter();
      const user = await testHelper.createTestUser();

      const sessionCount = 8;

      // Create sessions concurrently
      const sessionPromises = Array.from({ length: sessionCount }, (_, i) =>
        testHelper.createTestSession(user.id, {
          sessionToken: `concurrent-session-${i}-${Date.now()}-${Math.random()}`,
        })
      );

      const sessions = await Promise.all(sessionPromises);

      // Verify all sessions were created with unique tokens
      expect(sessions).toHaveLength(sessionCount);

      const sessionTokens = new Set(sessions.map(s => s.sessionToken));
      const sessionIds = new Set(sessions.map(s => s.id));

      expect(sessionTokens.size).toBe(sessionCount);
      expect(sessionIds.size).toBe(sessionCount);

      // Verify each session belongs to the correct user
      for (const session of sessions) {
        expect(session.userId).toBe(user.id);

        const foundSession = await adapter.findUnique('session', {
          sessionToken: session.sessionToken,
        });
        expect(foundSession.userId).toBe(user.id);
      }
    });

    it('should handle concurrent updates to the same entity', async () => {
      const adapter = testHelper.getAdapter();
      const user = await testHelper.createTestUser();

      // Perform concurrent updates
      const updatePromises = Array.from({ length: 5 }, (_, i) =>
        adapter
          .update(
            'user',
            { id: user.id },
            {
              name: `Updated Name ${i} - ${Date.now()}`,
            }
          )
          .catch(error => ({ error, index: i }))
      );

      const results = await Promise.all(updatePromises);

      // At least some updates should succeed
      const successfulUpdates = results.filter(r => !('error' in r));
      expect(successfulUpdates.length).toBeGreaterThan(0);

      // Final state should be consistent
      const finalUser = await adapter.findUnique('user', { id: user.id });
      expect(finalUser).toHaveValidEntityStructure();
      expect(finalUser.name).toMatch(/Updated Name/);
    });
  });

  describe('Data Validation and Constraints', () => {
    it('should enforce unique email constraints', async () => {
      const adapter = testHelper.getAdapter();
      const uniqueEmail = `unique-constraint-${Date.now()}@example.com`;

      // Create first user
      const firstUser = await testHelper.createTestUser({
        email: uniqueEmail,
      });

      // Attempt to create second user with same email
      await expect(
        testHelper.createTestUser({
          email: uniqueEmail,
        })
      ).rejects.toThrow();

      // First user should still exist and be retrievable
      const foundUser = await adapter.findUnique('user', {
        email: uniqueEmail,
      });
      expect(foundUser.id).toBe(firstUser.id);
    });

    it('should enforce session token uniqueness', async () => {
      const adapter = testHelper.getAdapter();
      const user1 = await testHelper.createTestUser();
      const user2 = await testHelper.createTestUser();

      const duplicateToken = `duplicate-session-${Date.now()}`;

      // Create first session
      const firstSession = await testHelper.createTestSession(user1.id, {
        sessionToken: duplicateToken,
      });

      // Attempt to create second session with same token
      await expect(
        testHelper.createTestSession(user2.id, {
          sessionToken: duplicateToken,
        })
      ).rejects.toThrow();

      // First session should still exist
      const foundSession = await adapter.findUnique('session', {
        sessionToken: duplicateToken,
      });
      expect(foundSession.id).toBe(firstSession.id);
      expect(foundSession.userId).toBe(user1.id);
    });

    it('should enforce account provider uniqueness per user', async () => {
      const adapter = testHelper.getAdapter();
      const user = await testHelper.createTestUser();

      const providerAccountId = `provider-unique-${Date.now()}`;
      const provider = 'github';

      // Create first account
      const firstAccount = await testHelper.createTestAccount(user.id, {
        provider,
        providerAccountId,
      });

      // Attempt to create duplicate account for same user/provider combination
      await expect(
        testHelper.createTestAccount(user.id, {
          provider,
          providerAccountId: `different-${providerAccountId}`, // Different provider account ID
        })
      ).rejects.toThrow();

      // First account should still exist
      const foundAccount = await adapter.findUnique('account', {
        provider,
        providerAccountId,
      });
      expect(foundAccount.id).toBe(firstAccount.id);
    });

    it('should validate required fields', async () => {
      const adapter = testHelper.getAdapter();

      // Test missing email
      await expect(
        adapter.create('user', {
          name: 'Test User',
          // email missing
        } as any)
      ).rejects.toThrow();

      // Test missing session token
      const user = await testHelper.createTestUser();
      await expect(
        adapter.create('session', {
          userId: user.id,
          expiresAt: new Date(),
          // sessionToken missing
        } as any)
      ).rejects.toThrow();

      // Test missing required account fields
      await expect(
        adapter.create('account', {
          userId: user.id,
          type: 'oauth',
          // provider missing
          // providerAccountId missing
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('Cleanup and Data Integrity', () => {
    it('should clean up test data without affecting other data', async () => {
      const adapter = testHelper.getAdapter();

      // Create a separate user that should NOT be cleaned up
      const permanentUser = await adapter.create('user', {
        email: `permanent-user-${Date.now()}@example.com`,
        name: 'Permanent User',
      });

      // Create test users through helper (will be cleaned up)
      const testUsers = await testHelper.createMultipleUsers(5);

      // Verify all users exist
      for (const user of testUsers) {
        const foundUser = await adapter.findUnique('user', { id: user.id });
        expect(foundUser).toHaveValidEntityStructure();
      }

      const foundPermanentUser = await adapter.findUnique('user', {
        id: permanentUser.id,
      });
      expect(foundPermanentUser).toHaveValidEntityStructure();

      // Perform cleanup
      await testHelper.cleanup();

      // Test users should be gone
      for (const user of testUsers) {
        await expect(
          adapter.findUnique('user', { id: user.id })
        ).rejects.toThrow();
      }

      // Permanent user should still exist
      const stillFoundUser = await adapter.findUnique('user', {
        id: permanentUser.id,
      });
      expect(stillFoundUser).toHaveValidEntityStructure();

      // Clean up permanent user
      await adapter.delete('user', { id: permanentUser.id });
    });

    it('should handle cascade cleanup of related entities', async () => {
      const adapter = testHelper.getAdapter();

      // Create user with related entities
      const user = await testHelper.createTestUser();
      const session = await testHelper.createTestSession(user.id);
      const account = await testHelper.createTestAccount(user.id);

      // Verify entities exist
      const foundUser = await adapter.findUnique('user', { id: user.id });
      const foundSession = await adapter.findUnique('session', {
        sessionToken: session.sessionToken,
      });
      const foundAccount = await adapter.findUnique('account', {
        id: account.id,
      });

      expect(foundUser).toHaveValidEntityStructure();
      expect(foundSession).toHaveValidEntityStructure();
      expect(foundAccount).toHaveValidEntityStructure();

      // Perform cleanup
      await testHelper.cleanup();

      // All entities should be cleaned up
      await expect(
        adapter.findUnique('user', { id: user.id })
      ).rejects.toThrow();

      await expect(
        adapter.findUnique('session', { sessionToken: session.sessionToken })
      ).rejects.toThrow();

      await expect(
        adapter.findUnique('account', { id: account.id })
      ).rejects.toThrow();
    });

    it('should handle partial cleanup failures gracefully', async () => {
      const adapter = testHelper.getAdapter();

      // Create test data
      const users = await testHelper.createMultipleUsers(3);

      // Manually delete one user to simulate partial failure scenario
      await adapter.delete('user', { id: users[0].id });

      // Cleanup should handle missing entities gracefully
      await expect(testHelper.cleanup()).resolves.not.toThrow();

      // Remaining users should be cleaned up
      for (let i = 1; i < users.length; i++) {
        await expect(
          adapter.findUnique('user', { id: users[i].id })
        ).rejects.toThrow();
      }
    });
  });

  describe('Data Migration and Versioning', () => {
    it('should handle entities with different timestamp formats', async () => {
      const adapter = testHelper.getAdapter();

      // Create entities with explicit timestamps
      const specificDate = new Date('2024-01-15T10:30:00.000Z');

      const user = await testHelper.createTestUser({
        createdAt: specificDate,
        updatedAt: specificDate,
        emailVerified: specificDate,
      });

      expect(user).toHaveValidEntityStructure();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);

      if (user.emailVerified) {
        expect(user.emailVerified).toBeInstanceOf(Date);
      }
    });

    it('should handle optional fields correctly', async () => {
      const adapter = testHelper.getAdapter();

      // Create user without optional fields
      const minimalUser = await testHelper.createTestUser({
        email: `minimal-${Date.now()}@example.com`,
        name: null, // Optional field
        image: null, // Optional field
        emailVerified: null, // Optional field
      });

      expect(minimalUser).toHaveValidEntityStructure();
      expect(minimalUser.email).toBeDefined();

      // Create user with all optional fields
      const completeUser = await testHelper.createTestUser({
        email: `complete-${Date.now()}@example.com`,
        name: 'Complete User',
        image: 'https://example.com/avatar.jpg',
        emailVerified: new Date(),
      });

      expect(completeUser).toHaveValidEntityStructure();
      expect(completeUser.name).toBe('Complete User');
      expect(completeUser.image).toBe('https://example.com/avatar.jpg');
      expect(completeUser.emailVerified).toBeInstanceOf(Date);
    });
  });

  describe('Stress Testing Data Integrity', () => {
    it('should maintain integrity under high load', async () => {
      const adapter = testHelper.getAdapter();
      const operationCount = 50;

      // Mix of different operations running concurrently
      const operations = [];

      // User creations
      for (let i = 0; i < operationCount / 5; i++) {
        operations.push(
          testHelper.createTestUser({
            email: `stress-user-${i}-${Date.now()}@example.com`,
          })
        );
      }

      // User with sessions
      for (let i = 0; i < operationCount / 5; i++) {
        operations.push(
          testHelper.createTestUser().then(async user => {
            const session = await testHelper.createTestSession(user.id);
            return { user, session };
          })
        );
      }

      // User with accounts
      for (let i = 0; i < operationCount / 5; i++) {
        operations.push(
          testHelper.createTestUser().then(async user => {
            const account = await testHelper.createTestAccount(user.id);
            return { user, account };
          })
        );
      }

      // Verification tokens
      for (let i = 0; i < operationCount / 5; i++) {
        operations.push(
          testHelper.createTestVerificationToken({
            identifier: `stress-token-${i}-${Date.now()}@example.com`,
          })
        );
      }

      // User lookups on existing data
      const existingUser = await testHelper.createTestUser();
      for (let i = 0; i < operationCount / 5; i++) {
        operations.push(adapter.findUnique('user', { id: existingUser.id }));
      }

      const startTime = performance.now();
      const results = await Promise.allSettled(operations);
      const duration = performance.now() - startTime;

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(
        `Stress test: ${successful} successful, ${failed} failed operations in ${duration.toFixed(2)}ms`
      );

      // Should have high success rate
      expect(successful).toBeGreaterThan(operationCount * 0.8);

      // Should complete in reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds
    }, 45000);
  });
});
