/**
 * HTTP Client Implementation with Retry Logic
 *
 * This class provides a robust HTTP client with built-in retry logic,
 * timeout handling, error mapping, and request/response logging.
 * It serves as the foundation for all HTTP communication with the Apso API.
 */

import type {
  HttpClient as IHttpClient,
  RequestConfig,
  Logger,
  HttpClientConfig,
  HttpInterceptors,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
  CircuitBreakerStats,
  ConnectionPoolStats,
} from '../types';

import { CircuitState } from '../types';

export class HttpClient implements IHttpClient {
  private readonly config: HttpClientConfig;
  private readonly logger: Logger | undefined;
  private readonly interceptors: HttpInterceptors;
  // private readonly observability: HttpObservabilityConfig;

  // Metrics properties
  private requestCount = 0;
  private successCount = 0;
  private errorCount = 0;
  private totalLatency = 0;
  private latencyBuckets: number[] = [];

  // Mock circuit breaker and connection pool for now
  private circuitBreaker = {
    getStats: (): CircuitBreakerStats => ({
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      requests: 0,
    }),
    reset: () => {},
  };

  private connectionPool = {
    getStats: (): ConnectionPoolStats => ({
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
      connectionErrors: 0,
      connectionTimeouts: 0,
      requestsWaiting: 0,
    }),
    destroy: () => {},
  };

  constructor(config?: HttpClientConfig) {
    this.config = {
      backend: 'fetch',
      timeout: 3000,
      observability: {
        enableMetrics: false,
        enableTracing: false,
        enableLogging: false,
        logLevel: 'info',
      },
      ...config,
    };

    this.logger = this.config.logger || undefined;
    this.interceptors = this.config.interceptors || {};
    // this.observability = this.config.observability || {
    //   enableMetrics: false,
    //   enableTracing: false,
    //   enableLogging: false,
    //   logLevel: 'info',
    // };
  }

  async request<T>(config: RequestConfig): Promise<T> {
    // 1. Validate request configuration
    if (!config.url) {
      throw new Error('URL is required for HTTP request');
    }

    // 2. Apply default timeout if not specified
    const timeout = config.timeout || this.config.timeout || 30000;

    // 3. Prepare fetch options
    const fetchOptions: RequestInit = {
      method: config.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    };

    if (config.body) {
      fetchOptions.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
    }

    // 4. Execute request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(config.url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 5. Parse and validate response
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        // Try to get more detailed error info from response body
        try {
          const errorBody = await response.text();
          if (errorBody) {
            const parsed = JSON.parse(errorBody);
            if (parsed.message) {
              errorMessage = parsed.message;
            } else if (parsed.error) {
              errorMessage = parsed.error;
            }
          }
        } catch (e) {
          // Ignore parsing errors, use default message
        }

        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json() as T;
      } else {
        return await response.text() as unknown as T;
      }
    } catch (error) {
      clearTimeout(timeoutId);

      // 6. Map HTTP errors to appropriate error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
      }
      throw new Error('Unknown error occurred during HTTP request');
    }
  }

  async get<T>(
    url: string,
    config?: Omit<RequestConfig, 'method' | 'url'>
  ): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url,
      ...config,
    });
  }

  async post<T>(
    url: string,
    data?: any,
    config?: Omit<RequestConfig, 'method' | 'url' | 'body'>
  ): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url,
      body: data,
      ...config,
    });
  }

  async put<T>(
    url: string,
    data?: any,
    config?: Omit<RequestConfig, 'method' | 'url' | 'body'>
  ): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url,
      body: data,
      ...config,
    });
  }

  async patch<T>(
    url: string,
    data?: any,
    config?: Omit<RequestConfig, 'method' | 'url' | 'body'>
  ): Promise<T> {
    return this.request<T>({
      method: 'PATCH',
      url,
      body: data,
      ...config,
    });
  }

  async delete<T>(
    url: string,
    config?: Omit<RequestConfig, 'method' | 'url'>
  ): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url,
      ...config,
    });
  }

  // =============================================================================
  // Batch Operations
  // =============================================================================

  async batchRequest<T>(_configs: RequestConfig[]): Promise<T[]> {
    // TODO: Implement batch request execution
    // 1. Execute requests with concurrency control
    // 2. Collect results and errors
    // 3. Return combined results
    throw new Error('Method not implemented');
  }

  // =============================================================================
  // Health Check
  // =============================================================================

  async healthCheck(url: string): Promise<boolean> {
    // TODO: Implement health check
    // 1. Make simple GET request to health endpoint
    // 2. Check response status and timing
    // 3. Return boolean result
    try {
      await this.get(url, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // =============================================================================
  // Interceptors - Implementation will be added when needed
  // =============================================================================

  // =============================================================================
  // Validation and Utilities - Implementation will be added when needed
  // =============================================================================

  // =============================================================================
  // Metrics and Observability - Implementation will be added when needed
  // =============================================================================

  // =============================================================================
  // Public Management Methods
  // =============================================================================

  /**
   * Get HTTP client metrics
   */
  getMetrics() {
    const latencySorted = [...this.latencyBuckets].sort((a, b) => a - b);

    return {
      requests: {
        total: this.requestCount,
        successful: this.successCount,
        failed: this.errorCount,
        successRate:
          this.requestCount > 0 ? this.successCount / this.requestCount : 0,
      },
      latency: {
        average:
          this.requestCount > 0 ? this.totalLatency / this.requestCount : 0,
        p50: this.getPercentile(latencySorted, 0.5),
        p95: this.getPercentile(latencySorted, 0.95),
        p99: this.getPercentile(latencySorted, 0.99),
      },
      circuitBreaker: this.circuitBreaker.getStats(),
      connectionPool: this.connectionPool.getStats(),
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    const clampedIndex = Math.max(0, Math.min(index, sortedArray.length - 1));
    return sortedArray[clampedIndex] || 0;
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.requestCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.totalLatency = 0;
    this.latencyBuckets.length = 0;
    this.circuitBreaker.reset();
    this.logger?.info('HttpClient metrics reset');
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    if (!this.interceptors.request) {
      this.interceptors.request = [];
    }
    this.interceptors.request.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    if (!this.interceptors.response) {
      this.interceptors.response = [];
    }
    this.interceptors.response.push(interceptor);
  }

  /**
   * Add error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    if (!this.interceptors.error) {
      this.interceptors.error = [];
    }
    this.interceptors.error.push(interceptor);
  }

  /**
   * Gracefully close the HTTP client
   */
  async close(): Promise<void> {
    this.connectionPool.destroy();
    this.logger?.info('HttpClient closed');
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create HttpClient with default configuration
 */
export function createHttpClient(config?: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}

/**
 * Create HttpClient optimized for high-throughput scenarios
 */
export function createHighThroughputHttpClient(
  config?: HttpClientConfig
): HttpClient {
  const defaultConfig: HttpClientConfig = {
    backend: 'fetch',
    timeout: 15000,
    connectionPool: {
      maxConnections: 200,
      maxConnectionsPerHost: 20,
      keepAlive: true,
      keepAliveTimeout: 120000,
      idleTimeout: 60000,
      enableHttp2: true,
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 0.3,
      recoveryTimeout: 15000,
      monitoringPeriod: 5000,
      minimumRequests: 3,
    },
    retryConfig: {
      maxRetries: 2,
      initialDelayMs: 50,
      maxDelayMs: 2000,
      retryableStatuses: [429, 500, 502, 503, 504],
    },
    observability: {
      enableMetrics: true,
      enableTracing: true,
      enableLogging: false, // Reduced logging for performance
      logLevel: 'warn',
    },
    ...config,
  };

  return new HttpClient(defaultConfig);
}

/**
 * Create HttpClient optimized for reliability over performance
 */
export function createReliableHttpClient(
  config?: HttpClientConfig
): HttpClient {
  const defaultConfig: HttpClientConfig = {
    backend: 'fetch',
    timeout: 60000,
    connectionPool: {
      maxConnections: 50,
      maxConnectionsPerHost: 5,
      keepAlive: true,
      keepAliveTimeout: 300000,
      idleTimeout: 120000,
      connectionTimeout: 30000,
      enableHttp2: false, // More reliable with HTTP/1.1
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 0.6,
      recoveryTimeout: 60000,
      monitoringPeriod: 30000,
      minimumRequests: 10,
    },
    retryConfig: {
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
    },
    observability: {
      enableMetrics: true,
      enableTracing: true,
      enableLogging: true,
      logLevel: 'debug',
    },
    ...config,
  };

  return new HttpClient(defaultConfig);
}
