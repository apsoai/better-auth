/**
 * Unit tests for ConfigValidator
 * Tests comprehensive configuration validation, normalization, and health checks
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  ConfigValidator, 
  ConfigErrorCode 
} from '../../src/utils/ConfigValidator';
import { 
  ApsoAdapterConfig, 
  AdapterError, 
  AdapterErrorCode 
} from '../../src/types';

// Mock NODE_ENV for production tests
const originalEnv = process.env.NODE_ENV;

// Mock fetch for health check tests
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Helper to create mock Response objects
const createMockResponse = (init: {
  ok: boolean;
  status: number;
  statusText: string;
  headers?: Record<string, string>;
}): Response => {
  const response = {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText,
    headers: new Headers(init.headers || {}),
    type: 'basic',
    url: '',
    redirected: false,
    body: null,
    bodyUsed: false,
    clone: () => response,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob([])),
    formData: () => Promise.resolve(new FormData()),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as Response;
  return response;
};

describe('ConfigValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Reset NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  // =============================================================================
  // Basic Validation Tests
  // =============================================================================

  describe('validateConfig', () => {
    it('should reject config without required baseUrl', () => {
      const config = {};
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'baseUrl',
        message: 'baseUrl is required',
        code: ConfigErrorCode.REQUIRED_FIELD
      });
    });

    it('should validate minimal valid configuration', () => {
      const config = {
        baseUrl: 'https://api.example.com'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedConfig).toBeDefined();
      expect(result.normalizedConfig!.baseUrl).toBe('https://api.example.com');
      expect(result.normalizedConfig!.timeout).toBe(30000); // Default timeout
    });

    it('should normalize baseUrl by removing trailing slash', () => {
      const config = {
        baseUrl: 'https://api.example.com/'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.normalizedConfig!.baseUrl).toBe('https://api.example.com');
      expect(result.warnings).toHaveLength(2); // baseUrl trailing slash + authentication warning
      expect(result.warnings.some(w => w.field === 'baseUrl')).toBe(true);
      expect(result.warnings.some(w => w.message.includes('trailing slash'))).toBe(true);
    });
  });

  // =============================================================================
  // URL Validation Tests
  // =============================================================================

  describe('baseUrl validation', () => {
    it('should reject invalid URL format', () => {
      const config = {
        baseUrl: 'not-a-valid-url'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ConfigErrorCode.INVALID_FORMAT)).toBe(true);
    });

    it('should reject URL without protocol', () => {
      const config = {
        baseUrl: 'api.example.com'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'baseUrl' && 
        e.message.includes('http:// or https://')
      )).toBe(true);
    });

    it('should warn about HTTP in non-localhost URLs', () => {
      const config = {
        baseUrl: 'http://api.example.com'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'baseUrl' && 
        w.message.includes('security risks')
      )).toBe(true);
    });

    it('should accept HTTP for localhost', () => {
      const config = {
        baseUrl: 'http://localhost:3000'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.field === 'baseUrl' && w.message.includes('security risks'))).toBe(false);
    });

    it.skip('should make HTTP URLs an error in production environment', () => {
      const config = {
        baseUrl: 'http://api.example.com'
      };
      
      // Set production environment just for this validation
      process.env.NODE_ENV = 'production';
      const result = ConfigValidator.validateConfig(config);
      // Restore environment immediately
      process.env.NODE_ENV = originalEnv;
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'baseUrl' && 
        e.code === ConfigErrorCode.SECURITY_RISK &&
        e.message.includes('HTTP URLs are not allowed in production')
      )).toBe(true);
    });

    it('should warn about private IP addresses (SSRF protection)', () => {
      const config = {
        baseUrl: 'https://192.168.1.100'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      // Should not warn in development, only in production
      expect(result.warnings.some(w => 
        w.field === 'baseUrl' && 
        w.message.includes('SSRF risks')
      )).toBe(false);
    });

    it('should warn about private IP addresses in production (SSRF protection)', () => {
      const config = {
        baseUrl: 'https://10.0.0.1'
      };
      
      process.env.NODE_ENV = 'production';
      const result = ConfigValidator.validateConfig(config);
      process.env.NODE_ENV = originalEnv;
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'baseUrl' && 
        w.message.includes('SSRF risks')
      )).toBe(true);
    });

    it('should validate port numbers', () => {
      const config = {
        baseUrl: 'https://api.example.com:0'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'baseUrl' && 
        e.message.includes('Invalid port number')
      )).toBe(true);
    });
  });

  // =============================================================================
  // Authentication Validation Tests
  // =============================================================================

  describe('authentication validation', () => {
    it('should warn when no authentication is configured', () => {
      const config = {
        baseUrl: 'https://api.example.com'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'authentication' && 
        w.message.includes('No authentication')
      )).toBe(true);
    });

    it('should validate apiKey type', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        apiKey: 123 as any
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'apiKey' && 
        e.code === ConfigErrorCode.INVALID_TYPE
      )).toBe(true);
    });

    it('should warn about short API keys in development', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        apiKey: '1234567'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'apiKey' && 
        w.message.includes('too short')
      )).toBe(true);
    });

    it('should make short API keys an error in production', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        apiKey: 'short-key-123'
      };
      
      process.env.NODE_ENV = 'production';
      const result = ConfigValidator.validateConfig(config);
      process.env.NODE_ENV = originalEnv;
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'apiKey' && 
        e.code === ConfigErrorCode.SECURITY_RISK &&
        e.message.includes('too short')
      )).toBe(true);
    });

    it('should accept long API keys in production', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        apiKey: 'sk-proj-1234567890abcdef1234567890abcdef1234567890abcdef' // 54 chars
      };
      
      process.env.NODE_ENV = 'production';
      const result = ConfigValidator.validateConfig(config);
      process.env.NODE_ENV = originalEnv;
      
      expect(result.valid).toBe(true);
      expect(result.errors.some(e => e.field === 'apiKey')).toBe(false);
    });

    it('should detect weak/placeholder API keys in production', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        apiKey: 'test-api-key-1234567890abcdef1234567890' // Long but obviously a test key
      };
      
      process.env.NODE_ENV = 'production';
      const result = ConfigValidator.validateConfig(config);
      process.env.NODE_ENV = originalEnv;
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'apiKey' && 
        e.code === ConfigErrorCode.SECURITY_RISK &&
        e.message.includes('placeholder or test value')
      )).toBe(true);
    });

    it('should warn about weak API keys in development', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        apiKey: 'demo-key-for-testing'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'apiKey' && 
        w.message.includes('placeholder or test value')
      )).toBe(true);
    });

    it('should validate authHeader type', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        authHeader: 123 as any
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'authHeader' && 
        e.code === ConfigErrorCode.INVALID_TYPE
      )).toBe(true);
    });
  });

  // =============================================================================
  // Timeout Validation Tests
  // =============================================================================

  describe('timeout validation', () => {
    it('should reject negative timeout', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        timeout: -1000
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'timeout' && 
        e.code === ConfigErrorCode.INVALID_VALUE
      )).toBe(true);
    });

    it('should reject timeout below minimum', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        timeout: 500
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'timeout' && 
        e.code === ConfigErrorCode.OUT_OF_RANGE
      )).toBe(true);
    });

    it('should reject timeout above maximum', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        timeout: 400000
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'timeout' && 
        e.code === ConfigErrorCode.OUT_OF_RANGE
      )).toBe(true);
    });

    it('should warn about very high timeout values', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        timeout: 150000
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'timeout' && 
        w.message.includes('Very high timeout value')
      )).toBe(true);
    });

    it('should use 30 second default timeout', () => {
      const config = {
        baseUrl: 'https://api.example.com'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.normalizedConfig!.timeout).toBe(30000); // Default timeout
    });

    it.skip('should warn about very high timeouts that impact performance', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        timeout: 120000 // 2 minutes
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'timeout' && 
        w.message.includes('may impact user experience')
      )).toBe(true);
    });
  });

  // =============================================================================
  // Retry Configuration Tests
  // =============================================================================

  describe('retry configuration validation', () => {
    it('should set default retry configuration when not provided', () => {
      const config = {
        baseUrl: 'https://api.example.com'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.normalizedConfig!.retryConfig).toBeDefined();
      expect(result.normalizedConfig!.retryConfig!.maxRetries).toBe(3);
      expect(result.normalizedConfig!.retryConfig!.initialDelayMs).toBe(1000);
      expect(result.normalizedConfig!.retryConfig!.maxDelayMs).toBe(10000);
    });

    it('should validate maxRetries range', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        retryConfig: {
          maxRetries: 15,
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          retryableStatuses: [500, 502, 503]
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'retryConfig.maxRetries' && 
        e.code === ConfigErrorCode.OUT_OF_RANGE
      )).toBe(true);
    });

    it('should validate delay ranges', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 50,
          maxDelayMs: 100000,
          retryableStatuses: [500]
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'retryConfig.initialDelayMs')).toBe(true);
      expect(result.errors.some(e => e.field === 'retryConfig.maxDelayMs')).toBe(true);
    });

    it('should ensure maxDelayMs >= initialDelayMs', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 5000,
          maxDelayMs: 2000,
          retryableStatuses: [500]
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'retryConfig.maxDelayMs' && 
        e.message.includes('greater than or equal to initialDelayMs')
      )).toBe(true);
    });

    it('should validate retryable status codes', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          retryableStatuses: [200, 999, 'invalid' as any]
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'retryConfig.retryableStatuses' && 
        e.code === ConfigErrorCode.INVALID_VALUE
      )).toBe(true);
    });

    it('should warn about high retry counts', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        retryConfig: {
          maxRetries: 8,
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          retryableStatuses: [500]
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'retryConfig.maxRetries' && 
        w.message.includes('High retry count')
      )).toBe(true);
    });
  });

  // =============================================================================
  // Cache Configuration Tests
  // =============================================================================

  describe('cache configuration validation', () => {
    it('should validate cache enabled type', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        cacheConfig: {
          enabled: 'true' as any,
          ttlMs: 60000,
          maxSize: 100
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'cacheConfig.enabled' && 
        e.code === ConfigErrorCode.INVALID_TYPE
      )).toBe(true);
    });

    it('should validate cache TTL range', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        cacheConfig: {
          enabled: true,
          ttlMs: 500,
          maxSize: 100
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'cacheConfig.ttlMs' && 
        e.code === ConfigErrorCode.OUT_OF_RANGE
      )).toBe(true);
    });

    it('should validate cache max size range', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        cacheConfig: {
          enabled: true,
          ttlMs: 60000,
          maxSize: 15000
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'cacheConfig.maxSize' && 
        e.code === ConfigErrorCode.OUT_OF_RANGE
      )).toBe(true);
    });

    it('should require ttlMs when cache is enabled', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        cacheConfig: {
          enabled: true,
          ttlMs: undefined as any,
          maxSize: 100
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'cacheConfig' && 
        e.code === ConfigErrorCode.REQUIRED_FIELD
      )).toBe(true);
    });
  });

  // =============================================================================
  // Multi-tenancy Configuration Tests
  // =============================================================================

  describe('multi-tenancy configuration validation', () => {
    it('should validate enabled type', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        multiTenancy: {
          enabled: 'true' as any,
          scopeField: 'tenant_id',
          getScopeValue: () => 'tenant1'
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'multiTenancy.enabled' && 
        e.code === ConfigErrorCode.INVALID_TYPE
      )).toBe(true);
    });

    it('should validate scopeField format', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        multiTenancy: {
          enabled: true,
          scopeField: '123invalid',
          getScopeValue: () => 'tenant1'
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'multiTenancy.scopeField' && 
        e.code === ConfigErrorCode.INVALID_FORMAT
      )).toBe(true);
    });

    it('should validate getScopeValue is a function', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        multiTenancy: {
          enabled: true,
          scopeField: 'tenant_id',
          getScopeValue: 'not-a-function' as any
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'multiTenancy.getScopeValue' && 
        e.code === ConfigErrorCode.INVALID_TYPE
      )).toBe(true);
    });

    it('should accept valid multi-tenancy configuration', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        multiTenancy: {
          enabled: true,
          scopeField: 'tenant_id',
          getScopeValue: () => 'tenant1'
        }
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
    });
  });

  // =============================================================================
  // Development Options Tests
  // =============================================================================

  describe('development options validation', () => {
    it('should warn about dry run mode', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        dryRun: true
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'dryRun' && 
        w.message.includes('no actual API calls')
      )).toBe(true);
    });

    it('should warn about debug mode', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        debugMode: true
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'debugMode' && 
        w.message.includes('sensitive information')
      )).toBe(true);
    });

    it('should validate boolean types for behavior options', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        usePlural: 'true' as any,
        emailNormalization: 1 as any,
        softDeletes: 'false' as any
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.filter(e => e.code === ConfigErrorCode.INVALID_TYPE)).toHaveLength(3);
    });
  });

  // =============================================================================
  // validateAndThrow Tests
  // =============================================================================

  describe('validateAndThrow', () => {
    it('should return normalized config for valid input', () => {
      const config = {
        baseUrl: 'https://api.example.com'
      };
      const result = ConfigValidator.validateAndThrow(config);
      
      expect(result).toBeDefined();
      expect(result.baseUrl).toBe('https://api.example.com');
      expect(result.timeout).toBe(30000);
    });

    it('should throw AdapterError for invalid config', () => {
      const config = {};
      
      expect(() => {
        ConfigValidator.validateAndThrow(config);
      }).toThrow(AdapterError);
      
      try {
        ConfigValidator.validateAndThrow(config);
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterError);
        expect((error as AdapterError).code).toBe(AdapterErrorCode.VALIDATION_ERROR);
        expect((error as AdapterError).message).toContain('Configuration validation failed');
      }
    });

    it('should log warnings but not throw for valid config with warnings', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const config = {
        baseUrl: 'https://api.example.com',
        dryRun: true
      };
      
      expect(() => {
        ConfigValidator.validateAndThrow(config);
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith('Configuration warnings:', expect.any(Array));
      consoleSpy.mockRestore();
    });
  });

  // =============================================================================
  // Health Check Tests
  // =============================================================================

  describe('validateHealthCheck', () => {
    it('should return healthy result for successful request', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK'
      }));

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 10000
      };

      const result = await ConfigValidator.validateHealthCheck(config);

      expect(result.healthy).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.latency).toBeDefined();
      expect(typeof result.latency).toBe('number');
    });

    it('should handle 404 as healthy (endpoint reachable)', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }));

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 10000
      };

      const result = await ConfigValidator.validateHealthCheck(config);

      expect(result.healthy).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return unhealthy for server errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }));

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 10000
      };

      const result = await ConfigValidator.validateHealthCheck(config);

      expect(result.healthy).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('HTTP 500');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 10000
      };

      const result = await ConfigValidator.validateHealthCheck(config);

      expect(result.healthy).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Network error');
    });

    it('should handle timeout', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_resolve, reject) => {
          setTimeout(() => {
            const error = new Error('The operation was aborted.');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        })
      );

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 5000
      };

      const result = await ConfigValidator.validateHealthCheck(config);

      expect(result.healthy).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('timeout');
    });

    it('should include authentication headers in health check', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK'
      }));

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com',
        apiKey: 'test-api-key',
        authHeader: 'X-API-Key',
        timeout: 10000
      };

      await ConfigValidator.validateHealthCheck(config);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com', {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Apso-Adapter-HealthCheck/1.0',
          'X-API-Key': 'test-api-key'
        },
        signal: expect.any(AbortSignal),
        redirect: 'manual'
      });
    });

    it('should support skipping health checks for security-sensitive environments', async () => {
      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 10000
      };

      const result = await ConfigValidator.validateHealthCheck(config, { skipHealthCheck: true });

      expect(result.healthy).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.skipped).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should block private IP addresses (SSRF protection)', async () => {
      const config: ApsoAdapterConfig = {
        baseUrl: 'https://192.168.1.100',
        timeout: 10000
      };

      const result = await ConfigValidator.validateHealthCheck(config);

      expect(result.healthy).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('SSRF protection');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should allow private IPs when explicitly enabled', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK'
      }));

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://192.168.1.100',
        timeout: 10000
      };

      const result = await ConfigValidator.validateHealthCheck(config, { allowPrivateIPs: true });

      expect(result.healthy).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should block non-standard ports (SSRF protection)', async () => {
      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com:6379', // Redis port
        timeout: 10000
      };

      const result = await ConfigValidator.validateHealthCheck(config);

      expect(result.healthy).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Non-standard port');
      expect(result.errors[0]).toContain('SSRF protection');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should allow standard web ports', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK'
      }));

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com:8443',
        timeout: 10000
      };

      const result = await ConfigValidator.validateHealthCheck(config);

      expect(result.healthy).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should sanitize error messages in production', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused to internal service'));

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 10000
      };

      process.env.NODE_ENV = 'production';
      const result = await ConfigValidator.validateHealthCheck(config);
      process.env.NODE_ENV = originalEnv;

      expect(result.healthy).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Network connectivity issue');
      expect(result.errors[0]).not.toContain('internal service');
    });

    it('should show detailed error messages in development', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 10000
      };

      process.env.NODE_ENV = 'development';
      const result = await ConfigValidator.validateHealthCheck(config);
      process.env.NODE_ENV = originalEnv;

      expect(result.healthy).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Connection refused');
    });
  });

  // =============================================================================
  // Configuration Caching Tests
  // =============================================================================

  describe('validation caching', () => {
    it('should cache valid configuration results', () => {
      const config = {
        baseUrl: 'https://api.example.com'
      };
      
      // First call
      const result1 = ConfigValidator.validateConfig(config, { useCache: true });
      expect(result1.valid).toBe(true);
      
      // Second call should return cached result (same reference)
      const result2 = ConfigValidator.validateConfig(config, { useCache: true });
      expect(result2.valid).toBe(true);
      // Results should be the same object (cached)
      expect(result2).toBe(result1);
    });

    it('should allow disabling cache', () => {
      const config = {
        baseUrl: 'https://api.example.com'
      };
      
      // First call with cache disabled
      const result1 = ConfigValidator.validateConfig(config, { useCache: false });
      expect(result1.valid).toBe(true);
      
      // Second call with cache disabled should create new result
      const result2 = ConfigValidator.validateConfig(config, { useCache: false });
      expect(result2.valid).toBe(true);
      // Results should be different objects (not cached)
      expect(result2).not.toBe(result1);
    });

    it('should not cache invalid configuration results', () => {
      const config = {
        baseUrl: 'invalid-url'
      };
      
      // First call
      const result1 = ConfigValidator.validateConfig(config, { useCache: true });
      expect(result1.valid).toBe(false);
      
      // Second call should not return cached result for invalid configs
      const result2 = ConfigValidator.validateConfig(config, { useCache: true });
      expect(result2.valid).toBe(false);
      // Results should be different objects (invalid configs not cached)
      expect(result2).not.toBe(result1);
    });
  });
});