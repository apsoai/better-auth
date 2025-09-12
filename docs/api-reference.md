# API Reference

Complete API reference for the Better Auth Apso Adapter.

## Table of Contents

- [Adapter Factory Functions](#adapter-factory-functions)
- [Adapter Interface](#adapter-interface)
- [Configuration Types](#configuration-types)
- [Error Types](#error-types)
- [Utility Functions](#utility-functions)
- [Type Definitions](#type-definitions)
- [Examples](#examples)

## Adapter Factory Functions

### `apsoAdapter(config: ApsoAdapterConfig): ApsoAdapter`

Creates a standard Better Auth adapter for Apso APIs.

**Parameters:**
- `config`: [`ApsoAdapterConfig`](#apsoadapterconfig) - Configuration object

**Returns:**
- [`ApsoAdapter`](#apsoadapter) - Configured adapter instance

**Example:**
```typescript
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

const adapter = apsoAdapter({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
  timeout: 10000,
});
```

---

### `createApsoAdapter(config: ApsoAdapterConfig): ApsoAdapter`

Alias for `apsoAdapter()`. Creates a standard adapter instance.

**Parameters:**
- `config`: [`ApsoAdapterConfig`](#apsoadapterconfig) - Configuration object

**Returns:**
- [`ApsoAdapter`](#apsoadapter) - Configured adapter instance

---

### `createReliableApsoAdapter(config: ApsoAdapterConfig): ApsoAdapter`

Creates an adapter optimized for reliability with enhanced retry logic and error handling.

**Parameters:**
- `config`: [`ApsoAdapterConfig`](#apsoadapterconfig) - Configuration object

**Returns:**
- [`ApsoAdapter`](#apsoadapter) - Configured adapter with reliability optimizations

**Optimizations Applied:**
- Enhanced retry configuration (5 retries, exponential backoff)
- Circuit breaker pattern
- Extended timeout (30 seconds)
- Comprehensive error recovery

**Example:**
```typescript
import { createReliableApsoAdapter } from '@apso/better-auth-apso-adapter';

const adapter = createReliableApsoAdapter({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
});

// Automatically configured with:
// - maxRetries: 5
// - initialDelayMs: 2000
// - maxDelayMs: 30000
// - timeout: 30000
// - circuitBreaker: enabled
```

---

### `createHighThroughputApsoAdapter(config: ApsoAdapterConfig): ApsoAdapter`

Creates an adapter optimized for high-throughput operations.

**Parameters:**
- `config`: [`ApsoAdapterConfig`](#apsoadapterconfig) - Configuration object

**Returns:**
- [`ApsoAdapter`](#apsoadapter) - Configured adapter with performance optimizations

**Optimizations Applied:**
- Increased batch sizes (500 items)
- Higher concurrency (10 concurrent requests)
- Connection pooling enabled
- Aggressive caching
- Reduced retry delays

**Example:**
```typescript
import { createHighThroughputApsoAdapter } from '@apso/better-auth-apso-adapter';

const adapter = createHighThroughputApsoAdapter({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
});

// Automatically configured with:
// - batchSize: 500
// - concurrency: 10
// - cacheEnabled: true
// - connectionPooling: enabled
```

---

### `checkAdapterHealth(adapter: ApsoAdapter): Promise<boolean>`

Performs a health check on an adapter instance.

**Parameters:**
- `adapter`: [`ApsoAdapter`](#apsoadapter) - Adapter instance to check

**Returns:**
- `Promise<boolean>` - True if adapter is healthy

**Example:**
```typescript
import { apsoAdapter, checkAdapterHealth } from '@apso/better-auth-apso-adapter';

const adapter = apsoAdapter({ baseUrl: 'https://api.example.com' });

const isHealthy = await checkAdapterHealth(adapter);
if (!isHealthy) {
  console.error('Adapter health check failed');
}
```

---

### `getActiveAdapters(): ApsoAdapter[]`

Returns all currently active adapter instances.

**Returns:**
- `ApsoAdapter[]` - Array of active adapters

**Example:**
```typescript
import { getActiveAdapters } from '@apso/better-auth-apso-adapter';

const adapters = getActiveAdapters();
console.log(`Found ${adapters.length} active adapters`);
```

---

### `closeAllAdapters(): Promise<void>`

Closes all active adapter instances and cleans up resources.

**Returns:**
- `Promise<void>`

**Example:**
```typescript
import { closeAllAdapters } from '@apso/better-auth-apso-adapter';

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closeAllAdapters();
  process.exit(0);
});
```

## Adapter Interface

### `ApsoAdapter`

Extended Better Auth adapter interface with additional capabilities.

```typescript
interface ApsoAdapter extends BetterAuthAdapter {
  // Core configuration
  readonly config: ApsoAdapterConfig;

  // Health check
  healthCheck(): Promise<boolean>;

  // Metrics
  getMetrics(): AdapterMetrics;
  resetMetrics(): void;

  // Cache management
  clearCache(): void;

  // Multi-tenancy
  setTenantContext(tenantId: string): void;
  getTenantContext(): string | null;

  // Batch operations
  createMany<T>(params: CreateManyParams): Promise<T[]>;
  
  // Connection management
  close(): Promise<void>;
}
```

#### Core Methods (Better Auth Interface)

##### `create<T>(params: CreateParams): Promise<T>`

Creates a new record.

**Parameters:**
- `params`: [`CreateParams`](#createparams) - Creation parameters

**Returns:**
- `Promise<T>` - Created record

**Example:**
```typescript
const user = await adapter.create({
  model: 'user',
  data: {
    email: 'user@example.com',
    name: 'John Doe',
  },
  select: ['id', 'email', 'name'],
});
```

---

##### `update<T>(params: UpdateParams): Promise<T>`

Updates an existing record.

**Parameters:**
- `params`: [`UpdateParams`](#updateparams) - Update parameters

**Returns:**
- `Promise<T>` - Updated record

**Example:**
```typescript
const updatedUser = await adapter.update({
  model: 'user',
  where: { id: 'user-123' },
  update: { name: 'Jane Doe' },
  select: ['id', 'name'],
});
```

---

##### `updateMany(params: UpdateManyParams): Promise<number>`

Updates multiple records.

**Parameters:**
- `params`: [`UpdateManyParams`](#updatemanyparams) - Bulk update parameters

**Returns:**
- `Promise<number>` - Number of updated records

**Example:**
```typescript
const updatedCount = await adapter.updateMany({
  model: 'user',
  where: { emailVerified: false },
  update: { emailVerified: true },
});
```

---

##### `delete<T>(params: DeleteParams): Promise<T>`

Deletes a record.

**Parameters:**
- `params`: [`DeleteParams`](#deleteparams) - Deletion parameters

**Returns:**
- `Promise<T>` - Deleted record

**Example:**
```typescript
const deletedUser = await adapter.delete({
  model: 'user',
  where: { id: 'user-123' },
  select: ['id', 'email'],
});
```

---

##### `deleteMany(params: DeleteManyParams): Promise<number>`

Deletes multiple records.

**Parameters:**
- `params`: [`DeleteManyParams`](#deletemanyparams) - Bulk deletion parameters

**Returns:**
- `Promise<number>` - Number of deleted records

**Example:**
```typescript
const deletedCount = await adapter.deleteMany({
  model: 'session',
  where: { expiresAt: { lt: new Date() } },
});
```

---

##### `findOne<T>(params: FindOneParams): Promise<T | null>`

Finds a single record.

**Parameters:**
- `params`: [`FindOneParams`](#findoneparams) - Query parameters

**Returns:**
- `Promise<T | null>` - Found record or null

**Example:**
```typescript
const user = await adapter.findOne({
  model: 'user',
  where: { email: 'user@example.com' },
  select: ['id', 'email', 'emailVerified'],
});
```

---

##### `findMany<T>(params: FindManyParams): Promise<T[]>`

Finds multiple records.

**Parameters:**
- `params`: [`FindManyParams`](#findmanyparams) - Query parameters

**Returns:**
- `Promise<T[]>` - Array of found records

**Example:**
```typescript
const users = await adapter.findMany({
  model: 'user',
  where: { emailVerified: true },
  select: ['id', 'email', 'name'],
  pagination: { page: 1, limit: 50 },
  orderBy: { createdAt: 'desc' },
});
```

---

##### `count(params: CountParams): Promise<number>`

Counts records matching criteria.

**Parameters:**
- `params`: [`CountParams`](#countparams) - Count parameters

**Returns:**
- `Promise<number>` - Number of matching records

**Example:**
```typescript
const userCount = await adapter.count({
  model: 'user',
  where: { emailVerified: true },
});
```

#### Extended Methods

##### `healthCheck(): Promise<boolean>`

Performs a health check on the adapter.

**Returns:**
- `Promise<boolean>` - True if healthy

**Example:**
```typescript
const isHealthy = await adapter.healthCheck();
if (!isHealthy) {
  console.error('Adapter is not healthy');
}
```

---

##### `getMetrics(): AdapterMetrics`

Returns adapter performance metrics.

**Returns:**
- [`AdapterMetrics`](#adaptermetrics) - Current metrics

**Example:**
```typescript
const metrics = adapter.getMetrics();
console.log(`Success rate: ${metrics.successfulRequests / metrics.totalRequests * 100}%`);
console.log(`Average latency: ${metrics.averageLatency}ms`);
console.log(`Cache hit rate: ${metrics.cacheHitRate * 100}%`);
```

---

##### `resetMetrics(): void`

Resets all metrics counters.

**Example:**
```typescript
adapter.resetMetrics();
```

---

##### `clearCache(): void`

Clears the adapter's internal cache.

**Example:**
```typescript
adapter.clearCache();
```

---

##### `setTenantContext(tenantId: string): void`

Sets the current tenant context for multi-tenancy.

**Parameters:**
- `tenantId`: `string` - Tenant identifier

**Example:**
```typescript
adapter.setTenantContext('tenant-123');
```

---

##### `getTenantContext(): string | null`

Gets the current tenant context.

**Returns:**
- `string | null` - Current tenant ID or null

**Example:**
```typescript
const currentTenant = adapter.getTenantContext();
console.log(`Current tenant: ${currentTenant}`);
```

---

##### `createMany<T>(params: CreateManyParams): Promise<T[]>`

Creates multiple records in a batch operation.

**Parameters:**
- `params`: [`CreateManyParams`](#createmanyparams) - Batch creation parameters

**Returns:**
- `Promise<T[]>` - Array of created records

**Example:**
```typescript
const users = await adapter.createMany({
  model: 'user',
  data: [
    { email: 'user1@example.com', name: 'User 1' },
    { email: 'user2@example.com', name: 'User 2' },
    { email: 'user3@example.com', name: 'User 3' },
  ],
  select: ['id', 'email'],
});
```

---

##### `close(): Promise<void>`

Closes the adapter and cleans up resources.

**Returns:**
- `Promise<void>`

**Example:**
```typescript
await adapter.close();
```

## Configuration Types

### `ApsoAdapterConfig`

Main configuration interface for the adapter.

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

**Property Details:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `baseUrl` | `string` | ✅ | - | Base URL of Apso API |
| `apiKey` | `string` | ❌ | - | API authentication key |
| `authHeader` | `string` | ❌ | `'Authorization'` | Auth header name |
| `fetchImpl` | [`HttpClient`](#httpclient) | ❌ | Built-in | Custom HTTP client |
| `timeout` | `number` | ❌ | `10000` | Request timeout (ms) |
| `retryConfig` | [`RetryConfig`](#retryconfig) | ❌ | See below | Retry settings |
| `cacheConfig` | [`CacheConfig`](#cacheconfig) | ❌ | Disabled | Cache settings |
| `batchConfig` | [`BatchConfig`](#batchconfig) | ❌ | See below | Batch settings |
| `multiTenancy` | [`MultiTenancyConfig`](#multitenancyconfig) | ❌ | Disabled | Multi-tenancy config |
| `observability` | [`ObservabilityConfig`](#observabilityconfig) | ❌ | See below | Monitoring config |
| `logger` | [`Logger`](#logger) | ❌ | Console | Custom logger |
| `usePlural` | `boolean` | ❌ | `true` | Use plural endpoints |
| `emailNormalization` | `boolean` | ❌ | `true` | Normalize emails |
| `softDeletes` | `boolean` | ❌ | `false` | Enable soft deletes |
| `debugMode` | `boolean` | ❌ | `false` | Debug logging |
| `dryRun` | `boolean` | ❌ | `false` | Dry-run mode |

---

### `RetryConfig`

Configuration for retry behavior.

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}
```

**Defaults:**
```typescript
{
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [429, 500, 502, 503, 504],
}
```

---

### `CacheConfig`

Configuration for response caching.

```typescript
interface CacheConfig {
  enabled: boolean;
  ttlMs: number;
  maxSize: number;
}
```

**Defaults:**
```typescript
{
  enabled: false,
  ttlMs: 300000, // 5 minutes
  maxSize: 1000,
}
```

---

### `BatchConfig`

Configuration for batch operations.

```typescript
interface BatchConfig {
  batchSize: number;
  concurrency: number;
  delayBetweenBatches?: number;
}
```

**Defaults:**
```typescript
{
  batchSize: 50,
  concurrency: 3,
  delayBetweenBatches: 100,
}
```

---

### `MultiTenancyConfig`

Configuration for multi-tenant support.

```typescript
interface MultiTenancyConfig {
  enabled: boolean;
  scopeField: string;
  getScopeValue: () => string | Promise<string>;
}
```

**Example:**
```typescript
{
  enabled: true,
  scopeField: 'tenantId',
  getScopeValue: () => getCurrentTenantId(),
}
```

---

### `ObservabilityConfig`

Configuration for monitoring and observability.

```typescript
interface ObservabilityConfig {
  metricsEnabled: boolean;
  tracingEnabled: boolean;
  logLevel: LogLevel;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

**Defaults:**
```typescript
{
  metricsEnabled: false,
  tracingEnabled: false,
  logLevel: 'warn',
}
```

## Parameter Types

### `CreateParams`

Parameters for creating a record.

```typescript
interface CreateParams {
  model: string;
  data: Record<string, any>;
  select?: string[];
}
```

---

### `UpdateParams`

Parameters for updating a record.

```typescript
interface UpdateParams {
  model: string;
  where: Record<string, any>;
  update: Record<string, any>;
  select?: string[];
}
```

---

### `UpdateManyParams`

Parameters for updating multiple records.

```typescript
interface UpdateManyParams {
  model: string;
  where?: Record<string, any>;
  update: Record<string, any>;
}
```

---

### `DeleteParams`

Parameters for deleting a record.

```typescript
interface DeleteParams {
  model: string;
  where: Record<string, any>;
  select?: string[];
}
```

---

### `DeleteManyParams`

Parameters for deleting multiple records.

```typescript
interface DeleteManyParams {
  model: string;
  where?: Record<string, any>;
}
```

---

### `FindOneParams`

Parameters for finding a single record.

```typescript
interface FindOneParams {
  model: string;
  where: Record<string, any>;
  select?: string[];
}
```

---

### `FindManyParams`

Parameters for finding multiple records.

```typescript
interface FindManyParams {
  model: string;
  where?: Record<string, any>;
  select?: string[];
  pagination?: PaginationOptions;
  orderBy?: Record<string, 'asc' | 'desc'>;
}
```

---

### `CountParams`

Parameters for counting records.

```typescript
interface CountParams {
  model: string;
  where?: Record<string, any>;
}
```

---

### `CreateManyParams`

Parameters for batch creation.

```typescript
interface CreateManyParams {
  model: string;
  data: Record<string, any>[];
  select?: string[];
}
```

---

### `PaginationOptions`

Pagination options for queries.

```typescript
interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}
```

## Error Types

### `AdapterError`

Custom error class for adapter-specific errors.

```typescript
class AdapterError extends Error {
  public readonly code: AdapterErrorCode;
  public readonly details?: any;
  public readonly retryable: boolean;
  public readonly statusCode?: number;

  constructor(
    code: AdapterErrorCode,
    message: string,
    details?: any,
    retryable: boolean = false,
    statusCode?: number
  );
}
```

---

### `AdapterErrorCode`

Error codes for different error types.

```typescript
enum AdapterErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}
```

**Error Handling Example:**
```typescript
import { AdapterError, AdapterErrorCode } from '@apso/better-auth-apso-adapter';

try {
  const user = await adapter.findOne({
    model: 'user',
    where: { id: 'invalid-id' },
  });
} catch (error) {
  if (error instanceof AdapterError) {
    switch (error.code) {
      case AdapterErrorCode.NOT_FOUND:
        console.log('User not found');
        break;
      case AdapterErrorCode.VALIDATION_ERROR:
        console.log('Invalid input:', error.details);
        break;
      case AdapterErrorCode.NETWORK_ERROR:
        if (error.retryable) {
          console.log('Retryable network error');
        }
        break;
      default:
        console.log('Unexpected error:', error.message);
    }
  }
}
```

## Metrics Types

### `AdapterMetrics`

Performance and operational metrics.

```typescript
interface AdapterMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  cacheHitRate: number;
  retryCount: number;
  errorsByType: Map<AdapterErrorCode, number>;
  requestsByModel: Map<string, number>;
  lastResetTime: Date;
}
```

**Usage Example:**
```typescript
const metrics = adapter.getMetrics();

// Calculate success rate
const successRate = metrics.successfulRequests / metrics.totalRequests;
console.log(`Success rate: ${(successRate * 100).toFixed(2)}%`);

// Check cache performance
console.log(`Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%`);

// Review error distribution
metrics.errorsByType.forEach((count, errorCode) => {
  console.log(`${errorCode}: ${count} occurrences`);
});

// Check model usage
metrics.requestsByModel.forEach((count, model) => {
  console.log(`${model}: ${count} requests`);
});
```

## HTTP Client Types

### `HttpClient`

Interface for HTTP client implementations.

```typescript
interface HttpClient {
  request<T>(config: RequestConfig): Promise<T>;
  get<T>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<T>;
  post<T>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<T>;
  put<T>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<T>;
  patch<T>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<T>;
  delete<T>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<T>;
}
```

---

### `RequestConfig`

Configuration for HTTP requests.

```typescript
interface RequestConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryConfig?: RetryConfig;
  signal?: AbortSignal;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
```

## Logger Interface

### `Logger`

Interface for custom logger implementations.

```typescript
interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}
```

**Custom Logger Example:**
```typescript
import winston from 'winston';

const customLogger: Logger = {
  debug: (message, meta) => winston.debug(message, meta),
  info: (message, meta) => winston.info(message, meta),
  warn: (message, meta) => winston.warn(message, meta),
  error: (message, meta) => winston.error(message, meta),
};

const adapter = apsoAdapter({
  baseUrl: 'https://api.example.com',
  logger: customLogger,
});
```

## Entity Types

### Better Auth Entities

Standard Better Auth entity formats:

```typescript
interface BetterAuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  image?: string;
}

interface BetterAuthSession {
  id: string;
  sessionToken: string;
  userId: string;
  expiresAt: Date;
}

interface BetterAuthVerificationToken {
  identifier: string;
  token: string;
  expiresAt: Date;
}

interface BetterAuthAccount {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
}
```

### Apso API Entities

Corresponding Apso API entity formats:

```typescript
interface ApsoUser {
  id: string;
  email: string;
  emailVerified: boolean;
  hashedPassword?: string;
  name?: string;
  image?: string;
  created_at: Date;
  updated_at: Date;
}

interface ApsoSession {
  id: string;
  sessionToken: string;
  userId: string;
  expiresAt: Date;
  created_at: Date;
  updated_at: Date;
}

interface ApsoVerificationToken {
  id?: string;
  identifier: string;
  token: string;
  expiresAt: Date;
  created_at: Date;
}

interface ApsoAccount {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
  created_at: Date;
  updated_at: Date;
}
```

## Type Guards

Utility functions for type checking:

```typescript
// Check if value is an API response
export const isApiResponse = <T>(value: any): value is ApiResponse<T>;

// Check if value is a paginated response
export const isPaginatedResponse = <T>(value: any): value is PaginatedResponse<T>;

// Check if error is an AdapterError
export const isAdapterError = (value: any): value is AdapterError;
```

## Utility Types

TypeScript utility types for advanced usage:

```typescript
// Make all properties optional recursively
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Make specific fields required
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Make specific fields optional
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Remove null and undefined
export type NonNullable<T> = T extends null | undefined ? never : T;
```

## Examples

### Complete Adapter Setup

```typescript
import { 
  apsoAdapter, 
  createReliableApsoAdapter,
  createHighThroughputApsoAdapter,
  AdapterError,
  AdapterErrorCode,
  type ApsoAdapterConfig,
  type Logger
} from '@apso/better-auth-apso-adapter';

// Custom logger
const logger: Logger = {
  debug: (msg, meta) => console.debug(msg, meta),
  info: (msg, meta) => console.info(msg, meta),
  warn: (msg, meta) => console.warn(msg, meta),
  error: (msg, meta) => console.error(msg, meta),
};

// Production configuration
const config: ApsoAdapterConfig = {
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
    ttlMs: 300000,
    maxSize: 1000,
  },
  
  batchConfig: {
    batchSize: 100,
    concurrency: 5,
    delayBetweenBatches: 100,
  },
  
  multiTenancy: {
    enabled: true,
    scopeField: 'tenantId',
    getScopeValue: () => getCurrentTenantId(),
  },
  
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'info',
  },
  
  logger,
  emailNormalization: true,
  softDeletes: true,
};

// Create adapters
const standardAdapter = apsoAdapter(config);
const reliableAdapter = createReliableApsoAdapter(config);
const fastAdapter = createHighThroughputApsoAdapter(config);
```

### Error Handling Pattern

```typescript
async function safeAdapterOperation<T>(
  operation: () => Promise<T>
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AdapterError) {
      switch (error.code) {
        case AdapterErrorCode.NOT_FOUND:
          return null; // Handle gracefully
          
        case AdapterErrorCode.RATE_LIMIT:
          // Wait and retry
          await new Promise(resolve => 
            setTimeout(resolve, error.details?.retryAfter || 5000)
          );
          return operation(); // Retry once
          
        case AdapterErrorCode.NETWORK_ERROR:
          if (error.retryable) {
            console.warn('Retryable network error, will retry automatically');
            throw error; // Let retry mechanism handle it
          }
          break;
          
        default:
          console.error(`Adapter error [${error.code}]:`, error.message);
          break;
      }
    }
    
    throw error;
  }
}

// Usage
const user = await safeAdapterOperation(() =>
  adapter.findOne({
    model: 'user',
    where: { email: 'user@example.com' },
  })
);
```

### Metrics Monitoring

```typescript
// Set up periodic metrics logging
setInterval(() => {
  const metrics = adapter.getMetrics();
  
  const successRate = metrics.successfulRequests / metrics.totalRequests;
  const errorRate = metrics.failedRequests / metrics.totalRequests;
  
  logger.info('Adapter Metrics', {
    totalRequests: metrics.totalRequests,
    successRate: (successRate * 100).toFixed(2) + '%',
    errorRate: (errorRate * 100).toFixed(2) + '%',
    averageLatency: metrics.averageLatency + 'ms',
    p95Latency: metrics.p95Latency + 'ms',
    cacheHitRate: (metrics.cacheHitRate * 100).toFixed(2) + '%',
    retryCount: metrics.retryCount,
  });
  
  // Alert on high error rates
  if (errorRate > 0.05) { // 5% error rate
    logger.error('High error rate detected', {
      errorRate: (errorRate * 100).toFixed(2) + '%',
      errorBreakdown: Object.fromEntries(metrics.errorsByType),
    });
  }
}, 60000); // Every minute
```

For more examples and usage patterns, see:
- [Configuration Guide](./configuration.md)
- [Usage Examples](./examples.md)
- [Troubleshooting Guide](./troubleshooting.md)