# Next.js Frontend for Better Auth + Apso Example

This is a Next.js 14 frontend application that demonstrates authentication using Better Auth with the Apso adapter.

## Features

- **Email/Password Authentication**: Complete sign up and sign in flows
- **Protected Routes**: Dashboard accessible only to authenticated users
- **Session Management**: Automatic session handling and refresh
- **Responsive UI**: Built with Tailwind CSS and Radix UI components
- **TypeScript**: Full type safety throughout the application
- **Real-time Updates**: Session state updates in real-time

## Quick Start

1. **Install dependencies**:
```bash
npm install
```

2. **Set up environment variables**:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration:
```env
BETTER_AUTH_SECRET=your-secret-key-here-should-be-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
APSO_BASE_URL=http://localhost:3001
```

3. **Start the development server**:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Pages

- **Home (`/`)**: Landing page with authentication status and links
- **Login (`/login`)**: Sign in form for existing users
- **Register (`/register`)**: Sign up form for new users  
- **Dashboard (`/dashboard`)**: Protected page showing user and session details

## Authentication Flow

### Registration
1. User fills out the registration form with email, password, and optional name
2. Better Auth validates the input and creates a new user
3. Apso adapter sends a POST request to `/users` endpoint on the backend
4. User is automatically signed in after successful registration
5. User is redirected to the dashboard

### Login
1. User enters email and password on the login form
2. Better Auth validates credentials against the database
3. Apso adapter queries the `/users` endpoint to verify user existence
4. Session is created and stored via the `/sessions` endpoint
5. User is redirected to the dashboard

### Session Management
- Sessions are automatically managed by Better Auth
- Session tokens are stored securely and refreshed as needed
- Protected routes automatically redirect unauthenticated users to login
- Users can sign out, which invalidates their session

## Better Auth Configuration

The application uses Better Auth with the following configuration:

```typescript
export const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: "http://localhost:3001",
    endpoints: {
      users: "/users",
      sessions: "/sessions", 
      verificationTokens: "/verification-tokens",
      accounts: "/accounts",
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 1 week
    updateAge: 60 * 60 * 24, // 1 day
  },
});
```

## Components

### UI Components
- **Button**: Customizable button component with variants
- **Input**: Form input component with proper styling
- **Card**: Content card with header, content, and footer sections
- **Label**: Form label component

### Hooks
- **useSession**: Get current user session and authentication state
- **signIn**: Sign in with email and password
- **signUp**: Register new user account
- **signOut**: Sign out current user

## API Integration

The frontend communicates with Better Auth through:

1. **API Routes**: `/app/api/auth/[...auth]/route.ts` handles all Better Auth requests
2. **Client SDK**: React hooks provide easy access to authentication methods
3. **Apso Adapter**: Transparently converts Better Auth operations to REST API calls

## Development

```bash
# Development mode
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Production build
npm run build
npm run start
```

## Customization

### Adding New Fields
To add custom user fields, update both:
1. The Better Auth configuration in `lib/auth.ts`
2. The backend `.apsorc` schema to include the new fields

### Styling
The application uses Tailwind CSS with a custom design system defined in `tailwind.config.js`. Colors and spacing can be customized through CSS custom properties.

### Additional Authentication Methods
Better Auth supports OAuth providers, magic links, and other authentication methods. These can be added to the configuration as needed.

## Troubleshooting

### Common Issues

1. **"Adapter connection failed"**
   - Ensure the Apso backend is running on the correct port
   - Check that `APSO_BASE_URL` environment variable is set correctly
   - Verify CORS is configured properly on the backend

2. **"Session not found"**
   - Check that sessions are being created in the database
   - Verify the session endpoints are working on the backend
   - Ensure cookies are being set correctly

3. **"User registration fails"**
   - Verify the user endpoint accepts POST requests
   - Check that required fields match the backend schema
   - Look for validation errors in the network tab

### Debug Mode

Set `NODE_ENV=development` to enable debug logging in Better Auth and additional error information.