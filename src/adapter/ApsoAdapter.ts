/**
 * Core Apso Adapter Implementation
 *
 * This class implements the Better Auth adapter interface and serves as the main
 * entry point for all database operations. It orchestrates the various components
 * (HttpClient, QueryTranslator, ResponseNormalizer, etc.) to provide a complete
 * adapter implementation.
 */

import type {
  ApsoAdapter as IApsoAdapter,
  ApsoAdapterConfig,
  CreateParams,
  UpdateParams,
  UpdateManyParams,
  DeleteParams,
  DeleteManyParams,
  FindOneParams,
  FindManyParams,
  CountParams,
  CreateManyParams,
  AdapterMetrics,
  TransactionAdapter,
} from '../types';
import { EntityType } from '../types';
import { AdapterError, AdapterErrorCode } from '../types';
import { ConfigValidator } from '../utils/ConfigValidator';
import { HttpClient } from '../client/HttpClient';
import { buildAuthHeaders } from '../utils/authHeaders';
import { guardQuery } from '../query/listUrl';
import { normalizeWhere } from '../query/whereMatcher';
import { QueryTranslator } from '../query/QueryTranslator';
import { ResponseNormalizer } from '../response/ResponseNormalizer';
import { EntityMapper } from '../response/EntityMapper';
import { UserOperations } from '../operations/UserOperations';
import { SessionOperations } from '../operations/SessionOperations';
import { VerificationTokenOperations } from '../operations/VerificationTokenOperations';
import { AccountOperations } from '../operations/AccountOperations';
import { BulkOperations } from '../operations/BulkOperations';

/**
 * Components interface for dependency injection
 */
export interface ApsoAdapterComponents {
  httpClient: HttpClient;
  queryTranslator: QueryTranslator;
  responseNormalizer: ResponseNormalizer;
  entityMapper: EntityMapper;
}

/**
 * Specialized operation handlers for different entity types
 */
export interface EntityOperations {
  userOperations: UserOperations;
  sessionOperations: SessionOperations;
  verificationTokenOperations: VerificationTokenOperations;
  accountOperations: AccountOperations;
}

/**
 * Did the API answer 404? HttpClient puts the status on the error, and the
 * status decides when it is there. An error from a custom client may carry
 * only the API message ("verification not found" or "HTTP 404: ..."), so
 * that is matched when there is no status.
 */
function isNotFound(error: unknown): boolean {
  const { statusCode, message } = (error ?? {}) as {
    statusCode?: unknown;
    message?: unknown;
  };
  return typeof statusCode === 'number'
    ? statusCode === 404
    : /not found|HTTP 404/i.test(String(message ?? ''));
}

export class ApsoAdapter implements IApsoAdapter {
  public readonly config: ApsoAdapterConfig;
  private readonly httpClient: HttpClient;
  private readonly queryTranslator: QueryTranslator;
  private readonly responseNormalizer: ResponseNormalizer;
  private readonly entityMapper: EntityMapper;

  // Specialized operation handlers
  private readonly userOperations: UserOperations;
  private readonly sessionOperations: SessionOperations;
  private readonly verificationTokenOperations: VerificationTokenOperations;
  private readonly accountOperations: AccountOperations;

  // Bulk operations handler
  private readonly bulkOperations: BulkOperations;

  // Metrics tracking
  private metrics: AdapterMetrics;

  // Multi-tenancy support
  private tenantContext: string | null = null;

  constructor(
    config: Partial<ApsoAdapterConfig>,
    components: ApsoAdapterComponents
  ) {
    // Validate and normalize configuration
    this.config = ConfigValidator.validateAndThrow(config);

    // Initialize components
    this.httpClient = components.httpClient;
    this.queryTranslator = components.queryTranslator;
    this.responseNormalizer = components.responseNormalizer;
    this.entityMapper = components.entityMapper;

    // Initialize specialized operation handlers
    const operationsDependencies = {
      httpClient: this.httpClient,
      queryTranslator: this.queryTranslator,
      responseNormalizer: this.responseNormalizer,
      entityMapper: this.entityMapper,
      config: this.config,
    };

    this.userOperations = new UserOperations(operationsDependencies);
    this.sessionOperations = new SessionOperations(operationsDependencies);
    this.verificationTokenOperations = new VerificationTokenOperations(
      operationsDependencies
    );
    this.accountOperations = new AccountOperations(
      this.config,
      this.httpClient,
      this.entityMapper,
      this.responseNormalizer
    );

    // Initialize bulk operations handler
    this.bulkOperations = new BulkOperations({
      httpClient: this.httpClient,
      responseNormalizer: this.responseNormalizer,
      entityMapper: this.entityMapper,
      config: this.config,
      userOperations: this.userOperations,
      sessionOperations: this.sessionOperations,
      verificationTokenOperations: this.verificationTokenOperations,
      accountOperations: this.accountOperations,
    });

    // Initialize metrics
    this.metrics = this.initializeMetrics();

    if (this.config.logger) {
      this.config.logger.info('ApsoAdapter initialized', {
        baseUrl: this.config.baseUrl,
        components: Object.keys(components),
        operations: [
          'UserOperations',
          'SessionOperations',
          'VerificationTokenOperations',
          'BulkOperations',
        ],
      });
    }
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): AdapterMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      cacheHitRate: 0,
      retryCount: 0,
      errorsByType: new Map<AdapterErrorCode, number>(),
      requestsByModel: new Map<string, number>(),
      lastResetTime: new Date(),
    };
  }

  // =============================================================================
  // Better Auth Required Methods
  // =============================================================================

  async create<T>(params: CreateParams): Promise<T> {
    const startTime = performance.now();

    try {
      // Track request
      this.updateModelMetrics(params.model);

      // Route to specialized operations for supported models
      switch (params.model.toLowerCase()) {
        case 'user':
          const userResult = await this.userOperations.createUser(params.data);
          this.updateSuccessMetrics(performance.now() - startTime);
          return userResult as T;

        case 'session':
          // Validate session data format
          // Better Auth might pass 'token' instead of 'sessionToken'
          const sessionToken = params.data.sessionToken || params.data.token;

          if (!sessionToken || !params.data.userId || !params.data.expiresAt) {
            throw new AdapterError(
              AdapterErrorCode.VALIDATION_ERROR,
              'Session creation requires sessionToken, userId, and expiresAt',
              params.data,
              false,
              400
            );
          }

          const sessionData = {
            sessionToken,
            userId: params.data.userId,
            expiresAt: new Date(params.data.expiresAt),
          };

          const sessionResult =
            await this.sessionOperations.createSession(sessionData);
          this.updateSuccessMetrics(performance.now() - startTime);
          return sessionResult as T;

        case 'verification': // BetterAuth uses 'verification' model name
        case 'verificationtoken':
          // BetterAuth sends verification data with:
          // - identifier: OAuth state value (used for lookup)
          // - value: JSON string with callback URL, code verifier, etc.
          // - expiresAt: expiration date
          // We bypass createVerificationToken to avoid token format validation
          // since BetterAuth's 'value' field contains JSON, not a simple token

          if (!params.data.identifier || !params.data.expiresAt) {
            throw new AdapterError(
              AdapterErrorCode.VALIDATION_ERROR,
              'Verification creation requires identifier and expiresAt',
              params.data,
              false,
              400
            );
          }

          // Directly call the API to create the verification record
          const verificationApiData = {
            identifier: params.data.identifier,
            value: params.data.value || params.data.token || '',
            expiresAt: new Date(params.data.expiresAt).toISOString(),
            createdAt: params.data.createdAt
              ? new Date(params.data.createdAt).toISOString()
              : new Date().toISOString(),
            updatedAt: params.data.updatedAt
              ? new Date(params.data.updatedAt).toISOString()
              : new Date().toISOString(),
          };

          const verificationUrl = `${this.config.baseUrl}/verifications`;
          const verificationResponse = await this.httpClient.post<any>(
            verificationUrl,
            verificationApiData,
            {
              headers: this.buildHeaders(),
              ...(this.config.timeout && { timeout: this.config.timeout }),
            }
          );

          const normalizedVerification =
            this.responseNormalizer.normalizeSingleResponse(
              verificationResponse
            ) as any;

          // Return in BetterAuth format
          const tokenResult = {
            id: normalizedVerification.id,
            identifier: normalizedVerification.identifier,
            value: normalizedVerification.value,
            expiresAt: new Date(
              normalizedVerification.expiresAt ||
                normalizedVerification.expires_at
            ),
            createdAt: normalizedVerification.createdAt
              ? new Date(normalizedVerification.createdAt)
              : undefined,
            updatedAt: normalizedVerification.updatedAt
              ? new Date(normalizedVerification.updatedAt)
              : undefined,
          };

          this.updateSuccessMetrics(performance.now() - startTime);
          return tokenResult as T;

        case 'account':
          // Handle account creation - delegate to AccountOperations for UUID generation
          const accountResult = await this.accountOperations.createAccount(
            params.data
          );
          this.updateSuccessMetrics(performance.now() - startTime);
          return accountResult as T;

        default:
          // Fall back to generic implementation for unsupported models
          const transformedData = this.entityMapper.transformOutbound(
            params.model,
            params.data
          );
          const apiPath = this.entityMapper.getApiPath(params.model);
          const url = `${this.config.baseUrl}/${apiPath}`;

          const response = await this.httpClient.post<T>(url, transformedData, {
            headers: this.buildHeaders(),
            ...(this.config.timeout && { timeout: this.config.timeout }),
          });

          const normalizedResponse =
            this.responseNormalizer.normalizeSingleResponse(response);

          const finalResult = this.entityMapper.transformInbound(
            params.model,
            normalizedResponse
          );

          this.updateSuccessMetrics(performance.now() - startTime);
          return finalResult;
      }
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'create', params.model);
    }
  }

  async update<T>(params: UpdateParams): Promise<T> {
    const startTime = performance.now();

    // Helper to extract value from where clause (handles both object and array formats)
    const extractWhereValue = (
      where: any,
      field: string
    ): string | number | undefined => {
      if (!where) return undefined;
      // Direct object format: { id: '102' }
      if (where[field] !== undefined) return where[field];
      // Array format: [{ field: 'id', value: '102' }]
      if (Array.isArray(where)) {
        const found = where.find((w: any) => w.field === field);
        return found?.value;
      }
      return undefined;
    };

    // Debug logging

    try {
      this.updateModelMetrics(params.model);

      // Extract id and email from where clause
      const whereId = extractWhereValue(params.where, 'id');
      const whereEmail = extractWhereValue(params.where, 'email');

      // Route to specialized operations for supported models
      switch (params.model.toLowerCase()) {
        case 'user':
          // Handle user-specific updates (support both string and number IDs)
          if (
            whereId &&
            (typeof whereId === 'string' || typeof whereId === 'number')
          ) {
            const userResult = await this.userOperations.updateUser(
              String(whereId),
              params.update
            );
            this.updateSuccessMetrics(performance.now() - startTime);
            return userResult as T;
          } else if (whereEmail && typeof whereEmail === 'string') {
            const userResult = await this.userOperations.updateUserByEmail(
              whereEmail,
              params.update
            );
            this.updateSuccessMetrics(performance.now() - startTime);
            return userResult as T;
          } else {
            // Find user first, then update by ID
            const existing = await this.findOne<T>({
              model: params.model,
              where: params.where,
              ...(params.select && { select: params.select }),
            });

            if (!existing) {
              throw new AdapterError(
                AdapterErrorCode.NOT_FOUND,
                `No user found for update`,
                params.where,
                false,
                404
              );
            }

            const recordWithId = existing as any;
            // The API returns numeric ids; the operations require a string.
            const userResult = await this.userOperations.updateUser(
              String(recordWithId.id),
              params.update
            );
            this.updateSuccessMetrics(performance.now() - startTime);
            return userResult as T;
          }

        case 'session':
          // Handle session-specific updates (support both string and number IDs)
          if (
            params.where.id &&
            (typeof params.where.id === 'string' ||
              typeof params.where.id === 'number')
          ) {
            const sessionResult = await this.sessionOperations.updateSession(
              String(params.where.id),
              params.update
            );
            this.updateSuccessMetrics(performance.now() - startTime);
            return sessionResult as T;
          } else if (
            params.where.sessionToken &&
            typeof params.where.sessionToken === 'string'
          ) {
            const sessionResult =
              await this.sessionOperations.updateSessionByToken(
                params.where.sessionToken,
                params.update
              );
            this.updateSuccessMetrics(performance.now() - startTime);
            return sessionResult as T;
          } else {
            // Find session first, then update by ID
            const existing = await this.findOne<T>({
              model: params.model,
              where: params.where,
              ...(params.select && { select: params.select }),
            });

            if (!existing) {
              throw new AdapterError(
                AdapterErrorCode.NOT_FOUND,
                `No session found for update`,
                params.where,
                false,
                404
              );
            }

            const recordWithId = existing as any;
            // The API returns numeric ids; the operations require a string.
            const sessionResult = await this.sessionOperations.updateSession(
              String(recordWithId.id),
              params.update
            );
            this.updateSuccessMetrics(performance.now() - startTime);
            return sessionResult as T;
          }

        case 'verification': // BetterAuth uses 'verification' model name
        case 'verificationtoken':
          // VerificationTokens are typically not updated but consumed/deleted
          // For Better Auth compatibility, we allow updates but recommend using consume operations
          const updateWhereClause = this.parseWhereClause(params.where);
          const updateWhereToken = updateWhereClause?.token as
            | string
            | undefined;
          if (updateWhereToken && typeof updateWhereToken === 'string') {
            // Find the token first to get its current data
            const existingToken =
              await this.verificationTokenOperations.findVerificationTokenByToken(
                updateWhereToken
              );
            if (!existingToken) {
              throw new AdapterError(
                AdapterErrorCode.NOT_FOUND,
                `No verification token found for update`,
                params.where,
                false,
                404
              );
            }

            // Delete the old token and create a new one with updates
            await this.verificationTokenOperations.deleteVerificationToken(
              updateWhereToken
            );
            const updatedTokenData = {
              ...existingToken,
              ...params.update,
              expiresAt: params.update.expiresAt
                ? new Date(params.update.expiresAt)
                : existingToken.expiresAt,
            };
            const tokenResult =
              await this.verificationTokenOperations.createVerificationToken({
                identifier:
                  updatedTokenData.identifier || existingToken.identifier,
                token:
                  updatedTokenData.value ||
                  updatedTokenData.token ||
                  existingToken.value ||
                  existingToken.token ||
                  '',
                expiresAt: updatedTokenData.expiresAt,
              });
            this.updateSuccessMetrics(performance.now() - startTime);
            return tokenResult as T;
          } else {
            // Find token first using identifier
            const updateWhereIdentifier = updateWhereClause?.identifier as
              | string
              | undefined;
            const existingTokens =
              await this.verificationTokenOperations.findVerificationTokensByIdentifier(
                updateWhereIdentifier || '',
                { activeOnly: false, limit: 1 }
              );
            if (existingTokens.length === 0) {
              throw new AdapterError(
                AdapterErrorCode.NOT_FOUND,
                `No verification token found for update`,
                params.where,
                false,
                404
              );
            }

            const existingToken = existingTokens[0];
            await this.verificationTokenOperations.deleteVerificationToken(
              existingToken!.value || existingToken!.token || ''
            );
            const updatedTokenData = {
              ...existingToken,
              ...params.update,
              expiresAt: params.update.expiresAt
                ? new Date(params.update.expiresAt)
                : existingToken!.expiresAt,
            };
            const tokenResult =
              await this.verificationTokenOperations.createVerificationToken({
                identifier:
                  updatedTokenData.identifier || existingToken!.identifier,
                token:
                  updatedTokenData.value ||
                  updatedTokenData.token ||
                  existingToken!.value ||
                  existingToken!.token ||
                  '',
                expiresAt: updatedTokenData.expiresAt,
              });
            this.updateSuccessMetrics(performance.now() - startTime);
            return tokenResult as T;
          }

        case 'account':
          // Handle account-specific updates (support both string and number IDs, and array format where)
          const accountWhereId = extractWhereValue(params.where, 'id');

          if (
            accountWhereId &&
            (typeof accountWhereId === 'string' ||
              typeof accountWhereId === 'number')
          ) {
            const accountResult = await this.accountOperations.updateAccount(
              String(accountWhereId),
              params.update
            );
            this.updateSuccessMetrics(performance.now() - startTime);
            return accountResult as T;
          } else {
            // Find account first, then update by ID
            const existingAccount = await this.findOne<T>({
              model: params.model,
              where: params.where,
              ...(params.select && { select: params.select }),
            });

            if (!existingAccount) {
              throw new AdapterError(
                AdapterErrorCode.NOT_FOUND,
                `No account found for update`,
                params.where,
                false,
                404
              );
            }

            const accountWithId = existingAccount as any;
            const accountResult = await this.accountOperations.updateAccount(
              String(accountWithId.id),
              params.update
            );
            this.updateSuccessMetrics(performance.now() - startTime);
            return accountResult as T;
          }

        default:
          // Fall back to generic implementation for unsupported models
          const transformedData = this.entityMapper.transformOutbound(
            params.model,
            params.update
          );

          if (params.where.id && typeof params.where.id === 'string') {
            const apiPath = this.entityMapper.getApiPath(params.model);
            const url = `${this.config.baseUrl}/${apiPath}/${params.where.id}`;

            const response = await this.httpClient.patch<T>(
              url,
              transformedData,
              {
                headers: this.buildHeaders(),
                ...(this.config.timeout && { timeout: this.config.timeout }),
              }
            );

            const normalizedResponse =
              this.responseNormalizer.normalizeSingleResponse(response);
            const result = this.entityMapper.transformInbound(
              params.model,
              normalizedResponse
            );

            this.updateSuccessMetrics(performance.now() - startTime);
            return result;
          }

          // For query-based updates, find the record first
          const existing = await this.findOne<T>({
            model: params.model,
            where: params.where,
            ...(params.select && { select: params.select }),
          });

          if (!existing) {
            throw new AdapterError(
              AdapterErrorCode.NOT_FOUND,
              `No record found for update in model ${params.model}`,
              params.where,
              false,
              404
            );
          }

          const recordWithId = existing as any;
          // The API returns numeric ids; the branch above needs a string.
          return this.update({
            ...params,
            where: { id: String(recordWithId.id) },
          });
      }
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'update', params.model);
    }
  }

  async updateMany(params: UpdateManyParams): Promise<number> {
    const startTime = performance.now();

    try {
      this.updateModelMetrics(params.model);

      // BulkOperations matches rows against the where clause and refuses an
      // empty one, so it is passed through exactly as Better Auth sent it.
      const updateManyOptions = {
        model: params.model,
        where: params.where,
        update: params.update,
      } as any;

      if (this.config.batchConfig?.batchSize) {
        updateManyOptions.batchSize = this.config.batchConfig.batchSize;
      }

      if (this.config.batchConfig?.concurrency) {
        updateManyOptions.maxConcurrency = this.config.batchConfig.concurrency;
      }

      const result = await this.bulkOperations.updateMany(updateManyOptions);

      // Update adapter metrics
      this.updateSuccessMetrics(performance.now() - startTime);

      // Log bulk operation results
      if (
        this.config.logger &&
        (result.failures > 0 || result.errors.length > 0)
      ) {
        this.config.logger.warn('Bulk update completed with some failures', {
          model: params.model,
          success: result.success,
          failures: result.failures,
          errorCount: result.errors.length,
        });
      }

      return result.success;
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'updateMany', params.model);
    }
  }

  async delete<T>(params: DeleteParams): Promise<T> {
    const startTime = performance.now();

    try {
      this.updateModelMetrics(params.model);

      // Handle session deletion specially (since session ID is now a string token)
      if (params.model.toLowerCase() === 'session') {
        const sessionWhere = this.parseWhereClause(params.where);
        if (
          sessionWhere.id ||
          sessionWhere.token ||
          sessionWhere.sessionToken
        ) {
          const sessionToken =
            sessionWhere.id || sessionWhere.token || sessionWhere.sessionToken;
          // Use session operations to delete by token
          const deletedSession =
            await this.sessionOperations.deleteSessionByToken(sessionToken);
          this.updateSuccessMetrics(performance.now() - startTime);
          return deletedSession as T;
        } else {
          throw new AdapterError(
            AdapterErrorCode.VALIDATION_ERROR,
            'Session deletion requires id, token, or sessionToken',
            params.where,
            false,
            400
          );
        }
      }

      // Handle verification token deletion specially
      // BetterAuth uses 'verification' model name, not 'verificationtoken'
      const verificationModelLower = params.model.toLowerCase();
      if (
        verificationModelLower === 'verificationtoken' ||
        verificationModelLower === 'verification'
      ) {
        // Parse where clause to handle BetterAuth's array format
        const whereClause = this.parseWhereClause(params.where);

        // Check for 'id' field - BetterAuth uses this for deleteVerificationValue
        const whereId = whereClause?.id as string | undefined;
        if (whereId && typeof whereId === 'string') {
          // Delete by ID (this is how BetterAuth calls deleteVerificationValue)
          const deletedToken =
            await this.verificationTokenOperations.deleteVerificationTokenById(
              whereId
            );
          this.updateSuccessMetrics(performance.now() - startTime);
          return deletedToken as T;
        }

        // Check for 'token' field - legacy support
        const whereToken = whereClause?.token as string | undefined;
        if (whereToken && typeof whereToken === 'string') {
          // Direct token deletion
          const deletedToken =
            await this.verificationTokenOperations.deleteVerificationToken(
              whereToken
            );
          this.updateSuccessMetrics(performance.now() - startTime);
          return deletedToken as T;
        }

        // Check for 'identifier' field - BetterAuth uses this for deleteVerificationByIdentifier
        const whereIdentifier = whereClause?.identifier as string | undefined;
        if (whereIdentifier && typeof whereIdentifier === 'string') {
          // Find token by identifier and delete
          const tokens =
            await this.verificationTokenOperations.findVerificationTokensByIdentifier(
              whereIdentifier,
              { activeOnly: false, limit: 1 }
            );
          if (tokens.length === 0) {
            throw new AdapterError(
              AdapterErrorCode.NOT_FOUND,
              `No verification token found for deletion`,
              params.where,
              false,
              404
            );
          }
          if (tokens[0]) {
            // Delete by the record's primary id (DELETE /verifications/:id).
            // Passing tokens[0].value/token issued a DELETE with no id, which
            // failed with "No verification token found for deletion" and broke
            // the OAuth callback ("Failed to parse state" ->
            // internal_server_error -> back to login).
            const tokenId = (tokens[0] as any).id;
            const deletedToken = tokenId
              ? await this.verificationTokenOperations.deleteVerificationTokenById(
                  String(tokenId)
                )
              : await this.verificationTokenOperations.deleteVerificationToken(
                  tokens[0].value || tokens[0].token || ''
                );
            this.updateSuccessMetrics(performance.now() - startTime);
            return deletedToken as T;
          } else {
            throw new AdapterError(
              AdapterErrorCode.NOT_FOUND,
              `No verification token found for deletion`,
              params.where,
              false,
              404
            );
          }
        }

        throw new AdapterError(
          AdapterErrorCode.VALIDATION_ERROR,
          `VerificationToken deletion requires id, token, or identifier`,
          params.where,
          false,
          400
        );
      }

      // For other models, use the standard deletion flow
      // Find the record first to return it
      const existing = await this.findOne<T>({
        model: params.model,
        where: params.where,
        ...(params.select && { select: params.select }),
      });

      if (!existing) {
        throw new AdapterError(
          AdapterErrorCode.NOT_FOUND,
          `No record found for deletion in model ${params.model}`,
          params.where,
          false,
          404
        );
      }

      // Delete using ID
      const recordWithId = existing as any;
      const apiPath = this.entityMapper.getApiPath(params.model);
      const url = `${this.config.baseUrl}/${apiPath}/${recordWithId.id}`;

      await this.httpClient.delete(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      this.updateSuccessMetrics(performance.now() - startTime);
      return existing;
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'delete', params.model);
    }
  }

  async deleteMany(params: DeleteManyParams): Promise<number> {
    const startTime = performance.now();

    try {
      this.updateModelMetrics(params.model);

      // BulkOperations matches rows against the where clause and refuses an
      // empty one, so it is passed through exactly as Better Auth sent it.
      // Deleting users also deletes their sessions.
      const deleteManyOptions = {
        model: params.model,
        where: params.where,
        cascadeDelete: params.model.toLowerCase() === 'user',
      } as any;

      if (this.config.batchConfig?.batchSize) {
        deleteManyOptions.batchSize = this.config.batchConfig.batchSize;
      }

      if (this.config.batchConfig?.concurrency) {
        deleteManyOptions.maxConcurrency = this.config.batchConfig.concurrency;
      }

      const result = await this.bulkOperations.deleteMany(deleteManyOptions);

      // Update adapter metrics
      this.updateSuccessMetrics(performance.now() - startTime);

      // Log bulk operation results
      if (
        this.config.logger &&
        (result.failures > 0 || result.errors.length > 0)
      ) {
        this.config.logger.warn('Bulk delete completed with some failures', {
          model: params.model,
          success: result.success,
          failures: result.failures,
          errorCount: result.errors.length,
        });
      }

      return result.success;
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'deleteMany', params.model);
    }
  }

  async findOne<T>(params: FindOneParams): Promise<T | null> {
    const startTime = performance.now();

    // DEBUG: Log all findOne calls to understand what Better Auth is requesting

    try {
      // Track request
      this.updateModelMetrics(params.model);

      // Check if join is requested (Better Auth uses this for includeAccounts)
      const joinParam = (params as any).join;
      const includeAccounts = joinParam?.account === true;

      // Route to specialized operations for supported models
      switch (params.model.toLowerCase()) {
        case 'user':
          // Parse where clause using the new parser
          const userWhere = this.parseWhereClause(params.where);
          let userResult: any = null;

          if (userWhere.id) {
            // For UUID lookups, use findManyUsers with filtering since direct ID lookup expects numeric
            const users = await this.userOperations.findManyUsers({
              where: { id: userWhere.id },
              pagination: { limit: 1 },
            });
            userResult = users.length > 0 ? users[0] : null;
          } else if (userWhere.email) {
            userResult = await this.userOperations.findUserByEmail(
              userWhere.email
            );
          } else {
            // Any other filter: the first row matching the full where clause
            userResult = await this.findFirstMatching<any>(
              'user',
              params.where
            );
          }

          // If includeAccounts is requested and we found a user, fetch their accounts
          if (userResult && includeAccounts) {
            const accounts = await this.accountOperations.findManyAccounts({
              where: { userId: userResult.id },
            });
            // Add accounts to the user object (Better Auth expects 'account' key)
            userResult = {
              ...userResult,
              account: accounts,
            };
          }

          this.updateSuccessMetrics(performance.now() - startTime);
          return userResult as T;

        case 'session':
          // Parse where clause using the new parser
          const sessionWhere = this.parseWhereClause(params.where);

          let sessionResult = null;
          if (sessionWhere.id) {
            sessionResult = await this.sessionOperations.findSessionById(
              sessionWhere.id
            );
          } else if (sessionWhere.sessionToken) {
            sessionResult = await this.sessionOperations.findSessionByToken(
              sessionWhere.sessionToken
            );
          } else if (sessionWhere.token) {
            // Handle both sessionToken and token field names
            sessionResult = await this.sessionOperations.findSessionByToken(
              sessionWhere.token
            );
          } else {
            // Any other filter: the first row matching the full where clause
            sessionResult = await this.findFirstMatching<any>(
              'session',
              params.where
            );
          }

          // Handle join: { user: true } - BetterAuth needs user data with session
          if (sessionResult && params.join) {
            const joinConfig =
              typeof params.join === 'string'
                ? JSON.parse(params.join)
                : params.join;
            if (joinConfig?.user) {
              const userIdStr = String(sessionResult.userId);
              try {
                const user = await this.userOperations.findUserById(userIdStr);
                if (user) {
                  sessionResult = {
                    ...sessionResult,
                    user,
                  };
                }
              } catch {
                // Session is still valid without the joined user; fall through.
              }
            }
          }

          this.updateSuccessMetrics(performance.now() - startTime);
          return sessionResult as T;

        case 'account':
          // Parse where clause using the new parser
          const accountWhere = this.parseWhereClause(params.where);

          if (accountWhere.id) {
            // Find account by ID
            const accountResult = await this.accountOperations.findAccountById(
              accountWhere.id
            );
            this.updateSuccessMetrics(performance.now() - startTime);
            return accountResult as T;
          } else if (accountWhere.providerId && accountWhere.accountId) {
            // Find account by providerId + accountId (for OAuth account linking)

            const accounts = await this.accountOperations.findManyAccounts({
              where: accountWhere, // Pass the parsed where clause
              pagination: { limit: 1 },
            });

            this.updateSuccessMetrics(performance.now() - startTime);
            return accounts.length > 0 ? (accounts[0] as T) : null;
          } else {
            // Any other filter, including userId with further conditions:
            // the first row matching the full where clause. A lookup by
            // userId alone used to ignore every other condition.
            const accountResult = await this.findFirstMatching(
              'account',
              params.where
            );
            this.updateSuccessMetrics(performance.now() - startTime);
            return accountResult as T;
          }

        case 'verification': // BetterAuth uses 'verification' model name
        case 'verificationtoken':
          // Handle verification token-specific lookups
          // Helper to extract value from where clause (handles both object and array formats)
          const extractVerificationWhereValue = (
            where: any,
            field: string
          ): string | undefined => {
            if (!where) return undefined;
            // Direct object format: { identifier: 'xxx' }
            if (where[field] !== undefined) return where[field];
            // Array format: [{ field: 'identifier', value: 'xxx' }]
            if (Array.isArray(where)) {
              const found = where.find((w: any) => w.field === field);
              return found?.value;
            }
            return undefined;
          };

          const whereToken = extractVerificationWhereValue(
            params.where,
            'token'
          );
          const whereIdentifier = extractVerificationWhereValue(
            params.where,
            'identifier'
          );

          if (whereToken && typeof whereToken === 'string') {
            const tokenResult =
              await this.verificationTokenOperations.findVerificationTokenByToken(
                whereToken
              );
            this.updateSuccessMetrics(performance.now() - startTime);
            return tokenResult as T;
          } else if (whereIdentifier && typeof whereIdentifier === 'string') {
            const tokens =
              await this.verificationTokenOperations.findVerificationTokensByIdentifier(
                whereIdentifier,
                { activeOnly: true, limit: 1 }
              );
            this.updateSuccessMetrics(performance.now() - startTime);
            return tokens.length > 0 ? (tokens[0] as T) : null;
          } else {
            this.updateSuccessMetrics(performance.now() - startTime);
            return null;
          }

        default:
          // Parse where clause for generic handling
          const genericWhere = this.parseWhereClause(params.where);

          // Fall back to generic implementation for unsupported models
          const found =
            genericWhere.id && typeof genericWhere.id === 'string'
              ? await this.findById<T>(params.model, genericWhere.id)
              : // The first row matching the full where clause. This used to
                // return the first row of the table whatever the clause said.
                await this.findFirstMatching<T>(params.model, params.where);
          const [result = null] = found
            ? await this.withJoins([found], (params as any).join)
            : [];
          this.updateSuccessMetrics(performance.now() - startTime);
          return result as T | null;
      }
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'findOne', params.model);
    }
  }

  async findMany<T>(params: FindManyParams): Promise<T[]> {
    const startTime = performance.now();

    try {
      this.updateModelMetrics(params.model);

      // Same matcher as updateMany and deleteMany: every page of candidates,
      // the full where clause (all operators and connectors) applied in
      // memory. An absent where clause lists every row.
      let rows = await this.bulkOperations.findMatching(
        params.model,
        params.where
      );

      // Better Auth passes sortBy/limit/offset; orderBy/pagination are the
      // older names. Sort before paging so "latest row" lookups are right.
      const sortBy =
        params.sortBy ??
        Object.entries(params.orderBy ?? {}).map(([field, direction]) => ({
          field,
          direction,
        }))[0];
      if (sortBy) {
        const sign = sortBy.direction === 'desc' ? -1 : 1;
        const key = (row: any) => {
          const value = row[sortBy.field];
          return value instanceof Date ? value.getTime() : value;
        };
        rows = [...rows].sort((a, b) => {
          const x = key(a);
          const y = key(b);
          if (x === y) return 0;
          if (x === undefined || x === null) return 1;
          if (y === undefined || y === null) return -1;
          return (x < y ? -1 : 1) * sign;
        });
      }
      const limit = params.limit ?? params.pagination?.limit;
      const offset =
        params.offset ??
        params.pagination?.offset ??
        (limit && params.pagination?.page
          ? (params.pagination.page - 1) * limit
          : 0);
      if (offset || limit) {
        rows = rows.slice(offset, limit ? offset + limit : undefined);
      }
      rows = await this.withJoins(rows, (params as any).join);

      this.updateSuccessMetrics(performance.now() - startTime);
      return rows as T[];
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'findMany', params.model);
    }
  }

  async count(params: CountParams): Promise<number> {
    const startTime = performance.now();

    try {
      this.updateModelMetrics(params.model);
      const rows = await this.bulkOperations.findMatching(
        params.model,
        params.where
      );
      this.updateSuccessMetrics(performance.now() - startTime);
      return rows.length;
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'count', params.model);
    }
  }

  /**
   * Better Auth 1.6 reads single-use rows (password reset, magic link and
   * email verification tokens) through consumeOne: return the row and delete
   * it. Without it every reset failed with "consumeOne is not a function".
   *
   * Two consumers can both read the row, in this process or in another one.
   * The DELETE decides which of them consumed it: the service answers 404 to
   * a DELETE of a row that is already gone, and that caller gets null. This
   * needs a service whose DELETE answers 404 in that case: a generated
   * service on @apso/crud-typeorm later than 1.1.0 (apsoai/apso-packages#88).
   * An older service answers 200 to both, and both callers get the row, as
   * before.
   */
  async consumeOne<T>(params: DeleteParams): Promise<T | null> {
    // Better Auth consumes by id, and findOne has no id lookup for
    // verification rows (2.0.21 returned null, so every reset was "Invalid token").
    const { id } = this.parseWhereClause(params.where);
    const row = (
      id != null
        ? await this.findById(params.model, String(id))
        : await this.findOne(params)
    ) as
      | (T & {
          id?: string | number;
          expiresAt?: unknown;
          expires_at?: unknown;
        })
      | null;
    if (!row) return null;
    const expires = row.expiresAt ?? row.expires_at;
    if (expires != null) row.expiresAt = new Date(expires as string);
    if (row.id == null) {
      await this.delete({ model: params.model, where: params.where });
      return row;
    }
    const apiPath = this.entityMapper.getApiPath(params.model);
    try {
      await this.httpClient.delete(
        `${this.config.baseUrl}/${apiPath}/${row.id}`,
        {
          headers: this.buildHeaders(),
          ...(this.config.timeout && { timeout: this.config.timeout }),
        }
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw this.handleError(error, 'consumeOne', params.model);
    }
    return row;
  }

  /**
   * Better Auth 1.7 changes a row only if it still matches: refresh token
   * rotation sets `revoked` where it is still null. Returns the updated row,
   * or null when no row matched.
   *
   * Two callers can both read a matching row, in this process or in another
   * one. The PATCH carries the conditions, and the service decides: it
   * updates the row only while it still meets them and answers 404 otherwise,
   * and that caller gets null. A counter is updated where it still holds the
   * value that was read, and read again when it does not. This needs a
   * service that checks the condition and writes under one row lock
   * (@apso/crud-typeorm with apsoai/apso-packages#88). An older service
   * checks the condition at its read only.
   * ponytail: a condition guardQuery cannot send (lt, gt, a date, OR), and a
   * model with its own update path (user, session, account, verification),
   * is matched here and then updated by id, so two callers can both match.
   * Send those conditions too when a flow needs one of them decided.
   */
  async incrementOne<T>(params: {
    model: string;
    where: any;
    increment: Record<string, number>;
    set?: Record<string, unknown>;
  }): Promise<T | null> {
    const conditions = normalizeWhere(params.where);
    const increments = Object.entries(params.increment ?? {});
    const ownUpdatePath = [
      'user',
      'session',
      'account',
      'verification',
      'verificationtoken',
    ].includes(params.model.toLowerCase());

    for (let attempt = 0; attempt < 5; attempt++) {
      // The whole where clause decides, not the id alone: findOne looks a
      // row up by id and ignores the other conditions.
      const row = await this.findFirstMatching<Record<string, any>>(
        params.model,
        params.where
      );
      if (!row) return null;
      const update: Record<string, unknown> = { ...params.set };
      for (const [field, by] of increments) {
        update[field] = (Number(row[field]) || 0) + by;
      }
      if (Object.keys(update).length === 0) return row as T;

      const guard = ownUpdatePath
        ? undefined
        : guardQuery(this.config, [
            ...conditions.filter(condition => condition.field !== 'id'),
            ...increments.map(([field]) => ({
              field,
              operator: 'eq' as const,
              value: row[field] ?? null,
              connector: 'AND' as const,
              insensitive: false,
            })),
          ]);
      if (guard === undefined) {
        return this.update<T>({
          model: params.model,
          where: { id: String(row.id) },
          update,
        });
      }

      const apiPath = this.entityMapper.getApiPath(params.model);
      try {
        const response = await this.httpClient.patch<T>(
          `${this.config.baseUrl}/${apiPath}/${row.id}${guard && `?${guard}`}`,
          this.entityMapper.transformOutbound(params.model, update),
          {
            headers: this.buildHeaders(),
            ...(this.config.timeout && { timeout: this.config.timeout }),
          }
        );
        return this.entityMapper.transformInbound(
          params.model,
          this.responseNormalizer.normalizeSingleResponse(response)
        );
      } catch (error) {
        if (!isNotFound(error)) {
          throw this.handleError(error, 'incrementOne', params.model);
        }
        // The row stopped matching between the read and the update. Without
        // a counter that is final. With one, another caller may only have
        // moved the counter: read again.
        if (increments.length === 0) return null;
      }
    }
    throw new AdapterError(
      AdapterErrorCode.API_ERROR,
      `incrementOne: ${params.model} kept changing between the read and the update`,
      { model: params.model },
      true
    );
  }

  /**
   * Attach the row Better Auth asked to join when this row holds its id:
   * `join: { user: true }` on a member reads the user named by member.userId.
   * The organization plugin reads a member with its user this way and treats
   * the member as missing when the user is absent.
   * ponytail: one request per row, and only a join found through
   * `<model>Id` on the row. A join in the other direction (an organization
   * with its members) is left out, as it was before. Add it when a flow
   * needs it.
   */
  private async withJoins<T>(
    rows: T[],
    join?: Record<string, unknown>
  ): Promise<T[]> {
    const wanted = Object.keys(join ?? {}).filter(other => join?.[other]);
    if (wanted.length === 0) return rows;
    return Promise.all(
      rows.map(async (row: any) => {
        const joined: Record<string, unknown> = {};
        for (const other of wanted) {
          const id = row[`${other}Id`];
          if (id === undefined) continue;
          joined[other] =
            id === null
              ? null
              : await this.findOne({
                  model: other,
                  where: [{ field: 'id', value: String(id) }] as any,
                });
        }
        return { ...row, ...joined };
      })
    );
  }

  async transaction<R>(
    callback: (trx: TransactionAdapter) => Promise<R>
  ): Promise<R> {
    // The Apso REST API has no transaction endpoint, so operations inside the
    // callback run sequentially against this adapter and are not rolled back
    // if a later one fails. This matches Better Auth's documented behavior for
    // adapters without transaction support.
    return callback(this);
  }

  // =============================================================================
  // Extended Adapter Methods
  // =============================================================================

  async createMany<T>(params: CreateManyParams): Promise<T[]> {
    const startTime = performance.now();

    try {
      this.updateModelMetrics(params.model);

      if (!params.data || params.data.length === 0) {
        this.updateSuccessMetrics(performance.now() - startTime);
        return [];
      }

      // Convert model name to EntityType enum
      const entityType = this.getEntityType(params.model);

      // Use BulkOperations for efficient batch processing
      const createManyOptions = {
        model: entityType,
        data: params.data,
        skipDuplicates: true, // Skip duplicates by default for safety
        validateBeforeInsert: true, // Validate data by default
      } as any;

      if (this.config.batchConfig?.batchSize) {
        createManyOptions.batchSize = this.config.batchConfig.batchSize;
      }

      if (this.config.batchConfig?.concurrency) {
        createManyOptions.maxConcurrency = this.config.batchConfig.concurrency;
      }

      const result = await this.bulkOperations.createMany(createManyOptions);

      // Update adapter metrics
      this.updateSuccessMetrics(performance.now() - startTime);

      // Log bulk operation results
      if (
        this.config.logger &&
        (result.failures > 0 || result.errors.length > 0)
      ) {
        this.config.logger.warn('Bulk create completed with some failures', {
          model: params.model,
          success: result.success,
          failures: result.failures,
          errorCount: result.errors.length,
        });
      }

      return result.results || [];
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'createMany', params.model);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await ConfigValidator.validateHealthCheck(this.config);
      return result.healthy;
    } catch (error) {
      // Log error if logger is available
      if (this.config.logger) {
        this.config.logger.error('Health check failed', { error });
      }
      return false;
    }
  }

  getMetrics(): AdapterMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = this.initializeMetrics();

    if (this.config.logger) {
      this.config.logger.info('Adapter metrics reset');
    }
  }

  clearCache(): void {
    // TODO: Implement cache clearing when cache is added
    if (this.config.logger) {
      this.config.logger.info('Cache cleared');
    }
  }

  setTenantContext(tenantId: string): void {
    this.tenantContext = tenantId;

    if (this.config.logger) {
      this.config.logger.debug('Tenant context set', { tenantId });
    }
  }

  getTenantContext(): string | null {
    return this.tenantContext;
  }

  async close(): Promise<void> {
    try {
      // Close HTTP client connections if supported
      if (
        'close' in this.httpClient &&
        typeof this.httpClient.close === 'function'
      ) {
        await this.httpClient.close();
      }

      // Clear any remaining caches
      this.clearCache();

      if (this.config.logger) {
        this.config.logger.info('ApsoAdapter closed successfully');
      }
    } catch (error) {
      if (this.config.logger) {
        this.config.logger.error('Error during adapter close', { error });
      }
      throw error;
    }
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Parse Better Auth where clause array format to our API format
   */
  private parseWhereClause(where: any): Record<string, any> {
    if (Array.isArray(where)) {
      const result: Record<string, any> = {};
      for (const condition of where) {
        const { field, value, operator = 'eq' } = condition;

        switch (operator) {
          case 'eq':
            result[field] = value;
            break;
          case 'ne':
            result[field] = { $ne: value };
            break;
          case 'lt':
            result[field] = { $lt: value };
            break;
          case 'lte':
            result[field] = { $lte: value };
            break;
          case 'gt':
            result[field] = { $gt: value };
            break;
          case 'gte':
            result[field] = { $gte: value };
            break;
          case 'in':
            result[field] = { $in: value };
            break;
          case 'contains':
            result[field] = { $contains: value };
            break;
          default:
            result[field] = value;
        }
      }
      return result;
    }

    // If not array, assume it's already in correct format
    return where as Record<string, any>;
  }

  /**
   * First row of a model that matches the full where clause, or null.
   */
  private async findFirstMatching<T>(
    model: string,
    where: unknown
  ): Promise<T | null> {
    const rows = await this.bulkOperations.findMatching(model, where);
    return (rows[0] as T) ?? null;
  }

  /**
   * Find a record by its ID using direct API call
   */
  private async findById<T>(model: string, id: string): Promise<T | null> {
    try {
      const apiPath = this.entityMapper.getApiPath(model);
      const url = `${this.config.baseUrl}/${apiPath}/${id}`;

      const response = await this.httpClient.get<T>(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      const normalizedResponse =
        this.responseNormalizer.normalizeSingleResponse(response);
      return this.entityMapper.transformInbound(model, normalizedResponse);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /**
   * Build HTTP headers including authentication and tenant context
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Add API key if configured
    Object.assign(headers, buildAuthHeaders(this.config));

    // Add tenant context if available
    if (this.tenantContext && this.config.multiTenancy?.enabled) {
      headers['X-Tenant-ID'] = this.tenantContext;
    }

    return headers;
  }

  /**
   * Update metrics for model requests
   */
  private updateModelMetrics(model: string): void {
    this.metrics.totalRequests++;
    const current = this.metrics.requestsByModel.get(model) || 0;
    this.metrics.requestsByModel.set(model, current + 1);
  }

  /**
   * Update metrics for successful requests
   */
  private updateSuccessMetrics(duration: number): void {
    this.metrics.successfulRequests++;
    // TODO: Update latency percentiles when we add proper tracking
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (this.metrics.successfulRequests - 1) +
        duration) /
      this.metrics.successfulRequests;
  }

  /**
   * Update metrics for failed requests
   */
  private updateErrorMetrics(error: any, _duration: number): void {
    this.metrics.failedRequests++;

    // Track error by type
    const errorCode = this.getErrorCode(error);
    const current = this.metrics.errorsByType.get(errorCode) || 0;
    this.metrics.errorsByType.set(errorCode, current + 1);
  }

  /**
   * Handle and normalize errors
   */
  private handleError(
    error: any,
    operation: string,
    model: string
  ): AdapterError {
    // If it's already an AdapterError with a specific message, preserve it
    if (error instanceof AdapterError) {
      if (this.config.logger) {
        this.config.logger.error(
          `${operation} operation failed for model ${model}`,
          { error, operation, model }
        );
      }
      return error;
    }

    const errorCode = this.getErrorCode(error);
    const message = `${operation} operation failed for model ${model}`;

    if (this.config.logger) {
      this.config.logger.error(message, { error, operation, model });
    }

    return new AdapterError(
      errorCode,
      message,
      error,
      this.isRetryableError(error),
      this.getStatusCode(error)
    );
  }

  /**
   * Get adapter error code from raw error
   */
  private getErrorCode(error: any): AdapterErrorCode {
    if (error && typeof error === 'object') {
      if ('statusCode' in error) {
        switch (error.statusCode) {
          case 400:
            return AdapterErrorCode.VALIDATION_ERROR;
          case 401:
            return AdapterErrorCode.UNAUTHORIZED;
          case 403:
            return AdapterErrorCode.FORBIDDEN;
          case 404:
            return AdapterErrorCode.NOT_FOUND;
          case 409:
            return AdapterErrorCode.CONFLICT;
          case 429:
            return AdapterErrorCode.RATE_LIMIT;
          case 500:
          case 502:
          case 503:
          case 504:
            return AdapterErrorCode.SERVER_ERROR;
        }
      }

      if ('code' in error) {
        switch (error.code) {
          case 'ECONNREFUSED':
          case 'ENOTFOUND':
          case 'ECONNRESET':
            return AdapterErrorCode.NETWORK_ERROR;
          case 'ETIMEDOUT':
            return AdapterErrorCode.TIMEOUT;
        }
      }
    }

    return AdapterErrorCode.UNKNOWN;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const statusCode = this.getStatusCode(error);
    if (statusCode) {
      return (
        this.config.retryConfig?.retryableStatuses?.includes(statusCode) ??
        false
      );
    }
    return false;
  }

  /**
   * Extract status code from error
   */
  private getStatusCode(error: any): number | undefined {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      return error.statusCode;
    }
    return undefined;
  }

  /**
   * Convert model name string to EntityType enum
   * Provides safe conversion with fallback for unknown models
   */
  private getEntityType(model: string): EntityType {
    const normalizedModel = model.toLowerCase();

    switch (normalizedModel) {
      case 'user':
        return EntityType.USER;
      case 'session':
        return EntityType.SESSION;
      case 'verification': // BetterAuth uses 'verification' model name
      case 'verificationtoken':
        return EntityType.VERIFICATION_TOKEN;
      case 'account':
        return EntityType.ACCOUNT;
      default:
        // For unknown models, default to USER type
        // This ensures the BulkOperations can still function
        this.config.logger?.warn('Unknown model type, defaulting to USER', {
          originalModel: model,
          normalizedModel,
        });
        return EntityType.USER;
    }
  }
}
