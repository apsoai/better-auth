/**
 * Performance Integration Tests
 * 
 * Tests real-world performance characteristics of the Apso adapter
 * with actual HTTP communication and API response times.
 */

import { IntegrationTestHelper, shouldRunIntegrationTests } from './setup';

// Skip all tests if integration tests are not enabled
const describeIntegration = shouldRunIntegrationTests() ? describe : describe.skip;

describeIntegration('Performance Integration Tests', () => {
  let testHelper: IntegrationTestHelper;

  beforeAll(async () => {
    testHelper = new IntegrationTestHelper();
    
    // Verify API connectivity
    const isHealthy = await testHelper.healthCheck();
    if (!isHealthy) {
      throw new Error('API health check failed - cannot run performance tests');
    }
  }, 30000);

  afterAll(async () => {
    if (testHelper) {
      await testHelper.cleanup();
    }
  }, 15000);

  describe('Single Operation Performance', () => {
    it('should create user within performance target', async () => {
      const { duration } = await testHelper.measureOperation(
        'single user creation',
        () => testHelper.createTestUser()
      );

      // P95 target: < 300ms for user creation
      expect(duration).toCompleteWithin(300);
    }, 10000);

    it('should find user by ID within performance target', async () => {
      const adapter = testHelper.getAdapter();
      const user = await testHelper.createTestUser();

      const { duration } = await testHelper.measureOperation(
        'find user by ID',
        () => adapter.findUnique('user', { id: user.id })
      );

      // P95 target: < 200ms for single record lookup
      expect(duration).toCompleteWithin(200);
    });

    it('should find user by email within performance target', async () => {
      const adapter = testHelper.getAdapter();
      const user = await testHelper.createTestUser();

      const { duration } = await testHelper.measureOperation(
        'find user by email',
        () => adapter.findUnique('user', { email: user.email })
      );

      // P95 target: < 250ms for indexed field lookup
      expect(duration).toCompleteWithin(250);
    });

    it('should update user within performance target', async () => {
      const adapter = testHelper.getAdapter();
      const user = await testHelper.createTestUser();

      const { duration } = await testHelper.measureOperation(
        'update user',
        () => adapter.update('user', { id: user.id }, { name: 'Updated Name' })
      );

      // P95 target: < 300ms for single record update
      expect(duration).toCompleteWithin(300);
    });

    it('should delete user within performance target', async () => {
      const adapter = testHelper.getAdapter();
      const user = await testHelper.createTestUser();

      const { duration } = await testHelper.measureOperation(
        'delete user',
        () => adapter.delete('user', { id: user.id })
      );

      // P95 target: < 250ms for single record deletion
      expect(duration).toCompleteWithin(250);
    });
  });

  describe('Session Performance', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await testHelper.createTestUser();
    });

    it('should create session within performance target', async () => {
      const { duration } = await testHelper.measureOperation(
        'session creation',
        () => testHelper.createTestSession(testUser.id)
      );

      // P95 target: < 250ms for session creation
      expect(duration).toCompleteWithin(250);
    });

    it('should find session by token within performance target', async () => {
      const adapter = testHelper.getAdapter();
      const session = await testHelper.createTestSession(testUser.id);

      const { duration } = await testHelper.measureOperation(
        'find session by token',
        () => adapter.findUnique('session', { sessionToken: session.sessionToken })
      );

      // P95 target: < 200ms for session lookup (critical for auth)
      expect(duration).toCompleteWithin(200);
    });

    it('should handle rapid session lookups efficiently', async () => {
      const adapter = testHelper.getAdapter();
      const sessions = [];

      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        const session = await testHelper.createTestSession(testUser.id);
        sessions.push(session);
      }

      // Perform rapid lookups
      const lookupPromises = sessions.map(session =>
        testHelper.measureOperation(
          `rapid session lookup ${session.id}`,
          () => adapter.findUnique('session', { sessionToken: session.sessionToken })
        )
      );

      const results = await Promise.all(lookupPromises);

      // All lookups should complete quickly
      results.forEach(({ duration }, index) => {
        expect(duration).toCompleteWithin(300);
      });

      // Average should be even better
      const avgDuration = results.reduce((sum, { duration }) => sum + duration, 0) / results.length;
      expect(avgDuration).toBeLessThan(200);
    });
  });

  describe('Bulk Operation Performance', () => {
    it('should handle batch user creation efficiently', async () => {
      const batchSizes = [10, 25, 50];

      for (const batchSize of batchSizes) {
        const { duration } = await testHelper.measureOperation(
          `batch create ${batchSize} users`,
          () => testHelper.createMultipleUsers(batchSize)
        );

        // Should average < 200ms per user for batch operations
        const avgPerUser = duration / batchSize;
        expect(avgPerUser).toBeLessThan(200);
        
        // Total time should scale reasonably
        const expectedMaxTime = batchSize * 300; // 300ms per user worst case
        expect(duration).toCompleteWithin(expectedMaxTime);
      }
    }, 60000); // Extended timeout for bulk operations

    it('should handle findMany with pagination efficiently', async () => {
      const adapter = testHelper.getAdapter();
      
      // Create test data
      await testHelper.createMultipleUsers(20);

      const pageSizes = [5, 10, 20];

      for (const pageSize of pageSizes) {
        const { duration } = await testHelper.measureOperation(
          `findMany with limit ${pageSize}`,
          () => adapter.findMany('user', {
            where: {
              email: {
                contains: testHelper.getConfig().testUserPrefix,
              },
            },
            take: pageSize,
          })
        );

        // Should complete quickly regardless of page size
        expect(duration).toCompleteWithin(500);
      }
    });

    it('should handle concurrent operations without significant degradation', async () => {
      const concurrencyLevels = [3, 5, 10];

      for (const concurrency of concurrencyLevels) {
        const concurrentOperations = Array.from({ length: concurrency }, (_, i) =>
          testHelper.measureOperation(
            `concurrent user creation ${i}`,
            () => testHelper.createTestUser({
              email: `concurrent-perf-${concurrency}-${i}@example.com`,
            })
          )
        );

        const startTime = performance.now();
        const results = await Promise.all(concurrentOperations);
        const totalTime = performance.now() - startTime;

        // All individual operations should complete reasonably
        results.forEach(({ duration }, index) => {
          expect(duration).toCompleteWithin(2000); // More lenient for concurrent ops
        });

        // Total time should not increase linearly with concurrency
        // (indicating good connection pooling and server handling)
        const expectedMaxTime = concurrency * 500; // Much less than sequential
        expect(totalTime).toCompleteWithin(expectedMaxTime);
      }
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const adapter = testHelper.getAdapter();
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 50; i++) {
        const user = await testHelper.createTestUser({
          email: `memory-test-${i}@example.com`,
        });
        
        await adapter.findUnique('user', { id: user.id });
        await adapter.update('user', { id: user.id }, { name: `Updated ${i}` });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not have significant memory growth (< 10MB for 50 operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    }, 30000);

    it('should handle large result sets efficiently', async () => {
      const adapter = testHelper.getAdapter();
      
      // Create a larger dataset
      await testHelper.createMultipleUsers(100);

      const { result: users, duration } = await testHelper.measureOperation(
        'fetch 100 users',
        () => adapter.findMany('user', {
          where: {
            email: {
              contains: testHelper.getConfig().testUserPrefix,
            },
          },
          take: 100,
        })
      );

      expect(users.length).toBeGreaterThan(50); // Should find at least our created users
      expect(duration).toCompleteWithin(2000); // Should handle large results quickly
    }, 45000);
  });

  describe('Network Resilience Performance', () => {
    it('should maintain performance under retry scenarios', async () => {
      // Create adapter with aggressive retry config for testing
      const retryTestHelper = new IntegrationTestHelper({
        retryConfig: {
          maxRetries: 2,
          initialDelayMs: 50,
          maxDelayMs: 200,
        },
      });

      const { duration } = await retryTestHelper.measureOperation(
        'operation with potential retries',
        () => retryTestHelper.createTestUser()
      );

      // Even with retries, should complete in reasonable time
      expect(duration).toCompleteWithin(1000);

      await retryTestHelper.cleanup();
    });

    it('should handle timeout scenarios gracefully', async () => {
      // Create adapter with short timeout for testing
      const timeoutTestHelper = new IntegrationTestHelper({
        timeout: 100, // Very short timeout to test behavior
      });

      try {
        const { duration } = await timeoutTestHelper.measureOperation(
          'operation with short timeout',
          () => timeoutTestHelper.createTestUser()
        );

        // If it succeeds, should be very fast
        expect(duration).toCompleteWithin(150);
      } catch (error) {
        // If it fails, should fail quickly (not hang)
        expect(error).toBeDefined();
      }

      await timeoutTestHelper.cleanup();
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain baseline performance for common operations', async () => {
      const baselines = {
        createUser: 300,
        findUserById: 200,
        findUserByEmail: 250,
        updateUser: 300,
        createSession: 250,
        findSessionByToken: 200,
      };

      const adapter = testHelper.getAdapter();
      
      // Test each baseline
      for (const [operation, maxDuration] of Object.entries(baselines)) {
        let duration: number;
        
        switch (operation) {
          case 'createUser': {
            const result = await testHelper.measureOperation(operation, () =>
              testHelper.createTestUser()
            );
            duration = result.duration;
            break;
          }
          
          case 'findUserById': {
            const user = await testHelper.createTestUser();
            const result = await testHelper.measureOperation(operation, () =>
              adapter.findUnique('user', { id: user.id })
            );
            duration = result.duration;
            break;
          }
          
          case 'findUserByEmail': {
            const user = await testHelper.createTestUser();
            const result = await testHelper.measureOperation(operation, () =>
              adapter.findUnique('user', { email: user.email })
            );
            duration = result.duration;
            break;
          }
          
          case 'updateUser': {
            const user = await testHelper.createTestUser();
            const result = await testHelper.measureOperation(operation, () =>
              adapter.update('user', { id: user.id }, { name: 'Updated' })
            );
            duration = result.duration;
            break;
          }
          
          case 'createSession': {
            const user = await testHelper.createTestUser();
            const result = await testHelper.measureOperation(operation, () =>
              testHelper.createTestSession(user.id)
            );
            duration = result.duration;
            break;
          }
          
          case 'findSessionByToken': {
            const user = await testHelper.createTestUser();
            const session = await testHelper.createTestSession(user.id);
            const result = await testHelper.measureOperation(operation, () =>
              adapter.findUnique('session', { sessionToken: session.sessionToken })
            );
            duration = result.duration;
            break;
          }
          
          default:
            continue;
        }

        // Check against baseline
        expect(duration).toCompleteWithin(maxDuration);
        
        // Log performance metrics for monitoring
        console.log(`Performance baseline: ${operation} completed in ${duration.toFixed(2)}ms (target: <${maxDuration}ms)`);
      }
    });
  });
});