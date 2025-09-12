/**
 * Mock HttpClient for Conformance Tests
 * 
 * This mock HttpClient implementation provides realistic behavior for testing
 * the adapter without making actual HTTP requests.
 */

import type { 
  HttpClient as IHttpClient, 
  RequestConfig,
  HttpClientConfig,
  HttpInterceptors,
  Logger,
  CircuitBreakerStats,
  ConnectionPoolStats,
} from '../../../src/types';
import { CircuitState } from '../../../src/types';
import { MockDataStore } from '../../unit/__mocks__/apsoSdk';

export class MockHttpClient implements IHttpClient {
  private mockStore: MockDataStore;

  // Properties to match the real HttpClient interface
  public readonly config: HttpClientConfig;
  public readonly logger: Logger | undefined;
  public readonly interceptors: HttpInterceptors;
  
  // Metrics properties
  public requestCount = 0;
  public successCount = 0;
  public errorCount = 0;
  public totalLatency = 0;
  public latencyBuckets: number[] = [];
  
  // Mock circuit breaker and connection pool
  public circuitBreaker = {
    getStats: (): CircuitBreakerStats => ({
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      requests: 0,
    }),
    reset: () => {}
  };
  
  public connectionPool = {
    getStats: (): ConnectionPoolStats => ({
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
      connectionErrors: 0,
      connectionTimeouts: 0,
      requestsWaiting: 0,
    }),
    destroy: () => {}
  };

  constructor(config?: HttpClientConfig) {
    this.mockStore = MockDataStore.getInstance();
    this.config = {
      backend: 'fetch' as const,
      timeout: 3000,
      observability: {
        enableMetrics: false,
        enableTracing: false,
        enableLogging: false,
        logLevel: 'info' as const,
      },
      ...config,
    };
    
    this.logger = this.config.logger || undefined;
    this.interceptors = this.config.interceptors || {};
  }

  async request<T>(config: RequestConfig): Promise<T> {
    const { method, url, body } = config;
    
    // Parse URL to extract resource information
    const urlObj = new URL(url, 'https://api.example.com');
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    
    // Handle different URL patterns:
    // Pattern 1: /users, /sessions, /verificationtokens
    // Pattern 2: /api/users, /api/sessions, /api/verificationtokens
    // Pattern 3: /users/123, /sessions/123 (with ID)
    
    let entityType: string;
    let id: string | undefined;
    
    if (pathParts.length === 1) {
      // Pattern 1: /users
      entityType = pathParts[0]!;
    } else if (pathParts.length === 2) {
      if (pathParts[0] === 'api') {
        // Pattern 2: /api/users
        entityType = pathParts[1]!;
      } else {
        // Pattern 3: /users/123
        entityType = pathParts[0]!;
        id = pathParts[1];
      }
    } else if (pathParts.length === 3 && pathParts[0] === 'api') {
      // Pattern: /api/users/123
      entityType = pathParts[1]!;
      id = pathParts[2];
    } else {
      const error = new Error(`Invalid URL pattern: ${url}`) as any;
      error.statusCode = 400;
      error.status = 400;
      throw error;
    }
    
    // Normalize entity names to singular form for MockDataStore
    entityType = this.normalizeEntityType(entityType);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

    try {
      switch (method) {
        case 'GET':
          if (id) {
            // Single entity request
            const result = this.mockStore.getEntity(entityType, id);
            if (!result) {
              const error = new Error('Not Found') as any;
              error.statusCode = 404;
              error.status = 404;
              throw error;
            }
            return result as T;
          } else {
            // Multiple entities request
            return this.mockStore.findEntities(entityType) as T;
          }
        
        case 'POST':
          if (!body) {
            const error = new Error('Bad Request: Body required') as any;
            error.statusCode = 400;
            error.status = 400;
            throw error;
          }
          return this.mockStore.createEntity(entityType, body) as T;
        
        case 'PUT':
        case 'PATCH':
          if (!id) {
            const error = new Error('Bad Request: ID required for update') as any;
            error.statusCode = 400;
            error.status = 400;
            throw error;
          }
          if (!body) {
            const error = new Error('Bad Request: Body required') as any;
            error.statusCode = 400;
            error.status = 400;
            throw error;
          }
          const updateResult = this.mockStore.updateEntity(entityType, id, body);
          if (!updateResult) {
            const error = new Error('Not Found') as any;
            error.statusCode = 404;
            error.status = 404;
            throw error;
          }
          return updateResult as T;
        
        case 'DELETE':
          if (!id) {
            const error = new Error('Bad Request: ID required for delete') as any;
            error.statusCode = 400;
            error.status = 400;
            throw error;
          }
          
          // Special handling for verification token deletion by token value
          if (entityType === 'verificationtoken') {
            // Find verification token by token value (not by ID)
            const tokens = this.mockStore.findEntities(entityType, { token: id });
            if (tokens.length === 0) {
              const error = new Error('Not Found') as any;
              error.statusCode = 404;
              error.status = 404;
              throw error;
            }
            // Delete by actual ID
            const token = tokens[0];
            const deleteResult = this.mockStore.deleteEntity(entityType, token.id);
            if (!deleteResult) {
              const error = new Error('Not Found') as any;
              error.statusCode = 404;
              error.status = 404;
              throw error;
            }
            return deleteResult as T;
          } else {
            // Normal deletion by ID for other entity types
            const deleteResult = this.mockStore.deleteEntity(entityType, id);
            if (!deleteResult) {
              const error = new Error('Not Found') as any;
              error.statusCode = 404;
              error.status = 404;
              throw error;
            }
            return deleteResult as T;
          }
        
        default:
          const error = new Error(`Method ${method} not allowed`) as any;
          error.statusCode = 405;
          error.status = 405;
          throw error;
      }
    } catch (error) {
      // Add proper error properties if they don't exist
      if (error && typeof error === 'object' && !('statusCode' in error)) {
        (error as any).statusCode = 500;
        (error as any).status = 500;
      }
      throw error;
    }
  }

  async get<T>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url,
      ...config
    });
  }

  async post<T>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url,
      body: data,
      ...config
    });
  }

  async put<T>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url,
      body: data,
      ...config
    });
  }

  async patch<T>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<T> {
    return this.request<T>({
      method: 'PATCH',
      url,
      body: data,
      ...config
    });
  }

  async delete<T>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url,
      ...config
    });
  }

  // Additional methods to match the real HttpClient
  async batchRequest<T>(_configs: RequestConfig[]): Promise<T[]> {
    // TODO: Implement batch request execution for tests
    throw new Error('Batch request method not implemented in mock');
  }

  async healthCheck(url: string): Promise<boolean> {
    try {
      await this.get(url, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // Lifecycle methods
  async close(): Promise<void> {
    // Mock close method
    return Promise.resolve();
  }

  // Stats methods
  getStats() {
    return {
      requests: this.requestCount,
      successes: this.successCount,
      errors: this.errorCount,
      averageLatency: this.totalLatency / Math.max(this.requestCount, 1),
      circuitBreaker: this.circuitBreaker.getStats(),
      connectionPool: this.connectionPool.getStats(),
    };
  }

  resetStats() {
    this.requestCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.totalLatency = 0;
    this.latencyBuckets = [];
  }

  /**
   * Normalize entity type names to singular form for MockDataStore
   */
  private normalizeEntityType(entityType: string): string {
    const normalized = entityType.toLowerCase();
    
    // Handle plural to singular mappings
    switch (normalized) {
      case 'users':
        return 'user';
      case 'sessions':
        return 'session';
      case 'verificationtokens':
      case 'verification-tokens':  // Handle hyphenated form
        return 'verificationtoken';
      case 'accounts':
        return 'account';
      default:
        return normalized;
    }
  }
}

// Mock the HttpClient class export
export { MockHttpClient as HttpClient };