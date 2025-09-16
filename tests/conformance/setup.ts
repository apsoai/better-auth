/**
 * Conformance Test Setup
 *
 * This file sets up the test environment for Better Auth conformance tests,
 * ensuring that all mocks are properly configured and that the test environment
 * matches real-world Better Auth usage patterns.
 */

import {
  MockDataStore,
  mockApsoClientFactory,
} from '../unit/__mocks__/apsoSdk';

// Mock the Apso SDK at module level
jest.mock('@apso/sdk', () => {
  return mockApsoClientFactory;
});

// Mock the HttpClient to use our test implementation
jest.mock('../../src/client/HttpClient', () => {
  const { MockHttpClient } = require('./__mocks__/HttpClient');
  return { HttpClient: MockHttpClient };
});

// Global test setup
beforeAll(() => {
  // Configure console to reduce test noise if needed
  if (process.env.NODE_ENV === 'test') {
    console.log = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
  }
});

// Reset mocks and data store before each test
beforeEach(() => {
  jest.clearAllMocks();
  MockDataStore.getInstance().reset();
});

// Clean up after each test
afterEach(() => {
  MockDataStore.getInstance().reset();
});

// Global test utilities for conformance tests
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidBetterAuthUser(): R;
      toBeValidBetterAuthSession(): R;
      toBeValidBetterAuthVerificationToken(): R;
    }
  }
}

// Custom matchers for Better Auth entities
expect.extend({
  toBeValidBetterAuthUser(received) {
    const pass =
      typeof received === 'object' &&
      received !== null &&
      typeof received.id === 'string' &&
      received.id.length > 0 &&
      typeof received.email === 'string' &&
      received.email.includes('@') &&
      typeof received.emailVerified === 'boolean' &&
      (received.name === undefined || typeof received.name === 'string') &&
      (received.image === undefined || typeof received.image === 'string');

    if (pass) {
      return {
        message: () =>
          `Expected ${JSON.stringify(received)} not to be a valid Better Auth User`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected ${JSON.stringify(received)} to be a valid Better Auth User with required fields: id (string), email (string), emailVerified (boolean), optional: name (string), image (string)`,
        pass: false,
      };
    }
  },

  toBeValidBetterAuthSession(received) {
    const pass =
      typeof received === 'object' &&
      received !== null &&
      typeof received.id === 'string' &&
      received.id.length > 0 &&
      typeof received.sessionToken === 'string' &&
      received.sessionToken.length > 0 &&
      typeof received.userId === 'string' &&
      received.userId.length > 0 &&
      received.expiresAt instanceof Date;

    if (pass) {
      return {
        message: () =>
          `Expected ${JSON.stringify(received)} not to be a valid Better Auth Session`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected ${JSON.stringify(received)} to be a valid Better Auth Session with required fields: id (string), sessionToken (string), userId (string), expiresAt (Date)`,
        pass: false,
      };
    }
  },

  toBeValidBetterAuthVerificationToken(received) {
    const pass =
      typeof received === 'object' &&
      received !== null &&
      typeof received.identifier === 'string' &&
      received.identifier.length > 0 &&
      typeof received.token === 'string' &&
      received.token.length > 0 &&
      received.expiresAt instanceof Date;

    if (pass) {
      return {
        message: () =>
          `Expected ${JSON.stringify(received)} not to be a valid Better Auth VerificationToken`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected ${JSON.stringify(received)} to be a valid Better Auth VerificationToken with required fields: identifier (string), token (string), expiresAt (Date)`,
        pass: false,
      };
    }
  },
});

export {};
