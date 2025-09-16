# Apso Backend for Better Auth Example

This is an Apso-generated NestJS backend that provides CRUD REST endpoints for Better Auth entities.

## Quick Start

1. **Install Apso CLI** (if not already installed):
```bash
npm install -g apso-cli
```

2. **Set up the database**:
```bash
# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
```

3. **Generate the backend code**:
```bash
# This will generate all entities, DTOs, controllers, and services
apso generate
```

4. **Install dependencies**:
```bash
npm install
```

5. **Run database migrations**:
```bash
npm run migration:run
```

6. **Start the development server**:
```bash
npm run start:dev
```

The backend will be available at `http://localhost:3001`.

## Generated Endpoints

After running `apso generate`, you'll have the following REST endpoints:

### Users
- `GET /users` - List all users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Sessions
- `GET /sessions` - List all sessions
- `GET /sessions/:id` - Get session by ID
- `POST /sessions` - Create new session
- `PUT /sessions/:id` - Update session
- `DELETE /sessions/:id` - Delete session

### Verification Tokens
- `GET /verification-tokens` - List all verification tokens
- `GET /verification-tokens/:id` - Get verification token by ID
- `POST /verification-tokens` - Create new verification token
- `PUT /verification-tokens/:id` - Update verification token
- `DELETE /verification-tokens/:id` - Delete verification token

### Accounts (OAuth)
- `GET /accounts` - List all accounts
- `GET /accounts/:id` - Get account by ID
- `POST /accounts` - Create new account
- `PUT /accounts/:id` - Update account
- `DELETE /accounts/:id` - Delete account

## Database Schema

The `.apsorc` file defines the following entities optimized for Better Auth:

- **User**: Core user information with email, password, and profile data
- **Session**: User sessions with tokens and expiration
- **VerificationToken**: Email verification and password reset tokens
- **Account**: OAuth provider account information

## Development

```bash
# Watch mode
npm run start:dev

# Debug mode
npm run start:debug

# Production build
npm run build
npm run start:prod
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## API Documentation

Once running, visit `http://localhost:3001/api` for Swagger documentation.