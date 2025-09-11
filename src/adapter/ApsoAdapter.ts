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
} from '../types';
import { 
  AdapterError, 
  AdapterErrorCode 
} from '../types';
import { ConfigValidator } from '../utils/ConfigValidator.js';
import { HttpClient } from '../client/HttpClient';
import { QueryTranslator } from '../query/QueryTranslator';
import { ResponseNormalizer } from '../response/ResponseNormalizer';
import { EntityMapper } from '../response/EntityMapper';
import { UserOperations } from '../operations/UserOperations';
import { SessionOperations } from '../operations/SessionOperations';
import { VerificationTokenOperations } from '../operations/VerificationTokenOperations';

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
      config: this.config
    };
    
    this.userOperations = new UserOperations(operationsDependencies);
    this.sessionOperations = new SessionOperations(operationsDependencies);
    this.verificationTokenOperations = new VerificationTokenOperations(operationsDependencies);
    
    // Initialize metrics
    this.metrics = this.initializeMetrics();
    
    if (this.config.logger) {
      this.config.logger.info('ApsoAdapter initialized', {
        baseUrl: this.config.baseUrl,
        components: Object.keys(components),
        operations: ['UserOperations', 'SessionOperations', 'VerificationTokenOperations']
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
          if (!params.data.sessionToken || !params.data.userId || !params.data.expiresAt) {
            throw new AdapterError(
              AdapterErrorCode.VALIDATION_ERROR,
              'Session creation requires sessionToken, userId, and expiresAt',
              params.data,
              false,
              400
            );
          }
          const sessionResult = await this.sessionOperations.createSession({
            sessionToken: params.data.sessionToken,
            userId: params.data.userId,
            expiresAt: new Date(params.data.expiresAt)
          });
          this.updateSuccessMetrics(performance.now() - startTime);
          return sessionResult as T;
          
        case 'verificationtoken':
          // Validate verification token data format
          if (!params.data.identifier || !params.data.token || !params.data.expiresAt) {
            throw new AdapterError(
              AdapterErrorCode.VALIDATION_ERROR,
              'VerificationToken creation requires identifier, token, and expiresAt',
              params.data,
              false,
              400
            );
          }
          const tokenResult = await this.verificationTokenOperations.createVerificationToken({
            identifier: params.data.identifier,
            token: params.data.token,
            expiresAt: new Date(params.data.expiresAt)
          });
          this.updateSuccessMetrics(performance.now() - startTime);
          return tokenResult as T;
          
        default:
          // Fall back to generic implementation for unsupported models
          const transformedData = this.entityMapper.transformOutbound(params.model, params.data);
          const apiPath = this.entityMapper.getApiPath(params.model);
          const url = `${this.config.baseUrl}/${apiPath}`;
          
          const response = await this.httpClient.post<T>(url, transformedData, {
            headers: this.buildHeaders(),
            ...(this.config.timeout && { timeout: this.config.timeout }),
          });
          
          const normalizedResponse = this.responseNormalizer.normalizeSingleResponse(response);
          const finalResult = this.entityMapper.transformInbound(params.model, normalizedResponse);
          
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
    
    try {
      this.updateModelMetrics(params.model);
      
      // Route to specialized operations for supported models
      switch (params.model.toLowerCase()) {
        case 'user':
          // Handle user-specific updates
          if (params.where.id && typeof params.where.id === 'string') {
            const userResult = await this.userOperations.updateUser(params.where.id, params.update);
            this.updateSuccessMetrics(performance.now() - startTime);
            return userResult as T;
          } else if (params.where.email && typeof params.where.email === 'string') {
            const userResult = await this.userOperations.updateUserByEmail(params.where.email, params.update);
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
            const userResult = await this.userOperations.updateUser(recordWithId.id, params.update);
            this.updateSuccessMetrics(performance.now() - startTime);
            return userResult as T;
          }
          
        case 'session':
          // Handle session-specific updates
          if (params.where.id && typeof params.where.id === 'string') {
            const sessionResult = await this.sessionOperations.updateSession(params.where.id, params.update);
            this.updateSuccessMetrics(performance.now() - startTime);
            return sessionResult as T;
          } else if (params.where.sessionToken && typeof params.where.sessionToken === 'string') {
            const sessionResult = await this.sessionOperations.updateSessionByToken(params.where.sessionToken, params.update);
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
            const sessionResult = await this.sessionOperations.updateSession(recordWithId.id, params.update);
            this.updateSuccessMetrics(performance.now() - startTime);
            return sessionResult as T;
          }
          
        case 'verificationtoken':
          // VerificationTokens are typically not updated but consumed/deleted
          // For Better Auth compatibility, we allow updates but recommend using consume operations
          if (params.where.token && typeof params.where.token === 'string') {
            // Find the token first to get its current data
            const existingToken = await this.verificationTokenOperations.findVerificationTokenByToken(params.where.token);
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
            await this.verificationTokenOperations.deleteVerificationToken(params.where.token);
            const updatedTokenData = {
              ...existingToken,
              ...params.update,
              expiresAt: params.update.expiresAt ? new Date(params.update.expiresAt) : existingToken.expiresAt
            };
            const tokenResult = await this.verificationTokenOperations.createVerificationToken({
              identifier: updatedTokenData.identifier || existingToken!.identifier,
              token: updatedTokenData.token || existingToken!.token,
              expiresAt: updatedTokenData.expiresAt
            });
            this.updateSuccessMetrics(performance.now() - startTime);
            return tokenResult as T;
          } else {
            // Find token first using other criteria
            const existingTokens = await this.verificationTokenOperations.findVerificationTokensByIdentifier(
              params.where.identifier || '', { activeOnly: false, limit: 1 }
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
            await this.verificationTokenOperations.deleteVerificationToken(existingToken!.token);
            const updatedTokenData = {
              ...existingToken,
              ...params.update,
              expiresAt: params.update.expiresAt ? new Date(params.update.expiresAt) : existingToken!.expiresAt
            };
            const tokenResult = await this.verificationTokenOperations.createVerificationToken({
              identifier: updatedTokenData.identifier || existingToken!.identifier,
              token: updatedTokenData.token || existingToken!.token,
              expiresAt: updatedTokenData.expiresAt
            });
            this.updateSuccessMetrics(performance.now() - startTime);
            return tokenResult as T;
          }
          
        default:
          // Fall back to generic implementation for unsupported models
          const transformedData = this.entityMapper.transformOutbound(params.model, params.update);
          
          if (params.where.id && typeof params.where.id === 'string') {
            const apiPath = this.entityMapper.getApiPath(params.model);
            const url = `${this.config.baseUrl}/${apiPath}/${params.where.id}`;
            
            const response = await this.httpClient.patch<T>(url, transformedData, {
              headers: this.buildHeaders(),
              ...(this.config.timeout && { timeout: this.config.timeout }),
            });
            
            const normalizedResponse = this.responseNormalizer.normalizeSingleResponse(response);
            const result = this.entityMapper.transformInbound(params.model, normalizedResponse);
            
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
          return this.update({
            ...params,
            where: { id: recordWithId.id },
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
      
      // Find all matching records first
      const existingRecords = await this.findMany({
        model: params.model,
        ...(params.where && { where: params.where }),
      });
      
      if (existingRecords.length === 0) {
        this.updateSuccessMetrics(performance.now() - startTime);
        return 0;
      }
      
      // Update each record individually
      let updatedCount = 0;
      for (const record of existingRecords) {
        try {
          const recordWithId = record as any;
          await this.update({
            model: params.model,
            where: { id: recordWithId.id },
            update: params.update,
          });
          updatedCount++;
        } catch (error) {
          // Log individual errors but continue
          if (this.config.logger) {
            this.config.logger.warn('Failed to update individual record', { error, record });
          }
        }
      }
      
      this.updateSuccessMetrics(performance.now() - startTime);
      return updatedCount;
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'updateMany', params.model);
    }
  }

  async delete<T>(params: DeleteParams): Promise<T> {
    const startTime = performance.now();
    
    try {
      this.updateModelMetrics(params.model);
      
      // Handle verification token deletion specially
      if (params.model.toLowerCase() === 'verificationtoken') {
        if (params.where.token && typeof params.where.token === 'string') {
          // Direct token deletion
          const deletedToken = await this.verificationTokenOperations.deleteVerificationToken(params.where.token);
          this.updateSuccessMetrics(performance.now() - startTime);
          return deletedToken as T;
        } else if (params.where.identifier && typeof params.where.identifier === 'string') {
          // Find token by identifier and delete
          const tokens = await this.verificationTokenOperations.findVerificationTokensByIdentifier(
            params.where.identifier, 
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
            const deletedToken = await this.verificationTokenOperations.deleteVerificationToken(tokens[0].token);
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
        } else {
          throw new AdapterError(
            AdapterErrorCode.VALIDATION_ERROR,
            `VerificationToken deletion requires token or identifier`,
            params.where,
            false,
            400
          );
        }
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
      
      // Find all matching records
      const existingRecords = await this.findMany({
        model: params.model,
        ...(params.where && { where: params.where }),
      });
      
      if (existingRecords.length === 0) {
        this.updateSuccessMetrics(performance.now() - startTime);
        return 0;
      }
      
      // Delete each record individually
      let deletedCount = 0;
      for (const record of existingRecords) {
        try {
          const recordWithId = record as any;
          await this.delete({
            model: params.model,
            where: { id: recordWithId.id },
          });
          deletedCount++;
        } catch (error) {
          // Log individual errors but continue
          if (this.config.logger) {
            this.config.logger.warn('Failed to delete individual record', { error, record });
          }
        }
      }
      
      this.updateSuccessMetrics(performance.now() - startTime);
      return deletedCount;
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'deleteMany', params.model);
    }
  }

  async findOne<T>(params: FindOneParams): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      // Track request
      this.updateModelMetrics(params.model);
      
      // Route to specialized operations for supported models
      switch (params.model.toLowerCase()) {
        case 'user':
          // Handle user-specific lookups
          if (params.where.id && typeof params.where.id === 'string') {
            const userResult = await this.userOperations.findUserById(params.where.id);
            this.updateSuccessMetrics(performance.now() - startTime);
            return userResult as T;
          } else if (params.where.email && typeof params.where.email === 'string') {
            const userResult = await this.userOperations.findUserByEmail(params.where.email);
            this.updateSuccessMetrics(performance.now() - startTime);
            return userResult as T;
          } else {
            // For other user filters, use findManyUsers with limit 1
            const users = await this.userOperations.findManyUsers({
              where: params.where,
              pagination: { limit: 1 }
            });
            this.updateSuccessMetrics(performance.now() - startTime);
            return users.length > 0 ? users[0] as T : null;
          }
          
        case 'session':
          // Handle session-specific lookups
          if (params.where.id && typeof params.where.id === 'string') {
            const sessionResult = await this.sessionOperations.findSessionById(params.where.id);
            this.updateSuccessMetrics(performance.now() - startTime);
            return sessionResult as T;
          } else if (params.where.sessionToken && typeof params.where.sessionToken === 'string') {
            const sessionResult = await this.sessionOperations.findSessionByToken(params.where.sessionToken);
            this.updateSuccessMetrics(performance.now() - startTime);
            return sessionResult as T;
          } else {
            // For other session filters, use findManySessions with limit 1
            const sessions = await this.sessionOperations.findManySessions({
              where: params.where,
              pagination: { limit: 1 }
            });
            this.updateSuccessMetrics(performance.now() - startTime);
            return sessions.length > 0 ? sessions[0] as T : null;
          }
          
        case 'verificationtoken':
          // Handle verification token-specific lookups
          if (params.where.token && typeof params.where.token === 'string') {
            const tokenResult = await this.verificationTokenOperations.findVerificationTokenByToken(params.where.token);
            this.updateSuccessMetrics(performance.now() - startTime);
            return tokenResult as T;
          } else if (params.where.identifier && typeof params.where.identifier === 'string') {
            const tokens = await this.verificationTokenOperations.findVerificationTokensByIdentifier(
              params.where.identifier, 
              { activeOnly: true, limit: 1 }
            );
            this.updateSuccessMetrics(performance.now() - startTime);
            return tokens.length > 0 ? tokens[0] as T : null;
          } else {
            // For other token filters, find by identifier or return null
            const identifier = params.where.identifier;
            if (identifier) {
              const tokens = await this.verificationTokenOperations.findVerificationTokensByIdentifier(
                identifier, 
                { activeOnly: true, limit: 1 }
              );
              this.updateSuccessMetrics(performance.now() - startTime);
              return tokens.length > 0 ? tokens[0] as T : null;
            }
            this.updateSuccessMetrics(performance.now() - startTime);
            return null;
          }
          
        default:
          // Fall back to generic implementation for unsupported models
          if (params.where.id && typeof params.where.id === 'string') {
            return this.findById<T>(params.model, params.where.id);
          }
          
          this.queryTranslator.buildFindQuery(params.where, { limit: 1 });
          const apiPath = this.entityMapper.getApiPath(params.model);
          const url = `${this.config.baseUrl}/${apiPath}`;
          
          const response = await this.httpClient.get<T[]>(url, {
            headers: this.buildHeaders(),
            ...(this.config.timeout && { timeout: this.config.timeout }),
          });
          
          const normalizedResults = this.responseNormalizer.normalizeArrayResponse(response);
          
          if (!normalizedResults || normalizedResults.length === 0) {
            this.updateSuccessMetrics(performance.now() - startTime);
            return null;
          }
          
          const result = this.entityMapper.transformInbound(params.model, normalizedResults[0]);
          this.updateSuccessMetrics(performance.now() - startTime);
          return result;
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
      
      // Build query parameters (for potential future use with query string)
      this.queryTranslator.buildFindQuery(
        params.where || {},
        params.pagination,
        params.orderBy
      );
      
      // Get API path
      const apiPath = this.entityMapper.getApiPath(params.model);
      const url = `${this.config.baseUrl}/${apiPath}`;
      
      // Execute request
      const response = await this.httpClient.get<T[]>(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
        // TODO: Add query params to URL
      });
      
      // Normalize response (handle both array and paginated responses)
      const normalizedResults = this.responseNormalizer.normalizeArrayResponse(response);
      
      // Transform each result
      const transformedResults = normalizedResults.map(item => 
        this.entityMapper.transformInbound(params.model, item)
      );
      
      this.updateSuccessMetrics(performance.now() - startTime);
      return transformedResults;
    } catch (error) {
      this.updateErrorMetrics(error, performance.now() - startTime);
      throw this.handleError(error, 'findMany', params.model);
    }
  }

  async count(params: CountParams): Promise<number> {
    const startTime = performance.now();
    
    try {
      this.updateModelMetrics(params.model);
      
      // Build query parameters (for potential future use with query string)
      this.queryTranslator.buildFindQuery(
        params.where || {},
        { limit: 1 } // We only need count, not the data
      );
      
      // Get API path
      const apiPath = this.entityMapper.getApiPath(params.model);
      const url = `${this.config.baseUrl}/${apiPath}`;
      
      // Execute request
      const response = await this.httpClient.get(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
        // TODO: Add query params to URL
      });
      
      // Try to get count from response metadata
      const normalizedResponse = this.responseNormalizer.normalizeCountResponse(response);
      
      this.updateSuccessMetrics(performance.now() - startTime);
      return normalizedResponse;
    } catch (error) {
      // Fallback: get all records and count them
      try {
        const allRecords = await this.findMany({
          model: params.model,
          ...(params.where && { where: params.where }),
        });
        
        this.updateSuccessMetrics(performance.now() - startTime);
        return allRecords.length;
      } catch (fallbackError) {
        this.updateErrorMetrics(error, performance.now() - startTime);
        throw this.handleError(error, 'count', params.model);
      }
    }
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
      
      // Create records individually using the appropriate operation handler
      const results: T[] = [];
      for (const item of params.data) {
        try {
          const created = await this.create<T>({
            model: params.model,
            data: item,
            ...(params.select && { select: params.select }),
          });
          results.push(created);
        } catch (error) {
          // Log individual errors but continue
          if (this.config.logger) {
            this.config.logger.warn('Failed to create individual record', { error, item });
          }
        }
      }
      
      this.updateSuccessMetrics(performance.now() - startTime);
      return results;
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
      if ('close' in this.httpClient && typeof this.httpClient.close === 'function') {
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
      
      const normalizedResponse = this.responseNormalizer.normalizeSingleResponse(response);
      return this.entityMapper.transformInbound(model, normalizedResponse);
    } catch (error) {
      // If it's a 404, return null instead of throwing
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Build HTTP headers including authentication and tenant context
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add API key if configured
    if (this.config.apiKey) {
      const authHeader = this.config.authHeader || 'Authorization';
      headers[authHeader] = `Bearer ${this.config.apiKey}`;
    }

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
      (this.metrics.averageLatency * (this.metrics.successfulRequests - 1) + duration) / 
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
  private handleError(error: any, operation: string, model: string): AdapterError {
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
          case 400: return AdapterErrorCode.VALIDATION_ERROR;
          case 401: return AdapterErrorCode.UNAUTHORIZED;
          case 403: return AdapterErrorCode.FORBIDDEN;
          case 404: return AdapterErrorCode.NOT_FOUND;
          case 409: return AdapterErrorCode.CONFLICT;
          case 429: return AdapterErrorCode.RATE_LIMIT;
          case 500:
          case 502:
          case 503:
          case 504: return AdapterErrorCode.SERVER_ERROR;
        }
      }
      
      if ('code' in error) {
        switch (error.code) {
          case 'ECONNREFUSED':
          case 'ENOTFOUND':
          case 'ECONNRESET': return AdapterErrorCode.NETWORK_ERROR;
          case 'ETIMEDOUT': return AdapterErrorCode.TIMEOUT;
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
      return this.config.retryConfig?.retryableStatuses?.includes(statusCode) ?? false;
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
}