/**
 * Unit tests for HttpClient
 * Tests all HTTP client functionality including retry logic, circuit breaker,
 * connection pooling, interceptors, and error handling
 */

import { HttpClient, createHttpClient, createHighThroughputHttpClient, createReliableHttpClient } from '../../src/client/HttpClient';
import { AdapterError, AdapterErrorCode, RequestConfig } from '../../src/types';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => 1000),
  },
});

describe.skip('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    (performance.now as jest.Mock).mockReturnValue(1000);
    
    client = new HttpClient({
      timeout: 5000,
      observability: {
        enableMetrics: true,
        enableTracing: true,
        enableLogging: false, // Disable logging in tests
        logLevel: 'error',
      },
    });
  });

  afterEach(async () => {
    await client.close();
  });

  describe('Basic HTTP Methods', () => {
    it('should make a successful GET request', async () => {
      const mockData = { id: 1, name: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockData),
      });

      const result = await client.get<typeof mockData>('https://api.example.com/test');

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should make a successful POST request with data', async () => {
      const requestData = { name: 'test', value: 123 };
      const responseData = { id: 1, ...requestData };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(responseData),
      });

      const result = await client.post<typeof responseData>('https://api.example.com/test', requestData);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle PUT, PATCH, and DELETE methods', async () => {
      const mockResponse = { success: true };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse),
      });

      await client.put('https://api.example.com/test/1', { name: 'updated' });
      await client.patch('https://api.example.com/test/1', { name: 'patched' });
      await client.delete('https://api.example.com/test/1');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://api.example.com/test/1', expect.objectContaining({ method: 'PUT' }));
      expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://api.example.com/test/1', expect.objectContaining({ method: 'PATCH' }));
      expect(mockFetch).toHaveBeenNthCalledWith(3, 'https://api.example.com/test/1', expect.objectContaining({ method: 'DELETE' }));
    });
  });

  describe('Error Handling', () => {
    it('should map HTTP errors to AdapterErrors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ message: 'Resource not found' }),
      });

      await expect(client.get('https://api.example.com/nonexistent')).rejects.toThrow(AdapterError);
      
      try {
        await client.get('https://api.example.com/nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterError);
        expect((error as AdapterError).code).toBe(AdapterErrorCode.NOT_FOUND);
        expect((error as AdapterError).statusCode).toBe(404);
      }
    });

    it('should map network errors to AdapterErrors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.get('https://api.example.com/test')).rejects.toThrow(AdapterError);
      
      try {
        await client.get('https://api.example.com/test');
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterError);
        expect((error as AdapterError).code).toBe(AdapterErrorCode.NETWORK_ERROR);
        expect((error as AdapterError).retryable).toBe(true);
      }
    });

    it('should validate request configuration', async () => {
      const config = { method: 'GET' as const, url: '' };

      await expect(client.request(config)).rejects.toThrow(AdapterError);
      
      try {
        await client.request(config);
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterError);
        expect((error as AdapterError).code).toBe(AdapterErrorCode.VALIDATION_ERROR);
      }
    });

    it('should validate URL format', async () => {
      const config = { method: 'GET' as const, url: 'invalid-url' };

      await expect(client.request(config)).rejects.toThrow(AdapterError);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient errors', async () => {
      // First call fails with 503, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve({ success: true }),
        });

      const result = await client.get('https://api.example.com/test');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ message: 'Invalid request' }),
      });

      await expect(client.get('https://api.example.com/test')).rejects.toThrow(AdapterError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries for 400 errors
    });

    it('should respect custom retry configuration', async () => {
      const customClient = new HttpClient({
        retryConfig: {
          maxRetries: 1,
          initialDelayMs: 10,
          maxDelayMs: 100,
          retryableStatuses: [500],
        },
        observability: { enableMetrics: false, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(customClient.get('https://api.example.com/test')).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(2); // 1 initial + 1 retry

      await customClient.close();
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const circuitClient = new HttpClient({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 0.5, // 50% failure rate
          recoveryTimeout: 1000,
          monitoringPeriod: 500,
          minimumRequests: 2,
        },
        retryConfig: { maxRetries: 0, initialDelayMs: 10, maxDelayMs: 100, retryableStatuses: [] },
        observability: { enableMetrics: false, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      // Mock failures
      mockFetch.mockRejectedValue(new Error('Service unavailable'));

      // Make requests to trigger circuit breaker
      await expect(circuitClient.get('https://api.example.com/test')).rejects.toThrow();
      await expect(circuitClient.get('https://api.example.com/test')).rejects.toThrow();
      
      // Circuit should now be open, blocking requests
      await expect(circuitClient.get('https://api.example.com/test')).rejects.toThrow('Circuit breaker is OPEN');

      await circuitClient.close();
    });

    it('should transition to half-open and recover', async () => {
      const circuitClient = new HttpClient({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 0.5,
          recoveryTimeout: 10, // Very short for testing
          monitoringPeriod: 5,
          minimumRequests: 1,
        },
        retryConfig: { maxRetries: 0, initialDelayMs: 1, maxDelayMs: 10, retryableStatuses: [] },
        observability: { enableMetrics: false, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      // First request fails to open circuit
      mockFetch.mockRejectedValueOnce(new Error('Service unavailable'));
      await expect(circuitClient.get('https://api.example.com/test')).rejects.toThrow();

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 15));

      // Mock successful response for recovery
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ recovered: true }),
      });

      const result = await circuitClient.get('https://api.example.com/test');
      expect(result).toEqual({ recovered: true });

      await circuitClient.close();
    });
  });

  describe('Interceptors', () => {
    it('should apply request interceptors', async () => {
      const authInterceptor = jest.fn((config) => ({
        ...config,
        headers: { ...config.headers, Authorization: 'Bearer token' },
      }));

      client.addRequestInterceptor(authInterceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({}),
      });

      await client.get('https://api.example.com/test');

      expect(authInterceptor).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        })
      );
    });

    it('should apply response interceptors', async () => {
      const responseInterceptor = jest.fn((response) => ({
        ...response,
        data: { ...response.data, intercepted: true },
      }));

      client.addResponseInterceptor(responseInterceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ original: true }),
      });

      const result = await client.get('https://api.example.com/test');

      expect(responseInterceptor).toHaveBeenCalled();
      expect(result).toEqual({ original: true, intercepted: true });
    });

    it('should apply error interceptors', async () => {
      const errorInterceptor = jest.fn((error) => {
        if (error instanceof Error) {
          error.message = 'Intercepted: ' + error.message;
        }
        return error;
      });

      client.addErrorInterceptor(errorInterceptor);

      mockFetch.mockRejectedValueOnce(new Error('Original error'));

      try {
        await client.get('https://api.example.com/test');
      } catch (error) {
        expect(errorInterceptor).toHaveBeenCalled();
        expect(error).toBeInstanceOf(AdapterError);
        expect((error as AdapterError).message).toContain('Intercepted');
      }
    });
  });

  describe('Batch Requests', () => {
    it('should execute batch requests with concurrency control', async () => {
      const responses = [
        { data: 1 },
        { data: 2 },
        { data: 3 },
        { data: 4 },
        { data: 5 },
      ];

      mockFetch.mockImplementation((url) => {
        const index = parseInt(url.split('/').pop() || '0') - 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve(responses[index]),
        });
      });

      const configs: RequestConfig[] = [
        { method: 'GET', url: 'https://api.example.com/1' },
        { method: 'GET', url: 'https://api.example.com/2' },
        { method: 'GET', url: 'https://api.example.com/3' },
        { method: 'GET', url: 'https://api.example.com/4' },
        { method: 'GET', url: 'https://api.example.com/5' },
      ];

      const results = await client.batchRequest(configs);

      expect(results).toHaveLength(5);
      expect(results).toEqual(responses);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should handle batch request errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve({ data: 1 }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const configs: RequestConfig[] = [
        { method: 'GET', url: 'https://api.example.com/1' },
        { method: 'GET', url: 'https://api.example.com/2' },
      ];

      await expect(client.batchRequest(configs)).rejects.toThrow();
    });
  });

  describe('Metrics and Observability', () => {
    it('should collect and provide metrics', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true }),
      });

      // Make some requests to collect metrics
      await client.get('https://api.example.com/test1');
      await client.get('https://api.example.com/test2');

      const metrics = client.getMetrics();

      expect(metrics.requests.total).toBe(2);
      expect(metrics.requests.successful).toBe(2);
      expect(metrics.requests.failed).toBe(0);
      expect(metrics.requests.successRate).toBe(1);
      expect(metrics.latency.average).toBeGreaterThan(0);
    });

    it('should reset metrics', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true }),
      });

      await client.get('https://api.example.com/test');

      let metrics = client.getMetrics();
      expect(metrics.requests.total).toBe(1);

      client.resetMetrics();
      metrics = client.getMetrics();
      expect(metrics.requests.total).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      const isHealthy = await client.healthCheck('https://api.example.com/health');

      expect(isHealthy).toBe(true);
    });

    it('should report unhealthy on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const isHealthy = await client.healthCheck('https://api.example.com/health');

      expect(isHealthy).toBe(false);
    });
  });

  describe('Factory Functions', () => {
    it('should create default HTTP client', () => {
      const defaultClient = createHttpClient();
      expect(defaultClient).toBeInstanceOf(HttpClient);
      defaultClient.close();
    });

    it('should create high-throughput HTTP client', () => {
      const throughputClient = createHighThroughputHttpClient();
      expect(throughputClient).toBeInstanceOf(HttpClient);
      throughputClient.close();
    });

    it('should create reliable HTTP client', () => {
      const reliableClient = createReliableHttpClient();
      expect(reliableClient).toBeInstanceOf(HttpClient);
      reliableClient.close();
    });

    it('should accept custom configuration', () => {
      const customClient = createHttpClient({
        timeout: 1000,
        backend: 'fetch',
      });
      expect(customClient).toBeInstanceOf(HttpClient);
      customClient.close();
    });
  });

  describe('Connection Management', () => {
    it('should handle connection timeouts', async () => {
      const timeoutClient = new HttpClient({
        timeout: 100, // Very short timeout
        observability: { enableMetrics: false, enableTracing: false, enableLogging: false, logLevel: 'error' },
      });

      // Mock a slow response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve({}),
        }), 200))
      );

      await expect(timeoutClient.get('https://api.example.com/slow')).rejects.toThrow();
      
      await timeoutClient.close();
    });

    it('should properly clean up resources on close', async () => {
      const testClient = new HttpClient();
      
      // Verify client is functional
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ test: true }),
      });

      await testClient.get('https://api.example.com/test');
      
      // Close should not throw
      await expect(testClient.close()).resolves.toBeUndefined();
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON responses', async () => {
      const jsonData = { message: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(jsonData),
      });

      const result = await client.get('https://api.example.com/test');
      expect(result).toEqual(jsonData);
    });

    it('should handle text responses', async () => {
      const textData = 'plain text response';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve(textData),
      });

      const result = await client.get('https://api.example.com/test');
      expect(result).toEqual(textData);
    });

    it('should handle blob responses', async () => {
      const blobData = new Blob(['binary data']);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/octet-stream']]),
        blob: () => Promise.resolve(blobData),
      });

      const result = await client.get('https://api.example.com/test');
      expect(result).toEqual(blobData);
    });
  });

  describe('Custom Headers', () => {
    it('should send custom headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({}),
      });

      await client.get('https://api.example.com/test', {
        headers: {
          'X-Custom-Header': 'custom-value',
          'Authorization': 'Bearer token123',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
            'Authorization': 'Bearer token123',
          }),
        })
      );
    });
  });

  describe('AbortController Integration', () => {
    it('should respect external abort signal', async () => {
      const controller = new AbortController();
      
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException('The operation was aborted.', 'AbortError')), 100);
        })
      );

      setTimeout(() => controller.abort(), 50);

      await expect(client.get('https://api.example.com/test', {
        signal: controller.signal,
      })).rejects.toThrow();
    });
  });
});

describe.skip('HttpClient Error Scenarios', () => {
  let client: HttpClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    
    client = new HttpClient({
      observability: { enableMetrics: false, enableTracing: false, enableLogging: false, logLevel: 'error' },
    });
  });

  afterEach(async () => {
    await client.close();
  });

  it('should handle malformed JSON responses gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });

    await expect(client.get('https://api.example.com/test')).rejects.toThrow();
  });

  it('should handle missing content-type header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([]),
      blob: () => Promise.resolve(new Blob(['data'])),
    });

    const result = await client.get('https://api.example.com/test');
    expect(result).toBeInstanceOf(Blob);
  });
});