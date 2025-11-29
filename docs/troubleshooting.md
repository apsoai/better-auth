# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Better Auth Apso Adapter.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- **[Apso Integration Issues](#apso-integration-issues)** ⭐ **Start here for Apso-specific problems**
- [Connection Issues](#connection-issues)
- [Authentication Problems](#authentication-problems)
- [Configuration Errors](#configuration-errors)
- [Performance Issues](#performance-issues)
- [Data Validation Errors](#data-validation-errors)
- [Caching Problems](#caching-problems)
- [Multi-Tenancy Issues](#multi-tenancy-issues)
- [Development and Testing](#development-and-testing)
- [Error Reference](#error-reference)
- [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check

Run a quick health check to identify basic connectivity issues:

```typescript
import { apsoAdapter, checkAdapterHealth } from '@apso/better-auth-apso-adapter';

const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  debugMode: true, // Enable for troubleshooting
});

// Basic health check
const isHealthy = await checkAdapterHealth(adapter);
console.log('Adapter healthy:', isHealthy);

// Detailed diagnostics
const metrics = adapter.getMetrics();
console.log('Adapter metrics:', metrics);
```

### Enable Debug Mode

Enable detailed logging to understand what's happening:

```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  // Enable debug logging
  debugMode: true,
  
  observability: {
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'debug',
  },
  
  // Custom logger for more control
  logger: {
    debug: (msg, meta) => console.log('🐛 DEBUG:', msg, meta),
    info: (msg, meta) => console.log('ℹ️  INFO:', msg, meta),
    warn: (msg, meta) => console.warn('⚠️  WARN:', msg, meta),
    error: (msg, meta) => console.error('❌ ERROR:', msg, meta),
  },
});
```

### Test Individual Operations

Test each adapter operation separately:

```typescript
async function runDiagnosticTests() {
  const adapter = apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
    debugMode: true,
  });

  try {
    // Test 1: Basic connectivity
    console.log('Testing basic connectivity...');
    const healthCheck = await adapter.healthCheck();
    console.log('Health check:', healthCheck ? '✅' : '❌');

    // Test 2: Create operation
    console.log('Testing create operation...');
    const testUser = await adapter.create({
      model: 'user',
      data: {
        email: `test-${Date.now()}@example.com`,
        emailVerified: false,
        name: 'Test User',
      },
    });
    console.log('Create test:', testUser ? '✅' : '❌');

    // Test 3: Read operation
    console.log('Testing read operation...');
    const foundUser = await adapter.findOne({
      model: 'user',
      where: { id: testUser.id },
    });
    console.log('Read test:', foundUser ? '✅' : '❌');

    // Test 4: Update operation
    console.log('Testing update operation...');
    const updatedUser = await adapter.update({
      model: 'user',
      where: { id: testUser.id },
      update: { name: 'Updated Test User' },
    });
    console.log('Update test:', updatedUser?.name === 'Updated Test User' ? '✅' : '❌');

    // Test 5: Delete operation
    console.log('Testing delete operation...');
    await adapter.delete({
      model: 'user',
      where: { id: testUser.id },
    });
    console.log('Delete test: ✅');

  } catch (error) {
    console.error('Diagnostic test failed:', error);
  } finally {
    await adapter.close();
  }
}

await runDiagnosticTests();
```

## Apso Integration Issues

### Problem: Entity Name Conflicts with Better Auth

**Symptoms:**
- Errors like "table 'user' already exists"
- Conflicts between your business entities and Better Auth authentication entities
- Better Auth trying to create tables that clash with your Apso schema

**Root Cause:**
Better Auth reserves certain entity names (`user`, `account`, `session`, `verification`) for authentication. If your Apso schema uses these names for business entities, you'll have conflicts.

**Solution:**

**1. Rename your business entities in `.apsorc` to avoid conflicts:**

```json
{
  "schemas": {
    "public": {
      "entities": {
        // BEFORE (conflicts with Better Auth):
        // "Account": { ... },
        // "Session": { ... },

        // AFTER (no conflicts):
        "Organization": {  // Renamed from "Account"
          "name": "string",
          "slug": "string!"
        },
        "DiscoverySession": {  // Renamed from "Session"
          "userId": "User",
          "status": "string"
        },

        // Better Auth Reserved Entities:
        // Keep these EXACTLY as Better Auth expects them
        "User": {  // DO NOT rename - Better Auth requires "User"
          "email": "string!",
          "email_verified": "boolean",
          "name": "string!",
          "avatar_url": "string?",        // nullable for OAuth
          "password_hash": "string?",     // nullable for OAuth
          "oauth_provider": "string?",    // nullable for email/password
          "oauth_id": "string?"           // nullable for email/password
        },
        "account": {  // lowercase - Better Auth convention
          "userId": "User!",
          "accountId": "string",
          "providerId": "string",
          "accessToken": "string?",
          "refreshToken": "string?",
          "accessTokenExpiresAt": "datetime?",
          "refreshTokenExpiresAt": "datetime?",
          "scope": "string?",
          "idToken": "string?",
          "password": "string?"
        },
        "session": {  // lowercase - Better Auth convention
          "sessionToken": "string!",
          "userId": "User!",
          "expiresAt": "datetime!"
        },
        "verification": {  // lowercase - Better Auth convention
          "identifier": "string!",
          "value": "string!",
          "expiresAt": "datetime!"
        }
      }
    }
  }
}
```

**2. Regenerate Apso backend after renaming:**

```bash
cd backend
npx apso generate
npm install
```

**3. Drop and recreate the database:**

```bash
# Connect to your database
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d lightbulb_dev

# Drop all tables
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# Exit psql
\q

# Restart backend to recreate tables with TypeORM synchronize
npm run start:dev
```

### Problem: "null value in column violates not-null constraint"

**Symptoms:**
- User signup fails with database constraint errors
- Errors mentioning `avatar_url`, `password_hash`, `oauth_id`, or `oauth_provider` columns

**Root Cause:**
Better Auth needs certain User fields to be nullable because:
- OAuth users don't have `password_hash`
- Email/password users don't have `oauth_id` or `oauth_provider`
- Not all users have `avatar_url`

**Solution:**

**1. Update your User entity to make optional fields nullable:**

In `backend/src/autogen/User/User.entity.ts`:

```typescript
@Entity('user')
export class User {
  @Column({ type: 'text', nullable: false })
  @PrimaryColumn()
  id: string;

  @Column({ type: 'text', nullable: false, unique: true })
  email: string;

  @Column({ type: 'boolean', default: false })
  email_verified!: boolean;

  @Column({ type: 'text', nullable: false })
  name: string;

  // MAKE THESE NULLABLE:
  @Column({ type: 'text', nullable: true })  // Changed from false
  avatar_url: string;

  @Column({ type: 'text', nullable: true })  // Changed from false
  password_hash: string;

  @Column({
    type: 'enum',
    enum: enums.UserOauthProviderEnum,
    nullable: true,  // Changed from false
  })
  oauth_provider: enums.UserOauthProviderEnum;

  @Column({ type: 'text', nullable: true })  // Changed from false
  oauth_id: string;

  // ... rest of fields
}
```

**2. Update the account entity similarly:**

In `backend/src/autogen/account/account.entity.ts`, ensure all optional Better Auth fields are nullable.

**3. Drop and recreate the database** (TypeORM synchronize won't update existing NOT NULL constraints):

```bash
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d lightbulb_dev
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q

# Restart backend
npm run start:dev
```

### Problem: "null value in column 'id' of relation 'account' violates not-null constraint"

**Symptoms:**
- Account creation fails during Better Auth sign-up
- Error specifically mentions the `id` column in the `account` table

**Root Cause:**
The adapter's `EntityMapper.mapAccountToApi()` method unconditionally includes `id: account.id` even when `id` is undefined. This sends `id: undefined` to the API, which tries to insert NULL into a NOT NULL column.

**Solution:**

This bug has been fixed in the adapter, but if you encounter it:

**1. Update the adapter to latest version:**

```bash
cd frontend
npm update @apso/better-auth-adapter
```

**2. If using a local version, fix the EntityMapper:**

In `apso/packages/better-auth/src/response/EntityMapper.ts`:

```typescript
// BEFORE (line 391):
const apsoAccount: ApsoAccount = {
  id: account.id,  // ❌ Always included, even if undefined
  userId: account.userId,
  // ...
}

// AFTER (lines 390-400):
const apsoAccount: ApsoAccount = {
  // ✅ Only include ID if it has a meaningful value
  ...(account.id && account.id !== '' && { id: account.id }),
  userId: account.userId,
  type: account.type || 'credential',
  provider: account.provider || accountWithPassword.providerId || 'credential',
  providerAccountId: account.providerAccountId ||
    accountWithPassword.accountId ||
    account.userId,
  // ... rest of fields
}
```

**3. Rebuild the adapter if using local version:**

```bash
cd ~/projects/mavric/apso/packages/better-auth
npm run build
```

### Problem: DTOs Rejecting `id` Field

**Symptoms:**
- API returns 400 errors saying `id` field is not expected
- Direct API tests work but Better Auth adapter calls fail

**Root Cause:**
Apso-generated DTOs might not include the `id` field in `Create` DTOs, expecting the backend to auto-generate it.

**Solution:**

**1. Add `id` field to your DTOs:**

In `backend/src/autogen/User/dtos/User.dto.ts`:

```typescript
export class UserCreate {
  @ApiProperty()
  id: string;  // Add this field

  @ApiProperty()
  email: string;

  // ... rest of fields
}
```

In `backend/src/autogen/account/dtos/account.dto.ts`:

```typescript
export class accountCreate {
  @ApiProperty()
  id: string;  // Add this field

  @ApiProperty()
  userId: string;

  // ... rest of fields
}
```

**2. Restart the backend:**

```bash
npm run start:dev
```

### Best Practices for Apso + Better Auth Integration

**1. Schema Design Checklist:**

- [ ] Use `Organization` instead of `Account` for your business entities
- [ ] Use `DiscoverySession`/`UserSession` instead of `Session` for your business entities
- [ ] Keep `User`, `account`, `session`, `verification` names reserved for Better Auth
- [ ] Make User optional fields nullable (`avatar_url`, `password_hash`, `oauth_*`)
- [ ] Include `id` field in all DTOs (UserCreate, accountCreate, etc.)

**2. Database Migration Checklist:**

- [ ] Drop and recreate database after schema changes affecting nullable constraints
- [ ] Verify TypeORM synchronize picked up all changes
- [ ] Test both email/password AND OAuth signup flows
- [ ] Check database directly to confirm constraint changes applied

**3. Testing Checklist:**

After setup, test these scenarios:

```bash
# Test 1: Email/password signup
curl -X POST 'http://localhost:3003/api/auth/sign-up/email' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

# Test 2: Check database
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d lightbulb_dev \
  -c "SELECT id, email, name FROM \"user\" ORDER BY created_at DESC LIMIT 1;"

# Test 3: Check account was created
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d lightbulb_dev \
  -c "SELECT id, \"userId\", provider FROM account ORDER BY id DESC LIMIT 1;"
```

**4. Common Pitfalls:**

- **Don't** manually edit TypeORM-generated entity files - regenerate from `.apsorc`
- **Don't** assume TypeORM will alter NOT NULL → NULL constraints (it won't in synchronize mode)
- **Don't** forget to restart backend after DTO changes
- **Do** drop the database when changing nullable constraints
- **Do** test both auth methods (email/password AND OAuth)
- **Do** check the database directly to verify changes

## Connection Issues

### Problem: "Connection timeout" or "Network error"

**Symptoms:**
- Requests timing out
- Network error messages
- Intermittent connection failures

**Solutions:**

1. **Check base URL:**
```typescript
// Ensure URL is correct and accessible
const adapter = apsoAdapter({
  baseUrl: 'https://your-correct-api-url.com', // Check this URL
  apiKey: process.env.APSO_API_KEY,
});

// Test URL accessibility
try {
  const response = await fetch(process.env.APSO_BASE_URL + '/health');
  console.log('API accessibility:', response.status);
} catch (error) {
  console.error('API not accessible:', error);
}
```

2. **Increase timeout:**
```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  timeout: 30000, // Increase from default 10 seconds
});
```

3. **Configure retry settings:**
```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  retryConfig: {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    retryableStatuses: [429, 500, 502, 503, 504, 408], // Add 408 for timeouts
  },
});
```

4. **Check firewall/network settings:**
```bash
# Test connectivity from your server
curl -I https://your-apso-api.com/health

# Check DNS resolution
nslookup your-apso-api.com

# Test with specific timeout
curl --max-time 30 https://your-apso-api.com/health
```

### Problem: "SSL/TLS handshake failed"

**Solutions:**

1. **Update Node.js TLS settings:**
```typescript
// For self-signed certificates (development only!)
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

// Better: Configure SSL properly
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  fetchImpl: new HttpClient({
    ssl: {
      rejectUnauthorized: false, // Only for development
    },
  }),
});
```

2. **Use proper certificates:**
```typescript
import fs from 'fs';

const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  fetchImpl: new HttpClient({
    ssl: {
      ca: fs.readFileSync('./path/to/ca-cert.pem'),
      cert: fs.readFileSync('./path/to/client-cert.pem'),
      key: fs.readFileSync('./path/to/client-key.pem'),
    },
  }),
});
```

## Authentication Problems

### Problem: Login fails with "Invalid email or password" after successful signup

**Symptoms:**
- User signup succeeds and returns a token
- Login immediately after fails with `INVALID_EMAIL_OR_PASSWORD`
- Error log shows: `Credential account not found`

**Root Cause:**
This is a **critical architecture issue** with how Better Auth handles credential (email/password) authentication:

1. **Passwords are stored in the `account` table**, NOT the `user` table
2. Better Auth calls `findUserByEmail(email, { includeAccounts: true })` during sign-in
3. The adapter must return the user WITH their accounts attached
4. Better Auth then searches for a credential account using: `user.accounts.find((a) => a.providerId === "credential")`

If the adapter doesn't:
- Handle the `includeAccounts` parameter
- Include the `providerId` field in account objects
- Use proper pagination when fetching accounts

...then login will fail even though signup succeeded.

**Solution:**

**1. Ensure the adapter handles the `join` parameter for includeAccounts:**

The adapter's `findOne` method must check for `join: { account: true }` and fetch accounts:

```typescript
// In ApsoAdapter.findOne():
const joinParam = (params as any).join;
const includeAccounts = joinParam?.account === true;

if (userResult && includeAccounts) {
  const accounts = await this.accountOperations.findManyAccounts({
    where: { userId: userResult.id },
  });
  userResult = {
    ...userResult,
    account: accounts,  // Better Auth expects 'account' key
  };
}
```

**2. Ensure `providerId` field is included in account mapping:**

Better Auth's runtime code uses `providerId` (NOT `provider`) to find credential accounts:

```typescript
// In EntityMapper.mapAccountFromApi():
const betterAuthAccount: BetterAuthAccount = {
  id: String(apiAccount.id),
  userId: apiAccount.userId,
  type: apiAccount.type,
  provider: apiAccount.providerId,
  // CRITICAL: Better Auth runtime uses providerId, not provider!
  providerId: apiAccount.providerId,  // Must include this!
  // ...
};
```

**3. Ensure proper pagination when fetching accounts:**

The API may paginate results. Use `?limit=10000` or similar to fetch all accounts:

```typescript
const url = `${this.config.baseUrl}/accounts?limit=10000`;
```

**Debugging Steps:**

```typescript
// Add debug logging to see what's happening:
console.log('🔍 [DEBUG] findOne called:', {
  model: params.model,
  where: JSON.stringify(params.where),
  join: JSON.stringify((params as any).join),
});

// When fetching accounts:
console.log('🔍 [DEBUG] Found accounts:', accounts.length,
  accounts.map(a => ({
    id: a.id,
    providerId: a.providerId,  // Should be "credential"
    password: a.password ? 'present' : 'missing'
  }))
);
```

**Key Points:**
- The `providerId` field MUST be `"credential"` for email/password accounts
- The `password` field in the account must contain the hashed password
- Better Auth expects `user.account` (singular) to be an array of accounts
- This is NOT a bug in Better Auth - it's the expected architecture

---

### Problem: "Unauthorized" (401) errors

**Symptoms:**
- All requests returning 401
- Authentication header issues

**Solutions:**

1. **Verify API key:**
```typescript
// Check if API key is set
console.log('API Key configured:', !!process.env.APSO_API_KEY);
console.log('API Key length:', process.env.APSO_API_KEY?.length);

// Test with explicit API key
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: 'your-actual-api-key', // Test with hardcoded key first
});
```

2. **Check authentication header format:**
```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  authHeader: 'Authorization', // Default
  // Or for custom header:
  // authHeader: 'X-API-Key',
});
```

3. **Test API key manually:**
```bash
# Test your API key with curl
curl -H "Authorization: Bearer YOUR_API_KEY" https://your-apso-api.com/users

# Or with custom header
curl -H "X-API-Key: YOUR_API_KEY" https://your-apso-api.com/users
```

### Problem: "Forbidden" (403) errors

**Symptoms:**
- Some operations work, others return 403
- User can authenticate but can't perform certain actions

**Solutions:**

1. **Check API key permissions:**
```typescript
// Test with different operations to identify permission scope
async function testPermissions() {
  const adapter = apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  });

  const tests = [
    { name: 'Read users', fn: () => adapter.count({ model: 'user' }) },
    { name: 'Create user', fn: () => adapter.create({ 
      model: 'user', 
      data: { email: 'test@example.com', emailVerified: false }
    })},
    { name: 'Update user', fn: () => adapter.findMany({ model: 'user', pagination: { limit: 1 } }).then(users => 
      users.length > 0 ? adapter.update({ 
        model: 'user', 
        where: { id: users[0].id }, 
        update: { name: 'Test' }
      }) : null
    )},
  ];

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name}: Success`);
    } catch (error) {
      console.log(`❌ ${test.name}: Failed -`, error.message);
    }
  }
}

await testPermissions();
```

2. **Verify multi-tenancy settings:**
```typescript
// If using multi-tenancy, ensure context is set
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  multiTenancy: {
    enabled: true,
    scopeField: 'tenantId',
    getScopeValue: () => 'your-tenant-id', // Make sure this returns valid tenant
  },
});

// Test tenant context
console.log('Current tenant:', adapter.getTenantContext());
```

## Configuration Errors

### Problem: "Invalid configuration" errors

**Solutions:**

1. **Validate configuration:**
```typescript
import { ConfigValidator } from '@apso/better-auth-apso-adapter';

const config = {
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  timeout: 30000,
};

// Validate before creating adapter
try {
  ConfigValidator.validate(config);
  console.log('Configuration is valid');
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

2. **Check environment variables:**
```typescript
// Validate all required environment variables
const requiredEnvVars = ['APSO_BASE_URL'];
const optionalEnvVars = ['APSO_API_KEY'];

console.log('Environment check:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`${varName}: ${value ? '✅ Set' : '❌ Missing'}`);
  if (!value) {
    console.error(`Required environment variable ${varName} is not set`);
  }
});

optionalEnvVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`${varName}: ${value ? '✅ Set' : '⚠️  Not set (optional)'}`);
});
```

3. **Use configuration factory:**
```typescript
// Create configuration from environment with defaults
function createConfigFromEnv() {
  if (!process.env.APSO_BASE_URL) {
    throw new Error('APSO_BASE_URL environment variable is required');
  }

  return {
    baseUrl: process.env.APSO_BASE_URL,
    apiKey: process.env.APSO_API_KEY,
    timeout: parseInt(process.env.APSO_TIMEOUT || '10000'),
    debugMode: process.env.NODE_ENV === 'development',
    
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
  };
}

const adapter = apsoAdapter(createConfigFromEnv());
```

## Performance Issues

### Problem: Slow response times

**Solutions:**

1. **Enable caching:**
```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  cacheConfig: {
    enabled: true,
    ttlMs: 300000, // 5 minutes
    maxSize: 2000,
  },
});

// Monitor cache performance
const metrics = adapter.getMetrics();
console.log(`Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%`);
```

2. **Optimize batch operations:**
```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  batchConfig: {
    batchSize: 100, // Increase batch size
    concurrency: 5, // Increase concurrency
    delayBetweenBatches: 50, // Reduce delay
  },
});
```

3. **Use connection pooling:**
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
  apiKey: process.env.APSO_API_KEY,
  fetchImpl: httpClient,
});
```

4. **Monitor performance:**
```typescript
// Set up performance monitoring
setInterval(() => {
  const metrics = adapter.getMetrics();
  
  if (metrics.averageLatency > 5000) { // Alert if over 5 seconds
    console.warn(`High latency detected: ${metrics.averageLatency}ms`);
  }
  
  if (metrics.failedRequests / metrics.totalRequests > 0.05) { // Alert if over 5% error rate
    console.warn(`High error rate: ${(metrics.failedRequests / metrics.totalRequests * 100).toFixed(2)}%`);
  }
}, 60000);
```

### Problem: Memory leaks

**Solutions:**

1. **Properly close adapters:**
```typescript
// Always close adapters when done
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
});

// Use try/finally to ensure cleanup
try {
  // Your operations
} finally {
  await adapter.close();
}

// Or use process handlers
process.on('SIGTERM', async () => {
  await adapter.close();
  process.exit(0);
});
```

2. **Clear caches periodically:**
```typescript
// Clear cache periodically in long-running processes
setInterval(() => {
  adapter.clearCache();
  console.log('Cache cleared');
}, 3600000); // Every hour
```

3. **Monitor memory usage:**
```typescript
// Monitor memory usage
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
  });
  
  // Alert if memory usage is too high
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    console.warn('High memory usage detected');
    adapter.clearCache();
  }
}, 30000); // Every 30 seconds
```

## Data Validation Errors

### Problem: "Validation failed" errors

**Solutions:**

1. **Check required fields:**
```typescript
// Ensure all required fields are provided
try {
  const user = await adapter.create({
    model: 'user',
    data: {
      email: 'user@example.com', // Required
      emailVerified: false, // Required
      // name is optional
      // image is optional
    },
  });
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    console.error('Validation details:', error.details);
  }
}
```

2. **Validate email formats:**
```typescript
import { EmailNormalizer } from '@apso/better-auth-apso-adapter';

// Test email normalization
const email = ' USER@EXAMPLE.COM ';
const normalized = EmailNormalizer.normalize(email);
console.log('Normalized email:', normalized); // 'user@example.com'

// Disable email normalization if causing issues
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  emailNormalization: false, // Disable if needed
});
```

3. **Handle date validation:**
```typescript
// Ensure dates are properly formatted
const session = await adapter.create({
  model: 'session',
  data: {
    sessionToken: 'token-123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  },
});
```

### Problem: "Foreign key constraint" errors

**Solutions:**

1. **Verify referenced entities exist:**
```typescript
// Create user first
const user = await adapter.create({
  model: 'user',
  data: {
    email: 'user@example.com',
    emailVerified: false,
  },
});

// Then create session with valid userId
const session = await adapter.create({
  model: 'session',
  data: {
    sessionToken: 'token-123',
    userId: user.id, // Use the actual user ID
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
});
```

2. **Check for concurrent modifications:**
```typescript
// Use transactions or check existence before creating related entities
async function createUserWithSession(userData: any, sessionData: any) {
  try {
    const user = await adapter.create({
      model: 'user',
      data: userData,
    });

    const session = await adapter.create({
      model: 'session',
      data: {
        ...sessionData,
        userId: user.id,
      },
    });

    return { user, session };
  } catch (error) {
    console.error('Failed to create user with session:', error);
    throw error;
  }
}
```

## Caching Problems

### Problem: Stale cached data

**Solutions:**

1. **Clear cache selectively:**
```typescript
// Clear cache after mutations
const user = await adapter.update({
  model: 'user',
  where: { id: 'user-123' },
  update: { name: 'New Name' },
});

// Clear cache to ensure fresh data on next read
adapter.clearCache();
```

2. **Reduce cache TTL:**
```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  cacheConfig: {
    enabled: true,
    ttlMs: 60000, // Reduce to 1 minute
    maxSize: 1000,
  },
});
```

3. **Disable caching for critical operations:**
```typescript
// Disable caching for specific environments
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  cacheConfig: {
    enabled: process.env.NODE_ENV === 'production', // Only cache in production
    ttlMs: 300000,
    maxSize: 1000,
  },
});
```

### Problem: Cache hit rate too low

**Solutions:**

1. **Analyze cache usage:**
```typescript
const metrics = adapter.getMetrics();
console.log(`Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%`);

if (metrics.cacheHitRate < 0.5) {
  console.warn('Cache hit rate is low, consider:');
  console.warn('- Increasing cache size');
  console.warn('- Increasing TTL');
  console.warn('- Reviewing query patterns');
}
```

2. **Optimize cache settings:**
```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  cacheConfig: {
    enabled: true,
    ttlMs: 600000, // Increase TTL to 10 minutes
    maxSize: 5000, // Increase cache size
  },
});
```

## Multi-Tenancy Issues

### Problem: Data bleeding between tenants

**Solutions:**

1. **Verify tenant context:**
```typescript
// Always check tenant context before operations
async function safeOperation(operation: () => Promise<any>) {
  const tenantId = adapter.getTenantContext();
  if (!tenantId) {
    throw new Error('Tenant context not set');
  }
  
  console.log('Operating in tenant context:', tenantId);
  return operation();
}

// Use the safe wrapper
const users = await safeOperation(() => 
  adapter.findMany({ model: 'user' })
);
```

2. **Set tenant context explicitly:**
```typescript
// Set tenant context from request headers, JWT, etc.
async function setTenantFromRequest(req: Request) {
  const tenantId = req.headers['x-tenant-id'] || 
                  extractTenantFromJWT(req.headers.authorization) ||
                  'default-tenant';
  
  adapter.setTenantContext(tenantId);
}

// Use in middleware
app.use(async (req, res, next) => {
  await setTenantFromRequest(req);
  next();
});
```

3. **Test tenant isolation:**
```typescript
async function testTenantIsolation() {
  // Create test data in tenant A
  adapter.setTenantContext('tenant-a');
  const userA = await adapter.create({
    model: 'user',
    data: { email: 'user-a@example.com', emailVerified: false },
  });

  // Switch to tenant B
  adapter.setTenantContext('tenant-b');
  const userB = await adapter.create({
    model: 'user',
    data: { email: 'user-b@example.com', emailVerified: false },
  });

  // Verify isolation - should not find user A when in tenant B context
  const foundUserA = await adapter.findOne({
    model: 'user',
    where: { id: userA.id },
  });

  if (foundUserA) {
    console.error('❌ Tenant isolation failed - found user A in tenant B');
  } else {
    console.log('✅ Tenant isolation working correctly');
  }
}

await testTenantIsolation();
```

## Development and Testing

### Problem: Tests failing intermittently

**Solutions:**

1. **Use dry-run mode for tests:**
```typescript
const testAdapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  dryRun: true, // No actual API calls
  debugMode: true,
});
```

2. **Clean up test data:**
```typescript
// Clean up after each test
afterEach(async () => {
  // Delete test data
  await adapter.deleteMany({
    model: 'user',
    where: { email: { contains: 'test-' } },
  });
});

// Or use test-specific tenant
beforeEach(async () => {
  adapter.setTenantContext(`test-${Date.now()}`);
});
```

3. **Mock the adapter for unit tests:**
```typescript
jest.mock('@apso/better-auth-apso-adapter');

const mockAdapter = {
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  // ... other methods
};

// Use mock in tests
test('user creation', async () => {
  mockAdapter.create.mockResolvedValue({ id: 'user-123' });
  
  const result = await someFunction();
  
  expect(mockAdapter.create).toHaveBeenCalledWith({
    model: 'user',
    data: expect.any(Object),
  });
});
```

### Problem: Development setup issues

**Solutions:**

1. **Use local API for development:**
```typescript
const developmentConfig = {
  baseUrl: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001/api' 
    : process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  debugMode: process.env.NODE_ENV === 'development',
  timeout: 5000, // Shorter timeout for development
};

const adapter = apsoAdapter(developmentConfig);
```

2. **Set up development middleware:**
```typescript
// Add request/response logging in development
if (process.env.NODE_ENV === 'development') {
  const adapter = apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
    
    logger: {
      debug: (msg, meta) => {
        console.log('🔍', new Date().toISOString(), msg);
        if (meta) console.log('   ', JSON.stringify(meta, null, 2));
      },
      info: (msg, meta) => console.log('ℹ️ ', msg, meta),
      warn: (msg, meta) => console.warn('⚠️ ', msg, meta),
      error: (msg, meta) => console.error('❌', msg, meta),
    },
  });
}
```

## Error Reference

### Common Error Codes

| Error Code | HTTP Status | Description | Solutions |
|------------|-------------|-------------|-----------|
| `VALIDATION_ERROR` | 400 | Invalid input data | Check required fields, data formats |
| `NOT_FOUND` | 404 | Resource not found | Verify IDs, check if resource exists |
| `CONFLICT` | 409 | Duplicate data or constraint violation | Check uniqueness constraints |
| `UNAUTHORIZED` | 401 | Authentication failed | Verify API key, check auth header |
| `FORBIDDEN` | 403 | Insufficient permissions | Check API key permissions |
| `NETWORK_ERROR` | - | Network connectivity issues | Check URL, network connectivity |
| `TIMEOUT` | 408 | Request timeout | Increase timeout, check server load |
| `RATE_LIMIT` | 429 | Too many requests | Implement backoff, reduce request rate |
| `SERVER_ERROR` | 500+ | Server-side error | Check server logs, retry if retryable |

### Error Handling Patterns

```typescript
import { AdapterError, AdapterErrorCode } from '@apso/better-auth-apso-adapter';

async function handleAdapterOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AdapterError) {
      switch (error.code) {
        case AdapterErrorCode.NOT_FOUND:
          console.log('Resource not found, continuing...');
          return null as T;
          
        case AdapterErrorCode.RATE_LIMIT:
          const retryAfter = error.details?.retryAfter || 5000;
          console.log(`Rate limited, waiting ${retryAfter}ms`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          return operation(); // Retry once
          
        case AdapterErrorCode.NETWORK_ERROR:
          if (error.retryable) {
            console.log('Network error, will be retried automatically');
          } else {
            console.error('Non-retryable network error:', error.message);
          }
          throw error;
          
        case AdapterErrorCode.VALIDATION_ERROR:
          console.error('Validation error:', error.details);
          throw new Error(`Invalid data: ${JSON.stringify(error.details)}`);
          
        default:
          console.error(`Adapter error [${error.code}]:`, error.message);
          throw error;
      }
    }
    
    // Handle non-adapter errors
    console.error('Unexpected error:', error);
    throw error;
  }
}

// Usage
const user = await handleAdapterOperation(() =>
  adapter.findOne({
    model: 'user',
    where: { email: 'user@example.com' },
  })
);
```

## Getting Help

### Debugging Information to Collect

When reporting issues, please include:

1. **Adapter version:**
```bash
npm list @apso/better-auth-apso-adapter
```

2. **Configuration (sanitized):**
```typescript
// Remove sensitive information like API keys
const sanitizedConfig = {
  baseUrl: adapter.config.baseUrl,
  timeout: adapter.config.timeout,
  debugMode: adapter.config.debugMode,
  // ... other non-sensitive config
};
console.log('Adapter config:', sanitizedConfig);
```

3. **Error details:**
```typescript
try {
  // Your operation
} catch (error) {
  console.error('Error details:', {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: error.stack,
    details: error.details,
  });
}
```

4. **Environment information:**
```typescript
console.log('Environment info:', {
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  env: process.env.NODE_ENV,
});
```

5. **Metrics and health status:**
```typescript
const metrics = adapter.getMetrics();
const isHealthy = await adapter.healthCheck();

console.log('Adapter status:', {
  healthy: isHealthy,
  totalRequests: metrics.totalRequests,
  successRate: metrics.successfulRequests / metrics.totalRequests,
  averageLatency: metrics.averageLatency,
});
```

### Support Channels

- **GitHub Issues**: [Report bugs and request features](https://github.com/your-org/apso/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/your-org/apso/discussions)
- **Documentation**: [Complete guides and API reference](../README.md)

### Before Reporting Issues

1. **Check existing documentation**
2. **Search existing issues**
3. **Try with debug mode enabled**
4. **Test with minimal configuration**
5. **Verify API accessibility**

For configuration help, see the [Configuration Guide](./configuration.md).  
For API details, see the [API Reference](./api-reference.md).  
For usage examples, see the [Examples](./examples.md).