# Getting Started with Better Auth + Apso Integration

This guide shows you how to set up Better Auth with the Apso adapter from scratch to build enterprise-grade authentication for your applications.

## Prerequisites

- Node.js 18.0.0 or higher
- An Apso project with generated backend API
- PostgreSQL, MySQL, or SQLite database
- Basic knowledge of React/Next.js

## Quick Start

### 1. Installation

Install the required packages:

```bash
npm install better-auth @apso/better-auth-apso-adapter
```

### 2. Environment Configuration

Create a `.env.local` file in your project root:

```bash
# Better Auth Configuration
BETTER_AUTH_SECRET="your-32-character-secret-key-here"
BETTER_AUTH_URL="http://localhost:3000"

# Apso Backend Configuration
APSO_BASE_URL="http://localhost:3001"
APSO_API_KEY="your-apso-api-key"

# Database Configuration (if using direct connection)
DATABASE_URL="postgresql://user:password@localhost:5432/database"
```

### 3. Apso Backend Setup

Generate your backend using Apso with the required entities:

```json
// .apsorc configuration for Better Auth
{
  "version": 2,
  "entities": [
    {
      "name": "User",
      "created_at": true,
      "updated_at": true,
      "fields": [
        {"name": "id", "type": "uuid", "primary": true},
        {"name": "email", "type": "text", "length": 255, "is_email": true, "unique": true},
        {"name": "emailVerified", "type": "boolean", "default": false},
        {"name": "name", "type": "text", "nullable": true},
        {"name": "image", "type": "text", "nullable": true}
      ]
    },
    {
      "name": "Session",
      "created_at": true,
      "updated_at": true,
      "fields": [
        {"name": "id", "type": "text", "primary": true},
        {"name": "userId", "type": "uuid"},
        {"name": "expiresAt", "type": "date"},
        {"name": "ipAddress", "type": "text", "nullable": true},
        {"name": "userAgent", "type": "text", "nullable": true}
      ]
    },
    {
      "name": "Account",
      "created_at": true,
      "updated_at": true,
      "fields": [
        {"name": "userId", "type": "uuid"},
        {"name": "type", "type": "text"},
        {"name": "provider", "type": "text"},
        {"name": "providerAccountId", "type": "text"},
        {"name": "password", "type": "text", "nullable": true},
        {"name": "refresh_token", "type": "text", "nullable": true},
        {"name": "access_token", "type": "text", "nullable": true},
        {"name": "expires_at", "type": "integer", "nullable": true}
      ]
    }
  ],
  "relationships": [
    {"name": "User", "relationship": "hasMany", "target": "Session", "on": "userId"},
    {"name": "User", "relationship": "hasMany", "target": "Account", "on": "userId"}
  ]
}
```

Then generate your backend:

```bash
# In your Apso backend directory
npm run schema:sync
npm run start:dev
```

### 4. Better Auth Configuration

Create `lib/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { apsoAdapter } from "@apso/better-auth-apso-adapter";

export const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL || "http://localhost:3001",
    apiKey: process.env.APSO_API_KEY || "your-api-key",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true for production
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 1 week
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      name: {
        type: "string",
        required: false,
      },
    },
  },
  advanced: {
    cookiePrefix: "better-auth",
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
```

### 5. API Route Setup

Create `app/api/auth/[...auth]/route.ts`:

```typescript
import { auth } from "@/lib/auth";

const handler = auth.handler;

export { handler as GET, handler as POST };
```

### 6. Client-Side Setup

Create `lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

### 7. Basic Usage

**Sign Up Component:**

```typescript
import { signUp } from "@/lib/auth-client";

const handleSignUp = async (email: string, password: string, name?: string) => {
  const result = await signUp.email({
    email,
    password,
    name,
  });

  if (result.data) {
    // User created successfully
    router.push("/dashboard");
  } else if (result.error) {
    // Handle error
    setError(result.error.message);
  }
};
```

**Sign In Component:**

```typescript
import { signIn } from "@/lib/auth-client";

const handleSignIn = async (email: string, password: string) => {
  const result = await signIn.email({
    email,
    password,
  });

  if (result.data) {
    // User signed in successfully
    router.push("/dashboard");
  } else if (result.error) {
    // Handle error
    setError(result.error.message);
  }
};
```

**Protected Page:**

```typescript
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div>
      <h1>Welcome, {session.user.email}!</h1>
      {/* Protected content */}
    </div>
  );
}
```

## Configuration Options

### Apso Adapter Options

```typescript
apsoAdapter({
  baseUrl: string,              // Required: Your Apso backend URL
  apiKey?: string,              // API key for authentication
  timeout?: number,             // Request timeout (default: 30000ms)
  enableValidation?: boolean,   // Enable data validation (default: true)
  enableEmailNormalization?: boolean, // Normalize email addresses (default: true)
  debugMode?: boolean,          // Enable debug logging (default: false)
})
```

### Better Auth Configuration

```typescript
betterAuth({
  database: apsoAdapter(config),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true for production
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // 1 day
  },
  trustedOrigins: ["http://localhost:3000"], // Your frontend URLs
})
```

## Database Schema Requirements

The Apso adapter requires these core entities in your `.apsorc`:

### Required Tables

1. **User Table**
   - `id`: UUID primary key
   - `email`: Unique email field
   - `emailVerified`: Boolean flag
   - `name`: Optional display name
   - `image`: Optional profile image URL

2. **Session Table**
   - `id`: Text primary key (session token)
   - `userId`: UUID foreign key to User
   - `expiresAt`: Date field for expiration
   - `ipAddress`: Optional IP tracking
   - `userAgent`: Optional user agent tracking

3. **Account Table**
   - `userId`: UUID foreign key to User
   - `type`: Account type (e.g., "credential")
   - `provider`: Provider name (e.g., "credential", "google")
   - `providerAccountId`: Provider-specific account ID
   - `password`: Hashed password for credential accounts

## Troubleshooting

### Common Issues

1. **"User not found" during sign-in**
   - Verify user was created successfully
   - Check email normalization settings
   - Ensure account relationship is properly set up

2. **Session not persisting**
   - Verify session table schema matches Better Auth requirements
   - Check that session token is used as primary key ID
   - Ensure cookies are being set correctly

3. **Database connection errors**
   - Verify Apso backend is running
   - Check API key and base URL configuration
   - Ensure database is accessible

### Development Tips

1. **Enable debug mode** during development:
   ```typescript
   apsoAdapter({
     debugMode: true,
     // ... other config
   })
   ```

2. **Use development-friendly settings**:
   ```typescript
   betterAuth({
     trustedOrigins: ["http://localhost:3000"],
     emailAndPassword: {
       requireEmailVerification: false,
     },
   })
   ```

3. **Check network requests** in browser dev tools to debug API calls

## Production Deployment

### Security Considerations

1. **Set strong secrets**:
   ```bash
   BETTER_AUTH_SECRET="a-secure-32-character-secret-key"
   ```

2. **Enable email verification**:
   ```typescript
   emailAndPassword: {
     requireEmailVerification: true,
   }
   ```

3. **Configure trusted origins**:
   ```typescript
   trustedOrigins: ["https://yourdomain.com"],
   ```

4. **Use HTTPS** in production for secure cookie handling

### Environment Variables

```bash
# Production environment variables
BETTER_AUTH_SECRET="production-secret-key"
BETTER_AUTH_URL="https://yourdomain.com"
APSO_BASE_URL="https://your-apso-backend.com"
APSO_API_KEY="production-api-key"
```

## Next Steps

1. **Explore Better Auth features**: [Better Auth Documentation](https://www.better-auth.com/docs)
2. **Learn about Apso**: [Apso Platform](https://apso.ai)
3. **View this example**: See the complete implementation in this repository
4. **Join the community**: Better Auth Discord and Apso community forums

## Support

- **Better Auth**: [Documentation](https://www.better-auth.com/docs) | [GitHub](https://github.com/better-auth/better-auth)
- **Apso**: [Documentation](https://app.apso.cloud/docs) | [Platform](https://apso.ai)
- **Integration Issues**: Check this example repository for reference implementation