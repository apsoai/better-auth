/**
 * Configuration Validator for ApsoAdapterConfig
 * Provides comprehensive runtime validation, normalization, and health checks
 */

import {
  ApsoAdapterConfig,
  LogLevel,
  AdapterError,
  AdapterErrorCode,
} from '../types';

// =============================================================================
// Validation Result Types
// =============================================================================

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
  normalizedConfig?: ApsoAdapterConfig | undefined;
}

export interface ConfigValidationError {
  field: string;
  message: string;
  code: ConfigErrorCode;
  details?: any;
}

export interface ConfigValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export enum ConfigErrorCode {
  REQUIRED_FIELD = 'REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  INVALID_VALUE = 'INVALID_VALUE',
  INVALID_TYPE = 'INVALID_TYPE',
  CONFLICTING_OPTIONS = 'CONFLICTING_OPTIONS',
  SECURITY_RISK = 'SECURITY_RISK',
}

// =============================================================================
// Validation Constants
// =============================================================================

/**
 * Configuration validation limits with security and performance considerations
 */
const VALIDATION_LIMITS = {
  /**
   * HTTP timeout limits: 1s minimum to prevent very fast timeouts that could cause cascading failures.
   * 5min maximum to prevent indefinitely hanging requests that consume resources.
   */
  timeout: { min: 1000, max: 300000 },

  /**
   * Retry attempt limits: 0 minimum allows disabling retries for critical operations.
   * 10 maximum prevents excessive API load and potential DoS scenarios.
   */
  retryAttempts: { min: 0, max: 10 },

  /**
   * Retry delay limits: 100ms minimum prevents tight retry loops that could overwhelm servers.
   * 1min maximum balances user experience with avoiding indefinite delays.
   */
  retryDelay: { min: 100, max: 60000 },

  /**
   * Cache TTL limits: 1s minimum ensures some caching benefit.
   * 24h maximum prevents stale data issues in dynamic environments.
   */
  cacheTtl: { min: 1000, max: 24 * 60 * 60 * 1000 },

  /**
   * Cache size limits: Minimum 1 entry for functionality.
   * 10,000 maximum prevents excessive memory usage (assuming ~1KB per entry = ~10MB max).
   */
  cacheMaxSize: { min: 1, max: 10000 },

  /**
   * Batch size limits: Minimum 1 for functionality.
   * 1000 maximum prevents oversized requests that could timeout or be rejected by APIs.
   */
  batchSize: { min: 1, max: 1000 },

  /**
   * Batch concurrency limits: Minimum 1 for functionality.
   * 50 maximum prevents overwhelming target systems with too many concurrent requests.
   */
  batchConcurrency: { min: 1, max: 50 },

  /**
   * Batch delay limits: 0 minimum allows continuous batching when appropriate.
   * 10s maximum prevents excessively slow batch processing.
   */
  batchDelay: { min: 0, max: 10000 },
} as const;

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const URL_PROTOCOL_REGEX = /^https?:\/\//i;
const TENANT_SCOPE_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

// Security constants
const PRODUCTION_API_KEY_MIN_LENGTH = 32;
const DEVELOPMENT_API_KEY_MIN_LENGTH = 8;
const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fe80:/i,
];

/**
 * Branded types for enhanced type safety with sensitive values
 */
export type ApiKey = string & { readonly __brand: 'ApiKey' };
export type SecureUrl = string & { readonly __brand: 'SecureUrl' };

/**
 * Environment detection utility
 */
function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Cache for validation results to improve performance
 */
class ValidationCache {
  private readonly cache = new Map<
    string,
    { result: ConfigValidationResult; timestamp: number }
  >();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  get(key: string): ConfigValidationResult | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.result;
    }
    this.cache.delete(key);
    return null;
  }

  set(key: string, result: ConfigValidationResult): void {
    this.cache.set(key, { result, timestamp: Date.now() });
    // Cleanup old entries if cache gets too large
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
  }

  generateKey(config: Partial<ApsoAdapterConfig>): string {
    // Create a stable hash of the config for caching
    return JSON.stringify(config, Object.keys(config).sort());
  }
}

const validationCache = new ValidationCache();

// =============================================================================
// ConfigValidator Class
// =============================================================================

export class ConfigValidator {
  /**
   * Validates and normalizes the complete ApsoAdapterConfig
   * @param config - The configuration to validate
   * @param options - Validation options
   * @returns Validation result with errors, warnings, and normalized config
   */
  public static validateConfig(
    config: Partial<ApsoAdapterConfig>,
    options: { useCache?: boolean; disableHealthCheck?: boolean } = {}
  ): ConfigValidationResult {
    const { useCache = true } = options;

    // Check cache first if enabled
    if (useCache) {
      const cacheKey = validationCache.generateKey(config);
      const cached = validationCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Create a copy for normalization
    const normalizedConfig = this.deepClone(config) as ApsoAdapterConfig;

    // Validate required fields
    this.validateRequiredFields(config, errors);

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Validate and normalize individual sections
    this.validateAndNormalizeBaseUrl(normalizedConfig, errors, warnings);
    this.validateAuthentication(normalizedConfig, errors, warnings);
    this.validateHttpConfig(normalizedConfig, errors, warnings);
    this.validateRetryConfig(normalizedConfig, errors, warnings);
    this.validateCacheConfig(normalizedConfig, errors, warnings);
    this.validateBatchConfig(normalizedConfig, errors, warnings);
    this.validateMultiTenancyConfig(normalizedConfig, errors, warnings);
    this.validateObservabilityConfig(normalizedConfig, errors, warnings);
    this.validateBehaviorOptions(normalizedConfig, errors, warnings);

    // Check for conflicting options
    this.validateConflictingOptions(normalizedConfig, errors, warnings);

    // Security validations
    this.validateSecuritySettings(normalizedConfig, errors, warnings);

    const valid = errors.length === 0;
    const result: ConfigValidationResult = {
      valid,
      errors,
      warnings,
      ...(valid ? { normalizedConfig } : {}),
    };

    // Cache the result if enabled
    if (options.useCache !== false && valid) {
      const cacheKey = validationCache.generateKey(config);
      validationCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Validates configuration and throws AdapterError if invalid
   * @param config - The configuration to validate
   * @returns Normalized configuration
   * @throws AdapterError if validation fails
   */
  public static validateAndThrow(
    config: Partial<ApsoAdapterConfig>
  ): ApsoAdapterConfig {
    const result = this.validateConfig(config);

    if (!result.valid) {
      const errorMessage = this.formatValidationErrors(result.errors);
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        `Configuration validation failed: ${errorMessage}`,
        { errors: result.errors, warnings: result.warnings }
      );
    }

    if (result.warnings.length > 0) {
      console.warn('Configuration warnings:', result.warnings);
    }

    return result.normalizedConfig!;
  }

  /**
   * Performs async health check validation with SSRF protection
   * @param config - Validated configuration
   * @param options - Health check options
   * @returns Promise resolving to health check result
   */
  public static async validateHealthCheck(
    config: ApsoAdapterConfig,
    options: {
      allowPrivateIPs?: boolean;
      skipHealthCheck?: boolean;
      maxRedirects?: number;
    } = {}
  ): Promise<{
    healthy: boolean;
    errors: string[];
    latency?: number;
    skipped?: boolean;
  }> {
    const {
      allowPrivateIPs = false,
      skipHealthCheck = false,
      maxRedirects = 0,
    } = options;
    const errors: string[] = [];
    let latency: number | undefined;

    // Option to skip health checks for security-sensitive environments
    if (skipHealthCheck) {
      return {
        healthy: true,
        errors: [],
        skipped: true,
      };
    }

    try {
      // SSRF Protection: Validate the URL before making the request
      const url = new URL(config.baseUrl);

      // Block private/internal addresses unless explicitly allowed
      if (!allowPrivateIPs && this.isPrivateOrLoopbackAddress(url.hostname)) {
        errors.push(
          'Health check blocked: Target URL points to private/internal address (SSRF protection)'
        );
        return {
          healthy: false,
          errors,
        };
      }

      // Block non-standard ports that might indicate internal services
      if (url.port && !allowPrivateIPs) {
        const port = parseInt(url.port, 10);
        const commonWebPorts = [80, 443, 8080, 8443];
        if (!commonWebPorts.includes(port)) {
          errors.push(
            `Health check blocked: Non-standard port ${port} may indicate internal service (SSRF protection)`
          );
          return {
            healthy: false,
            errors,
          };
        }
      }

      const startTime = Date.now();

      // Attempt a simple HTTP request to baseUrl
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        config.timeout || 10000
      );

      const headers: Record<string, string> = {
        'User-Agent': 'Apso-Adapter-HealthCheck/1.0',
      };

      if (config.apiKey) {
        const headerName = config.authHeader || 'Authorization';
        if (headerName.toLowerCase() === 'authorization') {
          headers[headerName] = `Bearer ${config.apiKey}`;
        } else {
          headers[headerName] = config.apiKey;
        }
      }

      try {
        const response = await fetch(config.baseUrl, {
          method: 'HEAD',
          headers,
          signal: controller.signal,
          redirect: maxRedirects > 0 ? 'follow' : 'manual',
        });

        clearTimeout(timeoutId);
        latency = Date.now() - startTime;

        if (!response.ok && response.status !== 404) {
          // 404 is acceptable for health check - means endpoint is reachable
          const statusText = isProductionEnvironment()
            ? 'HTTP Error'
            : response.statusText;
          errors.push(`HTTP ${response.status}: ${statusText}`);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          errors.push(
            `Health check timeout after ${config.timeout || 10000}ms`
          );
        } else {
          // Sanitize error messages in production
          const errorMsg = isProductionEnvironment()
            ? 'Network connectivity issue'
            : `Network error: ${fetchError.message}`;
          errors.push(errorMsg);
        }
      }
    } catch (error: any) {
      const errorMsg = isProductionEnvironment()
        ? 'Health check configuration error'
        : `Health check failed: ${error.message}`;
      errors.push(errorMsg);
    }

    const result: {
      healthy: boolean;
      errors: string[];
      latency?: number;
      skipped?: boolean;
    } = {
      healthy: errors.length === 0,
      errors,
    };

    if (latency !== undefined) {
      result.latency = latency;
    }

    return result;
  }

  // =============================================================================
  // Private Validation Methods
  // =============================================================================

  private static validateRequiredFields(
    config: Partial<ApsoAdapterConfig>,
    errors: ConfigValidationError[]
  ): void {
    if (!config.baseUrl) {
      errors.push({
        field: 'baseUrl',
        message: 'baseUrl is required',
        code: ConfigErrorCode.REQUIRED_FIELD,
      });
    }
  }

  /**
   * Validates if a hostname is a private/internal IP address
   */
  private static isPrivateOrLoopbackAddress(hostname: string): boolean {
    return PRIVATE_IP_RANGES.some(regex => regex.test(hostname));
  }

  /**
   * Sanitizes error details based on environment
   */
  private static sanitizeErrorDetails(details: any): any {
    if (!isProductionEnvironment()) {
      return details;
    }

    // In production, remove potentially sensitive information
    if (typeof details === 'object' && details !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(details)) {
        if (key === 'error' && typeof value === 'string') {
          sanitized[key] = 'Error details hidden in production';
        } else if (
          typeof value !== 'string' ||
          (!value.includes('password') &&
            !value.includes('token') &&
            !value.includes('key'))
        ) {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return details;
  }

  private static validateAndNormalizeBaseUrl(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    if (!config.baseUrl) return;

    // Validate URL format
    if (!URL_PROTOCOL_REGEX.test(config.baseUrl)) {
      errors.push({
        field: 'baseUrl',
        message: 'baseUrl must start with http:// or https://',
        code: ConfigErrorCode.INVALID_FORMAT,
        details: this.sanitizeErrorDetails({
          suggestion: 'Use https://your-api-domain.com format',
        }),
      });
      return;
    }

    try {
      const url = new URL(config.baseUrl);

      // CRITICAL: HTTP URLs are errors in production, warnings in development
      if (
        url.protocol === 'http:' &&
        !this.isPrivateOrLoopbackAddress(url.hostname)
      ) {
        const message =
          'HTTP URLs are not allowed in production environments for security';
        const suggestion =
          'Use HTTPS instead. HTTP is only acceptable for localhost/private IPs in development';

        if (isProductionEnvironment()) {
          errors.push({
            field: 'baseUrl',
            message,
            code: ConfigErrorCode.SECURITY_RISK,
            details: this.sanitizeErrorDetails({ suggestion }),
          });
        } else {
          warnings.push({
            field: 'baseUrl',
            message: 'Using HTTP instead of HTTPS may pose security risks',
            suggestion,
          });
        }
      }

      // SSRF Protection: Check for private IP ranges in URLs
      if (this.isPrivateOrLoopbackAddress(url.hostname)) {
        const message =
          'URLs pointing to private/internal addresses may pose SSRF risks';
        const suggestion =
          'Ensure this is intentional and the target service is trusted';

        if (isProductionEnvironment()) {
          warnings.push({
            field: 'baseUrl',
            message,
            suggestion: `${suggestion}. Consider using allowPrivateIPs option if needed.`,
          });
        }
      }

      // Normalize URL (remove trailing slash)
      if (config.baseUrl.endsWith('/')) {
        config.baseUrl = config.baseUrl.slice(0, -1);
        warnings.push({
          field: 'baseUrl',
          message: 'Removed trailing slash from baseUrl',
          suggestion: 'Avoid trailing slashes in baseUrl',
        });
      }

      // Validate port if specified
      if (url.port) {
        const port = parseInt(url.port, 10);
        if (port < 1 || port > 65535) {
          errors.push({
            field: 'baseUrl',
            message: 'Invalid port number in baseUrl (must be 1-65535)',
            code: ConfigErrorCode.OUT_OF_RANGE,
            details: this.sanitizeErrorDetails({
              port,
              suggestion: 'Use a valid port number between 1 and 65535',
            }),
          });
        }
      }
    } catch (urlError) {
      errors.push({
        field: 'baseUrl',
        message: 'Invalid URL format - unable to parse the provided URL',
        code: ConfigErrorCode.INVALID_FORMAT,
        details: this.sanitizeErrorDetails({
          error:
            urlError instanceof Error ? urlError.message : String(urlError),
          suggestion:
            'Ensure URL follows the format: https://your-api-domain.com',
        }),
      });
    }
  }

  private static validateAuthentication(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    if (!config.apiKey && !config.authHeader) {
      warnings.push({
        field: 'authentication',
        message: 'No authentication configured - API requests may fail',
        suggestion:
          'Set apiKey for Bearer token auth or authHeader for custom authentication',
      });
    }

    if (config.apiKey && typeof config.apiKey !== 'string') {
      errors.push({
        field: 'apiKey',
        message: 'apiKey must be a non-empty string',
        code: ConfigErrorCode.INVALID_TYPE,
        details: this.sanitizeErrorDetails({
          suggestion: 'Provide a valid API key as a string value',
        }),
      });
    }

    // Enhanced API key validation based on environment
    if (config.apiKey && typeof config.apiKey === 'string') {
      const isProduction = isProductionEnvironment();
      const minLength = isProduction
        ? PRODUCTION_API_KEY_MIN_LENGTH
        : DEVELOPMENT_API_KEY_MIN_LENGTH;

      if (config.apiKey.length < minLength) {
        const message = `API key is too short (${config.apiKey.length} chars, minimum ${minLength} required${isProduction ? ' in production' : ''})`;
        const suggestion = isProduction
          ? 'Use a production-grade API key with at least 32 characters for security'
          : 'Use a longer API key. Production requires at least 32 characters.';

        if (isProduction) {
          errors.push({
            field: 'apiKey',
            message,
            code: ConfigErrorCode.SECURITY_RISK,
            details: this.sanitizeErrorDetails({
              currentLength: config.apiKey.length,
              requiredMinLength: minLength,
              suggestion,
            }),
          });
        } else {
          warnings.push({
            field: 'apiKey',
            message,
            suggestion,
          });
        }
      }

      // Check for obviously weak API keys
      const weakPatterns = [
        /^(test|demo|example|sample)/i,
        /^(123|abc|password)/i,
      ];
      if (weakPatterns.some(pattern => pattern.test(config.apiKey!))) {
        const message = 'API key appears to be a placeholder or test value';
        const suggestion =
          'Replace with a proper API key from your service provider';

        if (isProduction) {
          errors.push({
            field: 'apiKey',
            message,
            code: ConfigErrorCode.SECURITY_RISK,
            details: this.sanitizeErrorDetails({ suggestion }),
          });
        } else {
          warnings.push({
            field: 'apiKey',
            message,
            suggestion,
          });
        }
      }
    }

    if (config.authHeader && typeof config.authHeader !== 'string') {
      errors.push({
        field: 'authHeader',
        message: 'authHeader must be a non-empty string',
        code: ConfigErrorCode.INVALID_TYPE,
        details: this.sanitizeErrorDetails({
          suggestion:
            'Provide a valid HTTP header name (e.g., "X-API-Key", "Authorization")',
        }),
      });
    } else if (config.authHeader && !config.authHeader.trim()) {
      errors.push({
        field: 'authHeader',
        message: 'authHeader cannot be empty or whitespace',
        code: ConfigErrorCode.INVALID_VALUE,
        details: this.sanitizeErrorDetails({
          suggestion: 'Provide a valid HTTP header name',
        }),
      });
    }
  }

  private static validateHttpConfig(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    _warnings: ConfigValidationWarning[]
  ): void {
    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout <= 0) {
        errors.push({
          field: 'timeout',
          message: 'timeout must be a positive number',
          code: ConfigErrorCode.INVALID_VALUE,
        });
      } else if (
        config.timeout < VALIDATION_LIMITS.timeout.min ||
        config.timeout > VALIDATION_LIMITS.timeout.max
      ) {
        errors.push({
          field: 'timeout',
          message: `timeout must be between ${VALIDATION_LIMITS.timeout.min} and ${VALIDATION_LIMITS.timeout.max} milliseconds`,
          code: ConfigErrorCode.OUT_OF_RANGE,
          details: {
            min: VALIDATION_LIMITS.timeout.min,
            max: VALIDATION_LIMITS.timeout.max,
          },
        });
      }
    } else {
      // Set default timeout
      config.timeout = 30000; // 30 seconds
    }
  }

  private static validateRetryConfig(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    _warnings: ConfigValidationWarning[]
  ): void {
    if (!config.retryConfig) {
      // Set sensible defaults
      config.retryConfig = {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        retryableStatuses: [...RETRYABLE_STATUS_CODES],
      };
      return;
    }

    const retry = config.retryConfig;

    // Validate maxRetries
    if (
      typeof retry.maxRetries !== 'number' ||
      retry.maxRetries < VALIDATION_LIMITS.retryAttempts.min ||
      retry.maxRetries > VALIDATION_LIMITS.retryAttempts.max
    ) {
      errors.push({
        field: 'retryConfig.maxRetries',
        message: `maxRetries must be between ${VALIDATION_LIMITS.retryAttempts.min} and ${VALIDATION_LIMITS.retryAttempts.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE,
        details: {
          min: VALIDATION_LIMITS.retryAttempts.min,
          max: VALIDATION_LIMITS.retryAttempts.max,
        },
      });
    }

    // Validate initialDelayMs
    if (
      typeof retry.initialDelayMs !== 'number' ||
      retry.initialDelayMs < VALIDATION_LIMITS.retryDelay.min ||
      retry.initialDelayMs > VALIDATION_LIMITS.retryDelay.max
    ) {
      errors.push({
        field: 'retryConfig.initialDelayMs',
        message: `initialDelayMs must be between ${VALIDATION_LIMITS.retryDelay.min} and ${VALIDATION_LIMITS.retryDelay.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE,
      });
    }

    // Validate maxDelayMs
    if (
      typeof retry.maxDelayMs !== 'number' ||
      retry.maxDelayMs < VALIDATION_LIMITS.retryDelay.min ||
      retry.maxDelayMs > VALIDATION_LIMITS.retryDelay.max
    ) {
      errors.push({
        field: 'retryConfig.maxDelayMs',
        message: `maxDelayMs must be between ${VALIDATION_LIMITS.retryDelay.min} and ${VALIDATION_LIMITS.retryDelay.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE,
      });
    }

    // Ensure maxDelayMs >= initialDelayMs
    if (retry.maxDelayMs < retry.initialDelayMs) {
      errors.push({
        field: 'retryConfig.maxDelayMs',
        message: 'maxDelayMs must be greater than or equal to initialDelayMs',
        code: ConfigErrorCode.INVALID_VALUE,
      });
    }

    // Validate retryableStatuses
    if (!Array.isArray(retry.retryableStatuses)) {
      errors.push({
        field: 'retryConfig.retryableStatuses',
        message: 'retryableStatuses must be an array of HTTP status codes',
        code: ConfigErrorCode.INVALID_TYPE,
      });
    } else {
      const invalidStatuses = retry.retryableStatuses.filter(
        status => typeof status !== 'number' || status < 100 || status > 599
      );
      if (invalidStatuses.length > 0) {
        errors.push({
          field: 'retryConfig.retryableStatuses',
          message:
            'retryableStatuses must contain valid HTTP status codes (100-599)',
          code: ConfigErrorCode.INVALID_VALUE,
          details: { invalidStatuses },
        });
      }
    }
  }

  private static validateCacheConfig(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    _warnings: ConfigValidationWarning[]
  ): void {
    if (!config.cacheConfig) return;

    const cache = config.cacheConfig;

    if (typeof cache.enabled !== 'boolean') {
      errors.push({
        field: 'cacheConfig.enabled',
        message: 'enabled must be a boolean',
        code: ConfigErrorCode.INVALID_TYPE,
      });
    }

    if (
      typeof cache.ttlMs !== 'number' ||
      cache.ttlMs < VALIDATION_LIMITS.cacheTtl.min ||
      cache.ttlMs > VALIDATION_LIMITS.cacheTtl.max
    ) {
      errors.push({
        field: 'cacheConfig.ttlMs',
        message: `ttlMs must be between ${VALIDATION_LIMITS.cacheTtl.min} and ${VALIDATION_LIMITS.cacheTtl.max} milliseconds`,
        code: ConfigErrorCode.OUT_OF_RANGE,
      });
    }

    if (
      typeof cache.maxSize !== 'number' ||
      cache.maxSize < VALIDATION_LIMITS.cacheMaxSize.min ||
      cache.maxSize > VALIDATION_LIMITS.cacheMaxSize.max
    ) {
      errors.push({
        field: 'cacheConfig.maxSize',
        message: `maxSize must be between ${VALIDATION_LIMITS.cacheMaxSize.min} and ${VALIDATION_LIMITS.cacheMaxSize.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE,
      });
    }
  }

  private static validateBatchConfig(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    _warnings: ConfigValidationWarning[]
  ): void {
    if (!config.batchConfig) return;

    const batch = config.batchConfig;

    if (
      typeof batch.batchSize !== 'number' ||
      batch.batchSize < VALIDATION_LIMITS.batchSize.min ||
      batch.batchSize > VALIDATION_LIMITS.batchSize.max
    ) {
      errors.push({
        field: 'batchConfig.batchSize',
        message: `batchSize must be between ${VALIDATION_LIMITS.batchSize.min} and ${VALIDATION_LIMITS.batchSize.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE,
      });
    }

    if (
      typeof batch.concurrency !== 'number' ||
      batch.concurrency < VALIDATION_LIMITS.batchConcurrency.min ||
      batch.concurrency > VALIDATION_LIMITS.batchConcurrency.max
    ) {
      errors.push({
        field: 'batchConfig.concurrency',
        message: `concurrency must be between ${VALIDATION_LIMITS.batchConcurrency.min} and ${VALIDATION_LIMITS.batchConcurrency.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE,
      });
    }

    if (batch.delayBetweenBatches !== undefined) {
      if (
        typeof batch.delayBetweenBatches !== 'number' ||
        batch.delayBetweenBatches < VALIDATION_LIMITS.batchDelay.min ||
        batch.delayBetweenBatches > VALIDATION_LIMITS.batchDelay.max
      ) {
        errors.push({
          field: 'batchConfig.delayBetweenBatches',
          message: `delayBetweenBatches must be between ${VALIDATION_LIMITS.batchDelay.min} and ${VALIDATION_LIMITS.batchDelay.max}`,
          code: ConfigErrorCode.OUT_OF_RANGE,
        });
      }
    }
  }

  private static validateMultiTenancyConfig(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    _warnings: ConfigValidationWarning[]
  ): void {
    if (!config.multiTenancy) return;

    const multiTenancy = config.multiTenancy;

    if (typeof multiTenancy.enabled !== 'boolean') {
      errors.push({
        field: 'multiTenancy.enabled',
        message: 'enabled must be a boolean',
        code: ConfigErrorCode.INVALID_TYPE,
      });
    }

    if (
      typeof multiTenancy.scopeField !== 'string' ||
      !multiTenancy.scopeField.trim()
    ) {
      errors.push({
        field: 'multiTenancy.scopeField',
        message: 'scopeField must be a non-empty string',
        code: ConfigErrorCode.INVALID_VALUE,
      });
    } else if (!TENANT_SCOPE_REGEX.test(multiTenancy.scopeField)) {
      errors.push({
        field: 'multiTenancy.scopeField',
        message:
          'scopeField must contain only alphanumeric characters, underscores, and hyphens, starting with a letter',
        code: ConfigErrorCode.INVALID_FORMAT,
      });
    }

    if (typeof multiTenancy.getScopeValue !== 'function') {
      errors.push({
        field: 'multiTenancy.getScopeValue',
        message: 'getScopeValue must be a function',
        code: ConfigErrorCode.INVALID_TYPE,
      });
    }
  }

  private static validateObservabilityConfig(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    _warnings: ConfigValidationWarning[]
  ): void {
    if (!config.observability) return;

    const obs = config.observability;

    if (typeof obs.metricsEnabled !== 'boolean') {
      errors.push({
        field: 'observability.metricsEnabled',
        message: 'metricsEnabled must be a boolean',
        code: ConfigErrorCode.INVALID_TYPE,
      });
    }

    if (typeof obs.tracingEnabled !== 'boolean') {
      errors.push({
        field: 'observability.tracingEnabled',
        message: 'tracingEnabled must be a boolean',
        code: ConfigErrorCode.INVALID_TYPE,
      });
    }

    if (!LOG_LEVELS.includes(obs.logLevel)) {
      errors.push({
        field: 'observability.logLevel',
        message: `logLevel must be one of: ${LOG_LEVELS.join(', ')}`,
        code: ConfigErrorCode.INVALID_VALUE,
        details: { validLevels: LOG_LEVELS },
      });
    }
  }

  private static validateBehaviorOptions(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    const booleanFields = [
      'usePlural',
      'emailNormalization',
      'softDeletes',
      'debugMode',
      'dryRun',
    ];

    booleanFields.forEach(field => {
      const value = (config as any)[field];
      if (value !== undefined && typeof value !== 'boolean') {
        errors.push({
          field,
          message: `${field} must be a boolean`,
          code: ConfigErrorCode.INVALID_TYPE,
        });
      }
    });

    // Warn about dry run mode
    if (config.dryRun === true) {
      warnings.push({
        field: 'dryRun',
        message: 'Dry run mode is enabled - no actual API calls will be made',
        suggestion: 'Disable dry run mode for production use',
      });
    }
  }

  private static validateConflictingOptions(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    // Check if both apiKey and custom fetchImpl are provided
    if (config.apiKey && config.fetchImpl) {
      warnings.push({
        field: 'authentication',
        message: 'Both apiKey and custom fetchImpl provided',
        suggestion: 'Ensure custom fetchImpl handles authentication properly',
      });
    }

    // Check if cache is enabled but no cache config provided
    if (config.cacheConfig?.enabled && !config.cacheConfig.ttlMs) {
      errors.push({
        field: 'cacheConfig',
        message: 'Cache is enabled but ttlMs is not specified',
        code: ConfigErrorCode.REQUIRED_FIELD,
      });
    }
  }

  private static validateSecuritySettings(
    config: ApsoAdapterConfig,
    _errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    // Check for insecure timeout values
    if (config.timeout && config.timeout > 120000) {
      // > 2 minutes
      warnings.push({
        field: 'timeout',
        message: 'Very high timeout value may cause performance issues',
        suggestion: 'Consider reducing timeout for better responsiveness',
      });
    }

    // Check for insecure retry settings
    if (config.retryConfig && config.retryConfig.maxRetries > 5) {
      warnings.push({
        field: 'retryConfig.maxRetries',
        message: 'High retry count may cause excessive API load',
        suggestion: 'Consider reducing retry attempts',
      });
    }

    // Debug mode warning
    if (config.debugMode === true) {
      warnings.push({
        field: 'debugMode',
        message: 'Debug mode is enabled - sensitive information may be logged',
        suggestion: 'Disable debug mode in production environments',
      });
    }
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  private static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (Array.isArray(obj))
      return obj.map(item => this.deepClone(item)) as unknown as T;

    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  private static formatValidationErrors(
    errors: ConfigValidationError[]
  ): string {
    return errors.map(error => `${error.field}: ${error.message}`).join('; ');
  }
}

// =============================================================================
// Export Default Instance
// =============================================================================

export const configValidator = ConfigValidator;
