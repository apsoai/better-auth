import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000/api/auth",
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;

// Type inference from server
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;