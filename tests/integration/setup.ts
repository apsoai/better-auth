/**
 * Integration Test Setup
 *
 * Provides infrastructure for integration testing with real Apso SDK.
 * Only runs when INTEGRATION_TESTS=true environment variable is set.
 */

import { apsoAdapter } from '../../src';
import { ApsoAdapterConfig, BetterAuthAdapter } from '../../src/types';

// Integration test configuration
export interface IntegrationTestConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryConfig: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
  testUserPrefix: string;
  testSessionPrefix: string;
  enableCleanup: boolean;
}

// Default integration test configuration
export const defaultIntegrationConfig: IntegrationTestConfig = {
  baseUrl: process.env.APSO_TEST_BASE_URL || 'http://localhost:3000/api',
  ...(process.env.APSO_TEST_API_KEY && {
    apiKey: process.env.APSO_TEST_API_KEY,
  }),
  timeout: parseInt(process.env.APSO_TEST_TIMEOUT || '5000', 10),
  retryConfig: {
    maxRetries: parseInt(process.env.APSO_TEST_MAX_RETRIES || '3', 10),
    initialDelayMs: 100,
    maxDelayMs: 1000,
  },
  testUserPrefix: `test-user-${Date.now()}`,
  testSessionPrefix: `test-session-${Date.now()}`,
  enableCleanup: process.env.APSO_TEST_CLEANUP !== 'false',
};

// Check if integration tests should run
export const shouldRunIntegrationTests = (): boolean => {
  return process.env.INTEGRATION_TESTS === 'true';
};

// Skip test if integration tests are not enabled
export const skipIfNoIntegration = (): void => {
  if (!shouldRunIntegrationTests()) {
    console.log('Skipping integration test - INTEGRATION_TESTS=true not set');
    return;
  }
};

// Test data cleanup registry
export class TestDataRegistry {
  private static instance: TestDataRegistry;
  private createdUsers: Set<string> = new Set();
  private createdSessions: Set<string> = new Set();
  private createdAccounts: Set<string> = new Set();
  private createdVerificationTokens: Set<string> = new Set();

  static getInstance(): TestDataRegistry {
    if (!TestDataRegistry.instance) {
      TestDataRegistry.instance = new TestDataRegistry();
    }
    return TestDataRegistry.instance;
  }

  // Register created entities for cleanup
  registerUser(userId: string): void {
    this.createdUsers.add(userId);
  }

  registerSession(sessionId: string): void {
    this.createdSessions.add(sessionId);
  }

  registerAccount(accountId: string): void {
    this.createdAccounts.add(accountId);
  }

  registerVerificationToken(identifier: string): void {
    this.createdVerificationTokens.add(identifier);
  }

  // Get all registered entities for cleanup
  getCreatedUsers(): string[] {
    return Array.from(this.createdUsers);
  }

  getCreatedSessions(): string[] {
    return Array.from(this.createdSessions);
  }

  getCreatedAccounts(): string[] {
    return Array.from(this.createdAccounts);
  }

  getCreatedVerificationTokens(): string[] {
    return Array.from(this.createdVerificationTokens);
  }

  // Clear all registrations
  clear(): void {
    this.createdUsers.clear();
    this.createdSessions.clear();
    this.createdAccounts.clear();
    this.createdVerificationTokens.clear();
  }
}

// Integration test helper class
export class IntegrationTestHelper {
  private adapterFactory: ReturnType<typeof apsoAdapter>;
  private adapter: BetterAuthAdapter;
  private config: IntegrationTestConfig;
  private registry: TestDataRegistry;

  constructor(config: Partial<IntegrationTestConfig> = {}) {
    this.config = { ...defaultIntegrationConfig, ...config };
    this.registry = TestDataRegistry.getInstance();

    const adapterConfig: Partial<ApsoAdapterConfig> = {
      baseUrl: this.config.baseUrl,
      ...(this.config.apiKey && { apiKey: this.config.apiKey }),
      timeout: this.config.timeout,
      retryConfig: {
        ...this.config.retryConfig,
        retryableStatuses: [429, 500, 502, 503, 504],
      },
      emailNormalization: true,
    };

    this.adapterFactory = apsoAdapter(adapterConfig);
    this.adapter = this.adapterFactory();
  }

  getAdapter(): BetterAuthAdapter {
    return this.adapter;
  }

  getConfig() {
    return this.config;
  }

  // Create test user with automatic cleanup registration
  async createTestUser(overrides: Partial<any> = {}): Promise<any> {
    const userData = {
      id: `${this.config.testUserPrefix}-${Math.random().toString(36).substr(2, 9)}`,
      email: `test-${Math.random().toString(36).substr(2, 9)}@example.com`,
      name: `Test User ${Math.random().toString(36).substr(2, 5)}`,
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    const user = (await this.adapter.create({
      model: 'user',
      data: userData,
    })) as any;
    this.registry.registerUser(user.id);
    return user;
  }

  // Create test session with automatic cleanup registration
  async createTestSession(
    userId: string,
    overrides: Partial<any> = {}
  ): Promise<any> {
    const sessionData = {
      id: `${this.config.testSessionPrefix}-${Math.random().toString(36).substr(2, 9)}`,
      sessionToken: `session-${Math.random().toString(36).substr(2, 20)}`,
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    const session = (await this.adapter.create({
      model: 'session',
      data: sessionData,
    })) as any;
    this.registry.registerSession(session.id);
    return session;
  }

  // Create test account with automatic cleanup registration
  async createTestAccount(
    userId: string,
    overrides: Partial<any> = {}
  ): Promise<any> {
    const accountData = {
      id: `account-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type: 'oauth',
      provider: 'test-provider',
      providerAccountId: `provider-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    const account = (await this.adapter.create({
      model: 'account',
      data: accountData,
    })) as any;
    this.registry.registerAccount(account.id);
    return account;
  }

  // Create test verification token with automatic cleanup registration
  async createTestVerificationToken(
    overrides: Partial<any> = {}
  ): Promise<any> {
    const identifier = `test-${Math.random().toString(36).substr(2, 9)}@example.com`;
    const tokenData = {
      identifier,
      token: `token-${Math.random().toString(36).substr(2, 20)}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      ...overrides,
    };

    const verificationToken = (await this.adapter.create({
      model: 'verificationToken',
      data: tokenData,
    })) as any;
    this.registry.registerVerificationToken(identifier);
    return verificationToken;
  }

  // Cleanup all created test data
  async cleanup(): Promise<void> {
    if (!this.config.enableCleanup) {
      console.log('Cleanup disabled - test data will persist');
      return;
    }

    const errors: Error[] = [];

    // Cleanup sessions first (foreign key constraints)
    for (const sessionId of this.registry.getCreatedSessions()) {
      try {
        await this.adapter.delete({
          model: 'session',
          where: { id: sessionId },
        });
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // Cleanup accounts
    for (const accountId of this.registry.getCreatedAccounts()) {
      try {
        await this.adapter.delete({
          model: 'account',
          where: { id: accountId },
        });
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // Cleanup verification tokens
    for (const identifier of this.registry.getCreatedVerificationTokens()) {
      try {
        await this.adapter.delete({
          model: 'verificationToken',
          where: { identifier },
        });
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // Cleanup users last
    for (const userId of this.registry.getCreatedUsers()) {
      try {
        await this.adapter.delete({
          model: 'user',
          where: { id: userId },
        });
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // Clear registry
    this.registry.clear();

    if (errors.length > 0) {
      console.warn(`Cleanup completed with ${errors.length} errors:`, errors);
    }
  }

  // Health check - verify API connectivity
  async healthCheck(): Promise<boolean> {
    try {
      // Try to create and immediately delete a test user
      const testUser = await this.createTestUser({
        email: `health-check-${Date.now()}@example.com`,
      });

      await this.adapter.delete({
        model: 'user',
        where: { id: testUser.id },
      });
      this.registry.clear();

      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // Performance measurement helper
  async measureOperation<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Operation "${name}" completed in ${duration.toFixed(2)}ms`);
    return { result, duration };
  }

  // Batch operation helper
  async createMultipleUsers(count: number): Promise<any[]> {
    const users = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser({
        email: `batch-user-${i}-${Date.now()}@example.com`,
        name: `Batch User ${i}`,
      });
      users.push(user);
    }

    return users;
  }
}

// Global setup for integration tests
export const setupIntegrationTests = (): IntegrationTestHelper => {
  if (!shouldRunIntegrationTests()) {
    throw new Error(
      'Integration tests require INTEGRATION_TESTS=true environment variable'
    );
  }

  return new IntegrationTestHelper();
};

// Global cleanup for integration tests
export const cleanupIntegrationTests = async (
  helper: IntegrationTestHelper
): Promise<void> => {
  await helper.cleanup();
};

// Custom matchers for integration tests
declare global {
  namespace jest {
    interface Matchers<R> {
      toCompleteWithin(maxDuration: number): R;
      toHaveValidEntityStructure(): R;
    }
  }
}

// Performance assertion matcher
expect.extend({
  toCompleteWithin(received: number, maxDuration: number) {
    const pass = received <= maxDuration;
    if (pass) {
      return {
        message: () =>
          `Expected operation to take more than ${maxDuration}ms, but it completed in ${received}ms`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected operation to complete within ${maxDuration}ms, but it took ${received}ms`,
        pass: false,
      };
    }
  },
});

// Entity structure validation matcher
expect.extend({
  toHaveValidEntityStructure(received: any) {
    const hasId = received && typeof received.id === 'string';
    const hasTimestamps =
      received &&
      received.createdAt instanceof Date &&
      received.updatedAt instanceof Date;

    if (hasId && hasTimestamps) {
      return {
        message: () => `Expected entity to have invalid structure`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected entity to have valid structure with id and timestamps, but got: ${JSON.stringify(received)}`,
        pass: false,
      };
    }
  },
});
