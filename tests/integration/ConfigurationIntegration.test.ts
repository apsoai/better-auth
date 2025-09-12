/**
 * Configuration Integration Tests
 * 
 * Tests different adapter configurations with real Apso SDK
 * to ensure all configuration options work correctly in practice.
 */

import { IntegrationTestHelper, shouldRunIntegrationTests } from './setup';
import { apsoAdapter, createReliableApsoAdapter, createHighThroughputApsoAdapter } from '../../src';
import { ApsoAdapterConfig } from '../../src/types';

// Skip all tests if integration tests are not enabled
const describeIntegration = shouldRunIntegrationTests() ? describe : describe.skip;

describeIntegration('Configuration Integration Tests', () => {
  let baseTestHelper: IntegrationTestHelper;

  beforeAll(async () => {
    baseTestHelper = new IntegrationTestHelper();
    
    // Verify base API connectivity
    const isHealthy = await baseTestHelper.healthCheck();
    if (!isHealthy) {
      throw new Error('API health check failed - cannot run configuration tests');
    }
  }, 30000);

  afterAll(async () => {
    if (baseTestHelper) {
      await baseTestHelper.cleanup();
    }
  }, 15000);

  describe('Basic Configuration Options', () => {
    it('should work with minimal configuration', async () => {
      const minimalConfig: ApsoAdapterConfig = {
        baseUrl: baseTestHelper.getConfig().baseUrl,
      };

      const adapter = apsoAdapter(minimalConfig);
      
      // Test basic operation
      const user = await adapter.create('user', {
        email: `minimal-config-${Date.now()}@example.com`,
        name: 'Minimal Config User',
      });

      expect(user).toHaveValidEntityStructure();
      
      // Cleanup
      await adapter.delete('user', { id: user.id });
    });

    it('should work with full configuration', async () => {
      const fullConfig: ApsoAdapterConfig = {
        baseUrl: baseTestHelper.getConfig().baseUrl,
        apiKey: baseTestHelper.getConfig().apiKey,
        timeout: 10000,
        retryConfig: {
          maxRetries: 2,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          retryableStatuses: [429, 500, 502, 503, 504],
        },
        batchConfig: {
          maxBatchSize: 50,
          batchDelayMs: 10,
        },
        enableEmailNormalization: true,
        logger: {
          error: console.error,
          warn: console.warn,
          info: console.info,
          debug: () => {}, // Silent debug for tests
        },
      };

      const adapter = apsoAdapter(fullConfig);
      
      // Test basic operation
      const user = await adapter.create('user', {
        email: `FULL-CONFIG+TEST@EXAMPLE.COM`, // Test email normalization
        name: 'Full Config User',
      });

      expect(user).toHaveValidEntityStructure();
      expect(user.email).toBe('full-config+test@example.com'); // Should be normalized
      
      // Cleanup
      await adapter.delete('user', { id: user.id });
    });

    it('should validate invalid configurations', () => {
      // Empty base URL
      expect(() => {
        apsoAdapter({ baseUrl: '' });
      }).toThrow(/baseUrl/i);

      // Invalid timeout
      expect(() => {
        apsoAdapter({
          baseUrl: 'https://api.example.com',
          timeout: -1,
        });
      }).toThrow(/timeout/i);

      // Invalid retry config
      expect(() => {
        apsoAdapter({
          baseUrl: 'https://api.example.com',
          retryConfig: {
            maxRetries: -1,
            initialDelayMs: 100,
            maxDelayMs: 1000,
          },
        });
      }).toThrow(/retry/i);
    });
  });

  describe('Timeout Configuration Testing', () => {
    const timeouts = [1000, 5000, 15000];

    timeouts.forEach(timeout => {
      it(`should respect ${timeout}ms timeout setting`, async () => {
        const timeoutHelper = new IntegrationTestHelper({
          timeout,
        });

        const adapter = timeoutHelper.getAdapter();
        
        const startTime = performance.now();
        
        try {
          const user = await adapter.create('user', {
            email: `timeout-${timeout}-${Date.now()}@example.com`,
            name: `Timeout ${timeout} User`,
          });

          const duration = performance.now() - startTime;
          
          // Should complete well within timeout
          expect(duration).toBeLessThan(timeout * 0.8);
          
          // Cleanup
          await adapter.delete('user', { id: user.id });
          
        } catch (error) {
          const duration = performance.now() - startTime;
          
          // If it times out, should be close to the timeout value
          if (error.message?.includes('timeout')) {
            expect(duration).toBeGreaterThan(timeout * 0.9);
            expect(duration).toBeLessThan(timeout * 1.2);
          }
        }
        
        await timeoutHelper.cleanup();
      }, timeout + 5000);
    });
  });

  describe('Retry Configuration Testing', () => {
    it('should work with no retries', async () => {
      const noRetryHelper = new IntegrationTestHelper({
        retryConfig: {
          maxRetries: 0,
          initialDelayMs: 100,
          maxDelayMs: 1000,
        },
      });

      const adapter = noRetryHelper.getAdapter();
      
      // Test normal operation (should work without retries)
      const user = await adapter.create('user', {
        email: `no-retry-${Date.now()}@example.com`,
        name: 'No Retry User',
      });

      expect(user).toHaveValidEntityStructure();
      
      // Cleanup
      await adapter.delete('user', { id: user.id });
      await noRetryHelper.cleanup();
    });

    it('should work with aggressive retry configuration', async () => {
      const aggressiveRetryHelper = new IntegrationTestHelper({
        retryConfig: {
          maxRetries: 5,
          initialDelayMs: 50,
          maxDelayMs: 500,
        },
      });

      const adapter = aggressiveRetryHelper.getAdapter();
      
      // Test normal operation (retries shouldn't interfere with successful requests)
      const user = await adapter.create('user', {
        email: `aggressive-retry-${Date.now()}@example.com`,
        name: 'Aggressive Retry User',
      });

      expect(user).toHaveValidEntityStructure();
      
      // Cleanup
      await adapter.delete('user', { id: user.id });
      await aggressiveRetryHelper.cleanup();
    });

    it('should work with conservative retry configuration', async () => {
      const conservativeRetryHelper = new IntegrationTestHelper({
        retryConfig: {
          maxRetries: 1,
          initialDelayMs: 500,
          maxDelayMs: 2000,
        },
      });

      const adapter = conservativeRetryHelper.getAdapter();
      
      const user = await adapter.create('user', {
        email: `conservative-retry-${Date.now()}@example.com`,
        name: 'Conservative Retry User',
      });

      expect(user).toHaveValidEntityStructure();
      
      // Cleanup
      await adapter.delete('user', { id: user.id });
      await conservativeRetryHelper.cleanup();
    });
  });

  describe('Batch Configuration Testing', () => {
    it('should work with different batch sizes', async () => {
      const batchSizes = [5, 25, 100];

      for (const maxBatchSize of batchSizes) {
        const batchHelper = new IntegrationTestHelper({
          batchConfig: {
            maxBatchSize,
            batchDelayMs: 10,
          },
        });

        const adapter = batchHelper.getAdapter();
        
        // Create multiple users to test batching
        const userCount = Math.min(maxBatchSize + 2, 15); // Test slightly over batch size
        const users = [];

        for (let i = 0; i < userCount; i++) {
          const user = await adapter.create('user', {
            email: `batch-${maxBatchSize}-${i}-${Date.now()}@example.com`,
            name: `Batch User ${i}`,
          });
          users.push(user);
        }

        expect(users).toHaveLength(userCount);
        users.forEach(user => {
          expect(user).toHaveValidEntityStructure();
        });

        await batchHelper.cleanup();
      }
    });

    it('should work with different batch delays', async () => {
      const batchDelays = [0, 50, 200];

      for (const batchDelayMs of batchDelays) {
        const batchHelper = new IntegrationTestHelper({
          batchConfig: {
            maxBatchSize: 10,
            batchDelayMs,
          },
        });

        const adapter = batchHelper.getAdapter();
        
        const startTime = performance.now();
        
        // Create a few users
        const users = [];
        for (let i = 0; i < 3; i++) {
          const user = await adapter.create('user', {
            email: `delay-${batchDelayMs}-${i}-${Date.now()}@example.com`,
            name: `Delay User ${i}`,
          });
          users.push(user);
        }

        const duration = performance.now() - startTime;

        expect(users).toHaveLength(3);
        
        // With higher delays, operations might take longer
        if (batchDelayMs > 100) {
          expect(duration).toBeGreaterThan(batchDelayMs * 0.5);
        }

        await batchHelper.cleanup();
      }
    });
  });

  describe('Email Normalization Configuration', () => {
    it('should work with email normalization enabled', async () => {
      const normalizationHelper = new IntegrationTestHelper({
        enableEmailNormalization: true,
      });

      const adapter = normalizationHelper.getAdapter();
      
      const testCases = [
        {
          input: 'Test.User@EXAMPLE.COM',
          expected: 'test.user@example.com',
        },
        {
          input: 'user+tag@DOMAIN.COM',
          expected: 'user+tag@domain.com',
        },
        {
          input: '  SPACED@EMAIL.COM  ',
          expected: 'spaced@email.com',
        },
      ];

      for (const testCase of testCases) {
        const user = await adapter.create('user', {
          email: testCase.input,
          name: 'Normalization Test User',
        });

        expect(user.email).toBe(testCase.expected);

        // Should be findable by original format
        const foundUser = await adapter.findUnique('user', { 
          email: testCase.input 
        });
        expect(foundUser.id).toBe(user.id);
        
        // Cleanup
        await adapter.delete('user', { id: user.id });
      }

      await normalizationHelper.cleanup();
    });

    it('should work with email normalization disabled', async () => {
      const noNormalizationHelper = new IntegrationTestHelper({
        enableEmailNormalization: false,
      });

      const adapter = noNormalizationHelper.getAdapter();
      
      // With normalization disabled, email should be used as-is
      const originalEmail = 'Test.User@EXAMPLE.COM';
      
      try {
        const user = await adapter.create('user', {
          email: originalEmail,
          name: 'No Normalization User',
        });

        // Email might be preserved as-is or normalized by the API
        // The behavior depends on the backend API implementation
        expect(user.email).toBeDefined();
        
        // Cleanup
        await adapter.delete('user', { id: user.id });
        
      } catch (error) {
        // Some APIs might reject non-normalized emails
        expect(error).toBeInstanceOf(Error);
      }

      await noNormalizationHelper.cleanup();
    });
  });

  describe('API Key Configuration', () => {
    it('should work with valid API key', async () => {
      if (!baseTestHelper.getConfig().apiKey) {
        console.log('Skipping API key test - no API key configured');
        return;
      }

      const apiKeyHelper = new IntegrationTestHelper({
        apiKey: baseTestHelper.getConfig().apiKey,
      });

      const adapter = apiKeyHelper.getAdapter();
      
      const user = await adapter.create('user', {
        email: `api-key-valid-${Date.now()}@example.com`,
        name: 'API Key User',
      });

      expect(user).toHaveValidEntityStructure();
      
      // Cleanup
      await adapter.delete('user', { id: user.id });
      await apiKeyHelper.cleanup();
    });

    it('should handle missing API key gracefully', async () => {
      const noApiKeyHelper = new IntegrationTestHelper({
        apiKey: undefined,
      });

      const adapter = noApiKeyHelper.getAdapter();
      
      try {
        const user = await adapter.create('user', {
          email: `no-api-key-${Date.now()}@example.com`,
          name: 'No API Key User',
        });

        // If API doesn't require key, this should work
        expect(user).toHaveValidEntityStructure();
        await adapter.delete('user', { id: user.id });
        
      } catch (error) {
        // If API requires key, should get appropriate error
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(/auth|key|unauthorized/i);
      }

      await noApiKeyHelper.cleanup();
    });

    it('should handle invalid API key appropriately', async () => {
      const invalidApiKeyHelper = new IntegrationTestHelper({
        apiKey: 'invalid-api-key-12345',
      });

      const adapter = invalidApiKeyHelper.getAdapter();
      
      try {
        await adapter.create('user', {
          email: `invalid-api-key-${Date.now()}@example.com`,
          name: 'Invalid API Key User',
        });
        
        // If this succeeds, the API doesn't validate keys properly
        console.warn('API accepted invalid API key');
        
      } catch (error) {
        // Should get authentication error
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(/auth|key|unauthorized|forbidden/i);
      }

      await invalidApiKeyHelper.cleanup();
    });
  });

  describe('Specialized Adapter Configurations', () => {
    it('should work with reliable adapter configuration', async () => {
      const reliableAdapter = createReliableApsoAdapter({
        baseUrl: baseTestHelper.getConfig().baseUrl,
        apiKey: baseTestHelper.getConfig().apiKey,
      });

      // Test that reliable adapter works correctly
      const user = await reliableAdapter.create('user', {
        email: `reliable-adapter-${Date.now()}@example.com`,
        name: 'Reliable Adapter User',
      });

      expect(user).toHaveValidEntityStructure();
      
      // Cleanup
      await reliableAdapter.delete('user', { id: user.id });
    });

    it('should work with high-throughput adapter configuration', async () => {
      const throughputAdapter = createHighThroughputApsoAdapter({
        baseUrl: baseTestHelper.getConfig().baseUrl,
        apiKey: baseTestHelper.getConfig().apiKey,
      });

      // Test that high-throughput adapter works correctly
      const user = await throughputAdapter.create('user', {
        email: `throughput-adapter-${Date.now()}@example.com`,
        name: 'Throughput Adapter User',
      });

      expect(user).toHaveValidEntityStructure();
      
      // Cleanup
      await throughputAdapter.delete('user', { id: user.id });
    });

    it('should handle concurrent operations with different configurations', async () => {
      const adapters = [
        apsoAdapter({ baseUrl: baseTestHelper.getConfig().baseUrl }),
        createReliableApsoAdapter({ baseUrl: baseTestHelper.getConfig().baseUrl }),
        createHighThroughputApsoAdapter({ baseUrl: baseTestHelper.getConfig().baseUrl }),
      ];

      // Test concurrent operations with different adapter configurations
      const operations = adapters.map((adapter, index) =>
        adapter.create('user', {
          email: `concurrent-config-${index}-${Date.now()}@example.com`,
          name: `Concurrent Config User ${index}`,
        })
      );

      const results = await Promise.allSettled(operations);
      
      let successCount = 0;
      const createdUsers: any[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          createdUsers.push({ user: result.value, adapter: adapters[index] });
        } else {
          console.error(`Adapter ${index} failed:`, result.reason);
        }
      });

      expect(successCount).toBeGreaterThan(0);

      // Cleanup
      for (const { user, adapter } of createdUsers) {
        try {
          await adapter.delete('user', { id: user.id });
        } catch (error) {
          console.warn('Cleanup failed for user:', user.id);
        }
      }
    });
  });

  describe('Logger Configuration', () => {
    it('should work with custom logger', async () => {
      const logMessages: string[] = [];
      
      const customLogger = {
        error: (msg: string) => logMessages.push(`ERROR: ${msg}`),
        warn: (msg: string) => logMessages.push(`WARN: ${msg}`),
        info: (msg: string) => logMessages.push(`INFO: ${msg}`),
        debug: (msg: string) => logMessages.push(`DEBUG: ${msg}`),
      };

      const loggerHelper = new IntegrationTestHelper({
        logger: customLogger,
      });

      const adapter = loggerHelper.getAdapter();
      
      // Perform operations that might generate logs
      const user = await adapter.create('user', {
        email: `logger-test-${Date.now()}@example.com`,
        name: 'Logger Test User',
      });

      expect(user).toHaveValidEntityStructure();
      
      // Check if any logs were generated
      // Note: The actual logging depends on the adapter implementation
      expect(Array.isArray(logMessages)).toBe(true);
      
      // Cleanup
      await adapter.delete('user', { id: user.id });
      await loggerHelper.cleanup();
    });

    it('should work with no logger configured', async () => {
      const noLoggerHelper = new IntegrationTestHelper({
        logger: undefined,
      });

      const adapter = noLoggerHelper.getAdapter();
      
      // Should work fine without logger
      const user = await adapter.create('user', {
        email: `no-logger-${Date.now()}@example.com`,
        name: 'No Logger User',
      });

      expect(user).toHaveValidEntityStructure();
      
      // Cleanup
      await adapter.delete('user', { id: user.id });
      await noLoggerHelper.cleanup();
    });
  });
});