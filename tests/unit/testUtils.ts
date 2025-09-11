/**
 * Test Utilities for Better Auth Apso Adapter Tests
 * 
 * Provides common test utilities, fixtures, and helper functions
 * for consistent and comprehensive testing across all test suites.
 */

import type {
  BetterAuthUser,
  BetterAuthSession,
  BetterAuthVerificationToken,
  ApsoUser,
  ApsoSession,
  ApsoVerificationToken,
  ApsoAdapterConfig,
  Logger,
} from '../../src/types';
import { MockDataStore } from './__mocks__/apsoSdk';

// =============================================================================
// Test Data Fixtures
// =============================================================================

export const createTestUser = (overrides: Partial<BetterAuthUser> = {}): BetterAuthUser => ({
  id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  email: 'test@example.com',
  emailVerified: false,
  name: 'Test User',
  ...overrides,
});

export const createTestUsers = (count: number): BetterAuthUser[] => {
  return Array.from({ length: count }, (_, index) => 
    createTestUser({
      email: `user${index + 1}@example.com`,
      name: `Test User ${index + 1}`,
      emailVerified: index % 2 === 0, // Alternate verified status
    })
  );
};

export const createTestSession = (overrides: Partial<BetterAuthSession> = {}): BetterAuthSession => ({
  id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  sessionToken: `token_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
  userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  ...overrides,
});

export const createTestSessions = (count: number, userId?: string): BetterAuthSession[] => {
  const baseUserId = userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return Array.from({ length: count }, (_, index) => 
    createTestSession({
      userId: baseUserId,
      sessionToken: `token_${index + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      expiresAt: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000), // Different expiry times
    })
  );
};

export const createTestVerificationToken = (overrides: Partial<BetterAuthVerificationToken> = {}): BetterAuthVerificationToken => ({
  identifier: 'test@example.com',
  token: `verify_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  ...overrides,
});

export const createTestVerificationTokens = (count: number): BetterAuthVerificationToken[] => {
  return Array.from({ length: count }, (_, index) => 
    createTestVerificationToken({
      identifier: `user${index + 1}@example.com`,
      token: `verify_${index + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
      expiresAt: new Date(Date.now() + (index + 1) * 60 * 60 * 1000), // Different expiry times
    })
  );
};

// Apso API format fixtures
export const createTestApsoUser = (overrides: Partial<ApsoUser> = {}): ApsoUser => ({
  id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  email: 'test@example.com',
  emailVerified: false,
  name: 'Test User',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export const createTestApsoSession = (overrides: Partial<ApsoSession> = {}): ApsoSession => ({
  id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  sessionToken: `token_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
  userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export const createTestApsoVerificationToken = (overrides: Partial<ApsoVerificationToken> = {}): ApsoVerificationToken => ({
  id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  identifier: 'test@example.com',
  token: `verify_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  created_at: new Date(),
  ...overrides,
});

// =============================================================================
// Test Configuration
// =============================================================================

export const createTestConfig = (overrides: Partial<ApsoAdapterConfig> = {}): ApsoAdapterConfig => ({
  baseUrl: 'https://test-api.example.com',
  apiKey: 'test-api-key',
  timeout: 5000,
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  batchConfig: {
    batchSize: 10,
    concurrency: 3,
  },
  observability: {
    metricsEnabled: false,
    tracingEnabled: false,
    logLevel: 'error' as const,
  },
  emailNormalization: true,
  usePlural: true,
  debugMode: false,
  ...overrides,
});

// =============================================================================
// Mock Logger
// =============================================================================

export const createMockLogger = (): Logger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// =============================================================================
// Test Environment Setup and Cleanup
// =============================================================================

export const setupTestEnvironment = () => {
  const mockDataStore = MockDataStore.getInstance();
  mockDataStore.reset();
  
  // Set up some default test data
  const testUser = createTestApsoUser({
    id: 'test-user-1',
    email: 'existing@example.com',
    emailVerified: true,
    name: 'Existing User',
  });
  mockDataStore.createEntity('users', testUser);
  
  const testSession = createTestApsoSession({
    id: 'test-session-1',
    userId: 'test-user-1',
    sessionToken: 'existing-session-token',
  });
  mockDataStore.createEntity('sessions', testSession);
  
  const testVerificationToken = createTestApsoVerificationToken({
    identifier: 'pending@example.com',
    token: 'existing-verification-token',
  });
  mockDataStore.createEntity('verification-tokens', testVerificationToken);
  
  return {
    testUser,
    testSession,
    testVerificationToken,
  };
};

export const cleanupTestEnvironment = () => {
  const mockDataStore = MockDataStore.getInstance();
  mockDataStore.reset();
  jest.clearAllMocks();
};

// =============================================================================
// Assertion Helpers
// =============================================================================

export const assertValidEmail = (email: string): void => {
  expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
};

export const assertValidId = (id: string): void => {
  expect(id).toBeTruthy();
  expect(typeof id).toBe('string');
  expect(id.length).toBeGreaterThan(0);
};

export const assertValidDate = (date: Date): void => {
  expect(date).toBeInstanceOf(Date);
  expect(date.getTime()).not.toBeNaN();
};

export const assertBetterAuthUser = (user: BetterAuthUser): void => {
  assertValidId(user.id);
  assertValidEmail(user.email);
  expect(typeof user.emailVerified).toBe('boolean');
  
  if (user.name !== undefined) {
    expect(typeof user.name).toBe('string');
  }
  
  if (user.image !== undefined) {
    expect(typeof user.image === 'string' || user.image === null).toBe(true);
  }
};

export const assertBetterAuthSession = (session: BetterAuthSession): void => {
  assertValidId(session.id);
  assertValidId(session.userId);
  expect(typeof session.sessionToken).toBe('string');
  expect(session.sessionToken.length).toBeGreaterThan(0);
  assertValidDate(session.expiresAt);
};

export const assertBetterAuthVerificationToken = (token: BetterAuthVerificationToken): void => {
  assertValidEmail(token.identifier);
  expect(typeof token.token).toBe('string');
  expect(token.token.length).toBeGreaterThan(0);
  assertValidDate(token.expiresAt);
};

// =============================================================================
// Error Testing Helpers
// =============================================================================

export const createNetworkError = (message = 'Network error'): Error => {
  const error = new Error(message) as any;
  error.code = 'ECONNREFUSED';
  return error;
};

export const createTimeoutError = (message = 'Request timeout'): Error => {
  const error = new Error(message) as any;
  error.code = 'ETIMEDOUT';
  return error;
};

export const createHttpError = (status: number, message?: string): Error => {
  const error = new Error(message || `HTTP ${status}`) as any;
  error.status = status;
  error.statusCode = status;
  return error;
};

export const createValidationError = (field: string, message: string): Error => {
  const error = new Error(`Validation error: ${message}`) as any;
  error.code = 'VALIDATION_ERROR';
  error.field = field;
  return error;
};

// =============================================================================
// Performance Testing Helpers
// =============================================================================

export const measureExecutionTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  
  return {
    result,
    duration: endTime - startTime,
  };
};

export const createLargeDataset = (size: number, type: 'users' | 'sessions' | 'tokens') => {
  switch (type) {
    case 'users':
      return createTestUsers(size);
    case 'sessions':
      return createTestSessions(size);
    case 'tokens':
      return createTestVerificationTokens(size);
    default:
      throw new Error(`Unknown dataset type: ${type}`);
  }
};

// =============================================================================
// Test Case Generators
// =============================================================================

export const generateEmailTestCases = () => [
  { input: 'test@example.com', expected: 'test@example.com', description: 'normal email' },
  { input: 'Test@Example.Com', expected: 'test@example.com', description: 'mixed case email' },
  { input: 'TEST@EXAMPLE.COM', expected: 'test@example.com', description: 'uppercase email' },
  { input: ' test@example.com ', expected: 'test@example.com', description: 'email with whitespace' },
];

export const generateErrorTestCases = () => [
  { status: 400, description: 'bad request', expectedCode: 'VALIDATION_ERROR' },
  { status: 401, description: 'unauthorized', expectedCode: 'UNAUTHORIZED' },
  { status: 403, description: 'forbidden', expectedCode: 'FORBIDDEN' },
  { status: 404, description: 'not found', expectedCode: 'NOT_FOUND' },
  { status: 409, description: 'conflict', expectedCode: 'CONFLICT' },
  { status: 429, description: 'rate limited', expectedCode: 'RATE_LIMIT' },
  { status: 500, description: 'internal server error', expectedCode: 'SERVER_ERROR' },
  { status: 502, description: 'bad gateway', expectedCode: 'SERVER_ERROR' },
  { status: 503, description: 'service unavailable', expectedCode: 'SERVER_ERROR' },
  { status: 504, description: 'gateway timeout', expectedCode: 'SERVER_ERROR' },
];

// =============================================================================
// Mock Reset Utilities
// =============================================================================

export const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  MockDataStore.getInstance().reset();
};

// Export commonly used test values
export const TEST_CONSTANTS = {
  VALID_EMAIL: 'test@example.com',
  INVALID_EMAIL: 'invalid-email',
  VALID_ID: 'user_123456789_abc123def',
  NONEXISTENT_ID: 'nonexistent_user_id',
  EXPIRED_DATE: new Date('2020-01-01'),
  FUTURE_DATE: new Date(Date.now() + 24 * 60 * 60 * 1000),
  TIMEOUT_DURATION: 100,
  LONG_STRING: 'a'.repeat(1000),
} as const;