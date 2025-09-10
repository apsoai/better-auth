/**
 * Retry Handler Utility
 * 
 * This utility provides retry logic with exponential backoff
 * for handling transient failures in HTTP requests.
 */

import type { RetryConfig, AdapterError, Logger } from '../types';

export class RetryHandler {
  private readonly config: RetryConfig;
  private readonly logger?: Logger;

  constructor(config: RetryConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Execute a function with retry logic
   * @param fn - Function to execute with retry
   * @param context - Context for logging
   * @returns Promise resolving to function result
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: { operation?: string; url?: string }
  ): Promise<T> {
    // TODO: Implement retry logic with exponential backoff
    // 1. Execute function
    // 2. Handle retryable errors
    // 3. Apply exponential backoff with jitter
    // 4. Retry up to maxRetries
    // 5. Throw final error if all attempts fail
    
    let lastError: Error;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          this.logger?.info('Retry succeeded', {
            attempt,
            maxRetries: this.config.maxRetries,
            ...context,
          });
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryable(error as Error, attempt)) {
          this.logger?.debug('Error not retryable, failing immediately', {
            error: error instanceof Error ? error.message : String(error),
            attempt,
            ...context,
          });
          throw error;
        }

        if (attempt < this.config.maxRetries) {
          const delay = this.calculateDelay(attempt);
          
          this.logger?.debug('Retrying after error', {
            error: error instanceof Error ? error.message : String(error),
            attempt,
            maxRetries: this.config.maxRetries,
            delayMs: delay,
            ...context,
          });

          await this.delay(delay);
        }
      }
    }

    this.logger?.error('All retry attempts failed', {
      attempts: this.config.maxRetries + 1,
      finalError: lastError.message,
      ...context,
    });

    throw lastError;
  }

  /**
   * Determine if an error is retryable
   * @param error - Error to check
   * @param attempt - Current attempt number
   * @returns True if error should be retried
   */
  private isRetryable(error: Error, attempt: number): boolean {
    // Don't retry if we've reached max attempts
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    // Handle AdapterError instances
    if (this.isAdapterError(error)) {
      // Check if explicitly marked as retryable
      if (!error.retryable) {
        return false;
      }

      // Check status code against retryable statuses
      if (error.statusCode && !this.config.retryableStatuses.includes(error.statusCode)) {
        return false;
      }

      return true;
    }

    // Handle network errors (usually retryable)
    if (this.isNetworkError(error)) {
      return true;
    }

    // Handle timeout errors (usually retryable)
    if (this.isTimeoutError(error)) {
      return true;
    }

    // Default to not retryable for unknown errors
    return false;
  }

  /**
   * Calculate backoff delay with exponential backoff and jitter
   * @param attempt - Current attempt number (0-based)
   * @returns Delay in milliseconds
   */
  private calculateDelay(attempt: number): number {
    // TODO: Calculate exponential backoff delay with jitter
    // 1. Apply exponential backoff
    // 2. Add jitter to prevent thundering herd
    // 3. Cap at maxDelayMs
    
    const exponentialDelay = this.config.initialDelayMs * Math.pow(2, attempt);
    
    // Add jitter (±25% of the delay)
    const jitterFactor = 0.25;
    const jitter = exponentialDelay * jitterFactor * (Math.random() - 0.5);
    const delayWithJitter = exponentialDelay + jitter;

    // Cap at maximum delay
    return Math.min(delayWithJitter, this.config.maxDelayMs);
  }

  /**
   * Delay execution for specified milliseconds
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =============================================================================
  // Error Type Checking
  // =============================================================================

  private isAdapterError(error: Error): error is AdapterError {
    return error.constructor.name === 'AdapterError';
  }

  private isNetworkError(error: Error): boolean {
    const networkErrorPatterns = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'EHOSTUNREACH',
      'ETIMEDOUT',
      'socket hang up',
      'network error',
      'fetch failed',
    ];

    return networkErrorPatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private isTimeoutError(error: Error): boolean {
    const timeoutPatterns = [
      'timeout',
      'timed out',
      'request timeout',
      'response timeout',
    ];

    return timeoutPatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  // =============================================================================
  // Static Utility Methods
  // =============================================================================

  /**
   * Create default retry configuration
   * @returns Default RetryConfig
   */
  static createDefaultConfig(): RetryConfig {
    return {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      retryableStatuses: [429, 500, 502, 503, 504],
    };
  }

  /**
   * Create aggressive retry configuration for critical operations
   * @returns Aggressive RetryConfig
   */
  static createAggressiveConfig(): RetryConfig {
    return {
      maxRetries: 5,
      initialDelayMs: 50,
      maxDelayMs: 10000,
      retryableStatuses: [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
    };
  }

  /**
   * Create conservative retry configuration
   * @returns Conservative RetryConfig
   */
  static createConservativeConfig(): RetryConfig {
    return {
      maxRetries: 1,
      initialDelayMs: 500,
      maxDelayMs: 2000,
      retryableStatuses: [500, 502, 503],
    };
  }
}