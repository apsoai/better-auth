# Migration Guide

This guide covers migrating to the Better Auth Apso Adapter from other authentication systems and database adapters.

## Table of Contents

- [Migration Overview](#migration-overview)
- [Migrating from AWS Cognito](#migrating-from-aws-cognito)
- [Migrating from Prisma Adapter](#migrating-from-prisma-adapter)
- [Migrating from Drizzle Adapter](#migrating-from-drizzle-adapter)
- [Migrating from MongoDB Adapter](#migrating-from-mongodb-adapter)
- [Data Export and Import](#data-export-and-import)
- [Schema Mapping](#schema-mapping)
- [Common Migration Issues](#common-migration-issues)
- [Validation and Testing](#validation-and-testing)

## Migration Overview

### Pre-Migration Checklist

Before starting any migration:

1. **Backup your existing data** - Create complete backups of your current authentication data
2. **Test in staging** - Run the migration process in a staging environment first
3. **Plan downtime** - Estimate and plan for any required downtime
4. **Prepare rollback plan** - Have a rollback strategy ready if issues occur
5. **Review dependencies** - Ensure all dependent systems can handle the change

### Migration Strategy Options

#### 1. Big Bang Migration
- Stop the old system, migrate all data, start new system
- Requires downtime but simpler process
- Best for smaller applications with flexible downtime windows

#### 2. Gradual Migration
- Run both systems in parallel during transition
- Migrate users gradually as they log in
- Zero downtime but more complex implementation

#### 3. Blue-Green Migration
- Set up complete new environment with migrated data
- Switch traffic once verified
- Minimal downtime, easy rollback

## Migrating from AWS Cognito

### Overview

Migrating from AWS Cognito involves:
1. Exporting user data from Cognito
2. Setting up Apso API endpoints
3. Migrating user accounts and sessions
4. Updating application authentication flows

### Step 1: Export Cognito User Data

```typescript
import { CognitoIdentityServiceProvider } from 'aws-sdk';

interface CognitoUser {
  Username: string;
  Attributes: { Name: string; Value: string }[];
  UserStatus: string;
  UserCreateDate: Date;
  UserLastModifiedDate: Date;
}

async function exportCognitoUsers(userPoolId: string): Promise<CognitoUser[]> {
  const cognito = new CognitoIdentityServiceProvider({ region: 'us-west-2' });
  const users: CognitoUser[] = [];
  let paginationToken: string | undefined;

  do {
    const response = await cognito.listUsers({
      UserPoolId: userPoolId,
      PaginationToken: paginationToken,
      Limit: 60, // Max allowed by AWS
    }).promise();

    if (response.Users) {
      users.push(...response.Users as CognitoUser[]);
    }
    
    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return users;
}

// Export users
const cognitoUsers = await exportCognitoUsers('us-west-2_XXXXXXXXX');
```

### Step 2: Transform Cognito Data

```typescript
interface ApsoUser {
  email: string;
  emailVerified: boolean;
  name?: string;
  hashedPassword?: string; // Will need to handle password reset
  created_at: Date;
  updated_at: Date;
}

function transformCognitoUser(cognitoUser: CognitoUser): ApsoUser {
  const getAttribute = (name: string) => 
    cognitoUser.Attributes?.find(attr => attr.Name === name)?.Value;

  return {
    email: getAttribute('email') || cognitoUser.Username,
    emailVerified: getAttribute('email_verified') === 'true',
    name: getAttribute('name') || getAttribute('given_name'),
    // Note: Cognito passwords cannot be exported
    // Users will need to reset passwords after migration
    created_at: cognitoUser.UserCreateDate,
    updated_at: cognitoUser.UserLastModifiedDate,
  };
}

const apsoUsers = cognitoUsers.map(transformCognitoUser);
```

### Step 3: Set up Better Auth with Apso Adapter

```typescript
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

export const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
    
    // Enhanced retry for migration stability
    retryConfig: {
      maxRetries: 5,
      initialDelayMs: 2000,
      maxDelayMs: 30000,
    },
    
    // Enable email normalization for consistency
    emailNormalization: true,
  }),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Match Cognito behavior
  },
  
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days to match Cognito default
  },
});
```

### Step 4: Import Users to Apso

```typescript
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

async function importUsersToApso(users: ApsoUser[]) {
  const adapter = apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  });

  // Import in batches to avoid overwhelming the API
  const batchSize = 50;
  const batches = [];
  
  for (let i = 0; i < users.length; i += batchSize) {
    batches.push(users.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    try {
      await adapter.createMany({
        model: 'user',
        data: batch,
      });
      
      console.log(`Imported batch of ${batch.length} users`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Failed to import batch:', error);
      throw error;
    }
  }

  await adapter.close();
}

await importUsersToApso(apsoUsers);
```

### Step 5: Handle Password Migration

Since Cognito passwords cannot be exported, you'll need to handle password migration:

#### Option 1: Force Password Reset

```typescript
// Send password reset emails to all migrated users
async function sendPasswordResetEmails(users: ApsoUser[]) {
  for (const user of users) {
    try {
      await auth.api.forgetPassword({
        body: {
          email: user.email,
          redirectTo: `${process.env.APP_URL}/reset-password`,
        },
      });
      
      console.log(`Password reset sent to ${user.email}`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to send reset email to ${user.email}:`, error);
    }
  }
}
```

#### Option 2: Gradual Migration on Login

```typescript
// Implement fallback to Cognito for users who haven't migrated yet
async function authenticateWithFallback(email: string, password: string) {
  try {
    // Try Better Auth first
    return await auth.api.signInEmail({
      body: { email, password },
    });
  } catch (error) {
    // Fall back to Cognito
    try {
      const cognitoResult = await authenticateWithCognito(email, password);
      
      if (cognitoResult.success) {
        // Migrate user to Better Auth
        await migrateUserWithPassword(email, password, cognitoResult.user);
        
        // Retry with Better Auth
        return await auth.api.signInEmail({
          body: { email, password },
        });
      }
    } catch (cognitoError) {
      throw error; // Return original Better Auth error
    }
  }
}
```

### Step 6: Update Application Code

Replace Cognito authentication calls with Better Auth:

```typescript
// Before (Cognito)
import { CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const authDetails = new AuthenticationDetails({
  Username: email,
  Password: password,
});

cognitoUser.authenticateUser(authDetails, {
  onSuccess: (result) => {
    const accessToken = result.getAccessToken().getJwtToken();
    // Handle success
  },
  onFailure: (error) => {
    // Handle error
  },
});

// After (Better Auth)
import { auth } from './lib/auth';

try {
  const result = await auth.api.signInEmail({
    body: { email, password },
  });
  
  if (result.data?.session) {
    // Handle success
    const token = result.data.session.token;
  }
} catch (error) {
  // Handle error
}
```

## Migrating from Prisma Adapter

### Overview

Migrating from Prisma to Apso involves:
1. Exporting data from Prisma
2. Setting up Apso API endpoints
3. Migrating schema and data
4. Updating Better Auth configuration

### Step 1: Export Prisma Data

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Export all authentication data
const exportData = async () => {
  const users = await prisma.user.findMany();
  const accounts = await prisma.account.findMany();
  const sessions = await prisma.session.findMany();
  const verificationTokens = await prisma.verificationToken.findMany();

  return {
    users,
    accounts,
    sessions,
    verificationTokens,
  };
};

const data = await exportData();
```

### Step 2: Transform Prisma Schema

```typescript
// Transform Prisma entities to Apso format
function transformPrismaUser(prismaUser: any) {
  return {
    id: prismaUser.id,
    email: prismaUser.email,
    emailVerified: prismaUser.emailVerified,
    name: prismaUser.name,
    image: prismaUser.image,
    hashedPassword: prismaUser.hashedPassword, // If available
    created_at: prismaUser.createdAt || new Date(),
    updated_at: prismaUser.updatedAt || new Date(),
  };
}

function transformPrismaSession(prismaSession: any) {
  return {
    id: prismaSession.id,
    sessionToken: prismaSession.sessionToken,
    userId: prismaSession.userId,
    expiresAt: prismaSession.expires,
    created_at: prismaSession.createdAt || new Date(),
    updated_at: prismaSession.updatedAt || new Date(),
  };
}

const transformedUsers = data.users.map(transformPrismaUser);
const transformedSessions = data.sessions.map(transformPrismaSession);
```

### Step 3: Update Better Auth Configuration

```typescript
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

// Replace Prisma adapter with Apso adapter
export const auth = betterAuth({
  // Before:
  // database: new PrismaAdapter(prisma),
  
  // After:
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  }),
  
  // Keep existing Better Auth configuration
  emailAndPassword: {
    enabled: true,
  },
  
  providers: [
    // Your OAuth providers
  ],
});
```

### Step 4: Import Data to Apso

```typescript
async function importPrismaDataToApso() {
  const adapter = apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  });

  try {
    // Import users first (required for foreign key relationships)
    console.log('Importing users...');
    await adapter.createMany({
      model: 'user',
      data: transformedUsers,
    });

    // Import sessions
    console.log('Importing sessions...');
    await adapter.createMany({
      model: 'session', 
      data: transformedSessions,
    });

    // Import accounts if using OAuth
    if (data.accounts.length > 0) {
      console.log('Importing accounts...');
      const transformedAccounts = data.accounts.map(transformPrismaAccount);
      await adapter.createMany({
        model: 'account',
        data: transformedAccounts,
      });
    }

    // Import verification tokens
    if (data.verificationTokens.length > 0) {
      console.log('Importing verification tokens...');
      const transformedTokens = data.verificationTokens.map(transformPrismaVerificationToken);
      await adapter.createMany({
        model: 'verificationToken',
        data: transformedTokens,
      });
    }

    console.log('Migration completed successfully!');
  } finally {
    await adapter.close();
  }
}
```

## Migrating from Drizzle Adapter

### Overview

Similar to Prisma migration but working with Drizzle ORM schemas and queries.

### Step 1: Export Drizzle Data

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { users, sessions, accounts, verificationTokens } from './schema';

const db = drizzle(connection);

// Export all data
const exportDrizzleData = async () => {
  const userData = await db.select().from(users);
  const sessionData = await db.select().from(sessions);
  const accountData = await db.select().from(accounts);
  const tokenData = await db.select().from(verificationTokens);

  return {
    users: userData,
    sessions: sessionData,
    accounts: accountData,
    verificationTokens: tokenData,
  };
};

const data = await exportDrizzleData();
```

### Step 2: Schema Transformation

```typescript
// Transform Drizzle entities to Apso format
function transformDrizzleUser(drizzleUser: any) {
  return {
    id: drizzleUser.id,
    email: drizzleUser.email,
    emailVerified: drizzleUser.email_verified,
    name: drizzleUser.name,
    image: drizzleUser.image,
    created_at: drizzleUser.created_at || new Date(),
    updated_at: drizzleUser.updated_at || new Date(),
  };
}

const transformedUsers = data.users.map(transformDrizzleUser);
```

### Step 3: Update Configuration

```typescript
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

export const auth = betterAuth({
  // Replace Drizzle adapter
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  }),
  
  // Existing configuration...
});
```

## Migrating from MongoDB Adapter

### Overview

MongoDB migration involves handling document structure differences and ObjectId transformations.

### Step 1: Export MongoDB Data

```typescript
import { MongoClient } from 'mongodb';

async function exportMongoData() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  
  const db = client.db('auth');
  
  const users = await db.collection('users').find({}).toArray();
  const sessions = await db.collection('sessions').find({}).toArray();
  const accounts = await db.collection('accounts').find({}).toArray();
  const tokens = await db.collection('verification_tokens').find({}).toArray();

  await client.close();

  return { users, sessions, accounts, tokens };
}

const mongoData = await exportMongoData();
```

### Step 2: Transform MongoDB Documents

```typescript
function transformMongoUser(mongoUser: any) {
  return {
    id: mongoUser._id.toString(), // Convert ObjectId to string
    email: mongoUser.email,
    emailVerified: mongoUser.emailVerified || false,
    name: mongoUser.name,
    image: mongoUser.image,
    created_at: mongoUser.createdAt || new Date(),
    updated_at: mongoUser.updatedAt || new Date(),
  };
}

function transformMongoSession(mongoSession: any) {
  return {
    id: mongoSession._id.toString(),
    sessionToken: mongoSession.sessionToken,
    userId: mongoSession.userId.toString(), // Handle ObjectId references
    expiresAt: mongoSession.expires,
    created_at: mongoSession.createdAt || new Date(),
    updated_at: mongoSession.updatedAt || new Date(),
  };
}

const transformedUsers = mongoData.users.map(transformMongoUser);
const transformedSessions = mongoData.sessions.map(transformMongoSession);
```

## Data Export and Import

### Generic Data Export Script

```typescript
interface MigrationData {
  users: any[];
  sessions: any[];
  accounts: any[];
  verificationTokens: any[];
}

async function exportToJSON(data: MigrationData, filename: string) {
  const fs = require('fs').promises;
  
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      userCount: data.users.length,
      sessionCount: data.sessions.length,
      accountCount: data.accounts.length,
      tokenCount: data.verificationTokens.length,
    },
    data,
  };

  await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
  console.log(`Data exported to ${filename}`);
}

// Export data
await exportToJSON(migrationData, 'auth-export.json');
```

### Generic Data Import Script

```typescript
async function importFromJSON(filename: string) {
  const fs = require('fs').promises;
  const data = JSON.parse(await fs.readFile(filename, 'utf8'));
  
  console.log('Import metadata:', data.metadata);
  
  const adapter = apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
    
    // Use batch operations for efficient import
    batchConfig: {
      batchSize: 100,
      concurrency: 3,
    },
  });

  try {
    // Import in dependency order
    if (data.data.users.length > 0) {
      console.log(`Importing ${data.data.users.length} users...`);
      await adapter.createMany({
        model: 'user',
        data: data.data.users,
      });
    }

    if (data.data.sessions.length > 0) {
      console.log(`Importing ${data.data.sessions.length} sessions...`);
      await adapter.createMany({
        model: 'session',
        data: data.data.sessions,
      });
    }

    if (data.data.accounts.length > 0) {
      console.log(`Importing ${data.data.accounts.length} accounts...`);
      await adapter.createMany({
        model: 'account',
        data: data.data.accounts,
      });
    }

    if (data.data.verificationTokens.length > 0) {
      console.log(`Importing ${data.data.verificationTokens.length} verification tokens...`);
      await adapter.createMany({
        model: 'verificationToken',
        data: data.data.verificationTokens,
      });
    }

    console.log('Import completed successfully!');
  } finally {
    await adapter.close();
  }
}

// Import data
await importFromJSON('auth-export.json');
```

## Schema Mapping

### Field Mapping Reference

| Better Auth Field | Prisma/Drizzle | MongoDB | Cognito | Notes |
|-------------------|----------------|---------|---------|-------|
| `id` | `id` | `_id` | `Username` | String ID required |
| `email` | `email` | `email` | `email` attribute | Primary identifier |
| `emailVerified` | `emailVerified` | `emailVerified` | `email_verified` | Boolean |
| `name` | `name` | `name` | `name` attribute | Optional |
| `image` | `image` | `image` | `picture` attribute | Optional |
| `createdAt` | `createdAt` | `createdAt` | `UserCreateDate` | Auto-generated |
| `updatedAt` | `updatedAt` | `updatedAt` | `UserLastModifiedDate` | Auto-generated |

### Session Mapping

| Better Auth Field | Source Fields | Notes |
|-------------------|---------------|--------|
| `id` | `id` / `_id` | Unique identifier |
| `sessionToken` | `sessionToken` / `token` | JWT token |
| `userId` | `userId` / `user_id` | Foreign key to user |
| `expiresAt` | `expires` / `expiresAt` | Expiration timestamp |

### Account Mapping (OAuth)

| Better Auth Field | Source Fields | Notes |
|-------------------|---------------|--------|
| `id` | `id` / `_id` | Unique identifier |
| `userId` | `userId` / `user_id` | Foreign key to user |
| `type` | `type` | Usually 'oauth' |
| `provider` | `provider` | e.g., 'google', 'github' |
| `providerAccountId` | `providerAccountId` | Provider's user ID |
| `access_token` | `access_token` | OAuth access token |
| `refresh_token` | `refresh_token` | OAuth refresh token |

## Common Migration Issues

### 1. ID Format Conflicts

**Problem**: Different ID formats (UUID vs ObjectId vs auto-increment)

**Solution**:
```typescript
function normalizeId(id: any): string {
  if (typeof id === 'string') return id;
  if (id && typeof id.toString === 'function') return id.toString();
  throw new Error(`Cannot normalize ID: ${id}`);
}

const normalizedUsers = rawUsers.map(user => ({
  ...user,
  id: normalizeId(user.id || user._id),
}));
```

### 2. Date Format Issues

**Problem**: Different date formats and timezones

**Solution**:
```typescript
function normalizeDate(date: any): Date {
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  if (typeof date === 'number') return new Date(date);
  return new Date(); // Default to current date
}

const normalizedSessions = rawSessions.map(session => ({
  ...session,
  expiresAt: normalizeDate(session.expires || session.expiresAt),
}));
```

### 3. Missing Required Fields

**Problem**: Source system missing fields required by Better Auth

**Solution**:
```typescript
function addDefaults(user: any) {
  return {
    ...user,
    emailVerified: user.emailVerified ?? false,
    created_at: user.created_at || user.createdAt || new Date(),
    updated_at: user.updated_at || user.updatedAt || new Date(),
  };
}
```

### 4. Foreign Key Relationships

**Problem**: Maintaining relationships between entities

**Solution**:
```typescript
// Create ID mapping for foreign key updates
const userIdMap = new Map<string, string>();

// During user import, track old -> new ID mappings
const importUsers = async (users: any[]) => {
  for (const user of users) {
    const oldId = user.id;
    const newUser = await adapter.create({
      model: 'user',
      data: user,
    });
    userIdMap.set(oldId, newUser.id);
  }
};

// Update foreign keys in sessions
const updateSessions = (sessions: any[]) => {
  return sessions.map(session => ({
    ...session,
    userId: userIdMap.get(session.userId) || session.userId,
  }));
};
```

### 5. Duplicate Data

**Problem**: Duplicate records causing constraint violations

**Solution**:
```typescript
async function deduplicateUsers(users: any[]) {
  const seen = new Set<string>();
  const unique: any[] = [];

  for (const user of users) {
    const key = user.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(user);
    } else {
      console.warn(`Duplicate user found: ${user.email}`);
    }
  }

  return unique;
}
```

## Validation and Testing

### Pre-Migration Validation

```typescript
async function validateMigrationData(data: MigrationData) {
  const errors: string[] = [];

  // Validate users
  for (const user of data.users) {
    if (!user.email) {
      errors.push(`User missing email: ${JSON.stringify(user)}`);
    }
    if (!user.id) {
      errors.push(`User missing ID: ${JSON.stringify(user)}`);
    }
  }

  // Validate sessions
  for (const session of data.sessions) {
    if (!session.sessionToken) {
      errors.push(`Session missing token: ${JSON.stringify(session)}`);
    }
    if (!session.userId) {
      errors.push(`Session missing userId: ${JSON.stringify(session)}`);
    }
  }

  // Check foreign key integrity
  const userIds = new Set(data.users.map(u => u.id));
  for (const session of data.sessions) {
    if (!userIds.has(session.userId)) {
      errors.push(`Session references non-existent user: ${session.userId}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed:\n${errors.join('\n')}`);
  }

  console.log('Data validation passed!');
}
```

### Post-Migration Testing

```typescript
async function testMigration() {
  const adapter = apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  });

  try {
    // Test user retrieval
    const userCount = await adapter.count({ model: 'user' });
    console.log(`Migrated ${userCount} users`);

    // Test session retrieval
    const sessionCount = await adapter.count({ model: 'session' });
    console.log(`Migrated ${sessionCount} sessions`);

    // Test authentication flow
    const testUser = await adapter.findOne({
      model: 'user',
      where: { email: 'test@example.com' },
    });

    if (testUser) {
      console.log('Test user found successfully');
    }

    // Test session lookup
    if (testUser) {
      const userSessions = await adapter.findMany({
        model: 'session',
        where: { userId: testUser.id },
      });
      console.log(`Found ${userSessions.length} sessions for test user`);
    }

    console.log('Migration testing completed successfully!');
  } finally {
    await adapter.close();
  }
}
```

### Rollback Strategy

```typescript
async function rollbackMigration() {
  console.log('Starting rollback...');
  
  const adapter = apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  });

  try {
    // Clear migrated data in reverse dependency order
    await adapter.deleteMany({ model: 'verificationToken', where: {} });
    await adapter.deleteMany({ model: 'account', where: {} });
    await adapter.deleteMany({ model: 'session', where: {} });
    await adapter.deleteMany({ model: 'user', where: {} });

    console.log('Rollback completed successfully');
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  } finally {
    await adapter.close();
  }
}

// Use with caution!
// await rollbackMigration();
```

## Next Steps

After successful migration:

1. **Update deployment configuration** to use new authentication system
2. **Monitor application logs** for any authentication errors
3. **Test all authentication flows** in production
4. **Update documentation** to reflect new authentication setup
5. **Train team members** on new system administration
6. **Schedule old system decommissioning** after stability period

For additional help:
- [Configuration Guide](./configuration.md)
- [Troubleshooting Guide](./troubleshooting.md) 
- [API Reference](./api-reference.md)