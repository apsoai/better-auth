/**
 * Integration tests for HttpClient
 * Tests real HTTP communication and integration with external services
 */

import { HttpClient, createHttpClient } from '../../src/client/HttpClient';
import { AdapterError, AdapterErrorCode } from '../../src/types';

// Only run integration tests if INTEGRATION_TESTS=true
const shouldRunTests = process.env.INTEGRATION_TESTS === 'true';

const testCondition = shouldRunTests ? describe : describe.skip;

testCondition('HttpClient Integration Tests', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient({
      timeout: 10000,
      observability: {
        enableMetrics: true,
        enableTracing: true,
        enableLogging: true,
        logLevel: 'debug',
      },
      retryConfig: {
        maxRetries: 2,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        retryableStatuses: [429, 500, 502, 503, 504],
      },
    });
  });

  afterEach(async () => {
    await client.close();
  });

  describe('Real HTTP Requests', () => {
    it('should make successful request to public API', async () => {
      // Using JSONPlaceholder as a reliable test API
      const response = await client.get<{ id: number; title: string }>('https://jsonplaceholder.typicode.com/posts/1');

      expect(response).toMatchObject({
        id: 1,
        title: expect.any(String),
        body: expect.any(String),
        userId: expect.any(Number),
      });
    });

    it('should handle 404 errors from real API', async () => {
      await expect(
        client.get('https://jsonplaceholder.typicode.com/posts/99999')
      ).rejects.toThrow(AdapterError);

      try {
        await client.get('https://jsonplaceholder.typicode.com/posts/99999');
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterError);
        expect((error as AdapterError).code).toBe(AdapterErrorCode.NOT_FOUND);
        expect((error as AdapterError).statusCode).toBe(404);
      }
    });

    it('should successfully POST to public API', async () => {
      const postData = {
        title: 'Integration Test Post',
        body: 'This is a test post from integration tests',
        userId: 1,
      };

      const response = await client.post('https://jsonplaceholder.typicode.com/posts', postData);

      expect(response).toMatchObject({
        ...postData,
        id: expect.any(Number),
      });
    });

    it('should handle network timeouts', async () => {
      const timeoutClient = new HttpClient({
        timeout: 100, // Very short timeout
        observability: { enableMetrics: false, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      // This should timeout (httpbin.org/delay/1 waits 1 second)
      await expect(
        timeoutClient.get('https://httpbin.org/delay/1')
      ).rejects.toThrow();

      await timeoutClient.close();
    }, 15000);

    it('should handle rate limiting (429)', async () => {
      // Note: This test depends on an external service that implements rate limiting
      // In a real scenario, you might use a service like httpbin.org or set up your own test server
      // For now, we'll skip this test unless a specific rate-limited endpoint is available
      
      if (!process.env.RATE_LIMITED_ENDPOINT) {
        console.log('Skipping rate limiting test - no RATE_LIMITED_ENDPOINT provided');
        return;
      }

      const rateLimitClient = new HttpClient({
        retryConfig: {
          maxRetries: 1,
          initialDelayMs: 50,
          maxDelayMs: 200,
          retryableStatuses: [429],
        },
        observability: { enableMetrics: true, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      // This may or may not throw depending on the rate limiting implementation
      try {
        await rateLimitClient.get(process.env.RATE_LIMITED_ENDPOINT);
      } catch (error) {
        if (error instanceof AdapterError && error.code === AdapterErrorCode.RATE_LIMIT) {
          expect(error.statusCode).toBe(429);
        }
      }

      await rateLimitClient.close();
    }, 30000);
  });

  describe('Connection Pooling Integration', () => {
    it('should reuse connections for multiple requests to same host', async () => {
      const poolClient = new HttpClient({
        connectionPool: {
          maxConnections: 10,
          maxConnectionsPerHost: 5,
          keepAlive: true,
          keepAliveTimeout: 30000,
        },
        observability: { enableMetrics: true, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      // Make multiple requests to the same host
      const promises = Array.from({ length: 5 }, (_, i) =>
        poolClient.get(`https://jsonplaceholder.typicode.com/posts/${i + 1}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toMatchObject({
          id: index + 1,
          title: expect.any(String),
        });
      });

      const stats = poolClient.getMetrics().connectionPool;
      expect(stats.totalConnections).toBeGreaterThan(0);

      await poolClient.close();
    }, 30000);

    it('should handle concurrent requests with connection limits', async () => {
      const limitedClient = new HttpClient({
        connectionPool: {
          maxConnections: 2,
          maxConnectionsPerHost: 1,
          connectionTimeout: 5000,
        },
        observability: { enableMetrics: true, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      // Make many concurrent requests - some may be queued due to connection limits
      const promises = Array.from({ length: 10 }, (_, i) =>
        limitedClient.get(`https://jsonplaceholder.typicode.com/posts/${i + 1}`)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      await limitedClient.close();
    }, 45000);
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit breaker on repeated failures', async () => {
      const circuitClient = new HttpClient({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 0.5,
          recoveryTimeout: 5000,
          monitoringPeriod: 1000,
          minimumRequests: 2,
        },
        retryConfig: {
          maxRetries: 0, // No retries to test circuit breaker more directly
          initialDelayMs: 10,
          maxDelayMs: 100,
          retryableStatuses: [],
        },
        observability: { enableMetrics: true, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      // Make requests to a non-existent endpoint to trigger failures
      const nonExistentUrl = 'https://definitely-does-not-exist-12345.com/api';

      await expect(circuitClient.get(nonExistentUrl)).rejects.toThrow();
      await expect(circuitClient.get(nonExistentUrl)).rejects.toThrow();

      // Circuit should now be open
      await expect(circuitClient.get(nonExistentUrl)).rejects.toThrow('Circuit breaker is OPEN');

      const metrics = circuitClient.getMetrics();
      expect(metrics.circuitBreaker.state).toBe('OPEN');

      await circuitClient.close();
    }, 30000);

    it('should recover from circuit breaker after timeout', async () => {
      const quickRecoveryClient = new HttpClient({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 0.5,
          recoveryTimeout: 1000, // 1 second recovery
          monitoringPeriod: 500,
          minimumRequests: 1,
        },
        retryConfig: {
          maxRetries: 0,
          initialDelayMs: 10,
          maxDelayMs: 100,
          retryableStatuses: [],
        },
        observability: { enableMetrics: true, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      // Trigger circuit breaker
      const badUrl = 'https://definitely-does-not-exist-12345.com/api';
      await expect(quickRecoveryClient.get(badUrl)).rejects.toThrow();

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Now try a good request to test recovery
      const response = await quickRecoveryClient.get('https://jsonplaceholder.typicode.com/posts/1');
      expect(response).toMatchObject({
        id: 1,
        title: expect.any(String),
      });

      await quickRecoveryClient.close();
    }, 30000);
  });

  describe('Performance and Load Testing', () => {
    it('should handle burst of requests', async () => {
      const burstClient = createHttpClient({
        connectionPool: {
          maxConnections: 20,
          maxConnectionsPerHost: 10,
        },
        retryConfig: {
          maxRetries: 1,
          initialDelayMs: 50,
          maxDelayMs: 500,
          retryableStatuses: [429, 500, 502, 503, 504],
        },
      });

      const startTime = Date.now();

      // Create a burst of 50 requests
      const promises = Array.from({ length: 50 }, (_, i) =>
        burstClient.get(`https://jsonplaceholder.typicode.com/posts/${(i % 100) + 1}`)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result).toMatchObject({
          id: expect.any(Number),
          title: expect.any(String),
        });
      });

      const totalTime = endTime - startTime;
      const averageTime = totalTime / 50;

      // Log performance metrics
      const metrics = burstClient.getMetrics();
      console.log('Burst test metrics:', {
        totalTime,
        averageTime,
        successRate: metrics.requests.successRate,
        averageLatency: metrics.latency.average,
        p95Latency: metrics.latency.p95,
      });

      expect(metrics.requests.successRate).toBeGreaterThan(0.9); // At least 90% success rate
      expect(averageTime).toBeLessThan(1000); // Average under 1 second per request

      await burstClient.close();
    }, 60000);

    it('should collect accurate metrics under load', async () => {
      const metricsClient = new HttpClient({
        observability: {
          enableMetrics: true,
          enableTracing: true,
          enableLogging: false, // Reduce logging for performance
          logLevel: 'error',
        },
      });

      // Make a series of requests
      const requestCount = 20;
      const promises = Array.from({ length: requestCount }, (_, i) =>
        metricsClient.get(`https://jsonplaceholder.typicode.com/posts/${(i % 10) + 1}`)
      );

      await Promise.all(promises);

      const metrics = metricsClient.getMetrics();

      expect(metrics.requests.total).toBe(requestCount);
      expect(metrics.requests.successful).toBe(requestCount);
      expect(metrics.requests.failed).toBe(0);
      expect(metrics.requests.successRate).toBe(1);
      expect(metrics.latency.average).toBeGreaterThan(0);
      expect(metrics.latency.p50).toBeGreaterThan(0);
      expect(metrics.latency.p95).toBeGreaterThan(0);
      expect(metrics.latency.p99).toBeGreaterThan(0);

      await metricsClient.close();
    }, 45000);
  });

  describe('Real Error Scenarios', () => {
    it('should handle DNS resolution failures', async () => {
      await expect(
        client.get('https://this-domain-definitely-does-not-exist-12345.com')
      ).rejects.toThrow(AdapterError);

      try {
        await client.get('https://this-domain-definitely-does-not-exist-12345.com');
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterError);
        expect((error as AdapterError).code).toBe(AdapterErrorCode.NETWORK_ERROR);
        expect((error as AdapterError).retryable).toBe(true);
      }
    }, 15000);

    it('should handle SSL/TLS errors', async () => {
      // Note: This test requires a server with invalid SSL certificate
      // For a complete integration test, you might set up a test server with self-signed cert
      
      if (!process.env.INVALID_SSL_ENDPOINT) {
        console.log('Skipping SSL error test - no INVALID_SSL_ENDPOINT provided');
        return;
      }

      await expect(
        client.get(process.env.INVALID_SSL_ENDPOINT)
      ).rejects.toThrow();
    }, 15000);
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with many requests', async () => {
      const memoryClient = new HttpClient({
        observability: { enableMetrics: true, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Make many requests to test for memory leaks
      for (let i = 0; i < 100; i++) {
        await memoryClient.get(`https://jsonplaceholder.typicode.com/posts/${(i % 10) + 1}`);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseKB = memoryIncrease / 1024;

      console.log(`Memory increase: ${memoryIncreaseKB.toFixed(2)} KB`);

      // Memory should not increase dramatically (allow some growth for legitimate caching)
      expect(memoryIncreaseKB).toBeLessThan(1024); // Less than 1MB increase

      await memoryClient.close();
    }, 120000);

    it('should clean up all resources on close', async () => {
      const resourceClient = new HttpClient({
        connectionPool: {
          maxConnections: 5,
          keepAlive: true,
        },
      });

      // Use the client
      await resourceClient.get('https://jsonplaceholder.typicode.com/posts/1');

      // Get initial metrics
      const beforeCloseMetrics = resourceClient.getMetrics();
      expect(beforeCloseMetrics.connectionPool.totalConnections).toBeGreaterThan(0);

      // Close should clean up resources
      await resourceClient.close();

      // Note: After close, we can't get metrics as the client should be unusable
      // This test primarily verifies that close() doesn't throw and completes
    });
  });
});

/**
 * Extended integration tests for specific scenarios
 * These tests require specific external services or configurations
 */
describe.skip('HttpClient Extended Integration Tests', () => {
  // These tests are skipped by default as they require specific setup

  it('should integrate with authentication services', async () => {
    // Test integration with OAuth, JWT, API keys, etc.
    // Requires actual auth service setup
  });

  it('should handle large file uploads/downloads', async () => {
    // Test streaming and large payload handling
    // Requires appropriate test endpoints
  });

  it('should work with WebSocket upgrades', async () => {
    // Test HTTP -> WebSocket upgrade scenarios
    // Requires WebSocket test server
  });

  it('should handle HTTP/2 server push', async () => {
    // Test HTTP/2 specific features
    // Requires HTTP/2 test server
  });
});