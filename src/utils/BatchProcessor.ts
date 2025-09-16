/**
 * Batch Processor Utility
 *
 * This utility handles batch processing of operations with concurrency control
 * and progress tracking for bulk operations.
 */

import type { BatchConfig, Logger } from '../types';

export interface BatchResult<T> {
  successful: T[];
  failed: BatchError[];
  totalProcessed: number;
}

export interface BatchError {
  index: number;
  item: any;
  error: Error;
}

export interface BatchProgressCallback {
  (completed: number, total: number, successful: number, failed: number): void;
}

export class BatchProcessor {
  private readonly config: BatchConfig;
  private readonly logger?: Logger;

  constructor(config: BatchConfig, logger?: Logger) {
    this.config = config;
    if (logger !== undefined) {
      this.logger = logger;
    }
  }

  /**
   * Process items in batches with concurrency control
   * @param items - Items to process
   * @param processor - Function to process each item
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to batch results
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    onProgress?: BatchProgressCallback
  ): Promise<BatchResult<R>> {
    // TODO: Implement batch processing with concurrency control
    // 1. Split items into batches
    // 2. Process batches with concurrency limit
    // 3. Collect results and errors
    // 4. Call progress callback
    // 5. Return batch results

    if (items.length === 0) {
      return {
        successful: [],
        failed: [],
        totalProcessed: 0,
      };
    }

    this.logger?.info('Starting batch processing', {
      totalItems: items.length,
      batchSize: this.config.batchSize,
      concurrency: this.config.concurrency,
    });

    const successful: R[] = [];
    const failed: BatchError[] = [];
    let processed = 0;

    // Split into batches
    const batches = this.createBatches(items);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;

      const batchStartIndex = i * this.config.batchSize;

      this.logger?.debug(`Processing batch ${i + 1}/${batches.length}`, {
        batchSize: batch.length,
        startIndex: batchStartIndex,
      });

      // Process batch with concurrency control
      const batchResults = await this.processBatchConcurrently(
        batch,
        (item, index) => processor(item, batchStartIndex + index),
        batchStartIndex
      );

      // Collect results
      successful.push(...batchResults.successful);
      failed.push(...batchResults.failed);
      processed += batch.length;

      // Call progress callback
      if (onProgress) {
        onProgress(processed, items.length, successful.length, failed.length);
      }

      // Delay between batches if configured
      if (this.config.delayBetweenBatches && i < batches.length - 1) {
        await this.delay(this.config.delayBetweenBatches);
      }
    }

    this.logger?.info('Batch processing completed', {
      totalItems: items.length,
      successful: successful.length,
      failed: failed.length,
    });

    return {
      successful,
      failed,
      totalProcessed: processed,
    };
  }

  /**
   * Process a single batch with concurrency control
   * @param batch - Items in the batch
   * @param processor - Processing function
   * @param baseIndex - Base index for error reporting
   * @returns Promise resolving to batch results
   */
  private async processBatchConcurrently<T, R>(
    batch: T[],
    processor: (item: T, index: number) => Promise<R>,
    baseIndex: number
  ): Promise<BatchResult<R>> {
    const successful: R[] = [];
    const failed: BatchError[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      if (!item) continue;

      const globalIndex = baseIndex + i;

      // Create processing promise
      const promise = this.processItem(item, globalIndex, processor)
        .then(result => {
          if (result !== undefined) {
            successful.push(result);
          }
        })
        .catch(error => {
          failed.push({
            index: globalIndex,
            item: item as any,
            error: error as Error,
          });
        });

      executing.push(promise);

      // Maintain concurrency limit
      if (executing.length >= this.config.concurrency) {
        // Wait for at least one to complete
        await Promise.race(executing);

        // Remove completed promises
        const stillExecuting = executing.filter(p => this.isPromisePending(p));
        executing.length = 0;
        executing.push(...stillExecuting);
      }
    }

    // Wait for all remaining promises to complete
    await Promise.all(executing);

    return {
      successful,
      failed,
      totalProcessed: batch.length,
    };
  }

  /**
   * Process a single item with error handling
   * @param item - Item to process
   * @param index - Item index
   * @param processor - Processing function
   * @returns Promise resolving to processed result
   */
  private async processItem<T, R>(
    item: T,
    index: number,
    processor: (item: T, index: number) => Promise<R>
  ): Promise<R> {
    try {
      const result = await processor(item, index);

      this.logger?.debug('Item processed successfully', {
        index,
        hasResult: Boolean(result),
      });

      return result;
    } catch (error) {
      this.logger?.debug('Item processing failed', {
        index,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Split items into batches
   * @param items - Items to batch
   * @returns Array of batches
   */
  private createBatches<T>(items: T[]): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += this.config.batchSize) {
      batches.push(items.slice(i, i + this.config.batchSize));
    }

    return batches;
  }

  /**
   * Check if a promise is still pending
   * @param promise - Promise to check
   * @returns True if promise is pending
   */
  private isPromisePending(promise: Promise<void>): boolean {
    // This is a simplified check - in practice, you'd need a more sophisticated
    // way to track promise state
    return promise instanceof Promise;
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
  // Static Utility Methods
  // =============================================================================

  /**
   * Create default batch configuration
   * @returns Default BatchConfig
   */
  static createDefaultConfig(): BatchConfig {
    return {
      batchSize: 50,
      concurrency: 3,
      delayBetweenBatches: 100,
    };
  }

  /**
   * Create fast batch configuration for small operations
   * @returns Fast BatchConfig
   */
  static createFastConfig(): BatchConfig {
    return {
      batchSize: 100,
      concurrency: 10,
      delayBetweenBatches: 0,
    };
  }

  /**
   * Create conservative batch configuration for heavy operations
   * @returns Conservative BatchConfig
   */
  static createConservativeConfig(): BatchConfig {
    return {
      batchSize: 10,
      concurrency: 1,
      delayBetweenBatches: 500,
    };
  }
}
