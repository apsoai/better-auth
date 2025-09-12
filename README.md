# Better Auth Apso Adapter

[![npm version](https://badge.fury.io/js/%40apso%2Fbetter-auth-apso-adapter.svg)](https://badge.fury.io/js/%40apso%2Fbetter-auth-apso-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

A production-ready database adapter for [Better Auth](https://better-auth.com) that seamlessly interfaces with Apso-generated CRUD REST endpoints. This adapter enables Better Auth to work with any REST API following Apso/nestjsx/crud conventions, providing enterprise-grade authentication for modern applications.

## Key Features

- **🔒 Complete Better Auth Integration** - Full compliance with Better Auth adapter interface
- **🚀 Production-Ready** - Built-in retry logic, circuit breakers, and connection pooling
- **⚡ High Performance** - Optimized for speed with caching and batch operations
- **🔧 TypeScript First** - Comprehensive type definitions and strict type checking
- **📧 Email Normalization** - Automatic email processing and validation
- **🏗️ Multi-Tenant Support** - Built-in multi-tenancy with scope isolation
- **📊 Observability** - Comprehensive metrics, tracing, and logging
- **🛡️ Security Focused** - Input validation, sanitization, and secure defaults
- **🔄 Flexible Configuration** - Extensive customization options
- **📈 Scalable** - Connection pooling and bulk operations for high throughput

## Installation

```bash
npm install @apso/better-auth-apso-adapter
```

```bash
yarn add @apso/better-auth-apso-adapter
```

```bash
pnpm add @apso/better-auth-apso-adapter
```

## Quick Start

```typescript
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

export const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
});
```

### Environment Variables

Create a `.env.local` file in your project root:

```env
APSO_BASE_URL=https://your-apso-api.com
APSO_API_KEY=your-secret-api-key
```

## Advanced Configuration

### Production Setup

```typescript
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  // Retry configuration for resilience
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  
  // Performance optimization
  cacheConfig: {
    enabled: true,
    ttlMs: 300000, // 5 minutes
    maxSize: 1000,
  },
  
  // Batch operations
  batchConfig: {
    batchSize: 100,
    concurrency: 5,
    delayBetweenBatches: 100,
  },
  
  // Request timeout
  timeout: 30000, // 30 seconds
  
  // Email normalization
  emailNormalization: true,
  
  // Observability
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'info',
  },
});
```

### Multi-Tenant Configuration

```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  multiTenancy: {
    enabled: true,
    scopeField: 'tenantId',
    getScopeValue: async () => {
      // Get tenant ID from context, headers, etc.
      return getCurrentTenantId();
    },
  },
});
```

### High-Throughput Setup

```typescript
import { createHighThroughputApsoAdapter } from '@apso/better-auth-apso-adapter';

const adapter = createHighThroughputApsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  // Optimized for high volume
  batchConfig: {
    batchSize: 500,
    concurrency: 10,
  },
  
  // Connection pooling
  fetchImpl: new HttpClient({
    connectionPool: {
      maxConnections: 100,
      maxConnectionsPerHost: 20,
      keepAlive: true,
    },
  }),
});
```

## Framework Integration

### Next.js App Router

```typescript
// app/lib/auth.ts
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

export const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL!],
});
```

```typescript
// app/api/auth/[...auth]/route.ts
import { auth } from '@/lib/auth';

export const { GET, POST } = auth.handler;
```

### Express.js

```typescript
// server.ts
import express from 'express';
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

const app = express();

const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  }),
  emailAndPassword: {
    enabled: true,
  },
});

app.use('/api/auth/*', auth.handler);
```

## API Reference

### `apsoAdapter(config: ApsoAdapterConfig)`

Creates a Better Auth adapter that interfaces with Apso CRUD APIs.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `baseUrl` | `string` | ✅ | Base URL of your Apso API |
| `apiKey` | `string` | ❌ | API key for authentication |
| `timeout` | `number` | ❌ | Request timeout in milliseconds (default: 10000) |
| `retryConfig` | `RetryConfig` | ❌ | Retry configuration for failed requests |
| `cacheConfig` | `CacheConfig` | ❌ | Response caching configuration |
| `batchConfig` | `BatchConfig` | ❌ | Batch operations configuration |
| `multiTenancy` | `MultiTenancyConfig` | ❌ | Multi-tenancy settings |
| `observability` | `ObservabilityConfig` | ❌ | Metrics and tracing configuration |
| `emailNormalization` | `boolean` | ❌ | Enable email normalization (default: true) |
| `debugMode` | `boolean` | ❌ | Enable debug logging (default: false) |

### Specialized Adapters

```typescript
// Reliable adapter with enhanced retry logic
const reliableAdapter = createReliableApsoAdapter(config);

// High-throughput adapter optimized for performance
const fastAdapter = createHighThroughputApsoAdapter(config);
```

### Health Monitoring

```typescript
// Check adapter health
const isHealthy = await checkAdapterHealth(adapter);

// Get adapter metrics
const metrics = adapter.getMetrics();
console.log(`Success rate: ${metrics.successfulRequests / metrics.totalRequests * 100}%`);

// Close all adapters (useful for graceful shutdown)
await closeAllAdapters();
```

## Authentication Flows

### Email/Password Sign Up

```typescript
import { auth } from './lib/auth';

// Sign up new user
const result = await auth.api.signUpEmail({
  body: {
    email: 'user@example.com',
    password: 'securePassword123',
    name: 'John Doe',
  },
});

if (result.data?.user) {
  console.log('User created:', result.data.user.id);
}
```

### Email/Password Sign In

```typescript
// Sign in user
const result = await auth.api.signInEmail({
  body: {
    email: 'user@example.com',
    password: 'securePassword123',
  },
});

if (result.data?.session) {
  console.log('Session created:', result.data.session.token);
}
```

### Password Reset Flow

```typescript
// Request password reset
await auth.api.forgetPassword({
  body: {
    email: 'user@example.com',
    redirectTo: 'https://yourdomain.com/reset-password',
  },
});

// Reset password with token
await auth.api.resetPassword({
  body: {
    token: 'reset-token',
    password: 'newSecurePassword123',
  },
});
```

## Error Handling

The adapter provides comprehensive error handling with specific error codes:

```typescript
import { AdapterError, AdapterErrorCode } from '@apso/better-auth-apso-adapter';

try {
  await auth.api.signInEmail({
    body: { email: 'invalid', password: 'wrong' }
  });
} catch (error) {
  if (error instanceof AdapterError) {
    switch (error.code) {
      case AdapterErrorCode.VALIDATION_ERROR:
        console.error('Invalid input:', error.details);
        break;
      case AdapterErrorCode.NOT_FOUND:
        console.error('User not found');
        break;
      case AdapterErrorCode.UNAUTHORIZED:
        console.error('Invalid credentials');
        break;
      case AdapterErrorCode.RATE_LIMIT:
        console.error('Too many requests, retry after:', error.details.retryAfter);
        break;
      default:
        console.error('Unexpected error:', error.message);
    }
  }
}
```

## Performance Optimization

### Caching Strategy

```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  cacheConfig: {
    enabled: true,
    ttlMs: 600000, // 10 minutes
    maxSize: 2000,
  },
});

// Clear cache when needed
adapter.clearCache();
```

### Batch Operations

```typescript
// Batch create users
const users = await adapter.createMany({
  model: 'user',
  data: [
    { email: 'user1@example.com', name: 'User 1' },
    { email: 'user2@example.com', name: 'User 2' },
    { email: 'user3@example.com', name: 'User 3' },
  ],
});
```

### Connection Pooling

```typescript
import { HttpClient } from '@apso/better-auth-apso-adapter';

const httpClient = new HttpClient({
  connectionPool: {
    maxConnections: 50,
    maxConnectionsPerHost: 10,
    keepAlive: true,
    keepAliveTimeout: 30000,
  },
});

const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  fetchImpl: httpClient,
});
```

## Security Best Practices

### Environment Variables

Never hardcode sensitive values. Always use environment variables:

```typescript
// ✅ Good
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
});

// ❌ Bad
const adapter = apsoAdapter({
  baseUrl: 'https://api.example.com',
  apiKey: 'secret-key-123',
});
```

### Input Validation

The adapter automatically validates and sanitizes all inputs:

```typescript
// Email normalization is enabled by default
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  emailNormalization: true, // Converts emails to lowercase, trims whitespace
});
```

### HTTPS Only

Always use HTTPS endpoints in production:

```typescript
// ✅ Good
const adapter = apsoAdapter({
  baseUrl: 'https://api.example.com',
});

// ❌ Bad (HTTP in production)
const adapter = apsoAdapter({
  baseUrl: 'http://api.example.com',
});
```

## Monitoring and Observability

### Metrics Collection

```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'info',
  },
});

// Get detailed metrics
const metrics = adapter.getMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  successRate: metrics.successfulRequests / metrics.totalRequests,
  averageLatency: metrics.averageLatency,
  p95Latency: metrics.p95Latency,
  cacheHitRate: metrics.cacheHitRate,
});
```

### Custom Logger

```typescript
import { Logger } from '@apso/better-auth-apso-adapter';

const customLogger: Logger = {
  debug: (message, meta) => console.debug(message, meta),
  info: (message, meta) => console.info(message, meta),
  warn: (message, meta) => console.warn(message, meta),
  error: (message, meta) => console.error(message, meta),
};

const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  logger: customLogger,
});
```

## Migration Guide

See our comprehensive [Migration Guide](./docs/migration.md) for detailed instructions on:

- Migrating from AWS Cognito
- Migrating from Prisma adapter
- Migrating from Drizzle adapter
- Data export and import procedures

## Troubleshooting

Common issues and solutions can be found in our [Troubleshooting Guide](./docs/troubleshooting.md).

### Quick Fixes

**Connection timeout errors:**
```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  timeout: 30000, // Increase timeout to 30 seconds
});
```

**Rate limiting issues:**
```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  retryConfig: {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
  },
});
```

## Examples

For complete working examples, see:

- [Next.js App Router Example](./docs/examples.md#nextjs-app-router)
- [Next.js Pages Router Example](./docs/examples.md#nextjs-pages-router)
- [Express.js Example](./docs/examples.md#expressjs)
- [Multi-tenant Application](./docs/examples.md#multi-tenant)
- [High-Performance Setup](./docs/examples.md#high-performance)

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Setting up the development environment
- Running tests and code quality checks
- Submitting pull requests
- Code style guidelines

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a detailed history of changes.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

- **Documentation**: [Full API Reference](./docs/api-reference.md)
- **Configuration**: [Configuration Guide](./docs/configuration.md)
- **Examples**: [Usage Examples](./docs/examples.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/apso/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/apso/discussions)

## Related Projects

- [Better Auth](https://better-auth.com) - Modern authentication library
- [Apso SDK](https://github.com/your-org/apso/tree/main/packages/apso-sdk) - TypeScript SDK for Apso APIs
- [nestjsx/crud](https://github.com/nestjsx/crud) - CRUD operations for NestJS applications

---

**Made with ❤️ by the Mavric Team**