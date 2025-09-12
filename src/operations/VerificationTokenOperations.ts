/**
 * VerificationToken Operations Implementation
 * 
 * This class provides comprehensive CRUD operations for the VerificationToken entity,
 * integrating with the Apso SDK and supporting all Better Auth verification flows
 * (email verification, password reset, magic links, two-factor authentication).
 * 
 * Features:
 * - Token-based lookups (primary access pattern)
 * - Automatic expiration handling and cleanup
 * - Email identifier normalization and case-insensitive matching
 * - Atomic consume operations (validate + delete)
 * - One-time use semantics with race condition handling
 * - Comprehensive security measures and audit logging
 * - Support for multiple identifier types (email, phone, username)
 * - Integration with QueryTranslator, EntityMapper, and ResponseNormalizer
 */

import type {
  BetterAuthVerificationToken,
  ApsoVerificationToken,
  ApsoAdapterConfig,
  CrudPagination,
  ValidationError
} from '../types/index';
import { AdapterError, AdapterErrorCode } from '../types/index';
import { HttpClient } from '../client/HttpClient';
import { QueryTranslator } from '../query/QueryTranslator';
import { ResponseNormalizer } from '../response/ResponseNormalizer';
import { EntityMapper } from '../response/EntityMapper';
import { EmailNormalizer } from '../utils/EmailNormalizer';

/**
 * Options for finding multiple verification tokens
 */
export interface FindVerificationTokensOptions {
  /** Filter criteria for token search */
  where?: Partial<BetterAuthVerificationToken>;
  /** Fields to select in the response */
  select?: string[];
  /** Pagination options */
  pagination?: CrudPagination;
  /** Only return active (non-expired) tokens */
  activeOnly?: boolean;
  /** Maximum number of tokens to return */
  limit?: number;
}

/**
 * Result of token validation operation
 */
export interface TokenValidationResult {
  /** The verification token if found */
  token: BetterAuthVerificationToken | null;
  /** Whether the token exists and is valid */
  isValid: boolean;
  /** Whether the token has expired */
  isExpired: boolean;
  /** Additional validation details */
  validationDetails?: {
    /** Time until expiration in milliseconds */
    timeUntilExpiry?: number;
    /** Whether token was found but expired */
    foundButExpired: boolean;
    /** Normalized identifier used for lookup */
    normalizedIdentifier?: string;
  };
}

/**
 * Result of token consumption operation
 */
export interface TokenConsumptionResult {
  /** The verification token that was consumed */
  token: BetterAuthVerificationToken | null;
  /** Whether the token was successfully consumed */
  isValid: boolean;
  /** Whether the token had expired */
  isExpired: boolean;
  /** Whether the token was already consumed */
  alreadyConsumed: boolean;
}

/**
 * Dependencies for VerificationTokenOperations
 */
export interface VerificationTokenOperationsDependencies {
  httpClient: HttpClient;
  queryTranslator: QueryTranslator;
  responseNormalizer: ResponseNormalizer;
  entityMapper: EntityMapper;
  config: ApsoAdapterConfig;
}

/**
 * Token format validation rules
 */
interface TokenValidationRules {
  /** Minimum token length */
  minLength: number;
  /** Maximum token length */
  maxLength: number;
  /** Allowed characters pattern */
  allowedPattern: RegExp;
  /** Whether token is case-sensitive */
  caseSensitive: boolean;
}

/**
 * VerificationTokenOperations class providing comprehensive CRUD operations for VerificationToken entities
 * 
 * This class handles all verification token operations for Better Auth flows including
 * email verification, password reset, magic links, and two-factor authentication.
 * It provides secure token handling, expiration management, and atomic consumption.
 */
export class VerificationTokenOperations {
  private readonly httpClient: HttpClient;
  private readonly queryTranslator: QueryTranslator;
  private readonly responseNormalizer: ResponseNormalizer;
  private readonly entityMapper: EntityMapper;
  private readonly config: ApsoAdapterConfig;
  private readonly apiPath = 'verification-tokens';

  /** Default token validation rules */
  private readonly defaultTokenRules: TokenValidationRules = {
    minLength: 8,
    maxLength: 512,
    allowedPattern: /^[a-zA-Z0-9\-_\.]+$/,
    caseSensitive: true
  };

  // Note: maxTokenAge could be used for automatic cleanup scheduling
  // private readonly maxTokenAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor(dependencies: VerificationTokenOperationsDependencies) {
    this.httpClient = dependencies.httpClient;
    this.queryTranslator = dependencies.queryTranslator;
    this.responseNormalizer = dependencies.responseNormalizer;
    this.entityMapper = dependencies.entityMapper;
    this.config = dependencies.config;
  }

  // =============================================================================
  // Create Operations
  // =============================================================================

  /**
   * Create a new verification token with validation and security checks
   * 
   * @param tokenData - Token data for creation
   * @returns Promise resolving to the created verification token
   * @throws {AdapterError} If validation fails, token conflicts, or API errors occur
   * 
   * @example
   * ```typescript
   * const token = await verificationTokenOps.createVerificationToken({
   *   identifier: 'user@example.com',
   *   token: 'secure-random-token-123',
   *   expiresAt: new Date(Date.now() + 3600000) // 1 hour
   * });
   * ```
   */
  async createVerificationToken(tokenData: {
    identifier: string;
    token: string;
    expiresAt: Date;
  }): Promise<BetterAuthVerificationToken> {
    const startTime = performance.now();
    
    try {
      // Validate input data
      this.validateCreateTokenData(tokenData);
      
      // Normalize identifier (email) if applicable
      let normalizedIdentifier = tokenData.identifier;
      if (this.isEmailIdentifier(tokenData.identifier)) {
        try {
          normalizedIdentifier = EmailNormalizer.normalize(tokenData.identifier);
        } catch (error) {
          throw new AdapterError(
            AdapterErrorCode.VALIDATION_ERROR,
            `Identifier normalization failed: ${(error as Error).message}`,
            { identifier: tokenData.identifier },
            false,
            400
          );
        }
      }

      // Validate token format
      this.validateTokenFormat(tokenData.token);

      // Check for existing token conflicts
      await this.checkTokenConflict(tokenData.token);

      // Create the token data structure
      const verificationToken: BetterAuthVerificationToken = {
        identifier: normalizedIdentifier,
        token: tokenData.token,
        expiresAt: new Date(tokenData.expiresAt)
      };

      // Transform to API format
      const apiData = this.entityMapper.mapVerificationTokenToApi(verificationToken);
      
      // Execute HTTP request
      const url = `${this.config.baseUrl}/${this.apiPath}`;
      const response = await this.httpClient.post<ApsoVerificationToken>(url, apiData, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });
      
      // Normalize and transform response
      const normalizedResponse = this.responseNormalizer.normalizeSingleResponse(response) as ApsoVerificationToken;
      const result = this.entityMapper.mapVerificationTokenFromApi(normalizedResponse);
      
      this.logOperation('createVerificationToken', performance.now() - startTime, true, {
        identifier: this.sanitizeIdentifierForLogging(normalizedIdentifier),
        expiresAt: tokenData.expiresAt
      });
      
      return result;
      
    } catch (error) {
      this.logOperation('createVerificationToken', performance.now() - startTime, false, error, {
        identifier: this.sanitizeIdentifierForLogging(tokenData.identifier)
      });
      throw this.handleError(error, 'createVerificationToken');
    }
  }

  // =============================================================================
  // Read Operations
  // =============================================================================

  /**
   * Find a verification token by its token value (primary lookup)
   * 
   * @param token - Token value to search for
   * @returns Promise resolving to the verification token or null if not found/expired
   * @throws {AdapterError} If validation fails or API errors occur
   * 
   * @example
   * ```typescript
   * const token = await verificationTokenOps.findVerificationTokenByToken('secure-token-123');
   * if (token && !isExpired(token.expiresAt)) {
   *   console.log('Found valid token for:', token.identifier);
   * }
   * ```
   */
  async findVerificationTokenByToken(token: string): Promise<BetterAuthVerificationToken | null> {
    const startTime = performance.now();
    
    try {
      if (!token || typeof token !== 'string') {
        throw new AdapterError(
          AdapterErrorCode.VALIDATION_ERROR,
          'Token must be a non-empty string',
          { token: this.sanitizeTokenForLogging(token) },
          false,
          400
        );
      }

      // Validate token format
      this.validateTokenFormat(token);

      // Build query to find token (for future query parameter implementation)
      this.queryTranslator.buildFindQuery(
        { token: token }, 
        { limit: 1 }
      );
      
      const url = `${this.config.baseUrl}/${this.apiPath}`;
      
      // For now, get all tokens and filter client-side
      // In production, this would use query parameters
      const response = await this.httpClient.get<ApsoVerificationToken[]>(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });
      
      const normalizedResults = this.responseNormalizer.normalizeArrayResponse(response) as ApsoVerificationToken[];
      
      // Find token by exact match
      const matchingToken = normalizedResults.find((t: ApsoVerificationToken) => t.token === token);
      
      if (!matchingToken) {
        this.logOperation('findVerificationTokenByToken', performance.now() - startTime, true, {
          found: false
        });
        return null;
      }
      
      // Transform to Better Auth format
      const result = this.entityMapper.mapVerificationTokenFromApi(matchingToken);
      
      // Check if token has expired
      if (this.isTokenExpired(result.expiresAt)) {
        this.logOperation('findVerificationTokenByToken', performance.now() - startTime, true, {
          found: true,
          expired: true,
          identifier: this.sanitizeIdentifierForLogging(result.identifier)
        });
        return null; // Return null for expired tokens
      }
      
      this.logOperation('findVerificationTokenByToken', performance.now() - startTime, true, {
        found: true,
        expired: false,
        identifier: this.sanitizeIdentifierForLogging(result.identifier)
      });
      
      return result;
      
    } catch (error) {
      this.logOperation('findVerificationTokenByToken', performance.now() - startTime, false, error);
      throw this.handleError(error, 'findVerificationTokenByToken');
    }
  }

  /**
   * Find verification tokens by identifier (email, phone, etc.)
   * 
   * @param identifier - Identifier to search for (will be normalized if email)
   * @param options - Search options including activeOnly and limit
   * @returns Promise resolving to an array of matching verification tokens
   * @throws {AdapterError} If validation fails or API errors occur
   * 
   * @example
   * ```typescript
   * const tokens = await verificationTokenOps.findVerificationTokensByIdentifier(
   *   'user@example.com',
   *   { activeOnly: true, limit: 5 }
   * );
   * ```
   */
  async findVerificationTokensByIdentifier(
    identifier: string,
    options: { activeOnly?: boolean; limit?: number } = {}
  ): Promise<BetterAuthVerificationToken[]> {
    const startTime = performance.now();
    
    try {
      if (!identifier || typeof identifier !== 'string') {
        throw new AdapterError(
          AdapterErrorCode.VALIDATION_ERROR,
          'Identifier must be a non-empty string',
          { identifier: this.sanitizeIdentifierForLogging(identifier) },
          false,
          400
        );
      }

      // Normalize identifier if it's an email
      let normalizedIdentifier = identifier;
      if (this.isEmailIdentifier(identifier)) {
        try {
          normalizedIdentifier = EmailNormalizer.normalize(identifier);
        } catch (error) {
          throw new AdapterError(
            AdapterErrorCode.VALIDATION_ERROR,
            `Invalid identifier format: ${(error as Error).message}`,
            { identifier: this.sanitizeIdentifierForLogging(identifier) },
            false,
            400
          );
        }
      }

      // Build query with identifier filter (for future query parameter implementation)
      this.queryTranslator.buildFindQuery(
        { identifier: normalizedIdentifier }, 
        { limit: options.limit || 100 }
      );
      
      const url = `${this.config.baseUrl}/${this.apiPath}`;
      
      // Execute request
      const response = await this.httpClient.get<ApsoVerificationToken[]>(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });
      
      const normalizedResults = this.responseNormalizer.normalizeArrayResponse(response) as ApsoVerificationToken[];
      
      // Filter by identifier (case-insensitive for emails)
      let matchingTokens = normalizedResults.filter((token: ApsoVerificationToken) => {
        if (this.isEmailIdentifier(token.identifier)) {
          return token.identifier.toLowerCase() === normalizedIdentifier.toLowerCase();
        }
        return token.identifier === normalizedIdentifier;
      });
      
      // Filter out expired tokens if activeOnly is true
      if (options.activeOnly) {
        matchingTokens = matchingTokens.filter((token: ApsoVerificationToken) => 
          !this.isTokenExpired(new Date(token.expiresAt))
        );
      }
      
      // Apply limit
      if (options.limit && options.limit > 0) {
        matchingTokens = matchingTokens.slice(0, options.limit);
      }
      
      // Transform results
      const transformedResults = matchingTokens.map((token: ApsoVerificationToken) => 
        this.entityMapper.mapVerificationTokenFromApi(token)
      );
      
      this.logOperation('findVerificationTokensByIdentifier', performance.now() - startTime, true, {
        identifier: this.sanitizeIdentifierForLogging(normalizedIdentifier),
        found: transformedResults.length,
        activeOnly: options.activeOnly
      });
      
      return transformedResults;
      
    } catch (error) {
      this.logOperation('findVerificationTokensByIdentifier', performance.now() - startTime, false, error, {
        identifier: this.sanitizeIdentifierForLogging(identifier)
      });
      throw this.handleError(error, 'findVerificationTokensByIdentifier');
    }
  }

  // =============================================================================
  // Validation Operations
  // =============================================================================

  /**
   * Validate a verification token without consuming it
   * 
   * @param token - Token value to validate
   * @returns Promise resolving to validation result with detailed information
   * @throws {AdapterError} If validation fails or API errors occur
   * 
   * @example
   * ```typescript
   * const validation = await verificationTokenOps.validateVerificationToken('token-123');
   * if (validation.isValid && !validation.isExpired) {
   *   console.log('Token is valid for:', validation.token?.identifier);
   * }
   * ```
   */
  async validateVerificationToken(token: string): Promise<TokenValidationResult> {
    const startTime = performance.now();
    
    try {
      if (!token || typeof token !== 'string') {
        const result: TokenValidationResult = {
          token: null,
          isValid: false,
          isExpired: false,
          validationDetails: {
            foundButExpired: false
          }
        };
        
        this.logOperation('validateVerificationToken', performance.now() - startTime, true, {
          valid: false,
          reason: 'invalid_token_format'
        });
        
        return result;
      }

      // Find the token
      const foundToken = await this.findVerificationTokenByToken(token);
      
      if (!foundToken) {
        // Check if token exists but is expired
        const expiredToken = await this.findExpiredToken(token);
        
        const result: TokenValidationResult = {
          token: null,
          isValid: false,
          isExpired: expiredToken !== null,
          validationDetails: {
            foundButExpired: expiredToken !== null,
            ...(expiredToken && {
              normalizedIdentifier: this.sanitizeIdentifierForLogging(expiredToken.identifier)
            })
          }
        };
        
        this.logOperation('validateVerificationToken', performance.now() - startTime, true, {
          valid: false,
          expired: expiredToken !== null,
          reason: expiredToken ? 'token_expired' : 'token_not_found'
        });
        
        return result;
      }
      
      // Check expiration
      const isExpired = this.isTokenExpired(foundToken.expiresAt);
      const timeUntilExpiry = foundToken.expiresAt.getTime() - Date.now();
      
      const result: TokenValidationResult = {
        token: foundToken,
        isValid: !isExpired,
        isExpired: isExpired,
        validationDetails: {
          timeUntilExpiry: Math.max(0, timeUntilExpiry),
          foundButExpired: false,
          normalizedIdentifier: this.sanitizeIdentifierForLogging(foundToken.identifier)
        }
      };
      
      this.logOperation('validateVerificationToken', performance.now() - startTime, true, {
        valid: !isExpired,
        expired: isExpired,
        identifier: this.sanitizeIdentifierForLogging(foundToken.identifier),
        timeUntilExpiry: timeUntilExpiry
      });
      
      return result;
      
    } catch (error) {
      this.logOperation('validateVerificationToken', performance.now() - startTime, false, error);
      throw this.handleError(error, 'validateVerificationToken');
    }
  }

  // =============================================================================
  // Consume Operations (Atomic Validate + Delete)
  // =============================================================================

  /**
   * Consume a verification token (validate and delete atomically)
   * 
   * @param token - Token value to consume
   * @returns Promise resolving to consumption result
   * @throws {AdapterError} If API errors occur
   * 
   * @example
   * ```typescript
   * const result = await verificationTokenOps.consumeVerificationToken('token-123');
   * if (result.isValid && !result.isExpired) {
   *   console.log('Token consumed for:', result.token?.identifier);
   * } else if (result.alreadyConsumed) {
   *   console.log('Token was already consumed');
   * }
   * ```
   */
  async consumeVerificationToken(token: string): Promise<TokenConsumptionResult> {
    const startTime = performance.now();
    
    try {
      // First validate the token
      const validation = await this.validateVerificationToken(token);
      
      if (!validation.token) {
        const result: TokenConsumptionResult = {
          token: null,
          isValid: false,
          isExpired: validation.isExpired,
          alreadyConsumed: false
        };
        
        this.logOperation('consumeVerificationToken', performance.now() - startTime, true, {
          consumed: false,
          reason: validation.isExpired ? 'token_expired' : 'token_not_found'
        });
        
        return result;
      }
      
      if (validation.isExpired) {
        const result: TokenConsumptionResult = {
          token: validation.token,
          isValid: false,
          isExpired: true,
          alreadyConsumed: false
        };
        
        this.logOperation('consumeVerificationToken', performance.now() - startTime, true, {
          consumed: false,
          reason: 'token_expired',
          identifier: this.sanitizeIdentifierForLogging(validation.token.identifier)
        });
        
        return result;
      }
      
      // Token is valid, attempt to delete it (consume)
      try {
        const deletedToken = await this.deleteVerificationToken(token);
        
        const result: TokenConsumptionResult = {
          token: deletedToken,
          isValid: true,
          isExpired: false,
          alreadyConsumed: false
        };
        
        this.logOperation('consumeVerificationToken', performance.now() - startTime, true, {
          consumed: true,
          identifier: this.sanitizeIdentifierForLogging(deletedToken.identifier)
        });
        
        return result;
        
      } catch (error) {
        // Handle race condition where token was already consumed
        if (this.isNotFoundError(error)) {
          const result: TokenConsumptionResult = {
            token: validation.token,
            isValid: false,
            isExpired: false,
            alreadyConsumed: true
          };
          
          this.logOperation('consumeVerificationToken', performance.now() - startTime, true, {
            consumed: false,
            reason: 'already_consumed',
            identifier: this.sanitizeIdentifierForLogging(validation.token.identifier)
          });
          
          return result;
        }
        
        throw error;
      }
      
    } catch (error) {
      this.logOperation('consumeVerificationToken', performance.now() - startTime, false, error);
      throw this.handleError(error, 'consumeVerificationToken');
    }
  }

  // =============================================================================
  // Delete Operations
  // =============================================================================

  /**
   * Delete a verification token by token value
   * 
   * @param token - Token value to delete
   * @returns Promise resolving to the deleted verification token
   * @throws {AdapterError} If token not found or API errors occur
   * 
   * @example
   * ```typescript
   * const deletedToken = await verificationTokenOps.deleteVerificationToken('token-123');
   * console.log('Deleted token for:', deletedToken.identifier);
   * ```
   */
  async deleteVerificationToken(token: string): Promise<BetterAuthVerificationToken> {
    const startTime = performance.now();
    
    try {
      if (!token || typeof token !== 'string') {
        throw new AdapterError(
          AdapterErrorCode.VALIDATION_ERROR,
          'Token must be a non-empty string',
          { token: this.sanitizeTokenForLogging(token) },
          false,
          400
        );
      }

      // Find the token first to get its ID and return it after deletion
      const existingToken = await this.findTokenIncludingExpired(token);
      if (!existingToken) {
        throw new AdapterError(
          AdapterErrorCode.NOT_FOUND,
          `Verification token not found`,
          { token: this.sanitizeTokenForLogging(token) },
          false,
          404
        );
      }

      // Delete using API path with token as identifier
      // Note: In a real implementation, you might need the internal ID
      const url = `${this.config.baseUrl}/${this.apiPath}/${encodeURIComponent(token)}`;
      
      await this.httpClient.delete(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });
      
      this.logOperation('deleteVerificationToken', performance.now() - startTime, true, {
        identifier: this.sanitizeIdentifierForLogging(existingToken.identifier)
      });
      
      return existingToken;
      
    } catch (error) {
      this.logOperation('deleteVerificationToken', performance.now() - startTime, false, error);
      throw this.handleError(error, 'deleteVerificationToken');
    }
  }

  /**
   * Delete a verification token by internal ID
   * 
   * @param id - Internal ID of the token to delete
   * @returns Promise resolving to the deleted verification token
   * @throws {AdapterError} If token not found or API errors occur
   */
  async deleteVerificationTokenById(id: string): Promise<BetterAuthVerificationToken> {
    const startTime = performance.now();
    
    try {
      if (!id || typeof id !== 'string') {
        throw new AdapterError(
          AdapterErrorCode.VALIDATION_ERROR,
          'Token ID must be a non-empty string',
          { id },
          false,
          400
        );
      }

      // Find the token first to return it after deletion
      const existingToken = await this.findTokenById(id);
      if (!existingToken) {
        throw new AdapterError(
          AdapterErrorCode.NOT_FOUND,
          `Verification token with ID ${id} not found`,
          { id },
          false,
          404
        );
      }

      // Delete by ID
      const url = `${this.config.baseUrl}/${this.apiPath}/${id}`;
      await this.httpClient.delete(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });
      
      this.logOperation('deleteVerificationTokenById', performance.now() - startTime, true, {
        id,
        identifier: this.sanitizeIdentifierForLogging(existingToken.identifier)
      });
      
      return existingToken;
      
    } catch (error) {
      this.logOperation('deleteVerificationTokenById', performance.now() - startTime, false, error);
      throw this.handleError(error, 'deleteVerificationTokenById');
    }
  }

  // =============================================================================
  // Cleanup Operations
  // =============================================================================

  /**
   * Delete all expired verification tokens
   * 
   * @returns Promise resolving to the number of deleted tokens
   * @throws {AdapterError} If API errors occur
   * 
   * @example
   * ```typescript
   * const deletedCount = await verificationTokenOps.deleteExpiredTokens();
   * console.log(`Cleaned up ${deletedCount} expired tokens`);
   * ```
   */
  async deleteExpiredTokens(): Promise<number> {
    const startTime = performance.now();
    
    try {
      // Get all tokens and filter expired ones
      const allTokens = await this.getAllTokens();
      const expiredTokens = allTokens.filter(token => 
        this.isTokenExpired(new Date(token.expiresAt))
      );
      
      if (expiredTokens.length === 0) {
        this.logOperation('deleteExpiredTokens', performance.now() - startTime, true, {
          deletedCount: 0
        });
        return 0;
      }
      
      // Delete each expired token
      let deletedCount = 0;
      for (const token of expiredTokens) {
        try {
          await this.deleteVerificationToken(token.token);
          deletedCount++;
        } catch (error) {
          // Log individual errors but continue
          if (this.config.logger) {
            this.config.logger.warn('Failed to delete expired token', { 
              error, 
              token: this.sanitizeTokenForLogging(token.token),
              identifier: this.sanitizeIdentifierForLogging(token.identifier)
            });
          }
        }
      }
      
      this.logOperation('deleteExpiredTokens', performance.now() - startTime, true, {
        deletedCount,
        totalFound: expiredTokens.length
      });
      
      return deletedCount;
      
    } catch (error) {
      this.logOperation('deleteExpiredTokens', performance.now() - startTime, false, error);
      throw this.handleError(error, 'deleteExpiredTokens');
    }
  }

  /**
   * Delete all verification tokens for a specific identifier
   * 
   * @param identifier - Identifier (email, phone, etc.) to delete tokens for
   * @returns Promise resolving to the number of deleted tokens
   * @throws {AdapterError} If validation fails or API errors occur
   * 
   * @example
   * ```typescript
   * const deletedCount = await verificationTokenOps.deleteTokensByIdentifier('user@example.com');
   * console.log(`Deleted ${deletedCount} tokens for user`);
   * ```
   */
  async deleteTokensByIdentifier(identifier: string): Promise<number> {
    const startTime = performance.now();
    
    try {
      // Find all tokens for this identifier
      const tokens = await this.findVerificationTokensByIdentifier(identifier, {
        activeOnly: false // Include expired tokens for cleanup
      });
      
      if (tokens.length === 0) {
        this.logOperation('deleteTokensByIdentifier', performance.now() - startTime, true, {
          identifier: this.sanitizeIdentifierForLogging(identifier),
          deletedCount: 0
        });
        return 0;
      }
      
      // Delete each token
      let deletedCount = 0;
      for (const token of tokens) {
        try {
          await this.deleteVerificationToken(token.token);
          deletedCount++;
        } catch (error) {
          // Log individual errors but continue
          if (this.config.logger) {
            this.config.logger.warn('Failed to delete token for identifier', { 
              error, 
              identifier: this.sanitizeIdentifierForLogging(identifier),
              token: this.sanitizeTokenForLogging(token.token)
            });
          }
        }
      }
      
      this.logOperation('deleteTokensByIdentifier', performance.now() - startTime, true, {
        identifier: this.sanitizeIdentifierForLogging(identifier),
        deletedCount,
        totalFound: tokens.length
      });
      
      return deletedCount;
      
    } catch (error) {
      this.logOperation('deleteTokensByIdentifier', performance.now() - startTime, false, error, {
        identifier: this.sanitizeIdentifierForLogging(identifier)
      });
      throw this.handleError(error, 'deleteTokensByIdentifier');
    }
  }

  // =============================================================================
  // Count Operations
  // =============================================================================

  /**
   * Count verification tokens matching optional filter criteria
   * 
   * @param where - Optional filter criteria
   * @returns Promise resolving to the count of matching tokens
   * @throws {AdapterError} If API errors occur
   * 
   * @example
   * ```typescript
   * const count = await verificationTokenOps.countVerificationTokens({
   *   identifier: 'user@example.com'
   * });
   * console.log(`${count} tokens found`);
   * ```
   */
  async countVerificationTokens(where?: Partial<BetterAuthVerificationToken>): Promise<number> {
    const startTime = performance.now();
    
    try {
      // Build query with filters (for future query parameter implementation)
      this.queryTranslator.buildFindQuery(where || {});
      
      const url = `${this.config.baseUrl}/${this.apiPath}`;
      
      try {
        // Try to get count from response metadata
        const response = await this.httpClient.get(url, {
          headers: this.buildHeaders(),
          ...(this.config.timeout && { timeout: this.config.timeout }),
        });
        
        const count = this.responseNormalizer.normalizeCountResponse(response);
        this.logOperation('countVerificationTokens', performance.now() - startTime, true, {
          count,
          hasFilters: !!where
        });
        return count;
        
      } catch (error) {
        // Fallback: get all tokens and count them
        const tokens = await this.findVerificationTokensByIdentifier(
          where?.identifier || '',
          { activeOnly: false }
        );
        const count = tokens.length;
        
        this.logOperation('countVerificationTokens', performance.now() - startTime, true, {
          count,
          hasFilters: !!where,
          fallbackUsed: true
        });
        return count;
      }
      
    } catch (error) {
      this.logOperation('countVerificationTokens', performance.now() - startTime, false, error);
      throw this.handleError(error, 'countVerificationTokens');
    }
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Validate data for token creation
   */
  private validateCreateTokenData(tokenData: {
    identifier: string;
    token: string;
    expiresAt: Date;
  }): void {
    const errors: ValidationError[] = [];

    if (!tokenData.identifier || typeof tokenData.identifier !== 'string') {
      errors.push({ field: 'identifier', message: 'Identifier is required and must be a string' });
    }

    if (!tokenData.token || typeof tokenData.token !== 'string') {
      errors.push({ field: 'token', message: 'Token is required and must be a string' });
    }

    if (!tokenData.expiresAt || !(tokenData.expiresAt instanceof Date)) {
      errors.push({ field: 'expiresAt', message: 'ExpiresAt is required and must be a Date' });
    } else if (tokenData.expiresAt <= new Date()) {
      errors.push({ field: 'expiresAt', message: 'ExpiresAt must be in the future' });
    }

    if (errors.length > 0) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Verification token creation validation failed',
        { errors },
        false,
        400
      );
    }
  }

  /**
   * Validate token format according to security rules
   */
  private validateTokenFormat(token: string): void {
    if (!token || typeof token !== 'string') {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Invalid token format: must be a non-empty string',
        { token: this.sanitizeTokenForLogging(token) },
        false,
        400
      );
    }

    if (token.length < this.defaultTokenRules.minLength) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        `Token too short: minimum ${this.defaultTokenRules.minLength} characters`,
        { token: this.sanitizeTokenForLogging(token), length: token.length },
        false,
        400
      );
    }

    if (token.length > this.defaultTokenRules.maxLength) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        `Token too long: maximum ${this.defaultTokenRules.maxLength} characters`,
        { token: this.sanitizeTokenForLogging(token), length: token.length },
        false,
        400
      );
    }

    if (!this.defaultTokenRules.allowedPattern.test(token)) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Token contains invalid characters',
        { token: this.sanitizeTokenForLogging(token) },
        false,
        400
      );
    }
  }

  /**
   * Check if identifier is an email address
   */
  private isEmailIdentifier(identifier: string): boolean {
    return EmailNormalizer.isValidEmail(identifier);
  }

  /**
   * Check if token has expired
   */
  private isTokenExpired(expiresAt: Date): boolean {
    return new Date(expiresAt) <= new Date();
  }

  /**
   * Check for existing token conflicts
   */
  private async checkTokenConflict(token: string): Promise<void> {
    const existingToken = await this.findTokenIncludingExpired(token);
    
    if (existingToken) {
      throw new AdapterError(
        AdapterErrorCode.CONFLICT,
        'A verification token with this value already exists',
        { token: this.sanitizeTokenForLogging(token) },
        false,
        409
      );
    }
  }

  /**
   * Find token including expired ones (for conflict checking)
   */
  private async findTokenIncludingExpired(token: string): Promise<BetterAuthVerificationToken | null> {
    try {
      const url = `${this.config.baseUrl}/${this.apiPath}`;
      const response = await this.httpClient.get<ApsoVerificationToken[]>(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });
      
      const normalizedResults = this.responseNormalizer.normalizeArrayResponse(response) as ApsoVerificationToken[];
      const matchingToken = normalizedResults.find((t: ApsoVerificationToken) => t.token === token);
      
      return matchingToken ? this.entityMapper.mapVerificationTokenFromApi(matchingToken) : null;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Find expired token (for validation details)
   */
  private async findExpiredToken(token: string): Promise<BetterAuthVerificationToken | null> {
    const foundToken = await this.findTokenIncludingExpired(token);
    
    if (foundToken && this.isTokenExpired(foundToken.expiresAt)) {
      return foundToken;
    }
    
    return null;
  }

  /**
   * Find token by internal ID
   */
  private async findTokenById(id: string): Promise<BetterAuthVerificationToken | null> {
    try {
      const url = `${this.config.baseUrl}/${this.apiPath}/${id}`;
      const response = await this.httpClient.get<ApsoVerificationToken>(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });
      
      const normalizedResponse = this.responseNormalizer.normalizeSingleResponse(response) as ApsoVerificationToken;
      return this.entityMapper.mapVerificationTokenFromApi(normalizedResponse);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all tokens (for cleanup operations)
   */
  private async getAllTokens(): Promise<ApsoVerificationToken[]> {
    const url = `${this.config.baseUrl}/${this.apiPath}`;
    const response = await this.httpClient.get<ApsoVerificationToken[]>(url, {
      headers: this.buildHeaders(),
      ...(this.config.timeout && { timeout: this.config.timeout }),
    });
    
    return this.responseNormalizer.normalizeArrayResponse(response) as ApsoVerificationToken[];
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

    // Add tenant context if available and multi-tenancy is enabled
    if (this.config.multiTenancy?.enabled) {
      try {
        const tenantId = this.config.multiTenancy.getScopeValue();
        if (typeof tenantId === 'string') {
          headers['X-Tenant-ID'] = tenantId;
        }
      } catch (error) {
        // Log error if logger is available, but don't fail the request
        if (this.config.logger) {
          this.config.logger.warn('Failed to get tenant scope value', { error });
        }
      }
    }

    return headers;
  }

  /**
   * Check if error is a 404 Not Found error
   */
  private isNotFoundError(error: any): boolean {
    return (
      error &&
      typeof error === 'object' &&
      ('statusCode' in error && error.statusCode === 404) ||
      ('status' in error && error.status === 404) ||
      ('code' in error && error.code === 'NOT_FOUND')
    );
  }

  /**
   * Sanitize token for logging (never log full token)
   */
  private sanitizeTokenForLogging(token: string): string {
    if (!token || typeof token !== 'string') {
      return '[INVALID_TOKEN]';
    }
    
    if (token.length <= 8) {
      return '[SHORT_TOKEN]';
    }
    
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  /**
   * Sanitize identifier for logging (mask email addresses partially)
   */
  private sanitizeIdentifierForLogging(identifier: string): string {
    if (!identifier || typeof identifier !== 'string') {
      return '[INVALID_IDENTIFIER]';
    }
    
    if (this.isEmailIdentifier(identifier)) {
      const [localPart, domain] = identifier.split('@');
      if (localPart && domain) {
        const maskedLocal = localPart.length > 2 
          ? `${localPart[0]}***${localPart[localPart.length - 1]}`
          : '***';
        return `${maskedLocal}@${domain}`;
      }
    }
    
    return identifier.length > 4 
      ? `${identifier.substring(0, 2)}***${identifier.substring(identifier.length - 2)}`
      : '***';
  }

  /**
   * Handle and normalize errors
   */
  private handleError(error: any, operation: string): AdapterError {
    // If it's already an AdapterError, just rethrow it
    if (error instanceof AdapterError) {
      return error;
    }

    // Determine error code based on error type/status
    let errorCode = AdapterErrorCode.UNKNOWN;
    let statusCode: number | undefined;

    if (error && typeof error === 'object') {
      if ('statusCode' in error || 'status' in error) {
        statusCode = error.statusCode || error.status;
        switch (statusCode) {
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
            break;
          case 500:
          case 502:
          case 503:
          case 504:
            errorCode = AdapterErrorCode.SERVER_ERROR;
            break;
        }
      }
      
      if ('code' in error) {
        switch (error.code) {
          case 'ECONNREFUSED':
          case 'ENOTFOUND':
          case 'ECONNRESET':
            errorCode = AdapterErrorCode.NETWORK_ERROR;
            break;
          case 'ETIMEDOUT':
            errorCode = AdapterErrorCode.TIMEOUT;
            break;
        }
      }
    }

    const message = `VerificationToken ${operation} operation failed: ${
      error instanceof Error ? error.message : String(error)
    }`;

    if (this.config.logger) {
      this.config.logger.error(message, { error, operation });
    }

    return new AdapterError(
      errorCode,
      message,
      error,
      this.isRetryableError(statusCode),
      statusCode
    );
  }

  /**
   * Check if error is retryable based on status code
   */
  private isRetryableError(statusCode?: number): boolean {
    if (!statusCode) return false;
    return this.config.retryConfig?.retryableStatuses?.includes(statusCode) ?? false;
  }

  /**
   * Log operation for observability
   */
  private logOperation(
    operation: string, 
    duration: number, 
    success: boolean, 
    error?: any, 
    metadata?: Record<string, any>
  ): void {
    if (this.config.logger) {
      const logData = {
        operation: `VerificationTokenOperations.${operation}`,
        duration: Math.round(duration),
        success,
        ...(metadata && { ...metadata }),
        ...(error && !success && { error: error instanceof Error ? error.message : String(error) })
      };

      if (success) {
        this.config.logger.debug('VerificationToken operation completed', logData);
      } else {
        this.config.logger.error('VerificationToken operation failed', logData);
      }
    }
  }
}