# Better Auth + Apso Full-Stack Example

This is a comprehensive example demonstrating how to build a complete authentication system using **Better Auth** with the **Apso adapter** for database operations.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Next.js 14     │    │  Better Auth     │    │  Apso Backend   │
│  Frontend       │◄──►│  + Apso Adapter  │◄──►│  (NestJS)       │
│                 │    │                  │    │                 │
│ • React hooks   │    │ • Authentication │    │ • REST API      │
│ • TypeScript    │    │ • Session mgmt   │    │ • PostgreSQL    │
│ • Tailwind CSS  │    │ • Validation     │    │ • TypeORM       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## What This Example Includes

### ✅ Complete Authentication System
- User registration with email/password
- User login and logout
- Session management with automatic refresh
- Protected routes and middleware
- Real-time session updates

### ✅ Full-Stack Integration
- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Authentication**: Better Auth with email/password provider
- **Backend**: Apso-generated NestJS REST API
- **Database**: PostgreSQL with proper schema for auth entities

### ✅ Production-Ready Features
- Type-safe throughout (TypeScript)
- Responsive UI with modern design system
- Proper error handling and loading states
- Environment-based configuration
- Database migrations and seeding

### ✅ Developer Experience
- Hot reloading for both frontend and backend
- Docker setup for easy local development
- Comprehensive documentation
- Example data and test users

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn
- Apso CLI (`npm install -g apso-cli`)

### 1. Setup Database

Create a PostgreSQL database:

```sql
CREATE DATABASE better_auth_example;
CREATE USER postgres WITH ENCRYPTED PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE better_auth_example TO postgres;
```

### 2. Setup Backend

```bash
cd apso-backend

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
# DB_HOST=localhost
# DB_PORT=5432  
# DB_USERNAME=postgres
# DB_PASSWORD=password
# DB_DATABASE=better_auth_example

# Generate backend code from .apsorc schema
apso generate

# Install dependencies
npm install

# Run database migrations
npm run migration:run

# Start backend server
npm run start:dev
```

The Apso backend will be available at `http://localhost:3001`.

### 3. Setup Frontend

```bash
cd nextjs-frontend

# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Edit .env.local with your configuration
# BETTER_AUTH_SECRET=your-secret-key-here-should-be-at-least-32-characters
# BETTER_AUTH_URL=http://localhost:3000
# APSO_BASE_URL=http://localhost:3001

# Start frontend server
npm run dev
```

The Next.js frontend will be available at `http://localhost:3000`.

### 4. Test the Application

1. Visit `http://localhost:3000`
2. Click "Sign Up" to create a new account
3. Fill out the registration form and submit
4. You'll be automatically signed in and redirected to the dashboard
5. Explore the dashboard to see user and session information
6. Sign out and try signing back in

## Project Structure

```
full-stack-example/
├── apso-backend/                   # Apso-generated NestJS backend
│   ├── .apsorc                    # Apso configuration with auth schema
│   ├── .env.example               # Environment variables template
│   ├── package.json               # Backend dependencies
│   ├── src/
│   │   ├── app.module.ts          # NestJS app configuration
│   │   ├── user/                  # Generated user CRUD (after apso generate)
│   │   ├── session/               # Generated session CRUD (after apso generate)
│   │   ├── verification-token/    # Generated verification token CRUD
│   │   └── account/               # Generated account CRUD (for OAuth)
│   └── README.md
│
├── nextjs-frontend/               # Next.js 14 frontend application
│   ├── .env.local.example         # Frontend environment template
│   ├── package.json               # Frontend dependencies
│   ├── lib/
│   │   ├── auth.ts                # Better Auth server configuration
│   │   ├── auth-client.ts         # Better Auth client hooks
│   │   └── utils.ts               # Utility functions
│   ├── app/
│   │   ├── page.tsx               # Home page
│   │   ├── login/page.tsx         # Login page
│   │   ├── register/page.tsx      # Registration page
│   │   ├── dashboard/page.tsx     # Protected dashboard
│   │   ├── layout.tsx             # Root layout
│   │   ├── globals.css            # Global styles
│   │   └── api/auth/[...auth]/route.ts  # Better Auth API routes
│   ├── components/ui/             # Reusable UI components
│   └── README.md
│
├── docker-compose.yml             # Docker setup for development
├── package.json                   # Root package with dev scripts
└── README.md                      # This file
```

## Database Schema

The `.apsorc` file defines the following entities optimized for Better Auth:

### User Entity
```json
{
  "name": "User",
  "fields": [
    { "name": "email", "type": "text", "unique": true, "is_email": true },
    { "name": "emailVerified", "type": "bool", "default": false },
    { "name": "hashedPassword", "type": "text", "nullable": true },
    { "name": "name", "type": "text", "nullable": true },
    { "name": "image", "type": "text", "nullable": true }
  ]
}
```

### Session Entity
```json
{
  "name": "Session", 
  "fields": [
    { "name": "sessionToken", "type": "text", "unique": true },
    { "name": "userId", "type": "uuid" },
    { "name": "expiresAt", "type": "date" }
  ]
}
```

### VerificationToken Entity
```json
{
  "name": "VerificationToken",
  "fields": [
    { "name": "identifier", "type": "text" },
    { "name": "token", "type": "text", "unique": true },
    { "name": "expiresAt", "type": "date" }
  ]
}
```

### Account Entity (for OAuth)
```json
{
  "name": "Account",
  "fields": [
    { "name": "userId", "type": "uuid" },
    { "name": "type", "type": "text" },
    { "name": "provider", "type": "text" },
    { "name": "providerAccountId", "type": "text" },
    // ... additional OAuth fields
  ]
}
```

## Development Scripts

From the root directory:

```bash
# Install all dependencies
npm install

# Start both frontend and backend in development mode
npm run dev

# Start only the backend
npm run dev:backend

# Start only the frontend  
npm run dev:frontend

# Run database migrations
npm run db:migrate

# Seed database with test data
npm run db:seed

# Run all tests
npm run test

# Build for production
npm run build
```

## API Endpoints

After running `apso generate`, the backend provides these REST endpoints:

### Users
- `GET /users` - List users (with pagination and filtering)
- `GET /users/:id` - Get user by ID
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Sessions
- `GET /sessions` - List sessions
- `GET /sessions/:id` - Get session by ID
- `POST /sessions` - Create session
- `PUT /sessions/:id` - Update session
- `DELETE /sessions/:id` - Delete session

### Verification Tokens
- `GET /verification-tokens` - List verification tokens
- `GET /verification-tokens/:id` - Get token by ID
- `POST /verification-tokens` - Create token
- `PUT /verification-tokens/:id` - Update token
- `DELETE /verification-tokens/:id` - Delete token

### Accounts (OAuth)
- `GET /accounts` - List accounts
- `GET /accounts/:id` - Get account by ID
- `POST /accounts` - Create account
- `PUT /accounts/:id` - Update account
- `DELETE /accounts/:id` - Delete account

## Better Auth Integration

The application integrates Better Auth using the custom Apso adapter:

```typescript
import { betterAuth } from "better-auth";
import { apsoAdapter } from "@apso/better-auth-apso-adapter";

export const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL,
    endpoints: {
      users: "/users",
      sessions: "/sessions",
      verificationTokens: "/verification-tokens", 
      accounts: "/accounts",
    },
  }),
  emailAndPassword: { enabled: true },
  session: { expiresIn: 60 * 60 * 24 * 7 }, // 1 week
});
```

The adapter automatically:
- Converts Better Auth operations to REST API calls
- Handles data transformation between formats
- Provides type-safe database operations
- Manages relationships between entities

## Deployment

### Backend Deployment

1. **Build the application**:
```bash
cd apso-backend
npm run build
```

2. **Set environment variables**:
```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_PORT=5432
DB_USERNAME=your-db-user
DB_PASSWORD=your-db-password
DB_DATABASE=your-db-name
PORT=3001
```

3. **Run migrations**:
```bash
npm run migration:run
```

4. **Start the server**:
```bash
npm run start:prod
```

### Frontend Deployment

1. **Build the application**:
```bash
cd nextjs-frontend
npm run build
```

2. **Set environment variables**:
```env
BETTER_AUTH_SECRET=your-production-secret-key
BETTER_AUTH_URL=https://your-frontend-domain.com
APSO_BASE_URL=https://your-backend-api-domain.com
```

3. **Deploy** to your preferred platform (Vercel, Netlify, etc.)

### Docker Deployment

Use the included `docker-compose.yml` for containerized deployment:

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Extending the Example

### Adding OAuth Providers

1. **Update Better Auth configuration**:
```typescript
import { github, google } from "better-auth/providers";

export const auth = betterAuth({
  // ... existing config
  providers: [
    github({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
});
```

2. **The Account entity is already configured** in the `.apsorc` schema to support OAuth providers.

### Adding Email Verification

1. **Enable email verification** in Better Auth:
```typescript
export const auth = betterAuth({
  // ... existing config
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Implement email sending (SendGrid, Nodemailer, etc.)
      await sendEmail(user.email, 'Verify your email', url);
    },
  },
});
```

2. **The VerificationToken entity is already configured** to support email verification.

### Adding Password Reset

Better Auth includes password reset functionality out of the box. The VerificationToken entity supports both email verification and password reset tokens.

### Adding User Roles

1. **Update the User entity** in `.apsorc`:
```json
{
  "name": "User",
  "fields": [
    // ... existing fields
    { "name": "role", "type": "text", "default": "user" }
  ]
}
```

2. **Regenerate the backend**:
```bash
cd apso-backend
apso generate
```

3. **Update Better Auth configuration** to include the role field:
```typescript
export const auth = betterAuth({
  // ... existing config
  user: {
    additionalFields: {
      role: { type: "string", required: true },
    },
  },
});
```

## Troubleshooting

### Common Issues

#### 1. Backend Connection Issues
```
Error: connect ECONNREFUSED 127.0.0.1:3001
```

**Solutions:**
- Ensure the Apso backend is running on port 3001
- Check that `APSO_BASE_URL` is set correctly in frontend `.env.local`
- Verify backend CORS configuration allows frontend origin

#### 2. Database Connection Issues
```
Error: password authentication failed for user "postgres"
```

**Solutions:**
- Verify database credentials in backend `.env`
- Ensure PostgreSQL is running and accessible
- Check that the database exists and user has proper permissions

#### 3. Better Auth Session Issues
```
Error: Session not found
```

**Solutions:**
- Ensure session endpoints are working in the backend
- Check that cookies are being set correctly
- Verify BETTER_AUTH_SECRET is set and consistent

#### 4. TypeScript Errors
```
Type 'User' is missing properties
```

**Solutions:**
- Ensure types are properly exported from auth configuration
- Check that generated backend types match Better Auth expectations
- Run type checking: `npm run type-check`

### Debug Mode

Enable debug logging:

**Backend (.env):**
```env
NODE_ENV=development
LOG_LEVEL=debug
```

**Frontend (.env.local):**
```env
NODE_ENV=development
```

### Getting Help

1. **Check the logs**: Both frontend and backend provide detailed error messages in development mode
2. **Network tab**: Use browser dev tools to inspect API requests and responses  
3. **Database**: Check that data is being created correctly in your PostgreSQL database
4. **Better Auth docs**: https://www.better-auth.com/
5. **Apso documentation**: Check the Apso CLI documentation for backend issues

## Contributing

This example is part of the `@apso/better-auth-apso-adapter` package. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## License

MIT License - see the [LICENSE](../../../LICENSE) file for details.