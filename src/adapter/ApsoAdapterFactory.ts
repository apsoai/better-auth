/**
 * ApsoAdapterFactory - Main factory for creating Better Auth adapters
 * 
 * This factory orchestrates the creation of ApsoAdapter instances, integrating
 * all the core components (HttpClient, QueryTranslator, ResponseNormalizer, EntityMapper)
 * and providing configuration management, health checking, and adapter lifecycle management.
 * 
 * @example
 * ```typescript
 * import { ApsoAdapterFactory } from './ApsoAdapterFactory';
 * 
 * // Create a basic adapter
 * const adapter = ApsoAdapterFactory.createAdapter({
 *   baseUrl: 'https://api.example.com',
 *   apiKey: 'your-key'
 * });
 * 
 * // Create a reliable adapter with enhanced retry logic
 * const reliableAdapter = ApsoAdapterFactory.createReliableAdapter({
 *   baseUrl: 'https://api.example.com',
 *   apiKey: 'your-key'
 * });
 * 
 * // Create a high-throughput adapter
 * const fastAdapter = ApsoAdapterFactory.createHighThroughputAdapter({
 *   baseUrl: 'https://api.example.com',
 *   apiKey: 'your-key'
 * });
 * ```
 */

import type {
  ApsoAdapterConfig,
  BetterAuthAdapter,
  HealthCheckResult,
  HttpClientConfig,
} from '../types';

import { ApsoAdapter } from './ApsoAdapter';
import { HttpClient } from '../client/HttpClient';
import { QueryTranslator } from '../query/QueryTranslator';
import { ResponseNormalizer } from '../response/ResponseNormalizer';
import { EntityMapper } from '../response/EntityMapper';
import { ConfigValidator } from '../utils/ConfigValidator';

/**
 * Factory class for creating and managing ApsoAdapter instances
 */
export class ApsoAdapterFactory {
  private static readonly activeAdapters = new Map<string, BetterAuthAdapter>();
  private static instanceCounter = 0;

  /**
   * Creates a standard ApsoAdapter instance with validated configuration
   */
  public static createAdapter(config: Partial<ApsoAdapterConfig>): BetterAuthAdapter {
    // Validate and normalize configuration
    const validatedConfig = ConfigValidator.validateAndThrow(config);
    
    // Create core components
    const components = this.createComponents(validatedConfig);
    
    // Create adapter instance
    const adapter = new ApsoAdapter(validatedConfig, components);
    
    // Register adapter for lifecycle management
    const instanceId = this.generateInstanceId();
    this.activeAdapters.set(instanceId, adapter);
    
    if (validatedConfig.logger) {
      validatedConfig.logger.info('Created ApsoAdapter instance', { 
        instanceId,
        baseUrl: validatedConfig.baseUrl 
      });
    }
    
    return adapter;
  }

  /**
   * Creates an ApsoAdapter optimized for reliability with enhanced retry logic
   */
  public static createReliableAdapter(config: Partial<ApsoAdapterConfig>): BetterAuthAdapter {
    const reliableConfig: Partial<ApsoAdapterConfig> = {
      ...config,
      retryConfig: {
        maxRetries: 5,
        initialDelayMs: 200,
        maxDelayMs: 5000,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
        ...config.retryConfig
      },
      timeout: config.timeout || 30000, // 30 second timeout
      cacheConfig: {
        enabled: true,
        ttlMs: 300000, // 5 minute cache
        maxSize: 1000,
        ...config.cacheConfig
      },
      observability: {
        metricsEnabled: true,
        tracingEnabled: true,
        logLevel: 'info',
        ...config.observability
      }
    };

    return this.createAdapter(reliableConfig);
  }

  /**
   * Creates an ApsoAdapter optimized for high throughput with connection pooling
   */
  public static createHighThroughputAdapter(config: Partial<ApsoAdapterConfig>): BetterAuthAdapter {
    const highThroughputConfig: Partial<ApsoAdapterConfig> = {
      ...config,
      retryConfig: {
        maxRetries: 2,
        initialDelayMs: 50,
        maxDelayMs: 500,
        retryableStatuses: [429, 503, 504],
        ...config.retryConfig
      },
      timeout: config.timeout || 5000, // 5 second timeout
      batchConfig: {
        batchSize: 50,
        concurrency: 10,
        delayBetweenBatches: 0,
        ...config.batchConfig
      },
      cacheConfig: {
        enabled: true,
        ttlMs: 60000, // 1 minute cache
        maxSize: 5000,
        ...config.cacheConfig
      },
      observability: {
        metricsEnabled: true,
        tracingEnabled: false, // Disable tracing for performance
        logLevel: 'warn',
        ...config.observability
      }
    };

    return this.createAdapter(highThroughputConfig);
  }

  /**
   * Performs a health check on the provided configuration
   */
  public static async healthCheck(config: Partial<ApsoAdapterConfig>): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const validatedConfig = ConfigValidator.validateAndThrow(config);
      const result = await ConfigValidator.validateHealthCheck(validatedConfig);
      
      return {
        healthy: result.healthy,
        timestamp: new Date(),
        latency: Date.now() - startTime,
        ...(result.healthy ? {} : { error: 'Health check failed' })
      };
    } catch (error) {
      return {
        healthy: false,
        timestamp: new Date(),
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Returns all active adapter instances
   */
  public static getActiveAdapters(): Map<string, BetterAuthAdapter> {
    return new Map(this.activeAdapters);
  }

  /**
   * Closes all active adapter instances and clears the registry
   */
  public static async closeAllAdapters(): Promise<void> {
    const closePromises = Array.from(this.activeAdapters.values()).map(async (adapter) => {
      if ('close' in adapter && typeof adapter.close === 'function') {
        await adapter.close();
      }
    });

    await Promise.allSettled(closePromises);
    this.activeAdapters.clear();
  }

  /**
   * Creates the core components needed by ApsoAdapter
   */
  private static createComponents(config: ApsoAdapterConfig) {
    // Create HTTP client configuration
    const httpClientConfig: HttpClientConfig = {
      backend: 'fetch',
      timeout: config.timeout || 10000,
      ...(config.retryConfig && { retryConfig: config.retryConfig }),
      ...(config.logger && { logger: config.logger }),
      ...(config.observability && {
        observability: {
          enableMetrics: config.observability.metricsEnabled,
          enableTracing: config.observability.tracingEnabled,
          enableLogging: true,
          logLevel: config.observability.logLevel
        }
      })
    };

    // Create core components
    const httpClient = new HttpClient(httpClientConfig);
    const queryTranslator = new QueryTranslator(config);
    const responseNormalizer = new ResponseNormalizer(config.logger);
    const entityMapper = new EntityMapper();

    return {
      httpClient,
      queryTranslator,
      responseNormalizer,
      entityMapper
    };
  }

  /**
   * Generates a unique instance ID for adapter tracking
   */
  private static generateInstanceId(): string {
    this.instanceCounter++;
    return `apso-adapter-${this.instanceCounter}-${Date.now()}`;
  }
}

/**
 * Main factory function for creating ApsoAdapter instances
 * This is the primary entry point that users will import and use
 */
export function apsoAdapter(config: Partial<ApsoAdapterConfig>): () => BetterAuthAdapter {
  return () => ApsoAdapterFactory.createAdapter(config);
}

/**
 * Alternative factory functions for specific use cases
 */
export function createApsoAdapter(config: Partial<ApsoAdapterConfig>): BetterAuthAdapter {
  return ApsoAdapterFactory.createAdapter(config);
}

export function createReliableApsoAdapter(config: Partial<ApsoAdapterConfig>): BetterAuthAdapter {
  return ApsoAdapterFactory.createReliableAdapter(config);
}

export function createHighThroughputApsoAdapter(config: Partial<ApsoAdapterConfig>): BetterAuthAdapter {
  return ApsoAdapterFactory.createHighThroughputAdapter(config);
}

/**
 * Health check function
 */
export async function checkAdapterHealth(config: Partial<ApsoAdapterConfig>): Promise<HealthCheckResult> {
  return ApsoAdapterFactory.healthCheck(config);
}

/**
 * Lifecycle management functions
 */
export function getActiveAdapters(): Map<string, BetterAuthAdapter> {
  return ApsoAdapterFactory.getActiveAdapters();
}

export async function closeAllAdapters(): Promise<void> {
  return ApsoAdapterFactory.closeAllAdapters();
}