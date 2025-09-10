# Better Auth Apso Adapter

A database adapter for Better Auth that interfaces with Apso-generated CRUD REST endpoints.

## Overview

This adapter enables Better Auth to work with any REST API that follows the Apso/nestjsx/crud conventions, providing a seamless bridge between Better Auth's authentication framework and your existing Apso service infrastructure.

## Features

- ✅ **Complete Better Auth Compatibility** - Implements all required adapter methods
- ✅ **HTTP-based Communication** - Works with any REST API following nestjsx/crud patterns  
- ✅ **Retry Logic** - Built-in exponential backoff for resilient operations
- ✅ **Email Normalization** - Consistent email handling across operations
- ✅ **Bulk Operations** - Efficient batch processing for large datasets
- ✅ **Multi-tenancy Ready** - Configurable tenant isolation
- ✅ **Type-safe** - Full TypeScript support with strict typing
- ✅ **Observability** - Comprehensive logging and metrics

## Installation

```bash
npm install @apso/better-auth-apso-adapter
```

## Quick Start

```typescript
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  }),
  // ... other Better Auth config
});
```

## Configuration

```typescript
const adapter = apsoAdapter({
  // Required
  baseUrl: 'https://api.example.com',
  
  // Optional
  apiKey: 'your-api-key',
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  multiTenancy: {
    enabled: true,
    scopeField: 'workspaceId',
    getScopeValue: () => getCurrentTenantId(),
  },
});
```

## Development Status

🚧 **Phase 1: Foundation Setup** - IN PROGRESS
- ✅ Project structure created
- ✅ TypeScript configuration
- ✅ Dependencies configured
- ✅ Core interfaces defined
- ✅ Placeholder components created

📅 **Coming Next:**
- Phase 2: Query Translation
- Phase 3: CRUD Operations
- Phase 4: Advanced Features
- Phase 5: Testing & Conformance

## API Endpoints Expected

The adapter expects your Apso service to expose these endpoints:

```
GET    /users          # Find many users
GET    /users/:id      # Find user by ID
POST   /users          # Create user
PATCH  /users/:id      # Update user
DELETE /users/:id      # Delete user

GET    /sessions       # Find many sessions
GET    /sessions/:id   # Find session by ID
POST   /sessions       # Create session
PATCH  /sessions/:id   # Update session
DELETE /sessions/:id   # Delete session

# Similar patterns for verification-tokens, accounts, etc.
```

## License

MIT License - see LICENSE file for details.