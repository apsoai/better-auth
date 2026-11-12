/**
 * Bulk Operations Implementation
 *
 * This class provides efficient bulk operations (updateMany, deleteMany, createMany)
 * with batching, progress tracking, and comprehensive error handling for the
 * Better Auth Apso Adapter.
 *
 * ## Features
 * - **Batch Processing**: Uses BatchProcessor for efficient concurrent operations
 * - **Memory Management**: Monitors memory usage and prevents memory leaks
 * - **Progress Tracking**: Optional progress callbacks for long-running operations
 * - **Error Handling**: Comprehensive error collection with retry logic
 * - **Entity-Specific Optimizations**: Specialized handling for Users, Sessions, VerificationTokens
 * - **Cascade Operations**: Automatic cascade deletion for user-related data
 * - **Duplicate Handling**: Smart duplicate detection and skipping
 * - **Data Validation**: Pre-insertion validation for data integrity
 *
 * ## Usage Examples
 *
 * ### Bulk Update
 * ```typescript
 * const result = await bulkOperations.updateMany({
 *   model: 'account',
 *   where: [
 *     { field: 'userId', value: userId },
 *     { field: 'providerId', value: 'credential' },
 *   ],
 *   update: { password: hash },
 * });
 * console.log(`Updated ${result.success} rows, ${result.failures} failures`);
 * ```
 *
 * ### Bulk Delete
 * ```typescript
 * const result = await bulkOperations.deleteMany({
 *   model: 'session',
 *   where: [{ field: 'userId', value: userId }],
 * });
 * ```
 *
 * updateMany and deleteMany act only on rows that match the where clause
 * (see findMatching) and refuse an empty one.
 *
 * ### Bulk Create with Validation
 * ```typescript
 * const result = await bulkOperations.createMany({
 *   model: EntityType.USER,
 *   data: newUsers,
 *   skipDuplicates: true,
 *   validateBeforeInsert: true,
 *   batchSize: 100
 * });
 * ```
 *
 * ## Performance Characteristics
 * - Default batch size: 50 records
 * - Default concurrency: 3 concurrent batches
 * - Memory threshold: 100MB (configurable)
 * - Automatic backpressure handling
 * - Network-aware request throttling
 *
 * @since Phase 3 - Bulk Operations Implementation
 * @author Better Auth Apso Adapter
 */

import type { ApsoAdapterConfig, Logger } from '../types';
import {
  EntityType,
  AdapterErrorCode,
  AdapterError as AdapterErrorClass,
} from '../types';
import {
  BatchProcessor,
  type BatchResult,
  type BatchProgressCallback,
} from '../utils/BatchProcessor';
import { ResponseNormalizer } from '../response/ResponseNormalizer';
import { EntityMapper } from '../response/EntityMapper';
import { HttpClient } from '../client/HttpClient';
import {
  matchesWhere,
  normalizeWhere,
  serverFilters,
} from '../query/whereMatcher';
import { UserOperations } from './UserOperations';
import { SessionOperations } from './SessionOperations';
import { VerificationTokenOperations } from './VerificationTokenOperations';
import { AccountOperations } from './AccountOperations';

/** The API returns at most this many rows per page. */
const PAGE_SIZE = 100;
/** Safety cap on candidate pages read for one operation (20,000 rows). */
const MAX_PAGES = 200;

/** Lower-cased model name, with the legacy verification alias folded in. */
function modelKey(model: string): string {
  const key = model.toLowerCase();
  return key === 'verificationtoken' ? 'verification' : key;
}

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Configuration for bulk operations
 */
export interface BulkOperationConfig {
  batchSize?: number;
  maxConcurrency?: number;
  skipFailures?: boolean;
  enableProgress?: boolean;
  memoryThreshold?: number;
}

/**
 * Result of a bulk operation
 */
export interface BulkOperationResult<T = any> {
  /** Total number of items processed */
  count: number;
  /** Number of successful operations */
  success: number;
  /** Number of failed operations */
  failures: number;
  /** Array of errors with context */
  errors: Array<BulkOperationError>;
  /** Successful results (if requested) */
  results?: T[];
  /** Operation duration in milliseconds */
  duration: number;
  /** Memory usage statistics */
  memoryUsage?: MemoryStats;
}

/**
 * Error information for bulk operations
 */
export interface BulkOperationError {
  /** Index of the failed item */
  index: number;
  /** Original item data */
  item: any;
  /** Error that occurred */
  error: Error;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Operation that failed */
  operation: string;
}

/**
 * Options for updateMany operation
 */
export interface UpdateManyOptions {
  /** Better Auth model name, for example "account" or "session". */
  model: string;
  /** Better Auth where clause: a list of conditions, or a plain object. */
  where: unknown;
  update: Record<string, any>;
  batchSize?: number;
  maxConcurrency?: number;
  onProgress?: BatchProgressCallback;
  returnResults?: boolean;
}

/**
 * Options for deleteMany operation
 */
export interface DeleteManyOptions {
  /** Better Auth model name, for example "account" or "session". */
  model: string;
  /** Better Auth where clause: a list of conditions, or a plain object. */
  where: unknown;
  batchSize?: number;
  maxConcurrency?: number;
  onProgress?: BatchProgressCallback;
  cascadeDelete?: boolean;
  returnDeleted?: boolean;
}

/**
 * Options for createMany operation
 */
export interface CreateManyOptions {
  model: EntityType;
  data: Array<Record<string, any>>;
  batchSize?: number;
  maxConcurrency?: number;
  skipDuplicates?: boolean;
  onProgress?: BatchProgressCallback;
  validateBeforeInsert?: boolean;
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  used: number;
  free: number;
  total: number;
  heapUsed?: number;
  heapTotal?: number;
}

/**
 * Internal operation context
 */
interface OperationContext {
  operation: string;
  model: string;
  startTime: number;
  config: BulkOperationConfig;
  logger: Logger | undefined;
}

// =============================================================================
// Dependencies Interface
// =============================================================================

export interface BulkOperationsDependencies {
  httpClient: HttpClient;
  responseNormalizer: ResponseNormalizer;
  entityMapper: EntityMapper;
  config: ApsoAdapterConfig;
  userOperations: UserOperations;
  sessionOperations: SessionOperations;
  verificationTokenOperations: VerificationTokenOperations;
  accountOperations: AccountOperations;
}

// =============================================================================
// Main BulkOperations Class
// =============================================================================

export class BulkOperations {
  private readonly httpClient: HttpClient;
  private readonly responseNormalizer: ResponseNormalizer;
  private readonly entityMapper: EntityMapper;
  private readonly config: ApsoAdapterConfig;
  private readonly logger: Logger | undefined;

  // Entity-specific operation handlers
  private readonly userOperations: UserOperations;
  private readonly sessionOperations: SessionOperations;
  private readonly verificationTokenOperations: VerificationTokenOperations;
  private readonly accountOperations: AccountOperations;

  // Batch processor instance
  private readonly batchProcessor: BatchProcessor;

  // Operation cancellation support
  private readonly cancelTokens = new Map<string, boolean>();

  constructor(dependencies: BulkOperationsDependencies) {
    this.httpClient = dependencies.httpClient;
    this.responseNormalizer = dependencies.responseNormalizer;
    this.entityMapper = dependencies.entityMapper;
    this.config = dependencies.config;
    this.logger = dependencies.config.logger;

    this.userOperations = dependencies.userOperations;
    this.sessionOperations = dependencies.sessionOperations;
    this.verificationTokenOperations = dependencies.verificationTokenOperations;
    this.accountOperations = dependencies.accountOperations;

    // Initialize batch processor with adapter config
    const batchConfig =
      dependencies.config.batchConfig || BatchProcessor.createDefaultConfig();
    this.batchProcessor = new BatchProcessor(batchConfig, this.logger);

    this.logger?.info('BulkOperations initialized', {
      batchSize: batchConfig.batchSize,
      concurrency: batchConfig.concurrency,
    });
  }

  // =============================================================================
  // Public API Methods
  // =============================================================================

  /**
   * Update multiple records matching criteria
   * Uses query-then-process pattern for accuracy and error handling
   */
  async updateMany<T = any>(
    options: UpdateManyOptions
  ): Promise<BulkOperationResult<T>> {
    const contextConfig: Partial<BulkOperationConfig> = {};
    if (options.batchSize !== undefined) {
      contextConfig.batchSize = options.batchSize;
    }
    if (options.maxConcurrency !== undefined) {
      contextConfig.maxConcurrency = options.maxConcurrency;
    }

    const context = this.createOperationContext(
      'updateMany',
      options.model,
      contextConfig
    );

    try {
      this.logger?.info('Starting bulk update operation', {
        model: options.model,
        batchSize: context.config.batchSize,
        concurrency: context.config.maxConcurrency,
      });

      // Step 1: Find all matching records. An update or delete without a
      // where clause is refused rather than applied to every row.
      const matchingRecords = await this.findMatching(
        options.model,
        options.where,
        { requireWhere: true }
      );

      if (matchingRecords.length === 0) {
        return this.createEmptyResult(context);
      }

      // Step 2: Process updates in batches
      const updateProcessor = this.createUpdateProcessor(
        options.model,
        options.update
      );
      const batchResult = await this.batchProcessor.processBatch(
        matchingRecords,
        updateProcessor,
        options.onProgress
      );

      // Step 3: Transform results and create response
      return this.transformBatchResult<T>(
        batchResult,
        context,
        options.returnResults
      );
    } catch (error) {
      this.logger?.error('Bulk update operation failed', {
        error: error instanceof Error ? error.message : String(error),
        model: options.model,
      });

      throw this.handleBulkError(error, context);
    }
  }

  /**
   * Delete multiple records matching criteria
   * Supports cascade deletion and safe deletion patterns
   */
  async deleteMany<T = any>(
    options: DeleteManyOptions
  ): Promise<BulkOperationResult<T>> {
    const contextConfig: Partial<BulkOperationConfig> = {};
    if (options.batchSize !== undefined) {
      contextConfig.batchSize = options.batchSize;
    }
    if (options.maxConcurrency !== undefined) {
      contextConfig.maxConcurrency = options.maxConcurrency;
    }

    const context = this.createOperationContext(
      'deleteMany',
      options.model,
      contextConfig
    );

    try {
      this.logger?.info('Starting bulk delete operation', {
        model: options.model,
        batchSize: context.config.batchSize,
        concurrency: context.config.maxConcurrency,
        cascade: options.cascadeDelete,
      });

      // Step 1: Find all matching records. An update or delete without a
      // where clause is refused rather than applied to every row.
      const matchingRecords = await this.findMatching(
        options.model,
        options.where,
        { requireWhere: true }
      );

      if (matchingRecords.length === 0) {
        return this.createEmptyResult(context);
      }

      // Step 2: Handle cascade deletion for Users
      if (modelKey(options.model) === 'user' && options.cascadeDelete) {
        await this.handleUserCascadeDelete(matchingRecords);
      }

      // Step 3: Store records if we need to return them
      const recordsToReturn = options.returnDeleted
        ? [...matchingRecords]
        : undefined;

      // Step 4: Process deletions in batches
      const deleteProcessor = this.createDeleteProcessor(options.model);
      const batchResult = await this.batchProcessor.processBatch(
        matchingRecords,
        deleteProcessor,
        options.onProgress
      );

      // Step 5: Transform results and create response
      const result = this.transformBatchResult<T>(
        batchResult,
        context,
        options.returnDeleted
      );

      if (recordsToReturn && result.success > 0) {
        result.results = recordsToReturn.slice(0, result.success) as T[];
      }

      return result;
    } catch (error) {
      this.logger?.error('Bulk delete operation failed', {
        error: error instanceof Error ? error.message : String(error),
        model: options.model,
      });

      throw this.handleBulkError(error, context);
    }
  }

  /**
   * Create multiple records with duplicate handling
   * Supports validation and conflict resolution
   */
  async createMany<T = any>(
    options: CreateManyOptions
  ): Promise<BulkOperationResult<T>> {
    const contextConfig: Partial<BulkOperationConfig> = {};
    if (options.batchSize !== undefined) {
      contextConfig.batchSize = options.batchSize;
    }
    if (options.maxConcurrency !== undefined) {
      contextConfig.maxConcurrency = options.maxConcurrency;
    }

    const context = this.createOperationContext(
      'createMany',
      options.model,
      contextConfig
    );

    try {
      this.logger?.info('Starting bulk create operation', {
        model: options.model,
        itemCount: options.data.length,
        batchSize: context.config.batchSize,
        concurrency: context.config.maxConcurrency,
        skipDuplicates: options.skipDuplicates,
      });

      if (options.data.length === 0) {
        return this.createEmptyResult(context);
      }

      // Step 1: Validate data if requested
      let validatedData = options.data;
      if (options.validateBeforeInsert) {
        validatedData = await this.validateCreateData(
          options.model,
          options.data
        );
      }

      // Step 2: Handle duplicate detection if requested
      if (options.skipDuplicates) {
        validatedData = await this.filterDuplicates(
          options.model,
          validatedData
        );
      }

      if (validatedData.length === 0) {
        return this.createEmptyResult(context);
      }

      // Step 3: Process creations in batches
      const createProcessor = this.createCreateProcessor(options.model);
      const batchResult = await this.batchProcessor.processBatch(
        validatedData,
        createProcessor,
        options.onProgress
      );

      // Step 4: Transform results and create response
      return this.transformBatchResult<T>(batchResult, context, true);
    } catch (error) {
      this.logger?.error('Bulk create operation failed', {
        error: error instanceof Error ? error.message : String(error),
        model: options.model,
      });

      throw this.handleBulkError(error, context);
    }
  }

  /**
   * Cancel a running bulk operation
   */
  cancelOperation(operationId: string): boolean {
    if (this.cancelTokens.has(operationId)) {
      this.cancelTokens.set(operationId, true);
      this.logger?.info('Bulk operation cancelled', { operationId });
      return true;
    }
    return false;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): MemoryStats {
    // Use dynamic access to avoid Edge Runtime static analysis errors
    const globalProcess = (globalThis as any).process;
    if (typeof globalProcess !== 'undefined' && globalProcess.memoryUsage) {
      const usage = globalProcess.memoryUsage();
      return {
        used: usage.heapUsed,
        free: usage.heapTotal - usage.heapUsed,
        total: usage.heapTotal,
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
      };
    }

    // Fallback for non-Node environments
    return {
      used: 0,
      free: 0,
      total: 0,
    };
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Create operation context with configuration
   */
  private createOperationContext(
    operation: string,
    model: string,
    config: Partial<BulkOperationConfig>
  ): OperationContext {
    const operationConfig: BulkOperationConfig = {
      skipFailures: config.skipFailures ?? true,
      enableProgress: config.enableProgress ?? true,
      memoryThreshold: config.memoryThreshold || 100 * 1024 * 1024, // 100MB
    };

    if (config.batchSize !== undefined) {
      operationConfig.batchSize = config.batchSize;
    } else if (this.config.batchConfig?.batchSize !== undefined) {
      operationConfig.batchSize = this.config.batchConfig.batchSize;
    } else {
      operationConfig.batchSize = 50;
    }

    if (config.maxConcurrency !== undefined) {
      operationConfig.maxConcurrency = config.maxConcurrency;
    } else if (this.config.batchConfig?.concurrency !== undefined) {
      operationConfig.maxConcurrency = this.config.batchConfig.concurrency;
    } else {
      operationConfig.maxConcurrency = 3;
    }

    return {
      operation,
      model,
      startTime: performance.now(),
      config: operationConfig,
      logger: this.logger,
    };
  }

  /**
   * Find every row of a model that matches a where clause.
   *
   * This is the one place a multi-row operation decides which rows it acts
   * on: findMany, count, updateMany and deleteMany all come through here.
   * Candidates are read from the API a page at a time until it has no more,
   * each row is converted to its Better Auth shape, and matchesWhere decides
   * it. Server-side filters only reduce how many candidates are read.
   *
   * @throws {AdapterError} If the where clause cannot be evaluated, if
   * requireWhere is set and the clause is empty, or if the API has more
   * candidate pages than MAX_PAGES (acting on a partial result is refused).
   */
  async findMatching(
    model: string,
    where: unknown,
    options: { requireWhere?: boolean } = {}
  ): Promise<any[]> {
    const conditions = normalizeWhere(where);
    if (options.requireWhere && conditions.length === 0) {
      throw new AdapterErrorClass(
        AdapterErrorCode.VALIDATION_ERROR,
        `Refusing to update or delete every ${model} row: the where clause is empty`,
        { model, where },
        false,
        400
      );
    }

    const key = modelKey(model);
    const baseUrl = `${this.config.baseUrl}/${this.entityMapper.getApiPath(key)}`;
    const filters = serverFilters(conditions).map(
      filter => `filter=${encodeURIComponent(filter)}`
    );

    const matches: any[] = [];
    const seen = new Set<string>();
    for (let page = 1; ; page++) {
      if (page > MAX_PAGES) {
        throw new AdapterErrorClass(
          AdapterErrorCode.API_ERROR,
          `More than ${MAX_PAGES * PAGE_SIZE} candidate ${model} rows; refusing to act on a partial result`,
          { model, where },
          false
        );
      }
      // A fixed order keeps pages stable, so no row is skipped or repeated.
      const query = [
        ...filters,
        `limit=${PAGE_SIZE}`,
        `page=${page}`,
        'sort=id,ASC',
      ].join('&');
      const response = await this.httpClient.get<any>(
        `${baseUrl}?${query}`,
        this.buildRequestConfig()
      );
      const rows =
        this.responseNormalizer.normalizeArrayResponse<any>(response);

      let added = 0;
      for (const raw of rows) {
        if (!raw || raw.id === undefined || raw.id === null) {
          throw new AdapterErrorClass(
            AdapterErrorCode.API_ERROR,
            `The API returned a ${model} row without an id`,
            { model },
            false
          );
        }
        if (seen.has(String(raw.id))) continue;
        seen.add(String(raw.id));
        added++;

        const row = this.toBetterAuth(key, raw);
        // Match on the Better Auth shape, falling back to the API's own
        // columns for fields the mapping does not carry.
        const view = {
          ...raw,
          ...(raw.created_at !== undefined && { createdAt: raw.created_at }),
          ...(raw.updated_at !== undefined && { updatedAt: raw.updated_at }),
          ...row,
        };
        if (matchesWhere(view, conditions)) matches.push(row);
      }

      const pageCount = response?.pageCount;
      const lastPage =
        typeof pageCount === 'number'
          ? page >= pageCount
          : rows.length < PAGE_SIZE;
      // An API that ignores paging returns the same rows again: stop.
      if (added === 0 || lastPage) break;
    }

    return matches;
  }

  /**
   * Convert an API row to the shape Better Auth reads.
   */
  private toBetterAuth(key: string, raw: any): any {
    if (key === 'verification') {
      const date = (value: unknown) =>
        value ? new Date(value as string) : undefined;
      return {
        id: String(raw.id),
        identifier: raw.identifier,
        value: raw.value,
        expiresAt: new Date(raw.expiresAt || raw.expires_at),
        createdAt: date(raw.createdAt || raw.created_at),
        updatedAt: date(raw.updatedAt || raw.updated_at),
      };
    }
    return this.entityMapper.transformInbound(key, raw);
  }

  /**
   * Create processor function for update operations. Every update is
   * addressed to one matched row by its id.
   */
  private createUpdateProcessor(
    model: string,
    updateData: Record<string, any>
  ) {
    const key = modelKey(model);
    return async (record: any, index: number): Promise<any> => {
      const id = String(record.id);
      try {
        switch (key) {
          case 'user':
            return await this.userOperations.updateUser(id, updateData);

          case 'session':
            return await this.sessionOperations.updateSession(id, updateData);

          case 'account':
            return await this.accountOperations.updateAccount(id, updateData);

          default: {
            const url = `${this.config.baseUrl}/${this.entityMapper.getApiPath(key)}/${id}`;
            const response = await this.httpClient.patch(
              url,
              updateData,
              this.buildRequestConfig()
            );
            return (
              this.responseNormalizer.normalizeSingleResponse(response) ??
              record
            );
          }
        }
      } catch (error) {
        this.logger?.debug('Individual update failed', {
          model,
          recordId: id,
          index,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
  }

  /**
   * Create processor function for delete operations. Every delete is
   * addressed to one matched row by its id.
   */
  private createDeleteProcessor(model: string) {
    const apiPath = this.entityMapper.getApiPath(modelKey(model));
    return async (record: any, index: number): Promise<any> => {
      try {
        await this.httpClient.delete(
          `${this.config.baseUrl}/${apiPath}/${record.id}`,
          this.buildRequestConfig()
        );
        return record;
      } catch (error) {
        this.logger?.debug('Individual delete failed', {
          model,
          recordId: record.id,
          index,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
  }

  /**
   * Create processor function for create operations
   */
  private createCreateProcessor(model: EntityType) {
    return async (data: Record<string, any>, index: number): Promise<any> => {
      try {
        switch (model) {
          case EntityType.USER:
            return await this.userOperations.createUser(data);

          case EntityType.SESSION:
            return await this.sessionOperations.createSession({
              sessionToken: data.sessionToken,
              userId: data.userId,
              expiresAt: new Date(data.expiresAt),
            });

          case EntityType.VERIFICATION_TOKEN:
            return await this.verificationTokenOperations.createVerificationToken(
              {
                identifier: data.identifier,
                token: data.token,
                expiresAt: new Date(data.expiresAt),
              }
            );

          default:
            // Generic create implementation
            const transformedData = this.entityMapper.transformOutbound(
              model,
              data
            );
            const apiPath = this.entityMapper.getApiPath(model);
            const url = `${this.config.baseUrl}/${apiPath}`;

            const response = await this.httpClient.post(
              url,
              transformedData,
              this.buildRequestConfig()
            );

            const normalizedResponse =
              this.responseNormalizer.normalizeSingleResponse(response);
            return this.entityMapper.transformInbound(
              model,
              normalizedResponse
            );
        }
      } catch (error) {
        this.logger?.debug('Individual create failed', {
          model,
          index,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
  }

  /**
   * Handle cascade deletion for users (delete related sessions)
   */
  private async handleUserCascadeDelete(users: any[]): Promise<void> {
    try {
      const userIds = users.map(user => user.id).filter(id => id);

      if (userIds.length === 0) return;

      this.logger?.debug('Performing cascade delete for user sessions', {
        userCount: userIds.length,
        userIds: userIds.slice(0, 5), // Log first 5 for debugging
      });

      for (const userId of userIds) {
        try {
          await this.deleteMany({
            model: 'session',
            where: [{ field: 'userId', value: userId }],
            batchSize: 20,
            maxConcurrency: 2,
          });
        } catch (error) {
          this.logger?.warn('Failed to cascade delete sessions for user', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other users
        }
      }
    } catch (error) {
      this.logger?.error('Cascade delete failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - cascade deletion is best effort
    }
  }

  /**
   * Validate create data before insertion
   */
  private async validateCreateData(
    model: EntityType,
    data: Array<Record<string, any>>
  ): Promise<Array<Record<string, any>>> {
    const validatedData: Array<Record<string, any>> = [];

    for (const item of data) {
      try {
        const validation = this.entityMapper.validate(model, item);
        if (validation.valid) {
          validatedData.push(item);
        } else {
          this.logger?.warn('Invalid data item skipped during create', {
            model,
            item,
            errors: validation.errors,
          });
        }
      } catch (error) {
        this.logger?.warn('Validation failed for data item', {
          model,
          item,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return validatedData;
  }

  /**
   * Filter out duplicate records based on unique constraints
   */
  private async filterDuplicates(
    model: EntityType,
    data: Array<Record<string, any>>
  ): Promise<Array<Record<string, any>>> {
    const filteredData: Array<Record<string, any>> = [];

    for (const item of data) {
      try {
        const isDuplicate = await this.checkForDuplicate(model, item);
        if (!isDuplicate) {
          filteredData.push(item);
        } else {
          this.logger?.debug('Duplicate record skipped', { model, item });
        }
      } catch (error) {
        // If duplicate check fails, include the item (fail open)
        filteredData.push(item);
        this.logger?.warn('Duplicate check failed, including item', {
          model,
          item,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return filteredData;
  }

  /**
   * Check if a record would be a duplicate
   */
  private async checkForDuplicate(
    model: EntityType,
    item: Record<string, any>
  ): Promise<boolean> {
    try {
      switch (model) {
        case EntityType.USER:
          if (item.email) {
            const existingUser = await this.userOperations.findUserByEmail(
              item.email
            );
            return existingUser !== null;
          }
          break;

        case EntityType.SESSION:
          if (item.sessionToken) {
            const existingSession =
              await this.sessionOperations.findSessionByToken(
                item.sessionToken
              );
            return existingSession !== null;
          }
          break;

        case EntityType.VERIFICATION_TOKEN:
          if (item.token) {
            const existingToken =
              await this.verificationTokenOperations.findVerificationTokenByToken(
                item.token
              );
            return existingToken !== null;
          }
          break;
      }

      return false;
    } catch (error) {
      // If we can't determine if it's a duplicate, assume it's not
      return false;
    }
  }

  /**
   * Transform batch processor result to bulk operation result
   */
  private transformBatchResult<T>(
    batchResult: BatchResult<T>,
    context: OperationContext,
    includeResults: boolean = false
  ): BulkOperationResult<T> {
    const duration = performance.now() - context.startTime;

    const errors: BulkOperationError[] = batchResult.failed.map(failure => ({
      index: failure.index,
      item: failure.item,
      error: failure.error,
      retryable: this.isRetryableError(failure.error),
      operation: context.operation,
    }));

    const result: BulkOperationResult<T> = {
      count: batchResult.totalProcessed,
      success: batchResult.successful.length,
      failures: batchResult.failed.length,
      errors,
      duration,
      memoryUsage: this.getMemoryStats(),
    };

    if (includeResults && batchResult.successful.length > 0) {
      result.results = batchResult.successful;
    }

    this.logger?.info('Bulk operation completed', {
      operation: context.operation,
      model: context.model,
      duration,
      success: result.success,
      failures: result.failures,
      memoryUsed: result.memoryUsage?.used,
    });

    return result;
  }

  /**
   * Create empty result for operations with no matching records
   */
  private createEmptyResult<T>(
    context: OperationContext
  ): BulkOperationResult<T> {
    const duration = performance.now() - context.startTime;

    return {
      count: 0,
      success: 0,
      failures: 0,
      errors: [],
      duration,
      memoryUsage: this.getMemoryStats(),
    };
  }

  /**
   * Build HTTP headers for API requests
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.config.apiKey) {
      const authHeader = this.config.authHeader || 'Authorization';
      headers[authHeader] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * Build request config with optional timeout handling
   */
  private buildRequestConfig(additionalConfig: any = {}): any {
    const config: any = {
      headers: this.buildHeaders(),
      ...additionalConfig,
    };

    if (this.config.timeout !== undefined) {
      config.timeout = this.config.timeout;
    }

    return config;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Check if error has status code information
    const errorWithStatus = error as any;
    if (errorWithStatus.statusCode) {
      return (
        this.config.retryConfig?.retryableStatuses?.includes(
          errorWithStatus.statusCode
        ) ?? false
      );
    }

    // Check for network errors
    const networkErrorCodes = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
    ];
    return networkErrorCodes.some(code => error.message.includes(code));
  }

  /**
   * Handle and normalize bulk operation errors
   */
  private handleBulkError(
    error: any,
    context: OperationContext
  ): AdapterErrorClass {
    // Keep a refusal's own message (unsupported or empty where clause).
    if (error instanceof AdapterErrorClass) return error;

    let errorCode: AdapterErrorCode = AdapterErrorCode.UNKNOWN;
    let retryable = false;

    if (error && typeof error === 'object') {
      if ('statusCode' in error) {
        switch (error.statusCode) {
          case 400:
            errorCode = AdapterErrorCode.VALIDATION_ERROR;
            break;
          case 401:
            errorCode = AdapterErrorCode.UNAUTHORIZED;
            break;
          case 403:
            errorCode = AdapterErrorCode.FORBIDDEN;
            break;
          case 404:
            errorCode = AdapterErrorCode.NOT_FOUND;
            break;
          case 409:
            errorCode = AdapterErrorCode.CONFLICT;
            break;
          case 429:
            errorCode = AdapterErrorCode.RATE_LIMIT;
            retryable = true;
            break;
          case 500:
          case 502:
          case 503:
          case 504:
            errorCode = AdapterErrorCode.SERVER_ERROR;
            retryable = true;
            break;
        }
      }

      if ('code' in error) {
        switch (error.code) {
          case 'ECONNREFUSED':
          case 'ENOTFOUND':
          case 'ECONNRESET':
            errorCode = AdapterErrorCode.NETWORK_ERROR;
            retryable = true;
            break;
          case 'ETIMEDOUT':
            errorCode = AdapterErrorCode.TIMEOUT;
            retryable = true;
            break;
        }
      }
    }

    const message = `Bulk ${context.operation} operation failed for model ${context.model}`;

    return new AdapterErrorClass(
      errorCode,
      message,
      error,
      retryable,
      error?.statusCode
    );
  }
}
