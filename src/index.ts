/**
 * Better Auth Apso Adapter
 *
 * A database adapter for Better Auth that interfaces with Apso-generated CRUD REST endpoints.
 * This adapter enables Better Auth to work with any REST API that follows the Apso/nestjsx/crud conventions.
 *
 * @example
 * ```typescript
 * import { apsoAdapter } from '@apso/better-auth-adapter';
 *
 * const adapter = apsoAdapter({
 *   baseUrl: process.env.APSO_BASE_URL!,
 *   apiKey: process.env.APSO_API_KEY,
 *   retryConfig: {
 *     maxRetries: 3,
 *     initialDelayMs: 100,
 *     maxDelayMs: 1000,
 *     retryableStatuses: [429, 500, 502, 503, 504],
 *   },
 * });
 * ```
 */

// Export all types
export * from './types';

// Export main adapter factory and specialized factories
export {
  apsoAdapter,
  createApsoAdapter,
  createReliableApsoAdapter,
  createHighThroughputApsoAdapter,
  checkAdapterHealth,
  getActiveAdapters,
  closeAllAdapters,
  ApsoAdapterFactory,
} from './adapter';

// Export individual components for advanced usage
export { ApsoAdapter } from './adapter/ApsoAdapter';
export { HttpClient } from './client/HttpClient';
export { QueryTranslator } from './query/QueryTranslator';
export { ResponseNormalizer } from './response/ResponseNormalizer';
export { ErrorMapper } from './response/ErrorMapper';

// Export utilities
export { EmailNormalizer } from './utils/EmailNormalizer';
export { RetryHandler } from './utils/RetryHandler';
export { BatchProcessor } from './utils/BatchProcessor';
export { ConfigValidator } from './utils/ConfigValidator';

// Re-export common types for convenience
export type {
  ApsoAdapterConfig,
  BetterAuthAdapter,
  CreateParams,
  UpdateParams,
  FindOneParams,
  FindManyParams,
  AdapterError,
  AdapterErrorCode,
  HttpClient as IHttpClient,
  Logger,
  ObservabilityProvider,
} from './types';
