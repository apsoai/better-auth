/**
 * Adapter factory and main entry point
 */

import { ApsoAdapter } from './ApsoAdapter';
import type { ApsoAdapterConfig } from '../types';

/**
 * Creates a new instance of the Apso adapter for Better Auth
 * 
 * @param config - Configuration options for the adapter
 * @returns Configured ApsoAdapter instance
 * 
 * @example
 * ```typescript
 * const adapter = apsoAdapter({
 *   baseUrl: 'https://api.example.com',
 *   apiKey: 'your-api-key',
 *   retryConfig: {
 *     maxRetries: 3,
 *     initialDelayMs: 100,
 *     maxDelayMs: 1000,
 *     retryableStatuses: [429, 500, 502, 503, 504],
 *   },
 * });
 * ```
 */
export function apsoAdapter(config: Partial<ApsoAdapterConfig>): ApsoAdapter {
  return new ApsoAdapter(config);
}

export { ApsoAdapter } from './ApsoAdapter';
export type { ApsoAdapterConfig } from '../types';