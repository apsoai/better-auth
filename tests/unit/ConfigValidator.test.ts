/**
 * Unit tests for ConfigValidator
 * Tests comprehensive configuration validation, normalization, and health checks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ConfigValidator, 
  ConfigValidationResult, 
  ConfigErrorCode 
} from '../../src/utils/ConfigValidator.js';
import { 
  ApsoAdapterConfig, 
  AdapterError, 
  AdapterErrorCode 
} from '../../src/types/index.js';

// Mock fetch for health check tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ConfigValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      expect(result.warnings.some(w => w.field === 'baseUrl')).toBe(false);
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

    it('should warn about short API keys', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        apiKey: '1234567'
      };
      const result = ConfigValidator.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.field === 'apiKey' && 
        w.message.includes('very short')
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
        w.message.includes('Very high timeout')
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
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const config: ApsoAdapterConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 10000
      };

      const result = await ConfigValidator.validateHealthCheck(config);

      expect(result.healthy).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return unhealthy for server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

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
        signal: expect.any(AbortSignal)
      });
    });
  });
});