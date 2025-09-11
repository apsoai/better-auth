/**
 * Jest Mock Setup for Apso SDK
 * 
 * This file sets up comprehensive mocks for the Apso SDK to enable
 * testing our adapter operations without making real HTTP calls.
 */

import {
  MockDataStore,
  mockApsoClientFactory
} from './__mocks__/apsoSdk';

// Mock the entire @apso/sdk module
jest.mock('@apso/sdk', () => {
  const {
    mockApsoClientFactory
  } = require('./__mocks__/apsoSdk');

  return {
    ApsoClient: jest.fn().mockImplementation(() => mockApsoClientFactory.getClient({ baseURL: 'test', apiKey: 'test' })),
    ApsoClientFactory: mockApsoClientFactory,
    QueryBuilder: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      page: jest.fn().mockReturnThis(),
      cache: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({
        params: {},
        useCache: false,
        cacheDuration: 60,
      }),
    })),
  };
});

// Set up global test hooks
beforeEach(() => {
  // Reset the mock data store before each test
  MockDataStore.getInstance().reset();
  
  // Clear all mock function calls
  jest.clearAllMocks();
});

afterEach(() => {
  // Additional cleanup after each test if needed
  jest.clearAllMocks();
});

// Export utilities for tests to use
export { MockDataStore, mockApsoClientFactory };