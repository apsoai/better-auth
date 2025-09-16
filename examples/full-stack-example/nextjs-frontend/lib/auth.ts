import { betterAuth } from "better-auth";
import { apsoAdapter } from "@apso/better-auth-apso-adapter";

export const auth = betterAuth({
  database: apsoAdapter({
    baseUrl: process.env.APSO_BASE_URL || "http://localhost:3100",
    // Add development API key to suppress configuration warnings
    apiKey: process.env.APSO_API_KEY || "development-test-key",
    // Disable validation for development
    enableValidation: false,
    enableEmailNormalization: false,
    includeTimestamps: false,
  }),
  advanced: {
    cookiePrefix: "better-auth", // Explicitly set cookie prefix
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true for production
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 1 week
    updateAge: 60 * 60 * 24, // 1 day (refresh session)
  },
  user: {
    additionalFields: {
      name: {
        type: "string",
        required: false,
      },
      image: {
        type: "string",
        required: false,
      },
    },
  },
  // Email verification configuration (optional)
  emailVerification: {
    sendOnSignUp: false, // Set to true for production
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      // Implement email sending logic here
      console.log(`Send verification email to ${user.email}: ${url}`);
    },
  },
  // Trust the host in development
  trustedOrigins: process.env.NODE_ENV === "development" 
    ? ["http://localhost:3000"] 
    : [],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;