# Configuration Guide

This guide covers all configuration options available for the Better Auth Apso Adapter.

## Table of Contents

- [Quick Configuration](#quick-configuration)
- [Complete Configuration Reference](#complete-configuration-reference)
- [Environment Variables](#environment-variables)
- [Configuration Patterns](#configuration-patterns)
- [Performance Tuning](#performance-tuning)
- [Security Configuration](#security-configuration)
- [Development vs Production](#development-vs-production)

## Quick Configuration

### Minimal Setup

```typescript
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
});
```

### Recommended Production Setup

```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  timeout: 30000,
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  cacheConfig: {
    enabled: true,
    ttlMs: 300000, // 5 minutes
    maxSize: 1000,
  },
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'info',
  },
});
```

## Complete Configuration Reference

### `ApsoAdapterConfig` Interface

```typescript
interface ApsoAdapterConfig {
  // Required
  baseUrl: string;

  // Authentication
  apiKey?: string;
  authHeader?: string;

  // HTTP Client
  fetchImpl?: HttpClient;
  timeout?: number;

  // Retry
  retryConfig?: RetryConfig;

  // Performance
  cacheConfig?: CacheConfig;
  batchConfig?: BatchConfig;

  // Multi-tenancy
  multiTenancy?: MultiTenancyConfig;

  // Observability
  observability?: ObservabilityConfig;
  logger?: Logger;

  // Behavior
  usePlural?: boolean;
  emailNormalization?: boolean;
  softDeletes?: boolean;

  // Development
  debugMode?: boolean;
  dryRun?: boolean;
}
```

### Core Settings

#### `baseUrl` (Required)

The base URL of your Apso API endpoint.

```typescript
{
  baseUrl: 'https://api.yourdomain.com'
}
```

**Environment Variable**: `APSO_BASE_URL`

#### `apiKey` (Optional)

API key for authenticating requests to your Apso API.

```typescript
{
  apiKey: 'your-secret-api-key'
}
```

**Environment Variable**: `APSO_API_KEY`

#### `authHeader` (Optional)

Custom authorization header name. Defaults to `'Authorization'`.

```typescript
{
  authHeader: 'X-API-Key' // Will send: X-API-Key: Bearer your-api-key
}
```

#### `timeout` (Optional)

Request timeout in milliseconds. Default: `10000` (10 seconds).

```typescript
{
  timeout: 30000 // 30 seconds
}
```

### Retry Configuration

Controls how failed requests are retried.

```typescript
interface RetryConfig {
  maxRetries: number;        // Default: 3
  initialDelayMs: number;    // Default: 1000 (1 second)
  maxDelayMs: number;        // Default: 10000 (10 seconds)
  retryableStatuses: number[]; // Default: [429, 500, 502, 503, 504]
}
```

#### Examples

**Conservative Retry Policy:**
```typescript
{
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    retryableStatuses: [429, 502, 503, 504],
  }
}
```

**Aggressive Retry Policy:**
```typescript
{
  retryConfig: {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    retryableStatuses: [429, 500, 502, 503, 504, 408],
  }
}
```

**Disable Retries:**
```typescript
{
  retryConfig: {
    maxRetries: 0,
    initialDelayMs: 0,
    maxDelayMs: 0,
    retryableStatuses: [],
  }
}
```

### Cache Configuration

Response caching for improved performance.

```typescript
interface CacheConfig {
  enabled: boolean;    // Default: false
  ttlMs: number;      // Default: 300000 (5 minutes)
  maxSize: number;    // Default: 1000 entries
}
```

#### Examples

**Basic Caching:**
```typescript
{
  cacheConfig: {
    enabled: true,
    ttlMs: 600000, // 10 minutes
    maxSize: 2000,
  }
}
```

**Short-term Caching:**
```typescript
{
  cacheConfig: {
    enabled: true,
    ttlMs: 60000, // 1 minute
    maxSize: 500,
  }
}
```

**Disable Caching:**
```typescript
{
  cacheConfig: {
    enabled: false,
  }
}
```

### Batch Configuration

Settings for batch operations to improve throughput.

```typescript
interface BatchConfig {
  batchSize: number;           // Default: 50
  concurrency: number;         // Default: 3
  delayBetweenBatches?: number; // Default: 100ms
}
```

#### Examples

**High Throughput:**
```typescript
{
  batchConfig: {
    batchSize: 200,
    concurrency: 10,
    delayBetweenBatches: 50,
  }
}
```

**Conservative Batching:**
```typescript
{
  batchConfig: {
    batchSize: 25,
    concurrency: 2,
    delayBetweenBatches: 500,
  }
}
```

### Multi-Tenancy Configuration

Enable multi-tenant support with automatic scope isolation.

```typescript
interface MultiTenancyConfig {
  enabled: boolean;
  scopeField: string;
  getScopeValue: () => string | Promise<string>;
}
```

#### Examples

**Basic Multi-Tenancy:**
```typescript
{
  multiTenancy: {
    enabled: true,
    scopeField: 'tenantId',
    getScopeValue: () => getCurrentTenantId(),
  }
}
```

**Async Tenant Resolution:**
```typescript
{
  multiTenancy: {
    enabled: true,
    scopeField: 'organizationId',
    getScopeValue: async () => {
      const user = await getCurrentUser();
      return user.organizationId;
    },
  }
}
```

### Observability Configuration

Monitoring, metrics, and logging settings.

```typescript
interface ObservabilityConfig {
  metricsEnabled: boolean;     // Default: false
  tracingEnabled: boolean;     // Default: false
  logLevel: LogLevel;         // Default: 'warn'
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

#### Examples

**Production Observability:**
```typescript
{
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'info',
  }
}
```

**Debug Mode:**
```typescript
{
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'debug',
  }
}
```

**Minimal Logging:**
```typescript
{
  observability: {
    metricsEnabled: false,
    tracingEnabled: false,
    logLevel: 'error',
  }
}
```

### Custom Logger

Provide your own logger implementation.

```typescript
interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}
```

#### Examples

**Winston Logger:**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.Console(),
  ],
});

{
  logger: {
    debug: (message, meta) => logger.debug(message, meta),
    info: (message, meta) => logger.info(message, meta),
    warn: (message, meta) => logger.warn(message, meta),
    error: (message, meta) => logger.error(message, meta),
  }
}
```

**Console Logger:**
```typescript
{
  logger: {
    debug: (message, meta) => console.debug(`[DEBUG] ${message}`, meta),
    info: (message, meta) => console.info(`[INFO] ${message}`, meta),
    warn: (message, meta) => console.warn(`[WARN] ${message}`, meta),
    error: (message, meta) => console.error(`[ERROR] ${message}`, meta),
  }
}
```

### Behavior Settings

#### `usePlural` (Optional)

Use plural endpoint names. Default: `true`.

```typescript
{
  usePlural: true // /users instead of /user
}
```

#### `emailNormalization` (Optional)

Enable automatic email normalization (lowercase, trim). Default: `true`.

```typescript
{
  emailNormalization: true
}
```

#### `softDeletes` (Optional)

Enable soft delete support. Default: `false`.

```typescript
{
  softDeletes: true // Sets deleted_at instead of removing records
}
```

### Development Settings

#### `debugMode` (Optional)

Enable verbose debug logging. Default: `false`.

```typescript
{
  debugMode: process.env.NODE_ENV === 'development'
}
```

#### `dryRun` (Optional)

Enable dry-run mode (no actual API calls). Default: `false`.

```typescript
{
  dryRun: process.env.NODE_ENV === 'test'
}
```

## Environment Variables

### Required Variables

```env
APSO_BASE_URL=https://your-apso-api.com
```

### Optional Variables

```env
APSO_API_KEY=your-secret-api-key
APSO_TIMEOUT=30000
APSO_DEBUG=false
APSO_DRY_RUN=false
APSO_CACHE_ENABLED=true
APSO_CACHE_TTL=300000
APSO_RETRY_MAX=3
APSO_BATCH_SIZE=50
APSO_LOG_LEVEL=info
```

### Loading Environment Variables

```typescript
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  timeout: parseInt(process.env.APSO_TIMEOUT || '10000'),
  debugMode: process.env.APSO_DEBUG === 'true',
  dryRun: process.env.APSO_DRY_RUN === 'true',
  
  cacheConfig: {
    enabled: process.env.APSO_CACHE_ENABLED !== 'false',
    ttlMs: parseInt(process.env.APSO_CACHE_TTL || '300000'),
    maxSize: parseInt(process.env.APSO_CACHE_SIZE || '1000'),
  },
  
  retryConfig: {
    maxRetries: parseInt(process.env.APSO_RETRY_MAX || '3'),
    initialDelayMs: parseInt(process.env.APSO_RETRY_DELAY || '1000'),
    maxDelayMs: parseInt(process.env.APSO_RETRY_MAX_DELAY || '10000'),
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  
  observability: {
    metricsEnabled: process.env.APSO_METRICS !== 'false',
    tracingEnabled: process.env.APSO_TRACING === 'true',
    logLevel: (process.env.APSO_LOG_LEVEL as any) || 'warn',
  },
});
```

## Configuration Patterns

### Development Configuration

```typescript
const developmentConfig = {
  baseUrl: 'http://localhost:3001/api',
  debugMode: true,
  timeout: 5000,
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'debug' as const,
  },
  cacheConfig: {
    enabled: false, // Disable caching in development
  },
  retryConfig: {
    maxRetries: 1, // Fail fast in development
    initialDelayMs: 100,
    maxDelayMs: 1000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
};
```

### Production Configuration

```typescript
const productionConfig = {
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  timeout: 30000,
  
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  
  cacheConfig: {
    enabled: true,
    ttlMs: 300000, // 5 minutes
    maxSize: 2000,
  },
  
  batchConfig: {
    batchSize: 100,
    concurrency: 5,
    delayBetweenBatches: 100,
  },
  
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'info' as const,
  },
  
  emailNormalization: true,
  softDeletes: true,
};
```

### Test Configuration

```typescript
const testConfig = {
  baseUrl: 'http://localhost:3001/api',
  dryRun: true, // No actual API calls
  debugMode: true,
  timeout: 1000,
  
  retryConfig: {
    maxRetries: 0, // No retries in tests
    initialDelayMs: 0,
    maxDelayMs: 0,
    retryableStatuses: [],
  },
  
  cacheConfig: {
    enabled: false, // No caching in tests
  },
  
  observability: {
    metricsEnabled: false,
    tracingEnabled: false,
    logLevel: 'error' as const, // Suppress logs in tests
  },
};
```

### Multi-Environment Setup

```typescript
interface EnvironmentConfig {
  [key: string]: Partial<ApsoAdapterConfig>;
}

const environmentConfigs: EnvironmentConfig = {
  development: {
    baseUrl: 'http://localhost:3001/api',
    debugMode: true,
    observability: { logLevel: 'debug' },
    cacheConfig: { enabled: false },
    retryConfig: { maxRetries: 1 },
  },
  
  staging: {
    baseUrl: process.env.STAGING_APSO_BASE_URL!,
    apiKey: process.env.STAGING_APSO_API_KEY,
    timeout: 15000,
    observability: { logLevel: 'info' },
    cacheConfig: { enabled: true, ttlMs: 120000 },
    retryConfig: { maxRetries: 2 },
  },
  
  production: {
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
    timeout: 30000,
    observability: { logLevel: 'warn', metricsEnabled: true },
    cacheConfig: { enabled: true, ttlMs: 300000 },
    retryConfig: { maxRetries: 3 },
  },
};

const environment = process.env.NODE_ENV || 'development';
const config = environmentConfigs[environment];

const adapter = apsoAdapter(config);
```

## Performance Tuning

### High-Throughput Applications

```typescript
const highThroughputConfig = {
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  // Longer timeout for high volume
  timeout: 60000,
  
  // Aggressive caching
  cacheConfig: {
    enabled: true,
    ttlMs: 600000, // 10 minutes
    maxSize: 5000,
  },
  
  // Large batch operations
  batchConfig: {
    batchSize: 500,
    concurrency: 20,
    delayBetweenBatches: 50,
  },
  
  // Conservative retry policy
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 2000,
    maxDelayMs: 15000,
    retryableStatuses: [429, 502, 503, 504],
  },
  
  // Minimal observability overhead
  observability: {
    metricsEnabled: true,
    tracingEnabled: false,
    logLevel: 'warn' as const,
  },
};
```

### Low-Latency Applications

```typescript
const lowLatencyConfig = {
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  // Short timeout for quick failures
  timeout: 5000,
  
  // Aggressive caching
  cacheConfig: {
    enabled: true,
    ttlMs: 60000, // 1 minute
    maxSize: 1000,
  },
  
  // Small, fast batches
  batchConfig: {
    batchSize: 10,
    concurrency: 3,
    delayBetweenBatches: 10,
  },
  
  // Quick retries
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    retryableStatuses: [429, 502, 503, 504],
  },
  
  // Disable expensive operations
  emailNormalization: false,
  
  observability: {
    metricsEnabled: false,
    tracingEnabled: false,
    logLevel: 'error' as const,
  },
};
```

## Security Configuration

### API Key Authentication

```typescript
const secureConfig = {
  baseUrl: 'https://api.yourdomain.com', // Always use HTTPS
  apiKey: process.env.APSO_API_KEY,
  authHeader: 'Authorization', // Default
  
  // Reasonable timeout
  timeout: 30000,
  
  // Validate all inputs
  emailNormalization: true,
};
```

### Custom Authentication Header

```typescript
const customAuthConfig = {
  baseUrl: 'https://api.yourdomain.com',
  apiKey: process.env.APSO_API_KEY,
  authHeader: 'X-API-Key', // Custom header
};
```

### Disable Sensitive Features in Production

```typescript
const productionSecurityConfig = {
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  // Disable debug features
  debugMode: false,
  dryRun: false,
  
  // Minimal logging
  observability: {
    logLevel: 'warn' as const,
    metricsEnabled: true,
    tracingEnabled: false, // Disable if contains sensitive data
  },
  
  // Enable security features
  emailNormalization: true,
  softDeletes: true,
};
```

## Development vs Production

### Development Setup

Focus on debugging and fast development cycles:

```typescript
const devAdapter = apsoAdapter({
  baseUrl: 'http://localhost:3001/api',
  
  // Development features
  debugMode: true,
  dryRun: false,
  
  // Fast failures
  timeout: 5000,
  retryConfig: {
    maxRetries: 1,
    initialDelayMs: 100,
    maxDelayMs: 500,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  
  // No caching for fresh data
  cacheConfig: {
    enabled: false,
  },
  
  // Verbose logging
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'debug',
  },
});
```

### Production Setup

Focus on reliability and performance:

```typescript
const prodAdapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  // Production settings
  debugMode: false,
  timeout: 30000,
  
  // Resilient retry policy
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  
  // Performance optimization
  cacheConfig: {
    enabled: true,
    ttlMs: 300000,
    maxSize: 1000,
  },
  
  batchConfig: {
    batchSize: 100,
    concurrency: 5,
    delayBetweenBatches: 100,
  },
  
  // Production monitoring
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'info',
  },
  
  // Security features
  emailNormalization: true,
  softDeletes: true,
});
```

## Configuration Validation

The adapter automatically validates configuration on startup:

```typescript
// Invalid configuration will throw an error
try {
  const adapter = apsoAdapter({
    baseUrl: '', // Invalid: empty string
    timeout: -1, // Invalid: negative number
    retryConfig: {
      maxRetries: -1, // Invalid: negative retries
    },
  });
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

Common validation errors:
- Empty or invalid `baseUrl`
- Negative timeout values
- Invalid retry configuration
- Invalid cache settings
- Missing required environment variables

For more information, see the [API Reference](./api-reference.md) and [Troubleshooting Guide](./troubleshooting.md).