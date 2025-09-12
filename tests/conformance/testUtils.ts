/**
 * Test Utilities for Conformance Tests
 * 
 * This file provides utilities for creating properly mocked adapter instances
 * for conformance testing.
 */

import type { 
  BetterAuthAdapter,
  ApsoAdapterConfig,
} from '../../src/types';

import { ApsoAdapter } from '../../src/adapter/ApsoAdapter';
import { QueryTranslator } from '../../src/query/QueryTranslator';
import { ResponseNormalizer } from '../../src/response/ResponseNormalizer';
import { EntityMapper } from '../../src/response/EntityMapper';
import { ConfigValidator } from '../../src/utils/ConfigValidator';
import { MockHttpClient } from './__mocks__/HttpClient';

/**
 * Creates an ApsoAdapter instance with mocked dependencies for testing
 */
export function createTestAdapter(config: Partial<ApsoAdapterConfig>): BetterAuthAdapter {
  // Validate and normalize configuration
  const validatedConfig = ConfigValidator.validateAndThrow(config);
  
  // Create mocked HTTP client
  const httpClient = new MockHttpClient() as any;
  
  // Create other components
  const queryTranslator = new QueryTranslator(validatedConfig);
  const responseNormalizer = new ResponseNormalizer(validatedConfig.logger);
  const entityMapper = new EntityMapper();

  // Create adapter instance with mocked components
  const adapter = new ApsoAdapter(validatedConfig, {
    httpClient,
    queryTranslator,
    responseNormalizer,
    entityMapper
  });

  return adapter;
}

/**
 * Default test configuration for conformance tests
 */
export const defaultTestConfig: Partial<ApsoAdapterConfig> = {
  baseUrl: 'https://api.example.com',
  apiKey: 'test-api-key',
  debugMode: true,
  timeout: 5000,
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    retryableStatuses: [500, 502, 503, 504],
  },
};