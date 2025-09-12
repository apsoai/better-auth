# Usage Examples

This guide provides complete, working examples for integrating the Better Auth Apso Adapter with popular frameworks and use cases.

## Table of Contents

- [Next.js Examples](#nextjs-examples)
- [Express.js Examples](#expressjs-examples)
- [React Examples](#react-examples)
- [Node.js Examples](#nodejs-examples)
- [Multi-Tenant Applications](#multi-tenant-applications)
- [High-Performance Setup](#high-performance-setup)
- [Testing Examples](#testing-examples)
- [Production Deployment](#production-deployment)

## Next.js Examples

### Next.js App Router (Recommended)

Complete Next.js 14+ setup with App Router and TypeScript:

#### 1. Installation and Setup

```bash
npm install better-auth @apso/better-auth-apso-adapter
npm install --save-dev @types/node
```

#### 2. Environment Configuration

```env
# .env.local
APSO_BASE_URL=https://your-apso-api.com
APSO_API_KEY=your-secret-api-key
NEXT_PUBLIC_APP_URL=https://your-app.com
BETTER_AUTH_SECRET=your-auth-secret-key
```

#### 3. Auth Configuration

```typescript
// app/lib/auth.ts
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

export const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
    
    // Production configuration
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      retryableStatuses: [429, 500, 502, 503, 504],
    },
    
    cacheConfig: {
      enabled: process.env.NODE_ENV === 'production',
      ttlMs: 300000, // 5 minutes
      maxSize: 1000,
    },
    
    emailNormalization: true,
  }),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL!],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
```

#### 4. API Route Handler

```typescript
// app/api/auth/[...auth]/route.ts
import { auth } from '@/lib/auth';

export const { GET, POST } = auth.handler;
```

#### 5. Client-Side Auth Hook

```typescript
// app/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';
import type { Session, User } from './auth';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
});

export const {
  useSession,
  signIn,
  signOut,
  signUp,
  useUser,
} = authClient;
```

#### 6. Authentication Pages

**Sign Up Page:**
```typescript
// app/auth/signup/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/auth-client';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.data?.user) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Sign Up</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>
      
      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <a href="/auth/signin" className="font-medium text-blue-600 hover:text-blue-500">
          Sign in
        </a>
      </p>
    </div>
  );
}
```

**Sign In Page:**
```typescript
// app/auth/signin/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth-client';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.data?.session) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Sign In</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      
      <div className="mt-4 text-center">
        <a
          href="/auth/forgot-password"
          className="text-sm text-blue-600 hover:text-blue-500"
        >
          Forgot your password?
        </a>
      </div>
      
      <p className="mt-4 text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <a href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-500">
          Sign up
        </a>
      </p>
    </div>
  );
}
```

#### 7. Protected Route Component

```typescript
// app/components/ProtectedRoute.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ 
  children, 
  fallback = <div>Loading...</div> 
}: ProtectedRouteProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/auth/signin');
    }
  }, [session, isPending, router]);

  if (isPending) {
    return fallback;
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
```

#### 8. Dashboard Page

```typescript
// app/dashboard/page.tsx
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardContent from './DashboardContent';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
```

```typescript
// app/dashboard/DashboardContent.tsx
'use client';

import { useUser, signOut } from '@/lib/auth-client';

export default function DashboardContent() {
  const { data: user, isPending } = useUser();

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  if (isPending) {
    return <div>Loading user data...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {user?.name || 'User'}!
            </h1>
            <p className="text-gray-600">{user?.email}</p>
          </div>
          
          <button
            onClick={handleSignOut}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign Out
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900">Account Status</h3>
            <p className="text-blue-700">
              {user?.emailVerified ? 'Verified' : 'Unverified'}
            </p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900">Last Login</h3>
            <p className="text-green-700">Today</p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-900">Account Type</h3>
            <p className="text-purple-700">Standard</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Next.js Pages Router

For applications using Pages Router:

#### 1. Auth Configuration

```typescript
// lib/auth.ts
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

export const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
  }),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
});
```

#### 2. API Route

```typescript
// pages/api/auth/[...auth].ts
import { auth } from '@/lib/auth';

export default auth.handler;
```

#### 3. Auth Context

```typescript
// contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';

interface AuthContextType {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await authClient.getSession();
        setSession(data.session);
        setUser(data.user);
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password });
    if (result.data?.session) {
      setSession(result.data.session);
      setUser(result.data.user);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const result = await authClient.signUp.email({ email, password, name });
    if (result.data?.user) {
      setUser(result.data.user);
    }
  };

  const signOut = async () => {
    await authClient.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

## Express.js Examples

### Basic Express.js Setup

```typescript
// server.ts
import express from 'express';
import cors from 'cors';
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Better Auth setup
const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
    
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
    },
    
    observability: {
      metricsEnabled: true,
      tracingEnabled: process.env.NODE_ENV === 'production',
      logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  }),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BASE_URL || 'http://localhost:3001',
});

// Auth routes
app.use('/api/auth/*', auth.handler);

// Protected route middleware
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session.data?.session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.user = session.data.user;
    req.session = session.data.session;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid session' });
  }
};

// Protected routes
app.get('/api/profile', requireAuth, (req: any, res: any) => {
  res.json({
    user: req.user,
    session: req.session,
  });
});

app.put('/api/profile', requireAuth, async (req: any, res: any) => {
  try {
    // Update user profile logic here
    const updatedUser = {
      ...req.user,
      ...req.body,
    };
    
    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Public routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message 
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Express.js with TypeScript and Validation

```typescript
// types/express.d.ts
import { User, Session } from '@/lib/auth';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}
```

```typescript
// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { auth } from '@/lib/auth';

export const requireAuth = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });

    if (!session.data?.session) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    req.user = session.data.user;
    req.session = session.data.session;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      error: 'Invalid session',
      code: 'INVALID_SESSION'
    });
  }
};

export const requireEmailVerified = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
};
```

```typescript
// routes/users.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireEmailVerified } from '@/middleware/auth';

const router = Router();

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
});

// Get current user profile
router.get('/profile', requireAuth, (req, res) => {
  res.json({
    user: req.user,
    session: {
      id: req.session?.id,
      expiresAt: req.session?.expiresAt,
    },
  });
});

// Update user profile
router.put('/profile', requireAuth, requireEmailVerified, async (req, res) => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    
    // Here you would update the user in your database
    // For now, we'll just return the merged data
    const updatedUser = {
      ...req.user,
      ...validatedData,
    };
    
    res.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
```

## React Examples

### React SPA with Context

```typescript
// hooks/useAuth.ts
import { useState, useEffect, createContext, useContext } from 'react';
import { createAuthClient } from 'better-auth/react';

const authClient = createAuthClient({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
});

interface AuthContextType {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await authClient.getSession();
        if (data?.session) {
          setSession(data.session);
          setUser(data.user);
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.data?.session) {
        setSession(result.data.session);
        setUser(result.data.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    try {
      const result = await authClient.signUp.email({ email, password, name });
      if (result.data?.user) {
        setUser(result.data.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await authClient.signOut();
    setUser(null);
    setSession(null);
  };

  const sendPasswordReset = async (email: string) => {
    await authClient.forgetPassword({ email });
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

```typescript
// components/LoginForm.tsx
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border rounded-md"
        />
      </div>
      
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border rounded-md"
        />
      </div>
      
      {error && <div className="text-red-600 text-sm">{error}</div>}
      
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

## Node.js Examples

### Standalone Node.js Application

```typescript
// app.ts
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

// Initialize auth
const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL!,
    apiKey: process.env.APSO_API_KEY,
    
    // Optimized for CLI/batch operations
    batchConfig: {
      batchSize: 200,
      concurrency: 10,
    },
    
    retryConfig: {
      maxRetries: 5,
      initialDelayMs: 2000,
      maxDelayMs: 30000,
    },
  }),
  
  emailAndPassword: {
    enabled: true,
  },
  
  secret: process.env.BETTER_AUTH_SECRET!,
});

// User management functions
export class UserManager {
  private auth = auth;

  async createUser(userData: { email: string; password: string; name?: string }) {
    try {
      const result = await this.auth.api.signUpEmail({
        body: userData,
      });
      
      console.log('User created:', result.data?.user?.email);
      return result.data?.user;
    } catch (error) {
      console.error('User creation failed:', error);
      throw error;
    }
  }

  async authenticateUser(email: string, password: string) {
    try {
      const result = await this.auth.api.signInEmail({
        body: { email, password },
      });
      
      if (result.data?.session) {
        console.log('Authentication successful for:', email);
        return {
          user: result.data.user,
          session: result.data.session,
        };
      }
      
      throw new Error('Authentication failed');
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  async bulkCreateUsers(users: Array<{ email: string; password: string; name?: string }>) {
    console.log(`Creating ${users.length} users...`);
    
    const results = [];
    const batchSize = 10;
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (userData) => {
        try {
          return await this.createUser(userData);
        } catch (error) {
          console.error(`Failed to create user ${userData.email}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(Boolean));
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Successfully created ${results.length}/${users.length} users`);
    return results;
  }

  async exportUsers() {
    // This would require direct adapter access
    const adapter = (this.auth as any).adapter;
    
    try {
      const users = await adapter.findMany({
        model: 'user',
        select: ['id', 'email', 'name', 'emailVerified'],
      });
      
      return users;
    } catch (error) {
      console.error('User export failed:', error);
      throw error;
    }
  }
}

// Usage example
async function main() {
  const userManager = new UserManager();
  
  try {
    // Create a single user
    const user = await userManager.createUser({
      email: 'admin@example.com',
      password: 'secure-password',
      name: 'Admin User',
    });
    
    // Authenticate the user
    const auth = await userManager.authenticateUser(
      'admin@example.com',
      'secure-password'
    );
    
    console.log('Authentication successful:', auth.user.email);
    
    // Bulk create users
    const bulkUsers = [
      { email: 'user1@example.com', password: 'password1', name: 'User 1' },
      { email: 'user2@example.com', password: 'password2', name: 'User 2' },
      { email: 'user3@example.com', password: 'password3', name: 'User 3' },
    ];
    
    await userManager.bulkCreateUsers(bulkUsers);
    
    // Export all users
    const allUsers = await userManager.exportUsers();
    console.log(`Total users in system: ${allUsers.length}`);
    
  } catch (error) {
    console.error('Application error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
```

## Multi-Tenant Applications

### Multi-Tenant Setup

```typescript
// lib/multi-tenant-auth.ts
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

// Tenant context management
class TenantManager {
  private static instance: TenantManager;
  private currentTenant: string | null = null;

  static getInstance(): TenantManager {
    if (!TenantManager.instance) {
      TenantManager.instance = new TenantManager();
    }
    return TenantManager.instance;
  }

  setTenant(tenantId: string) {
    this.currentTenant = tenantId;
  }

  getTenant(): string {
    if (!this.currentTenant) {
      throw new Error('Tenant context not set');
    }
    return this.currentTenant;
  }

  clearTenant() {
    this.currentTenant = null;
  }
}

export const tenantManager = TenantManager.getInstance();

// Multi-tenant auth configuration
export const createTenantAuth = () => {
  return betterAuth({
    database: apsoAdapter({
      baseUrl: process.env.APSO_BASE_URL!,
      apiKey: process.env.APSO_API_KEY,
      
      // Multi-tenancy configuration
      multiTenancy: {
        enabled: true,
        scopeField: 'tenantId',
        getScopeValue: () => tenantManager.getTenant(),
      },
      
      // Optimized for multi-tenant performance
      cacheConfig: {
        enabled: true,
        ttlMs: 300000, // 5 minutes
        maxSize: 2000, // Larger cache for multiple tenants
      },
      
      batchConfig: {
        batchSize: 50,
        concurrency: 3,
      },
    }),
    
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    
    secret: process.env.BETTER_AUTH_SECRET!,
  });
};

export const auth = createTenantAuth();
```

### Tenant Middleware

```typescript
// middleware/tenant.ts
import { Request, Response, NextFunction } from 'express';
import { tenantManager } from '@/lib/multi-tenant-auth';

// Extract tenant from subdomain
export const extractTenantFromSubdomain = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const host = req.get('host');
  if (!host) {
    return res.status(400).json({ error: 'Host header required' });
  }

  // Extract subdomain (e.g., tenant1.app.com -> tenant1)
  const subdomain = host.split('.')[0];
  
  if (!subdomain || subdomain === 'www') {
    return res.status(400).json({ error: 'Invalid tenant subdomain' });
  }

  tenantManager.setTenant(subdomain);
  next();
};

// Extract tenant from header
export const extractTenantFromHeader = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header required' });
  }

  tenantManager.setTenant(tenantId);
  next();
};

// Extract tenant from JWT claim
export const extractTenantFromJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    // Decode JWT and extract tenant (implementation depends on your JWT structure)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const tenantId = decoded.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in token' });
    }

    tenantManager.setTenant(tenantId);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Cleanup tenant context after request
export const cleanupTenantContext = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.on('finish', () => {
    tenantManager.clearTenant();
  });
  next();
};
```

### Tenant-Aware Express App

```typescript
// server.ts
import express from 'express';
import { auth } from '@/lib/multi-tenant-auth';
import {
  extractTenantFromHeader,
  cleanupTenantContext,
} from '@/middleware/tenant';

const app = express();

app.use(express.json());

// Apply tenant middleware globally
app.use(extractTenantFromHeader);
app.use(cleanupTenantContext);

// Auth routes (tenant-aware)
app.use('/api/auth/*', auth.handler);

// Tenant-specific API routes
app.get('/api/users', async (req, res) => {
  try {
    // This will automatically be scoped to the current tenant
    const adapter = (auth as any).adapter;
    const users = await adapter.findMany({
      model: 'user',
      select: ['id', 'email', 'name'],
    });
    
    res.json({ users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Health check with tenant info
app.get('/api/health', (req, res) => {
  const tenantId = tenantManager.getTenant();
  res.json({ 
    status: 'ok', 
    tenant: tenantId,
    timestamp: new Date().toISOString() 
  });
});

app.listen(3001, () => {
  console.log('Multi-tenant server running on port 3001');
});
```

## High-Performance Setup

### Optimized Configuration

```typescript
// lib/high-performance-auth.ts
import { createHighThroughputApsoAdapter } from '@apso/better-auth-apso-adapter';
import { betterAuth } from 'better-auth';

// High-performance adapter configuration
const adapter = createHighThroughputApsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  apiKey: process.env.APSO_API_KEY,
  
  // Connection optimization
  fetchImpl: new HttpClient({
    connectionPool: {
      maxConnections: 100,
      maxConnectionsPerHost: 20,
      keepAlive: true,
      keepAliveTimeout: 30000,
      idleTimeout: 60000,
    },
    
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 10000,
      minimumRequests: 10,
    },
  }),
  
  // Aggressive caching
  cacheConfig: {
    enabled: true,
    ttlMs: 600000, // 10 minutes
    maxSize: 10000,
  },
  
  // Large batch operations
  batchConfig: {
    batchSize: 500,
    concurrency: 20,
    delayBetweenBatches: 50,
  },
  
  // Minimal retry for speed
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 2000,
    retryableStatuses: [429, 502, 503, 504],
  },
  
  // Performance monitoring
  observability: {
    metricsEnabled: true,
    tracingEnabled: false, // Disable for performance
    logLevel: 'error', // Minimal logging
  },
});

export const auth = betterAuth({
  database: adapter,
  
  emailAndPassword: {
    enabled: true,
  },
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  
  secret: process.env.BETTER_AUTH_SECRET!,
});

// Performance monitoring
setInterval(() => {
  const metrics = adapter.getMetrics();
  
  console.log('Performance metrics:', {
    totalRequests: metrics.totalRequests,
    successRate: ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) + '%',
    averageLatency: metrics.averageLatency + 'ms',
    p95Latency: metrics.p95Latency + 'ms',
    cacheHitRate: (metrics.cacheHitRate * 100).toFixed(2) + '%',
  });
  
  // Alert on performance issues
  if (metrics.averageLatency > 2000) {
    console.warn('High latency detected:', metrics.averageLatency + 'ms');
  }
  
  if (metrics.cacheHitRate < 0.8) {
    console.warn('Low cache hit rate:', (metrics.cacheHitRate * 100).toFixed(2) + '%');
  }
}, 60000); // Every minute

export { adapter };
```

### Load Balancer-Aware Setup

```typescript
// lib/load-balanced-auth.ts
import { apsoAdapter } from '@apso/better-auth-apso-adapter';
import { betterAuth } from 'better-auth';

// Multiple API endpoints for load balancing
const apiEndpoints = [
  process.env.APSO_BASE_URL_1!,
  process.env.APSO_BASE_URL_2!,
  process.env.APSO_BASE_URL_3!,
].filter(Boolean);

let currentEndpointIndex = 0;

// Custom HTTP client with load balancing
class LoadBalancedHttpClient {
  private endpoints: string[];
  private currentIndex: number = 0;

  constructor(endpoints: string[]) {
    this.endpoints = endpoints;
  }

  private getNextEndpoint(): string {
    const endpoint = this.endpoints[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
    return endpoint;
  }

  async request(config: any) {
    const maxAttempts = this.endpoints.length;
    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const endpoint = this.getNextEndpoint();
      
      try {
        const url = new URL(config.url, endpoint).toString();
        const response = await fetch(url, {
          method: config.method,
          headers: config.headers,
          body: config.body ? JSON.stringify(config.body) : undefined,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.warn(`Endpoint ${endpoint} failed:`, error);
        lastError = error;
        
        // If this was the last attempt, throw the error
        if (attempt === maxAttempts - 1) {
          throw lastError;
        }
        
        // Wait before trying next endpoint
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Implement other HTTP methods...
  async get(url: string, config?: any) {
    return this.request({ ...config, method: 'GET', url });
  }

  async post(url: string, data?: any, config?: any) {
    return this.request({ ...config, method: 'POST', url, body: data });
  }

  // ... other methods
}

// Create adapter with load balancing
export const adapter = apsoAdapter({
  baseUrl: apiEndpoints[0], // Primary endpoint
  apiKey: process.env.APSO_API_KEY,
  
  fetchImpl: new LoadBalancedHttpClient(apiEndpoints),
  
  // Optimized for high availability
  retryConfig: {
    maxRetries: apiEndpoints.length * 2, // Retry across all endpoints
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  
  cacheConfig: {
    enabled: true,
    ttlMs: 300000,
    maxSize: 5000,
  },
});

export const auth = betterAuth({
  database: adapter,
  
  emailAndPassword: {
    enabled: true,
  },
  
  secret: process.env.BETTER_AUTH_SECRET!,
});
```

## Testing Examples

### Unit Tests with Jest

```typescript
// tests/auth.test.ts
import { betterAuth } from 'better-auth';
import { apsoAdapter } from '@apso/better-auth-apso-adapter';

// Mock the adapter for testing
jest.mock('@apso/better-auth-apso-adapter');

const mockAdapter = {
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  updateMany: jest.fn(),
  deleteMany: jest.fn(),
  createMany: jest.fn(),
  healthCheck: jest.fn(),
  getMetrics: jest.fn(),
  resetMetrics: jest.fn(),
  clearCache: jest.fn(),
  setTenantContext: jest.fn(),
  getTenantContext: jest.fn(),
  close: jest.fn(),
};

(apsoAdapter as jest.Mock).mockReturnValue(mockAdapter);

describe('Better Auth with Apso Adapter', () => {
  let auth: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    auth = betterAuth({
      database: apsoAdapter({
        baseUrl: 'http://test-api.com',
        apiKey: 'test-key',
      }),
      
      emailAndPassword: {
        enabled: true,
      },
      
      secret: 'test-secret',
      baseURL: 'http://localhost:3000',
    });
  });

  describe('User Registration', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        emailVerified: false,
        name: 'Test User',
      };

      mockAdapter.create.mockResolvedValue({
        id: 'user-123',
        ...userData,
      });

      const result = await auth.api.signUpEmail({
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        },
      });

      expect(mockAdapter.create).toHaveBeenCalledWith({
        model: 'user',
        data: expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
        }),
      });

      expect(result.data?.user).toMatchObject(userData);
    });

    it('should handle registration with existing email', async () => {
      mockAdapter.create.mockRejectedValue(new Error('Email already exists'));

      await expect(
        auth.api.signUpEmail({
          body: {
            email: 'existing@example.com',
            password: 'password123',
          },
        })
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('User Authentication', () => {
    it('should authenticate user with valid credentials', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        hashedPassword: 'hashed-password',
      };

      mockAdapter.findOne.mockResolvedValue(user);
      mockAdapter.create.mockResolvedValue({
        id: 'session-123',
        sessionToken: 'token-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const result = await auth.api.signInEmail({
        body: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(mockAdapter.findOne).toHaveBeenCalledWith({
        model: 'user',
        where: { email: 'test@example.com' },
      });

      expect(result.data?.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should reject authentication with invalid credentials', async () => {
      mockAdapter.findOne.mockResolvedValue(null);

      await expect(
        auth.api.signInEmail({
          body: {
            email: 'nonexistent@example.com',
            password: 'password123',
          },
        })
      ).rejects.toThrow();
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration.test.ts
import { apsoAdapter, checkAdapterHealth } from '@apso/better-auth-apso-adapter';
import { betterAuth } from 'better-auth';

// Integration tests require actual API endpoint
const TEST_API_URL = process.env.TEST_APSO_BASE_URL;
const TEST_API_KEY = process.env.TEST_APSO_API_KEY;

describe('Integration Tests', () => {
  let adapter: any;
  let auth: any;

  beforeAll(async () => {
    if (!TEST_API_URL || !TEST_API_KEY) {
      throw new Error('Test environment variables not set');
    }

    adapter = apsoAdapter({
      baseUrl: TEST_API_URL,
      apiKey: TEST_API_KEY,
      debugMode: true,
    });

    auth = betterAuth({
      database: adapter,
      emailAndPassword: { enabled: true },
      secret: 'test-secret-' + Date.now(),
    });

    // Wait for adapter to be ready
    const isHealthy = await checkAdapterHealth(adapter);
    if (!isHealthy) {
      throw new Error('Adapter health check failed');
    }
  });

  afterAll(async () => {
    if (adapter) {
      await adapter.close();
    }
  });

  describe('End-to-end user flow', () => {
    let testUser: any;
    let testSession: any;

    it('should create a user', async () => {
      const email = `test-${Date.now()}@example.com`;
      
      const result = await auth.api.signUpEmail({
        body: {
          email,
          password: 'test-password-123',
          name: 'Test User',
        },
      });

      expect(result.data?.user).toBeDefined();
      expect(result.data?.user.email).toBe(email);
      testUser = result.data.user;
    });

    it('should authenticate the user', async () => {
      const result = await auth.api.signInEmail({
        body: {
          email: testUser.email,
          password: 'test-password-123',
        },
      });

      expect(result.data?.session).toBeDefined();
      expect(result.data?.user.id).toBe(testUser.id);
      testSession = result.data.session;
    });

    it('should get user session', async () => {
      const result = await auth.api.getSession({
        headers: {
          'authorization': `Bearer ${testSession.token}`,
        },
      });

      expect(result.data?.user.id).toBe(testUser.id);
    });

    it('should sign out the user', async () => {
      await auth.api.signOut({
        headers: {
          'authorization': `Bearer ${testSession.token}`,
        },
      });

      // Verify session is invalidated
      const result = await auth.api.getSession({
        headers: {
          'authorization': `Bearer ${testSession.token}`,
        },
      });

      expect(result.data?.session).toBeFalsy();
    });

    // Cleanup
    afterAll(async () => {
      if (testUser) {
        try {
          await adapter.delete({
            model: 'user',
            where: { id: testUser.id },
          });
        } catch (error) {
          console.warn('Failed to cleanup test user:', error);
        }
      }
    });
  });
});
```

## Production Deployment

### Docker Setup

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(() => process.exit(0)).catch(() => process.exit(1))"

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - APSO_BASE_URL=${APSO_BASE_URL}
      - APSO_API_KEY=${APSO_API_KEY}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: better-auth-app
  labels:
    app: better-auth-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: better-auth-app
  template:
    metadata:
      labels:
        app: better-auth-app
    spec:
      containers:
      - name: app
        image: your-registry/better-auth-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: APSO_BASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: apso-base-url
        - name: APSO_API_KEY
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: apso-api-key
        - name: BETTER_AUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: better-auth-secret
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: v1
kind: Service
metadata:
  name: better-auth-service
spec:
  selector:
    app: better-auth-app
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: v1
kind: Secret
metadata:
  name: auth-secrets
type: Opaque
data:
  apso-base-url: # base64 encoded
  apso-api-key: # base64 encoded
  better-auth-secret: # base64 encoded
```

For more examples and advanced configurations, see:
- [Configuration Guide](./configuration.md)
- [API Reference](./api-reference.md)
- [Troubleshooting Guide](./troubleshooting.md)