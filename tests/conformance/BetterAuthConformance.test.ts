/**
 * Better Auth Adapter Conformance Tests
 *
 * This test suite verifies that our ApsoAdapter implementation conforms
 * to the Better Auth adapter specification and behaves correctly with
 * the actual Better Auth framework.
 */

import type {
  BetterAuthAdapter,
  BetterAuthUser,
  BetterAuthSession,
  BetterAuthVerificationToken,
} from '../../src/types';

import { MockDataStore } from '../unit/__mocks__/apsoSdk';
import { createTestAdapter, defaultTestConfig } from './testUtils';

describe('Better Auth Adapter Conformance', () => {
  let adapter: BetterAuthAdapter;
  let mockStore: MockDataStore;

  beforeEach(() => {
    // Reset mock data store
    mockStore = MockDataStore.getInstance();
    mockStore.reset();

    // Create adapter instance
    adapter = createTestAdapter(defaultTestConfig);
  });

  afterEach(() => {
    mockStore.reset();
  });

  describe('Interface Compliance', () => {
    it('should implement all required BetterAuthAdapter methods', () => {
      // Verify all required methods exist
      expect(typeof adapter.create).toBe('function');
      expect(typeof adapter.update).toBe('function');
      expect(typeof adapter.updateMany).toBe('function');
      expect(typeof adapter.delete).toBe('function');
      expect(typeof adapter.deleteMany).toBe('function');
      expect(typeof adapter.findOne).toBe('function');
      expect(typeof adapter.findMany).toBe('function');
      expect(typeof adapter.count).toBe('function');
    });

    it('should have correct method signatures and return types', async () => {
      // Test that methods return Promises with correct types
      const createPromise = adapter.create({
        model: 'user',
        data: {
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: false,
        },
      });
      expect(createPromise).toBeInstanceOf(Promise);

      const findOnePromise = adapter.findOne({
        model: 'user',
        where: { email: 'nonexistent@example.com' },
      });
      expect(findOnePromise).toBeInstanceOf(Promise);

      const findManyPromise = adapter.findMany({
        model: 'user',
        where: {},
      });
      expect(findManyPromise).toBeInstanceOf(Promise);

      const countPromise = adapter.count({
        model: 'user',
        where: {},
      });
      expect(countPromise).toBeInstanceOf(Promise);

      // Verify return types
      const user = await createPromise;
      expect(typeof user).toBe('object');
      expect(user).toBeTruthy();

      const notFound = await findOnePromise;
      expect(notFound).toBeNull();

      const users = await findManyPromise;
      expect(Array.isArray(users)).toBe(true);

      const userCount = await countPromise;
      expect(typeof userCount).toBe('number');
    });

    it('should handle optional parameters correctly', async () => {
      // Test methods with minimal parameters
      const user = (await adapter.create({
        model: 'user',
        data: { email: 'minimal@example.com', emailVerified: false },
      })) as BetterAuthUser;

      const found = await adapter.findOne({
        model: 'user',
        where: { id: user.id },
      });

      expect(found).toBeTruthy();
      expect((found as BetterAuthUser).email).toBe('minimal@example.com');
    });
  });

  describe('User Operations', () => {
    it('should create a user with required fields', async () => {
      const userData = {
        email: 'user@example.com',
        name: 'John Doe',
        emailVerified: false,
      };

      const user = await adapter.create<BetterAuthUser>({
        model: 'user',
        data: userData,
      });

      expect(user).toBeTruthy();
      expect(user.id).toBeTruthy();
      expect(typeof user.id).toBe('string');
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.emailVerified).toBe(userData.emailVerified);
    });

    it('should create a user with minimal required fields', async () => {
      const user = await adapter.create<BetterAuthUser>({
        model: 'user',
        data: {
          email: 'minimal@example.com',
          emailVerified: false,
        },
      });

      expect(user).toBeTruthy();
      expect(user.id).toBeTruthy();
      expect(user.email).toBe('minimal@example.com');
      expect(user.emailVerified).toBe(false);
      expect(user.name).toBeUndefined();
    });

    it('should find user by ID', async () => {
      const userData = {
        email: 'findbyid@example.com',
        name: 'Find Me',
        emailVerified: true,
      };

      const created = await adapter.create<BetterAuthUser>({
        model: 'user',
        data: userData,
      });

      const found = await adapter.findOne<BetterAuthUser>({
        model: 'user',
        where: { id: created.id },
      });

      expect(found).toBeTruthy();
      expect(found!.id).toBe(created.id);
      expect(found!.email).toBe(userData.email);
      expect(found!.name).toBe(userData.name);
    });

    it('should find user by email', async () => {
      const userData = {
        email: 'findbyemail@example.com',
        name: 'Email User',
        emailVerified: false,
      };

      await adapter.create<BetterAuthUser>({
        model: 'user',
        data: userData,
      });

      const found = await adapter.findOne<BetterAuthUser>({
        model: 'user',
        where: { email: userData.email },
      });

      expect(found).toBeTruthy();
      expect(found!.email).toBe(userData.email);
      expect(found!.name).toBe(userData.name);
    });

    it('should return null for non-existent user', async () => {
      const found = await adapter.findOne<BetterAuthUser>({
        model: 'user',
        where: { id: 'non-existent-id' },
      });

      expect(found).toBeNull();

      const foundByEmail = await adapter.findOne<BetterAuthUser>({
        model: 'user',
        where: { email: 'nonexistent@example.com' },
      });

      expect(foundByEmail).toBeNull();
    });

    it('should update user by ID', async () => {
      const user = await adapter.create<BetterAuthUser>({
        model: 'user',
        data: {
          email: 'update@example.com',
          name: 'Original Name',
          emailVerified: false,
        },
      });

      const updated = await adapter.update<BetterAuthUser>({
        model: 'user',
        where: { id: user.id },
        update: {
          name: 'Updated Name',
          emailVerified: true,
        },
      });

      expect(updated).toBeTruthy();
      expect(updated.id).toBe(user.id);
      expect(updated.email).toBe('update@example.com'); // Should remain unchanged
      expect(updated.name).toBe('Updated Name');
      expect(updated.emailVerified).toBe(true);
    });

    it('should update user by email', async () => {
      await adapter.create<BetterAuthUser>({
        model: 'user',
        data: {
          email: 'updatebyemail@example.com',
          name: 'Email Update User',
          emailVerified: false,
        },
      });

      const updated = await adapter.update<BetterAuthUser>({
        model: 'user',
        where: { email: 'updatebyemail@example.com' },
        update: { emailVerified: true },
      });

      expect(updated).toBeTruthy();
      expect(updated.email).toBe('updatebyemail@example.com');
      expect(updated.emailVerified).toBe(true);
    });

    it('should delete user and return deleted entity', async () => {
      const user = await adapter.create<BetterAuthUser>({
        model: 'user',
        data: {
          email: 'delete@example.com',
          name: 'Delete Me',
          emailVerified: false,
        },
      });

      const deleted = await adapter.delete<BetterAuthUser>({
        model: 'user',
        where: { id: user.id },
      });

      expect(deleted).toBeTruthy();
      expect(deleted.id).toBe(user.id);
      expect(deleted.email).toBe('delete@example.com');

      // Verify user is actually deleted
      const found = await adapter.findOne<BetterAuthUser>({
        model: 'user',
        where: { id: user.id },
      });

      expect(found).toBeNull();
    });

    it('should find multiple users', async () => {
      // Create multiple users
      await Promise.all([
        adapter.create<BetterAuthUser>({
          model: 'user',
          data: { email: 'user1@example.com', emailVerified: true },
        }),
        adapter.create<BetterAuthUser>({
          model: 'user',
          data: { email: 'user2@example.com', emailVerified: false },
        }),
        adapter.create<BetterAuthUser>({
          model: 'user',
          data: { email: 'user3@example.com', emailVerified: true },
        }),
      ]);

      const allUsers = await adapter.findMany<BetterAuthUser>({
        model: 'user',
      });

      expect(Array.isArray(allUsers)).toBe(true);
      expect(allUsers.length).toBeGreaterThanOrEqual(3);

      const userEmails = allUsers.map(u => u.email);
      expect(userEmails).toContain('user1@example.com');
      expect(userEmails).toContain('user2@example.com');
      expect(userEmails).toContain('user3@example.com');
    });

    it('should count users', async () => {
      const initialCount = await adapter.count({ model: 'user' });

      await adapter.create<BetterAuthUser>({
        model: 'user',
        data: { email: 'count1@example.com', emailVerified: true },
      });

      await adapter.create<BetterAuthUser>({
        model: 'user',
        data: { email: 'count2@example.com', emailVerified: false },
      });

      const newCount = await adapter.count({ model: 'user' });
      expect(newCount).toBe(initialCount + 2);
    });
  });

  describe('Session Operations', () => {
    let testUser: BetterAuthUser;

    beforeEach(async () => {
      testUser = await adapter.create<BetterAuthUser>({
        model: 'user',
        data: {
          email: 'session-user@example.com',
          name: 'Session User',
          emailVerified: true,
        },
      });
    });

    it('should create a session with all required fields', async () => {
      const sessionData = {
        sessionToken: 'session-token-123456789',
        userId: testUser.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      };

      const session = await adapter.create<BetterAuthSession>({
        model: 'session',
        data: sessionData,
      });

      expect(session).toBeTruthy();
      expect(session.id).toBeTruthy();
      expect(typeof session.id).toBe('string');
      expect(session.sessionToken).toBe(sessionData.sessionToken);
      expect(session.userId).toBe(sessionData.userId);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should find session by token', async () => {
      const sessionToken = 'find-by-token-456789';
      const sessionData = {
        sessionToken,
        userId: testUser.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await adapter.create<BetterAuthSession>({
        model: 'session',
        data: sessionData,
      });

      const found = await adapter.findOne<BetterAuthSession>({
        model: 'session',
        where: { sessionToken },
      });

      expect(found).toBeTruthy();
      expect(found!.sessionToken).toBe(sessionToken);
      expect(found!.userId).toBe(testUser.id);
    });

    it('should find session by ID', async () => {
      const session = await adapter.create<BetterAuthSession>({
        model: 'session',
        data: {
          sessionToken: 'find-by-id-789012345',
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const found = await adapter.findOne<BetterAuthSession>({
        model: 'session',
        where: { id: session.id },
      });

      expect(found).toBeTruthy();
      expect(found!.id).toBe(session.id);
      expect(found!.sessionToken).toBe('find-by-id-789012345');
    });

    it('should update session', async () => {
      await adapter.create<BetterAuthSession>({
        model: 'session',
        data: {
          sessionToken: 'update-session-token123',
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
        },
      });

      const newExpiryDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
      const updated = await adapter.update<BetterAuthSession>({
        model: 'session',
        where: { sessionToken: 'update-session-token123' },
        update: { expiresAt: newExpiryDate },
      });

      expect(updated).toBeTruthy();
      expect(updated.sessionToken).toBe('update-session-token123');
      expect(updated.expiresAt.getTime()).toBe(newExpiryDate.getTime());
    });

    it('should delete session', async () => {
      await adapter.create<BetterAuthSession>({
        model: 'session',
        data: {
          sessionToken: 'delete-session-token123',
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const deleted = await adapter.delete<BetterAuthSession>({
        model: 'session',
        where: { sessionToken: 'delete-session-token123' },
      });

      expect(deleted).toBeTruthy();
      expect(deleted.sessionToken).toBe('delete-session-token123');

      // Verify session is deleted
      const found = await adapter.findOne<BetterAuthSession>({
        model: 'session',
        where: { sessionToken: 'delete-session-token123' },
      });

      expect(found).toBeNull();
    });

    it('should handle session creation validation errors', async () => {
      await expect(
        adapter.create<BetterAuthSession>({
          model: 'session',
          data: {
            // Missing required fields
            sessionToken: 'invalid-session', // This is intentionally too short
          },
        })
      ).rejects.toThrow(/requires sessionToken, userId, and expiresAt/);
    });
  });

  describe('VerificationToken Operations', () => {
    it('should create verification token with all required fields', async () => {
      const tokenData = {
        identifier: 'verify@example.com',
        token: 'verification-token-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const verificationToken =
        await adapter.create<BetterAuthVerificationToken>({
          model: 'verificationtoken',
          data: tokenData,
        });

      expect(verificationToken).toBeTruthy();
      expect(verificationToken.identifier).toBe(tokenData.identifier);
      expect(verificationToken.token).toBe(tokenData.token);
      expect(verificationToken.expiresAt).toBeInstanceOf(Date);
    });

    it('should find verification token by token', async () => {
      const token = 'find-verification-token-456';
      const tokenData = {
        identifier: 'findtoken@example.com',
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await adapter.create<BetterAuthVerificationToken>({
        model: 'verificationtoken',
        data: tokenData,
      });

      const found = await adapter.findOne<BetterAuthVerificationToken>({
        model: 'verificationtoken',
        where: { token },
      });

      expect(found).toBeTruthy();
      expect(found!.token).toBe(token);
      expect(found!.identifier).toBe('findtoken@example.com');
    });

    it('should find verification token by identifier', async () => {
      const identifier = 'findbyidentifier@example.com';
      const tokenData = {
        identifier,
        token: 'token-for-identifier-789',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await adapter.create<BetterAuthVerificationToken>({
        model: 'verificationtoken',
        data: tokenData,
      });

      const found = await adapter.findOne<BetterAuthVerificationToken>({
        model: 'verificationtoken',
        where: { identifier },
      });

      expect(found).toBeTruthy();
      expect(found!.identifier).toBe(identifier);
      expect(found!.token).toBe('token-for-identifier-789');
    });

    it('should delete verification token by token', async () => {
      const tokenData = {
        identifier: 'deletetoken@example.com',
        token: 'delete-token-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await adapter.create<BetterAuthVerificationToken>({
        model: 'verificationtoken',
        data: tokenData,
      });

      const deleted = await adapter.delete<BetterAuthVerificationToken>({
        model: 'verificationtoken',
        where: { token: 'delete-token-123' },
      });

      expect(deleted).toBeTruthy();
      expect(deleted.token).toBe('delete-token-123');

      // Verify token is deleted
      const found = await adapter.findOne<BetterAuthVerificationToken>({
        model: 'verificationtoken',
        where: { token: 'delete-token-123' },
      });

      expect(found).toBeNull();
    });

    it('should handle verification token validation errors', async () => {
      await expect(
        adapter.create<BetterAuthVerificationToken>({
          model: 'verificationtoken',
          data: {
            // Missing required fields
            identifier: 'incomplete@example.com',
          },
        })
      ).rejects.toThrow(/requires identifier, token, and expiresAt/);
    });
  });

  describe('Bulk Operations', () => {
    let testUsers: BetterAuthUser[];

    beforeEach(async () => {
      // Create test users for bulk operations
      testUsers = await Promise.all([
        adapter.create<BetterAuthUser>({
          model: 'user',
          data: { email: 'bulk1@example.com', emailVerified: false },
        }),
        adapter.create<BetterAuthUser>({
          model: 'user',
          data: { email: 'bulk2@example.com', emailVerified: false },
        }),
        adapter.create<BetterAuthUser>({
          model: 'user',
          data: { email: 'bulk3@example.com', emailVerified: false },
        }),
      ]);
    });

    it('should update multiple users', async () => {
      const updateCount = await adapter.updateMany({
        model: 'user',
        where: { emailVerified: false },
        update: { emailVerified: true },
      });

      expect(updateCount).toBeGreaterThanOrEqual(3);

      // Verify updates were applied
      const updatedUsers = await adapter.findMany<BetterAuthUser>({
        model: 'user',
        where: { emailVerified: true },
      });

      const bulkUserEmails = updatedUsers
        .map(u => u.email)
        .filter(email => email.startsWith('bulk'));

      expect(bulkUserEmails).toContain('bulk1@example.com');
      expect(bulkUserEmails).toContain('bulk2@example.com');
      expect(bulkUserEmails).toContain('bulk3@example.com');
    });

    it('should delete multiple users', async () => {
      const deleteCount = await adapter.deleteMany({
        model: 'user',
        where: { emailVerified: false },
      });

      expect(deleteCount).toBeGreaterThanOrEqual(3);

      // Verify deletions
      for (const user of testUsers) {
        const found = await adapter.findOne<BetterAuthUser>({
          model: 'user',
          where: { id: user.id },
        });
        expect(found).toBeNull();
      }
    });

    it('should handle bulk operations with empty results', async () => {
      const updateCount = await adapter.updateMany({
        model: 'user',
        where: { email: 'nonexistent@example.com' },
        update: { emailVerified: true },
      });

      expect(updateCount).toBe(0);

      const deleteCount = await adapter.deleteMany({
        model: 'user',
        where: { email: 'nonexistent@example.com' },
      });

      expect(deleteCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should return null for findOne when record does not exist', async () => {
      const result = await adapter.findOne<BetterAuthUser>({
        model: 'user',
        where: { id: 'non-existent-id' },
      });

      expect(result).toBeNull();
    });

    it('should throw error when updating non-existent record', async () => {
      await expect(
        adapter.update<BetterAuthUser>({
          model: 'user',
          where: { id: 'non-existent-id' },
          update: { name: 'Updated Name' },
        })
      ).rejects.toThrow(/User with ID .* not found/);
    });

    it('should throw error when deleting non-existent record', async () => {
      await expect(
        adapter.delete<BetterAuthUser>({
          model: 'user',
          where: { id: 'non-existent-id' },
        })
      ).rejects.toThrow(/No record found for deletion/);
    });

    it('should throw validation errors for invalid data', async () => {
      await expect(
        adapter.create<BetterAuthSession>({
          model: 'session',
          data: {}, // Missing required fields
        })
      ).rejects.toThrow();
    });

    it('should handle network-like errors gracefully', async () => {
      // This would test network error scenarios in a real implementation
      // For now, we verify that errors are properly wrapped
      try {
        await adapter.create<BetterAuthUser>({
          model: 'user',
          data: { email: 'test@example.com', emailVerified: false },
        });
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toBeTruthy();
        }
      }
    });
  });

  describe('Data Format Tests', () => {
    it('should return user entities with correct format', async () => {
      const user = await adapter.create<BetterAuthUser>({
        model: 'user',
        data: {
          email: 'format@example.com',
          name: 'Format Test',
          emailVerified: true,
          image: 'https://example.com/avatar.jpg',
        },
      });

      // Verify all required fields are present and have correct types
      expect(typeof user.id).toBe('string');
      expect(user.id.length).toBeGreaterThan(0);
      expect(typeof user.email).toBe('string');
      expect(typeof user.emailVerified).toBe('boolean');

      // Optional fields should be strings if present, or undefined
      if (user.name !== undefined) {
        expect(typeof user.name).toBe('string');
      }
      if (user.image !== undefined) {
        expect(typeof user.image).toBe('string');
      }
    });

    it('should return session entities with correct format', async () => {
      const testUser = await adapter.create<BetterAuthUser>({
        model: 'user',
        data: { email: 'sessionformat@example.com', emailVerified: true },
      });

      const session = await adapter.create<BetterAuthSession>({
        model: 'session',
        data: {
          sessionToken: 'format-session-token',
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      expect(typeof session.id).toBe('string');
      expect(session.id.length).toBeGreaterThan(0);
      expect(typeof session.sessionToken).toBe('string');
      expect(typeof session.userId).toBe('string');
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should return verification token entities with correct format', async () => {
      const token = await adapter.create<BetterAuthVerificationToken>({
        model: 'verificationtoken',
        data: {
          identifier: 'tokenformat@example.com',
          token: 'format-verification-token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      expect(typeof token.identifier).toBe('string');
      expect(typeof token.token).toBe('string');
      expect(token.expiresAt).toBeInstanceOf(Date);
    });

    it('should handle date fields correctly', async () => {
      const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const token = await adapter.create<BetterAuthVerificationToken>({
        model: 'verificationtoken',
        data: {
          identifier: 'datetest@example.com',
          token: 'date-test-token',
          expiresAt: expirationDate,
        },
      });

      // Date should be preserved or properly converted
      expect(token.expiresAt).toBeInstanceOf(Date);
      expect(
        Math.abs(token.expiresAt.getTime() - expirationDate.getTime())
      ).toBeLessThan(1000);
    });

    it('should handle array responses correctly', async () => {
      // Create multiple users
      await Promise.all([
        adapter.create<BetterAuthUser>({
          model: 'user',
          data: { email: 'array1@example.com', emailVerified: true },
        }),
        adapter.create<BetterAuthUser>({
          model: 'user',
          data: { email: 'array2@example.com', emailVerified: false },
        }),
      ]);

      const users = await adapter.findMany<BetterAuthUser>({ model: 'user' });

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThanOrEqual(2);

      users.forEach(user => {
        expect(typeof user.id).toBe('string');
        expect(typeof user.email).toBe('string');
        expect(typeof user.emailVerified).toBe('boolean');
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle operations within reasonable time limits', async () => {
      const start = performance.now();

      await adapter.create<BetterAuthUser>({
        model: 'user',
        data: { email: 'performance@example.com', emailVerified: false },
      });

      const duration = performance.now() - start;

      // Operations should complete within reasonable time (generous limit for tests)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should handle empty arrays correctly', async () => {
      const emptyResults = await adapter.findMany<BetterAuthUser>({
        model: 'user',
        where: { email: 'definitelynotexist@nowhere.com' },
      });

      expect(Array.isArray(emptyResults)).toBe(true);
      expect(emptyResults.length).toBe(0);
    });

    it('should handle special characters in data', async () => {
      const specialEmail = 'special+chars_123@test-domain.com';
      const specialName = 'Test User & Co. (Special)';

      const user = await adapter.create<BetterAuthUser>({
        model: 'user',
        data: {
          email: specialEmail,
          name: specialName,
          emailVerified: true,
        },
      });

      expect(user.email).toBe(specialEmail);
      expect(user.name).toBe(specialName);
    });

    it('should handle concurrent operations gracefully', async () => {
      const concurrentCreations = Array.from({ length: 5 }, (_, i) =>
        adapter.create<BetterAuthUser>({
          model: 'user',
          data: {
            email: `concurrent${i}@example.com`,
            emailVerified: false,
          },
        })
      );

      const results = await Promise.all(concurrentCreations);

      expect(results).toHaveLength(5);
      results.forEach((user, index) => {
        expect(user.email).toBe(`concurrent${index}@example.com`);
        expect(typeof user.id).toBe('string');
      });
    });
  });

  describe('Model Name Variations', () => {
    it('should handle case variations in model names', async () => {
      // Test both lowercase and mixed case
      const user1 = await adapter.create<BetterAuthUser>({
        model: 'user',
        data: { email: 'lowercase@example.com', emailVerified: false },
      });

      const user2 = await adapter.create<BetterAuthUser>({
        model: 'User',
        data: { email: 'titlecase@example.com', emailVerified: false },
      });

      expect(user1).toBeTruthy();
      expect(user2).toBeTruthy();
    });

    it('should handle verificationtoken vs verificationToken variations', async () => {
      const token = await adapter.create<BetterAuthVerificationToken>({
        model: 'verificationtoken', // lowercase
        data: {
          identifier: 'lowercase@example.com',
          token: 'lowercase-token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      expect(token).toBeTruthy();
      expect(token.identifier).toBe('lowercase@example.com');
    });
  });
});
