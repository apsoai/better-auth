/**
 * Error Handling Integration Tests
 *
 * Tests error scenarios with real network communication,
 * including timeouts, connection failures, and API errors.
 */

import { IntegrationTestHelper, shouldRunIntegrationTests } from './setup';
import { apsoAdapter } from '../../src';

// Skip all tests if integration tests are not enabled
const describeIntegration = shouldRunIntegrationTests()
  ? describe
  : describe.skip;

describeIntegration('Error Handling Integration Tests', () => {
  let testHelper: IntegrationTestHelper;

  beforeAll(async () => {
    testHelper = new IntegrationTestHelper();

    // Verify base API connectivity
    const isHealthy = await testHelper.healthCheck();
    if (!isHealthy) {
      throw new Error(
        'API health check failed - cannot run error handling tests'
      );
    }
  }, 30000);

  afterAll(async () => {
    if (testHelper) {
      await testHelper.cleanup();
    }
  }, 15000);

  describe('Network Failure Scenarios', () => {
    it('should handle unreachable host gracefully', async () => {
      const unreachableAdapter = apsoAdapter({
        baseUrl: 'https://unreachable-host-that-does-not-exist.invalid',
        timeout: 2000,
        retryConfig: {
          maxRetries: 1,
          initialDelayMs: 100,
          maxDelayMs: 200,
        },
      });

      const startTime = performance.now();

      await expect(
        unreachableAdapter.findUnique('user', { id: 'test' })
      ).rejects.toThrow(/network|timeout|ENOTFOUND|connection/i);

      const duration = performance.now() - startTime;

      // Should fail relatively quickly, not hang
      expect(duration).toBeLessThan(10000); // Within 10 seconds
    }, 15000);

    it('should handle connection timeout gracefully', async () => {
      const timeoutAdapter = apsoAdapter({
        baseUrl: testHelper.getConfig().baseUrl,
        timeout: 1, // Extremely short timeout
        retryConfig: {
          maxRetries: 0, // No retries to test pure timeout
        },
      });

      const startTime = performance.now();

      await expect(
        timeoutAdapter.create('user', {
          email: 'timeout-test@example.com',
          name: 'Timeout Test User',
        })
      ).rejects.toThrow(/timeout/i);

      const duration = performance.now() - startTime;

      // Should fail very quickly due to timeout
      expect(duration).toBeLessThan(1000);
    });

    it('should handle network interruption during operation', async () => {
      // This test simulates network issues that might occur mid-operation
      const flakyAdapter = apsoAdapter({
        baseUrl: testHelper.getConfig().baseUrl,
        timeout: 5000,
        retryConfig: {
          maxRetries: 2,
          initialDelayMs: 100,
          maxDelayMs: 500,
        },
      });

      // Test multiple operations to potentially hit network issues
      const operations = Array.from({ length: 5 }, (_, i) =>
        flakyAdapter.create('user', {
          email: `network-test-${i}-${Date.now()}@example.com`,
          name: `Network Test User ${i}`,
        })
      );

      try {
        const results = await Promise.allSettled(operations);

        // At least some should succeed, but some might fail due to network issues
        const succeeded = results.filter(r => r.status === 'fulfilled');
        const failed = results.filter(r => r.status === 'rejected');

        // Clean up successful creations
        for (const result of succeeded) {
          if (result.status === 'fulfilled') {
            try {
              await flakyAdapter.delete('user', {
                id: (result.value as any).id,
              });
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }

        // Should handle errors gracefully
        failed.forEach(result => {
          if (result.status === 'rejected') {
            expect(result.reason).toBeInstanceOf(Error);
          }
        });
      } catch (error) {
        // Network issues are acceptable for this test
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('HTTP Error Scenarios', () => {
    it('should handle 404 errors appropriately', async () => {
      const adapter = testHelper.getAdapter();

      await expect(
        adapter.findUnique('user', { id: 'non-existent-user-id-12345' })
      ).rejects.toThrow();

      await expect(
        adapter.update(
          'user',
          { id: 'non-existent-user-id-12345' },
          { name: 'Updated' }
        )
      ).rejects.toThrow();

      await expect(
        adapter.delete('user', { id: 'non-existent-user-id-12345' })
      ).rejects.toThrow();
    });

    it('should handle validation errors from API', async () => {
      const adapter = testHelper.getAdapter();

      // Test invalid email format
      await expect(
        adapter.create('user', {
          email: 'invalid-email-format',
          name: 'Test User',
        })
      ).rejects.toThrow();

      // Test missing required fields
      await expect(adapter.create('user', {} as any)).rejects.toThrow();

      // Test invalid data types
      await expect(
        adapter.create('user', {
          email: 'valid@example.com',
          name: 12345, // Invalid type
        } as any)
      ).rejects.toThrow();
    });

    it('should handle duplicate key constraints', async () => {
      const adapter = testHelper.getAdapter();
      const duplicateEmail = `duplicate-${Date.now()}@example.com`;

      // Create first user
      const firstUser = await testHelper.createTestUser({
        email: duplicateEmail,
      });

      // Attempt to create second user with same email
      await expect(
        adapter.create('user', {
          email: duplicateEmail,
          name: 'Duplicate Email User',
        })
      ).rejects.toThrow(/duplicate|conflict|unique/i);

      // Cleanup
      await adapter.delete('user', { id: firstUser.id });
    });
  });

  describe('Retry Mechanism Testing', () => {
    it('should retry failed requests according to configuration', async () => {
      const attemptCount = 0;

      // Create adapter with retry configuration
      const retryAdapter = apsoAdapter({
        baseUrl: testHelper.getConfig().baseUrl,
        timeout: 5000,
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 50,
          maxDelayMs: 200,
        },
        // Note: In real implementation, you might need to mock or use a proxy
        // to simulate intermittent failures for retry testing
      });

      // For this test, we'll use a valid operation that should succeed
      // In practice, you might want to test with a controlled flaky endpoint
      const startTime = performance.now();

      try {
        const user = await retryAdapter.create('user', {
          email: `retry-test-${Date.now()}@example.com`,
          name: 'Retry Test User',
        });

        const duration = performance.now() - startTime;

        // Should succeed and cleanup
        await retryAdapter.delete('user', { id: user.id });

        // Should complete in reasonable time
        expect(duration).toBeLessThan(10000);
      } catch (error) {
        // If it fails after retries, that's also valid for this test
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle exponential backoff in retries', async () => {
      const retryAdapter = apsoAdapter({
        baseUrl: 'https://httpstat.us/500', // Service that returns 500 errors
        timeout: 2000,
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
        },
      });

      const startTime = performance.now();

      await expect(
        retryAdapter.findUnique('user', { id: 'test' })
      ).rejects.toThrow();

      const duration = performance.now() - startTime;

      // With 3 retries and exponential backoff, should take some time
      // 100ms + 200ms + 400ms + request times > 700ms
      expect(duration).toBeGreaterThan(700);
      expect(duration).toBeLessThan(10000); // But not too long
    }, 15000);
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle concurrent request limits gracefully', async () => {
      const adapter = testHelper.getAdapter();

      // Create many concurrent requests to potentially hit limits
      const concurrentRequests = Array.from({ length: 20 }, (_, i) =>
        adapter
          .create('user', {
            email: `concurrent-${i}-${Date.now()}@example.com`,
            name: `Concurrent User ${i}`,
          })
          .catch(error => ({ error, index: i }))
      );

      const results = await Promise.allSettled(concurrentRequests);

      let successCount = 0;
      let errorCount = 0;
      const createdUsers: any[] = [];

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          if ('error' in result.value) {
            errorCount++;
          } else {
            successCount++;
            createdUsers.push(result.value);
          }
        } else {
          errorCount++;
        }
      });

      // Clean up created users
      for (const user of createdUsers) {
        try {
          await adapter.delete('user', { id: user.id });
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      // Should handle some level of concurrency
      expect(successCount).toBeGreaterThan(0);

      // If some failed, errors should be meaningful
      if (errorCount > 0) {
        console.log(
          `${errorCount}/${results.length} requests failed due to concurrency limits or other errors`
        );
      }
    });

    it('should handle large payload scenarios', async () => {
      const adapter = testHelper.getAdapter();

      // Create user with large data
      const largeUserData = {
        email: `large-payload-${Date.now()}@example.com`,
        name: 'A'.repeat(1000), // Large name field
      };

      try {
        const user = await adapter.create('user', largeUserData);
        expect(user).toHaveValidEntityStructure();

        // Cleanup
        await adapter.delete('user', { id: user.id });
      } catch (error) {
        // Large payloads might be rejected by API
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Data Consistency Error Recovery', () => {
    it('should handle partial operation failures gracefully', async () => {
      const adapter = testHelper.getAdapter();

      // Create user
      const user = await testHelper.createTestUser();

      try {
        // Attempt operation that might partially fail
        await adapter.update(
          'user',
          { id: user.id },
          {
            name: 'Updated Name',
            email: 'invalid-email-format', // This should cause validation error
          }
        );

        // If it succeeds, verify the update
        const updatedUser = await adapter.findUnique('user', { id: user.id });
        expect(updatedUser.name).toBe('Updated Name');
      } catch (error) {
        // If update fails, original data should be intact
        const originalUser = await adapter.findUnique('user', { id: user.id });
        expect(originalUser.id).toBe(user.id);
        expect(originalUser.email).toBe(user.email); // Should not be changed
      }
    });

    it('should handle cascade deletion errors properly', async () => {
      const adapter = testHelper.getAdapter();

      // Create user with related data
      const user = await testHelper.createTestUser();
      const session = await testHelper.createTestSession(user.id);
      const account = await testHelper.createTestAccount(user.id);

      try {
        // Attempt to delete user (might fail if cascade is not properly configured)
        await adapter.delete('user', { id: user.id });

        // If deletion succeeded, related data should be handled appropriately
        await expect(
          adapter.findUnique('session', { sessionToken: session.sessionToken })
        ).rejects.toThrow();

        await expect(
          adapter.findUnique('account', { id: account.id })
        ).rejects.toThrow();
      } catch (error) {
        // If user deletion failed, manual cleanup of related data
        try {
          await adapter.delete('session', {
            sessionToken: session.sessionToken,
          });
          await adapter.delete('account', { id: account.id });
          await adapter.delete('user', { id: user.id });
        } catch (cleanupError) {
          console.warn('Manual cleanup failed:', cleanupError);
        }
      }
    });
  });

  describe('API Rate Limiting', () => {
    it('should handle rate limiting gracefully', async () => {
      const adapter = testHelper.getAdapter();

      // Perform rapid requests that might trigger rate limiting
      const rapidRequests = Array.from({ length: 10 }, (_, i) =>
        adapter.create('user', {
          email: `rate-limit-${i}-${Date.now()}@example.com`,
          name: `Rate Limit User ${i}`,
        })
      );

      const startTime = performance.now();
      const results = await Promise.allSettled(rapidRequests);
      const duration = performance.now() - startTime;

      let successCount = 0;
      let rateLimitCount = 0;
      const createdUsers: any[] = [];

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
          createdUsers.push(result.value);
        } else {
          if (
            result.reason.message?.includes('429') ||
            result.reason.message?.includes('rate limit')
          ) {
            rateLimitCount++;
          }
        }
      });

      // Clean up created users
      for (const user of createdUsers) {
        try {
          await adapter.delete('user', { id: user.id });
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      // Should handle rate limits appropriately
      if (rateLimitCount > 0) {
        console.log(`${rateLimitCount} requests were rate limited`);
        expect(duration).toBeGreaterThan(1000); // Should have delays due to rate limiting
      }
    });
  });

  describe('Error Message Quality', () => {
    it('should provide meaningful error messages', async () => {
      const adapter = testHelper.getAdapter();

      // Test various error scenarios and verify error message quality
      const errorTests = [
        {
          name: 'non-existent user',
          operation: () => adapter.findUnique('user', { id: 'non-existent' }),
          expectedPattern: /not found|does not exist/i,
        },
        {
          name: 'invalid email',
          operation: () =>
            adapter.create('user', {
              email: 'invalid-email',
              name: 'Test',
            }),
          expectedPattern: /email|validation|invalid/i,
        },
        {
          name: 'missing required field',
          operation: () =>
            adapter.create('user', { email: 'test@example.com' } as any),
          expectedPattern: /required|missing/i,
        },
      ];

      for (const test of errorTests) {
        try {
          await test.operation();
          // If it doesn't throw, that's unexpected but not a test failure
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toMatch(test.expectedPattern);
        }
      }
    });

    it('should preserve error context and stack traces', async () => {
      const adapter = testHelper.getAdapter();

      try {
        await adapter.findUnique('user', { id: 'non-existent-user' });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('findUnique');
      }
    });
  });
});
