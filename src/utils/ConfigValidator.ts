/**
 * Configuration Validator for ApsoAdapterConfig
 * Provides comprehensive runtime validation, normalization, and health checks
 */

import { 
  ApsoAdapterConfig, 
  LogLevel,
  AdapterError,
  AdapterErrorCode 
} from '../types/index.js';

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
  SECURITY_RISK = 'SECURITY_RISK'
}

// =============================================================================
// Validation Constants
// =============================================================================

const VALIDATION_LIMITS = {
  timeout: { min: 1000, max: 300000 }, // 1s to 5min
  retryAttempts: { min: 0, max: 10 },
  retryDelay: { min: 100, max: 60000 }, // 100ms to 1min
  cacheTtl: { min: 1000, max: 24 * 60 * 60 * 1000 }, // 1s to 24h
  cacheMaxSize: { min: 1, max: 10000 },
  batchSize: { min: 1, max: 1000 },
  batchConcurrency: { min: 1, max: 50 },
  batchDelay: { min: 0, max: 10000 } // 0 to 10s
} as const;

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const URL_PROTOCOL_REGEX = /^https?:\/\//i;
const TENANT_SCOPE_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

// =============================================================================
// ConfigValidator Class
// =============================================================================

export class ConfigValidator {
  /**
   * Validates and normalizes the complete ApsoAdapterConfig
   * @param config - The configuration to validate
   * @returns Validation result with errors, warnings, and normalized config
   */
  public static validateConfig(config: Partial<ApsoAdapterConfig>): ConfigValidationResult {
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
    return {
      valid,
      errors,
      warnings,
      ...(valid ? { normalizedConfig } : {})
    } as ConfigValidationResult;
  }

  /**
   * Validates configuration and throws AdapterError if invalid
   * @param config - The configuration to validate
   * @returns Normalized configuration
   * @throws AdapterError if validation fails
   */
  public static validateAndThrow(config: Partial<ApsoAdapterConfig>): ApsoAdapterConfig {
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
   * Performs async health check validation
   * @param config - Validated configuration
   * @returns Promise resolving to health check result
   */
  public static async validateHealthCheck(config: ApsoAdapterConfig): Promise<{
    healthy: boolean;
    errors: string[];
    latency?: number;
  }> {
    const errors: string[] = [];
    let latency: number | undefined;

    try {
      const startTime = Date.now();
      
      // Attempt a simple HTTP request to baseUrl
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout || 10000);

      const headers: Record<string, string> = {
        'User-Agent': 'Apso-Adapter-HealthCheck/1.0'
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
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        latency = Date.now() - startTime;

        if (!response.ok && response.status !== 404) {
          // 404 is acceptable for health check - means endpoint is reachable
          errors.push(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          errors.push(`Health check timeout after ${config.timeout || 10000}ms`);
        } else {
          errors.push(`Network error: ${fetchError.message}`);
        }
      }

    } catch (error: any) {
      errors.push(`Health check failed: ${error.message}`);
    }

    const result: { healthy: boolean; errors: string[]; latency?: number } = {
      healthy: errors.length === 0,
      errors
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
        code: ConfigErrorCode.REQUIRED_FIELD
      });
    }
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
        code: ConfigErrorCode.INVALID_FORMAT
      });
      return;
    }

    try {
      const url = new URL(config.baseUrl);
      
      // Security check for HTTPS in production
      if (url.protocol === 'http:' && !url.hostname.includes('localhost') && !url.hostname.startsWith('127.')) {
        warnings.push({
          field: 'baseUrl',
          message: 'Using HTTP instead of HTTPS may pose security risks',
          suggestion: 'Consider using HTTPS for production environments'
        });
      }

      // Normalize URL (remove trailing slash)
      if (config.baseUrl.endsWith('/')) {
        config.baseUrl = config.baseUrl.slice(0, -1);
        warnings.push({
          field: 'baseUrl',
          message: 'Removed trailing slash from baseUrl',
          suggestion: 'Avoid trailing slashes in baseUrl'
        });
      }

      // Validate port if specified
      if (url.port) {
        const port = parseInt(url.port, 10);
        if (port < 1 || port > 65535) {
          errors.push({
            field: 'baseUrl',
            message: 'Invalid port number in baseUrl',
            code: ConfigErrorCode.OUT_OF_RANGE,
            details: { port }
          });
        }
      }

    } catch (urlError) {
      errors.push({
        field: 'baseUrl',
        message: 'Invalid URL format',
        code: ConfigErrorCode.INVALID_FORMAT,
        details: { error: urlError instanceof Error ? urlError.message : String(urlError) }
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
        message: 'No authentication configured',
        suggestion: 'Consider setting apiKey or authHeader for secure API access'
      });
    }

    if (config.apiKey && typeof config.apiKey !== 'string') {
      errors.push({
        field: 'apiKey',
        message: 'apiKey must be a string',
        code: ConfigErrorCode.INVALID_TYPE
      });
    }

    if (config.apiKey && config.apiKey.length < 8) {
      warnings.push({
        field: 'apiKey',
        message: 'API key appears to be very short',
        suggestion: 'Ensure API key is valid and sufficiently secure'
      });
    }

    if (config.authHeader && typeof config.authHeader !== 'string') {
      errors.push({
        field: 'authHeader',
        message: 'authHeader must be a string',
        code: ConfigErrorCode.INVALID_TYPE
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
          code: ConfigErrorCode.INVALID_VALUE
        });
      } else if (config.timeout < VALIDATION_LIMITS.timeout.min || config.timeout > VALIDATION_LIMITS.timeout.max) {
        errors.push({
          field: 'timeout',
          message: `timeout must be between ${VALIDATION_LIMITS.timeout.min} and ${VALIDATION_LIMITS.timeout.max} milliseconds`,
          code: ConfigErrorCode.OUT_OF_RANGE,
          details: { min: VALIDATION_LIMITS.timeout.min, max: VALIDATION_LIMITS.timeout.max }
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
        retryableStatuses: [...RETRYABLE_STATUS_CODES]
      };
      return;
    }

    const retry = config.retryConfig;

    // Validate maxRetries
    if (typeof retry.maxRetries !== 'number' || retry.maxRetries < VALIDATION_LIMITS.retryAttempts.min || retry.maxRetries > VALIDATION_LIMITS.retryAttempts.max) {
      errors.push({
        field: 'retryConfig.maxRetries',
        message: `maxRetries must be between ${VALIDATION_LIMITS.retryAttempts.min} and ${VALIDATION_LIMITS.retryAttempts.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE,
        details: { min: VALIDATION_LIMITS.retryAttempts.min, max: VALIDATION_LIMITS.retryAttempts.max }
      });
    }

    // Validate initialDelayMs
    if (typeof retry.initialDelayMs !== 'number' || retry.initialDelayMs < VALIDATION_LIMITS.retryDelay.min || retry.initialDelayMs > VALIDATION_LIMITS.retryDelay.max) {
      errors.push({
        field: 'retryConfig.initialDelayMs',
        message: `initialDelayMs must be between ${VALIDATION_LIMITS.retryDelay.min} and ${VALIDATION_LIMITS.retryDelay.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE
      });
    }

    // Validate maxDelayMs
    if (typeof retry.maxDelayMs !== 'number' || retry.maxDelayMs < VALIDATION_LIMITS.retryDelay.min || retry.maxDelayMs > VALIDATION_LIMITS.retryDelay.max) {
      errors.push({
        field: 'retryConfig.maxDelayMs',
        message: `maxDelayMs must be between ${VALIDATION_LIMITS.retryDelay.min} and ${VALIDATION_LIMITS.retryDelay.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE
      });
    }

    // Ensure maxDelayMs >= initialDelayMs
    if (retry.maxDelayMs < retry.initialDelayMs) {
      errors.push({
        field: 'retryConfig.maxDelayMs',
        message: 'maxDelayMs must be greater than or equal to initialDelayMs',
        code: ConfigErrorCode.INVALID_VALUE
      });
    }

    // Validate retryableStatuses
    if (!Array.isArray(retry.retryableStatuses)) {
      errors.push({
        field: 'retryConfig.retryableStatuses',
        message: 'retryableStatuses must be an array of HTTP status codes',
        code: ConfigErrorCode.INVALID_TYPE
      });
    } else {
      const invalidStatuses = retry.retryableStatuses.filter(status => 
        typeof status !== 'number' || status < 100 || status > 599
      );
      if (invalidStatuses.length > 0) {
        errors.push({
          field: 'retryConfig.retryableStatuses',
          message: 'retryableStatuses must contain valid HTTP status codes (100-599)',
          code: ConfigErrorCode.INVALID_VALUE,
          details: { invalidStatuses }
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
        code: ConfigErrorCode.INVALID_TYPE
      });
    }

    if (typeof cache.ttlMs !== 'number' || cache.ttlMs < VALIDATION_LIMITS.cacheTtl.min || cache.ttlMs > VALIDATION_LIMITS.cacheTtl.max) {
      errors.push({
        field: 'cacheConfig.ttlMs',
        message: `ttlMs must be between ${VALIDATION_LIMITS.cacheTtl.min} and ${VALIDATION_LIMITS.cacheTtl.max} milliseconds`,
        code: ConfigErrorCode.OUT_OF_RANGE
      });
    }

    if (typeof cache.maxSize !== 'number' || cache.maxSize < VALIDATION_LIMITS.cacheMaxSize.min || cache.maxSize > VALIDATION_LIMITS.cacheMaxSize.max) {
      errors.push({
        field: 'cacheConfig.maxSize',
        message: `maxSize must be between ${VALIDATION_LIMITS.cacheMaxSize.min} and ${VALIDATION_LIMITS.cacheMaxSize.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE
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

    if (typeof batch.batchSize !== 'number' || batch.batchSize < VALIDATION_LIMITS.batchSize.min || batch.batchSize > VALIDATION_LIMITS.batchSize.max) {
      errors.push({
        field: 'batchConfig.batchSize',
        message: `batchSize must be between ${VALIDATION_LIMITS.batchSize.min} and ${VALIDATION_LIMITS.batchSize.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE
      });
    }

    if (typeof batch.concurrency !== 'number' || batch.concurrency < VALIDATION_LIMITS.batchConcurrency.min || batch.concurrency > VALIDATION_LIMITS.batchConcurrency.max) {
      errors.push({
        field: 'batchConfig.concurrency',
        message: `concurrency must be between ${VALIDATION_LIMITS.batchConcurrency.min} and ${VALIDATION_LIMITS.batchConcurrency.max}`,
        code: ConfigErrorCode.OUT_OF_RANGE
      });
    }

    if (batch.delayBetweenBatches !== undefined) {
      if (typeof batch.delayBetweenBatches !== 'number' || batch.delayBetweenBatches < VALIDATION_LIMITS.batchDelay.min || batch.delayBetweenBatches > VALIDATION_LIMITS.batchDelay.max) {
        errors.push({
          field: 'batchConfig.delayBetweenBatches',
          message: `delayBetweenBatches must be between ${VALIDATION_LIMITS.batchDelay.min} and ${VALIDATION_LIMITS.batchDelay.max}`,
          code: ConfigErrorCode.OUT_OF_RANGE
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
        code: ConfigErrorCode.INVALID_TYPE
      });
    }

    if (typeof multiTenancy.scopeField !== 'string' || !multiTenancy.scopeField.trim()) {
      errors.push({
        field: 'multiTenancy.scopeField',
        message: 'scopeField must be a non-empty string',
        code: ConfigErrorCode.INVALID_VALUE
      });
    } else if (!TENANT_SCOPE_REGEX.test(multiTenancy.scopeField)) {
      errors.push({
        field: 'multiTenancy.scopeField',
        message: 'scopeField must contain only alphanumeric characters, underscores, and hyphens, starting with a letter',
        code: ConfigErrorCode.INVALID_FORMAT
      });
    }

    if (typeof multiTenancy.getScopeValue !== 'function') {
      errors.push({
        field: 'multiTenancy.getScopeValue',
        message: 'getScopeValue must be a function',
        code: ConfigErrorCode.INVALID_TYPE
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
        code: ConfigErrorCode.INVALID_TYPE
      });
    }

    if (typeof obs.tracingEnabled !== 'boolean') {
      errors.push({
        field: 'observability.tracingEnabled',
        message: 'tracingEnabled must be a boolean',
        code: ConfigErrorCode.INVALID_TYPE
      });
    }

    if (!LOG_LEVELS.includes(obs.logLevel)) {
      errors.push({
        field: 'observability.logLevel',
        message: `logLevel must be one of: ${LOG_LEVELS.join(', ')}`,
        code: ConfigErrorCode.INVALID_VALUE,
        details: { validLevels: LOG_LEVELS }
      });
    }
  }

  private static validateBehaviorOptions(
    config: ApsoAdapterConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    const booleanFields = ['usePlural', 'emailNormalization', 'softDeletes', 'debugMode', 'dryRun'];
    
    booleanFields.forEach(field => {
      const value = (config as any)[field];
      if (value !== undefined && typeof value !== 'boolean') {
        errors.push({
          field,
          message: `${field} must be a boolean`,
          code: ConfigErrorCode.INVALID_TYPE
        });
      }
    });

    // Warn about dry run mode
    if (config.dryRun === true) {
      warnings.push({
        field: 'dryRun',
        message: 'Dry run mode is enabled - no actual API calls will be made',
        suggestion: 'Disable dry run mode for production use'
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
        suggestion: 'Ensure custom fetchImpl handles authentication properly'
      });
    }

    // Check if cache is enabled but no cache config provided
    if (config.cacheConfig?.enabled && !config.cacheConfig.ttlMs) {
      errors.push({
        field: 'cacheConfig',
        message: 'Cache is enabled but ttlMs is not specified',
        code: ConfigErrorCode.REQUIRED_FIELD
      });
    }
  }

  private static validateSecuritySettings(
    config: ApsoAdapterConfig,
    _errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    // Check for insecure timeout values
    if (config.timeout && config.timeout > 120000) { // > 2 minutes
      warnings.push({
        field: 'timeout',
        message: 'Very high timeout value may cause performance issues',
        suggestion: 'Consider reducing timeout for better responsiveness'
      });
    }

    // Check for insecure retry settings
    if (config.retryConfig && config.retryConfig.maxRetries > 5) {
      warnings.push({
        field: 'retryConfig.maxRetries',
        message: 'High retry count may cause excessive API load',
        suggestion: 'Consider reducing retry attempts'
      });
    }

    // Debug mode warning
    if (config.debugMode === true) {
      warnings.push({
        field: 'debugMode',
        message: 'Debug mode is enabled - sensitive information may be logged',
        suggestion: 'Disable debug mode in production environments'
      });
    }
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  private static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item)) as unknown as T;
    
    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  private static formatValidationErrors(errors: ConfigValidationError[]): string {
    return errors
      .map(error => `${error.field}: ${error.message}`)
      .join('; ');
  }
}

// =============================================================================
// Export Default Instance
// =============================================================================

export const configValidator = ConfigValidator;