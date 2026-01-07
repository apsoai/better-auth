/**
 * Session Operations Implementation
 *
 * This class provides comprehensive CRUD operations for the Session entity with
 * advanced token handling, expiration management, and security features.
 *
 * Key Features:
 * - Session token-based operations (primary lookup method)
 * - Automatic expiration checking and cleanup
 * - User association and validation
 * - Security measures for token handling
 * - Performance-optimized frequent lookups
 * - Comprehensive error handling
 * - Multi-tenant session isolation
 *
 * Session tokens are the primary means of session identification in Better Auth,
 * making token-based operations the most critical for performance and reliability.
 */

import type {
  BetterAuthSession,
  ApsoSession,
  ApsoAdapterConfig,
  AdapterError,
  CrudPagination,
  ValidationError,
} from '../types';
import { AdapterError as AdapterErrorClass, AdapterErrorCode } from '../types';
import { HttpClient } from '../client/HttpClient';
import { QueryTranslator } from '../query/QueryTranslator';
import { ResponseNormalizer } from '../response/ResponseNormalizer';
import { EntityMapper } from '../response/EntityMapper';

/**
 * Options for finding multiple sessions
 */
export interface FindManySessionsOptions {
  /** Filter criteria for session search */
  where?: Partial<BetterAuthSession>;
  /** Fields to select in the response */
  select?: string[];
  /** Pagination options */
  pagination?: CrudPagination;
  /** Sort options */
  sort?: Record<string, 'ASC' | 'DESC'>;
  /** Include only active (non-expired) sessions */
  activeOnly?: boolean;
}

/**
 * Session validation result with detailed information
 */
export interface SessionValidationResult {
  /** The session object if found */
  session: BetterAuthSession | null;
  /** Whether the session exists and is valid */
  isValid: boolean;
  /** Whether the session has expired */
  isExpired: boolean;
  /** Error details if validation failed */
  error?: string;
}

/**
 * Dependencies for SessionOperations
 */
export interface SessionOperationsDependencies {
  httpClient: HttpClient;
  queryTranslator: QueryTranslator;
  responseNormalizer: ResponseNormalizer;
  entityMapper: EntityMapper;
  config: ApsoAdapterConfig;
}

/**
 * SessionOperations class providing comprehensive CRUD operations for Session entities
 *
 * This class handles all session-related database operations with emphasis on
 * token-based authentication flows, session security, and expiration management.
 * Sessions are frequently accessed during authentication, so performance is critical.
 */
export class SessionOperations {
  private readonly httpClient: HttpClient;
  private readonly queryTranslator: QueryTranslator;
  private readonly responseNormalizer: ResponseNormalizer;
  private readonly entityMapper: EntityMapper;
  private readonly config: ApsoAdapterConfig;
  private readonly apiPath = 'sessions';

  // Session token validation pattern (example - adjust based on your token format)
  private readonly tokenPattern = /^[a-zA-Z0-9_-]+$/;
  private readonly minTokenLength = 16;
  private readonly maxTokenLength = 255;

  constructor(dependencies: SessionOperationsDependencies) {
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
   * Create a new session with validation and token security
   *
   * @param sessionData - Session data for creation
   * @returns Promise resolving to the created session in Better Auth format
   * @throws {AdapterError} If validation fails, token conflicts, or API errors occur
   *
   * @example
   * ```typescript
   * const session = await sessionOps.createSession({
   *   sessionToken: 'unique-session-token-123',
   *   userId: 'user_456',
   *   expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
   * });
   * ```
   */
  async createSession(sessionData: {
    sessionToken: string;
    userId: string;
    expiresAt: Date;
  }): Promise<BetterAuthSession> {
    const startTime = performance.now();

    try {
      // Validate required fields
      this.validateCreateSessionData(sessionData);

      // Validate session token format and security
      this.validateSessionToken(sessionData.sessionToken);

      // Check for token conflicts
      await this.checkTokenConflict(sessionData.sessionToken);

      // Validate user exists (if enabled in config)
      if (this.config.debugMode) {
        await this.validateUserExists(sessionData.userId);
      }

      // Create API data - do NOT include ID, let the backend auto-generate it (SERIAL/integer)
      const apiData = {
        // id omitted - backend will auto-generate
        token: sessionData.sessionToken, // Apso schema has separate token field
        userId: sessionData.userId,
        expiresAt: sessionData.expiresAt,
        ipAddress: '', // Default value
        userAgent: '', // Default value
      };

      // Execute HTTP request
      const url = `${this.config.baseUrl}/${this.apiPath}`;
      const response = await this.httpClient.post<ApsoSession>(url, apiData, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      // Normalize and transform response
      const normalizedResponse =
        this.responseNormalizer.normalizeSingleResponse(
          response
        ) as ApsoSession;

      const result = this.entityMapper.mapSessionFromApi(normalizedResponse);

      this.logOperation('createSession', performance.now() - startTime, true);
      return result;
    } catch (error) {
      this.logOperation(
        'createSession',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'createSession');
    }
  }

  // =============================================================================
  // Read Operations
  // =============================================================================

  /**
   * Find a session by its token (most common operation)
   *
   * This is the primary session lookup method used in authentication flows.
   * Optimized for performance as it's called frequently.
   *
   * @param sessionToken - Session token to search for
   * @returns Promise resolving to the session or null if not found
   * @throws {AdapterError} If validation fails or API errors occur
   *
   * @example
   * ```typescript
   * const session = await sessionOps.findSessionByToken('session-token-123');
   * if (session && !sessionOps.isSessionExpired(session)) {
   *   console.log('Valid session for user:', session.userId);
   * }
   * ```
   */
  async findSessionByToken(
    sessionToken: string
  ): Promise<BetterAuthSession | null> {
    const startTime = performance.now();

    try {
      if (!sessionToken || typeof sessionToken !== 'string') {
        throw new AdapterErrorClass(
          AdapterErrorCode.VALIDATION_ERROR,
          'Session token must be a non-empty string',
          { sessionToken },
          false,
          400
        );
      }

      // Validate token format for basic security
      this.validateSessionToken(sessionToken, false); // Don't throw on invalid format, just return null

      // Use server-side filtering to find session by token
      // This is much more efficient than paginating through all sessions
      // Note: Apso API uses 'token' field and 'eq' operator (not '$eq')
      const filterValue = encodeURIComponent(`token||eq||${sessionToken}`);
      const url = `${this.config.baseUrl}/${this.apiPath}?filter=${filterValue}&limit=1`;

      const response = await this.httpClient.get<any>(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      const normalizedResults =
        this.responseNormalizer.normalizeArrayResponse(
          response
        ) as ApsoSession[];

      // Get first matching session
      const matchingSession = normalizedResults.length > 0 ? normalizedResults[0] : null;

      if (!matchingSession) {
        this.logOperation(
          'findSessionByToken',
          performance.now() - startTime,
          true
        );
        return null;
      }

      const result = this.entityMapper.mapSessionFromApi(matchingSession);

      this.logOperation(
        'findSessionByToken',
        performance.now() - startTime,
        true
      );
      return result;
    } catch (error) {
      this.logOperation(
        'findSessionByToken',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'findSessionByToken');
    }
  }

  /**
   * Find a session by its unique ID
   *
   * @param id - Session ID to search for
   * @returns Promise resolving to the session or null if not found
   * @throws {AdapterError} If validation fails or API errors occur
   *
   * @example
   * ```typescript
   * const session = await sessionOps.findSessionById('session_123');
   * if (session) {
   *   console.log('Found session token:', session.sessionToken);
   * }
   * ```
   */
  async findSessionById(id: string): Promise<BetterAuthSession | null> {
    const startTime = performance.now();

    try {
      if (!id || typeof id !== 'string') {
        throw new AdapterErrorClass(
          AdapterErrorCode.VALIDATION_ERROR,
          'Session ID must be a non-empty string',
          { id },
          false,
          400
        );
      }

      const url = `${this.config.baseUrl}/${this.apiPath}/${id}`;

      try {
        const response = await this.httpClient.get<ApsoSession>(url, {
          headers: this.buildHeaders(),
          ...(this.config.timeout && { timeout: this.config.timeout }),
        });

        const normalizedResponse =
          this.responseNormalizer.normalizeSingleResponse(
            response
          ) as ApsoSession;
        const result = this.entityMapper.mapSessionFromApi(normalizedResponse);

        this.logOperation(
          'findSessionById',
          performance.now() - startTime,
          true
        );
        return result;
      } catch (error) {
        // Handle 404 as null result, not an error
        if (this.isNotFoundError(error)) {
          this.logOperation(
            'findSessionById',
            performance.now() - startTime,
            true
          );
          return null;
        }
        throw error;
      }
    } catch (error) {
      this.logOperation(
        'findSessionById',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'findSessionById');
    }
  }

  /**
   * Find all sessions for a specific user
   *
   * @param userId - User ID to find sessions for
   * @param options - Additional options for filtering and pagination
   * @returns Promise resolving to an array of matching sessions
   * @throws {AdapterError} If validation fails or API errors occur
   *
   * @example
   * ```typescript
   * const activeSessions = await sessionOps.findSessionsByUserId('user_123', {
   *   activeOnly: true,
   *   limit: 10
   * });
   * console.log(`User has ${activeSessions.length} active sessions`);
   * ```
   */
  async findSessionsByUserId(
    userId: string,
    options: {
      activeOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<BetterAuthSession[]> {
    const startTime = performance.now();

    try {
      if (!userId || typeof userId !== 'string') {
        throw new AdapterErrorClass(
          AdapterErrorCode.VALIDATION_ERROR,
          'User ID must be a non-empty string',
          { userId },
          false,
          400
        );
      }

      // Build query with user filter
      const url = `${this.config.baseUrl}/${this.apiPath}`;

      const response = await this.httpClient.get<ApsoSession[]>(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      const normalizedResults = this.responseNormalizer.normalizeArrayResponse(
        response
      ) as ApsoSession[];

      // Filter sessions by userId
      let userSessions = normalizedResults.filter(
        session => session.userId === userId
      );

      // Filter out expired sessions if activeOnly is true
      if (options.activeOnly) {
        const now = new Date();
        userSessions = userSessions.filter(
          session => new Date(session.expiresAt) > now
        );
      }

      // Apply limit if specified
      if (options.limit) {
        userSessions = userSessions.slice(0, options.limit);
      }

      // Transform results
      const transformedResults = userSessions.map(session =>
        this.entityMapper.mapSessionFromApi(session)
      );

      this.logOperation(
        'findSessionsByUserId',
        performance.now() - startTime,
        true
      );
      return transformedResults;
    } catch (error) {
      this.logOperation(
        'findSessionsByUserId',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'findSessionsByUserId');
    }
  }

  // =============================================================================
  // Update Operations
  // =============================================================================

  /**
   * Update a session by its ID
   *
   * @param id - Session ID to update
   * @param updates - Partial session data with updates
   * @returns Promise resolving to the updated session
   * @throws {AdapterError} If session not found, validation fails, or API errors occur
   *
   * @example
   * ```typescript
   * const extendedSession = await sessionOps.updateSession('session_123', {
   *   expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Extend 7 days
   * });
   * ```
   */
  async updateSession(
    id: string,
    updates: Partial<BetterAuthSession>
  ): Promise<BetterAuthSession> {
    const startTime = performance.now();

    try {
      if (!id || typeof id !== 'string') {
        throw new AdapterErrorClass(
          AdapterErrorCode.VALIDATION_ERROR,
          'Session ID must be a non-empty string',
          { id },
          false,
          400
        );
      }

      // Validate update data
      this.validateUpdateSessionData(updates);

      // Check for token conflicts if updating sessionToken
      if (updates.sessionToken) {
        this.validateSessionToken(updates.sessionToken);
        await this.checkTokenConflict(updates.sessionToken, id);
      }

      // Get existing session to merge updates
      const existingSession = await this.findSessionById(id);
      if (!existingSession) {
        throw new AdapterErrorClass(
          AdapterErrorCode.NOT_FOUND,
          `Session with ID ${id} not found`,
          { id },
          false,
          404
        );
      }

      // Merge updates with existing session data
      const updatedSession: BetterAuthSession = {
        ...existingSession,
        ...updates,
        id: existingSession.id, // Ensure ID cannot be changed
      };

      // Transform to API format
      const apiData = this.entityMapper.mapSessionToApi(updatedSession);

      // Execute update request
      const url = `${this.config.baseUrl}/${this.apiPath}/${id}`;
      const response = await this.httpClient.patch<ApsoSession>(url, apiData, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      // Normalize and transform response
      const normalizedResponse =
        this.responseNormalizer.normalizeSingleResponse(
          response
        ) as ApsoSession;
      const result = this.entityMapper.mapSessionFromApi(normalizedResponse);

      this.logOperation('updateSession', performance.now() - startTime, true);
      return result;
    } catch (error) {
      this.logOperation(
        'updateSession',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'updateSession');
    }
  }

  /**
   * Update a session by its token
   *
   * @param sessionToken - Session token of the session to update
   * @param updates - Partial session data with updates
   * @returns Promise resolving to the updated session
   * @throws {AdapterError} If session not found, validation fails, or API errors occur
   *
   * @example
   * ```typescript
   * const extendedSession = await sessionOps.updateSessionByToken('token_123', {
   *   expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Extend 30 days
   * });
   * ```
   */
  async updateSessionByToken(
    sessionToken: string,
    updates: Partial<BetterAuthSession>
  ): Promise<BetterAuthSession> {
    const startTime = performance.now();

    try {
      // Find session by token first
      const existingSession = await this.findSessionByToken(sessionToken);
      if (!existingSession) {
        throw new AdapterErrorClass(
          AdapterErrorCode.NOT_FOUND,
          `Session with token not found`,
          { sessionToken: '[REDACTED]' }, // Never log actual token
          false,
          404
        );
      }

      // Use updateSession with the found session's ID
      const result = await this.updateSession(existingSession.id, updates);

      this.logOperation(
        'updateSessionByToken',
        performance.now() - startTime,
        true
      );
      return result;
    } catch (error) {
      this.logOperation(
        'updateSessionByToken',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'updateSessionByToken');
    }
  }

  // =============================================================================
  // Delete Operations
  // =============================================================================

  /**
   * Delete a session by its ID (logout)
   *
   * @param id - Session ID to delete
   * @returns Promise resolving to the deleted session
   * @throws {AdapterError} If session not found or API errors occur
   *
   * @example
   * ```typescript
   * const deletedSession = await sessionOps.deleteSession('session_123');
   * console.log('Deleted session for user:', deletedSession.userId);
   * ```
   */
  async deleteSession(id: string): Promise<BetterAuthSession> {
    const startTime = performance.now();

    try {
      if (!id || typeof id !== 'string') {
        throw new AdapterErrorClass(
          AdapterErrorCode.VALIDATION_ERROR,
          'Session ID must be a non-empty string',
          { id },
          false,
          400
        );
      }

      // Get session first to return it after deletion
      const existingSession = await this.findSessionById(id);
      if (!existingSession) {
        throw new AdapterErrorClass(
          AdapterErrorCode.NOT_FOUND,
          `Session with ID ${id} not found`,
          { id },
          false,
          404
        );
      }

      // Execute delete request
      const url = `${this.config.baseUrl}/${this.apiPath}/${id}`;
      await this.httpClient.delete(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      this.logOperation('deleteSession', performance.now() - startTime, true);
      return existingSession;
    } catch (error) {
      this.logOperation(
        'deleteSession',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'deleteSession');
    }
  }

  /**
   * Delete a session by its token (logout)
   *
   * @param sessionToken - Session token of the session to delete
   * @returns Promise resolving to the deleted session
   * @throws {AdapterError} If session not found, validation fails, or API errors occur
   *
   * @example
   * ```typescript
   * const deletedSession = await sessionOps.deleteSessionByToken('token_123');
   * console.log('User logged out:', deletedSession.userId);
   * ```
   */
  async deleteSessionByToken(sessionToken: string): Promise<BetterAuthSession> {
    const startTime = performance.now();

    try {
      // Find session by token first
      const existingSession = await this.findSessionByToken(sessionToken);
      if (!existingSession) {
        throw new AdapterErrorClass(
          AdapterErrorCode.NOT_FOUND,
          `Session with token not found`,
          { sessionToken: '[REDACTED]' }, // Never log actual token
          false,
          404
        );
      }

      // Use deleteSession with the found session's ID to actually delete it
      const result = await this.deleteSession(existingSession.id);

      this.logOperation(
        'deleteSessionByToken',
        performance.now() - startTime,
        true
      );
      return result;
    } catch (error) {
      this.logOperation(
        'deleteSessionByToken',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'deleteSessionByToken');
    }
  }

  /**
   * Delete all expired sessions (cleanup operation)
   *
   * @returns Promise resolving to the number of deleted sessions
   * @throws {AdapterError} If API errors occur
   *
   * @example
   * ```typescript
   * const deletedCount = await sessionOps.deleteExpiredSessions();
   * console.log(`Cleaned up ${deletedCount} expired sessions`);
   * ```
   */
  async deleteExpiredSessions(): Promise<number> {
    const startTime = performance.now();

    try {
      const now = new Date();

      // Find all expired sessions
      const allSessions = await this.findManySessions({
        where: {},
      });

      const expiredSessions = allSessions.filter(
        session => new Date(session.expiresAt) <= now
      );

      if (expiredSessions.length === 0) {
        this.logOperation(
          'deleteExpiredSessions',
          performance.now() - startTime,
          true
        );
        return 0;
      }

      // Delete each expired session
      let deletedCount = 0;
      for (const session of expiredSessions) {
        try {
          await this.deleteSession(session.id);
          deletedCount++;
        } catch (error) {
          // Log individual errors but continue
          if (this.config.logger) {
            this.config.logger.warn('Failed to delete expired session', {
              sessionId: session.id,
              error,
            });
          }
        }
      }

      this.logOperation(
        'deleteExpiredSessions',
        performance.now() - startTime,
        true
      );
      return deletedCount;
    } catch (error) {
      this.logOperation(
        'deleteExpiredSessions',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'deleteExpiredSessions');
    }
  }

  /**
   * Delete all sessions for a specific user
   *
   * @param userId - User ID to delete sessions for
   * @returns Promise resolving to the number of deleted sessions
   * @throws {AdapterError} If validation fails or API errors occur
   *
   * @example
   * ```typescript
   * const deletedCount = await sessionOps.deleteUserSessions('user_123');
   * console.log(`Deleted ${deletedCount} sessions for user`);
   * ```
   */
  async deleteUserSessions(userId: string): Promise<number> {
    const startTime = performance.now();

    try {
      if (!userId || typeof userId !== 'string') {
        throw new AdapterErrorClass(
          AdapterErrorCode.VALIDATION_ERROR,
          'User ID must be a non-empty string',
          { userId },
          false,
          400
        );
      }

      // Find all sessions for the user
      const userSessions = await this.findSessionsByUserId(userId);

      if (userSessions.length === 0) {
        this.logOperation(
          'deleteUserSessions',
          performance.now() - startTime,
          true
        );
        return 0;
      }

      // Delete each session
      let deletedCount = 0;
      for (const session of userSessions) {
        try {
          await this.deleteSession(session.id);
          deletedCount++;
        } catch (error) {
          // Log individual errors but continue
          if (this.config.logger) {
            this.config.logger.warn('Failed to delete user session', {
              sessionId: session.id,
              userId,
              error,
            });
          }
        }
      }

      this.logOperation(
        'deleteUserSessions',
        performance.now() - startTime,
        true
      );
      return deletedCount;
    } catch (error) {
      this.logOperation(
        'deleteUserSessions',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'deleteUserSessions');
    }
  }

  // =============================================================================
  // Validation and Utility Operations
  // =============================================================================

  /**
   * Validate a session token and check expiration
   *
   * @param sessionToken - Session token to validate
   * @returns Promise resolving to detailed validation result
   * @throws {AdapterError} If validation process fails (not if session is invalid)
   *
   * @example
   * ```typescript
   * const validation = await sessionOps.validateSession('token_123');
   * if (validation.isValid) {
   *   console.log('Valid session for user:', validation.session.userId);
   * } else if (validation.isExpired) {
   *   console.log('Session has expired');
   * } else {
   *   console.log('Session not found');
   * }
   * ```
   */
  async validateSession(
    sessionToken: string
  ): Promise<SessionValidationResult> {
    const startTime = performance.now();

    try {
      if (!sessionToken || typeof sessionToken !== 'string') {
        return {
          session: null,
          isValid: false,
          isExpired: false,
          error: 'Invalid session token format',
        };
      }

      // Basic token format validation
      if (!this.isValidTokenFormat(sessionToken)) {
        return {
          session: null,
          isValid: false,
          isExpired: false,
          error: 'Session token format is invalid',
        };
      }

      // Find the session
      const session = await this.findSessionByToken(sessionToken);

      if (!session) {
        this.logOperation(
          'validateSession',
          performance.now() - startTime,
          true
        );
        return {
          session: null,
          isValid: false,
          isExpired: false,
          error: 'Session not found',
        };
      }

      // Check expiration
      const now = new Date();
      const isExpired = new Date(session.expiresAt) <= now;

      const result: SessionValidationResult = {
        session,
        isValid: !isExpired,
        isExpired,
        ...(isExpired && { error: 'Session has expired' }),
      };

      this.logOperation('validateSession', performance.now() - startTime, true);
      return result;
    } catch (error) {
      this.logOperation(
        'validateSession',
        performance.now() - startTime,
        false,
        error
      );
      return {
        session: null,
        isValid: false,
        isExpired: false,
        error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Find multiple sessions with optional filtering and pagination
   *
   * @param options - Search options including filters, pagination, and sorting
   * @returns Promise resolving to an array of matching sessions
   * @throws {AdapterError} If API errors occur
   *
   * @example
   * ```typescript
   * const activeSessions = await sessionOps.findManySessions({
   *   activeOnly: true,
   *   pagination: { limit: 20, page: 1 },
   *   sort: { expiresAt: 'DESC' }
   * });
   * ```
   */
  async findManySessions(
    options: FindManySessionsOptions = {}
  ): Promise<BetterAuthSession[]> {
    const startTime = performance.now();

    try {
      // Build query with filters and options (for future query parameter implementation)
      this.queryTranslator.buildFindQuery(
        options.where || {},
        options.pagination,
        this.convertSortOptions(options.sort)
      );

      const url = `${this.config.baseUrl}/${this.apiPath}`;

      // Execute request
      const response = await this.httpClient.get<ApsoSession[]>(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      // Normalize and transform results
      const normalizedResults = this.responseNormalizer.normalizeArrayResponse(
        response
      ) as ApsoSession[];

      // Apply client-side filtering if needed
      let filteredResults = normalizedResults;
      if (options.where) {
        filteredResults = this.applyClientSideFiltering(
          normalizedResults,
          options.where
        );
      }

      // Filter out expired sessions if activeOnly is true
      if (options.activeOnly) {
        const now = new Date();
        filteredResults = filteredResults.filter(
          session => new Date(session.expiresAt) > now
        );
      }

      // Apply client-side pagination if needed
      if (options.pagination) {
        filteredResults = this.applyClientSidePagination(
          filteredResults,
          options.pagination
        );
      }

      // Transform results
      const transformedResults = filteredResults.map(session =>
        this.entityMapper.mapSessionFromApi(session)
      );

      this.logOperation(
        'findManySessions',
        performance.now() - startTime,
        true
      );
      return transformedResults;
    } catch (error) {
      this.logOperation(
        'findManySessions',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'findManySessions');
    }
  }

  /**
   * Count sessions matching optional filter criteria
   *
   * @param where - Optional filter criteria
   * @returns Promise resolving to the count of matching sessions
   * @throws {AdapterError} If API errors occur
   *
   * @example
   * ```typescript
   * const activeCount = await sessionOps.countSessions();
   * const userSessionCount = await sessionOps.countSessions({ userId: 'user_123' });
   * console.log(`Total: ${activeCount}, User: ${userSessionCount}`);
   * ```
   */
  async countSessions(where?: Partial<BetterAuthSession>): Promise<number> {
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
        this.logOperation('countSessions', performance.now() - startTime, true);
        return count;
      } catch (error) {
        // Fallback: get all records and count them
        const sessions = await this.findManySessions({ where: where || {} });
        const count = sessions.length;

        this.logOperation('countSessions', performance.now() - startTime, true);
        return count;
      }
    } catch (error) {
      this.logOperation(
        'countSessions',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'countSessions');
    }
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Check if a session has expired
   *
   * @param session - Session to check
   * @returns True if the session has expired
   *
   * @example
   * ```typescript
   * const session = await sessionOps.findSessionByToken('token_123');
   * if (session && sessionOps.isSessionExpired(session)) {
   *   console.log('Session has expired');
   * }
   * ```
   */
  isSessionExpired(session: BetterAuthSession): boolean {
    return new Date(session.expiresAt) <= new Date();
  }

  /**
   * Get time until session expires (in milliseconds)
   *
   * @param session - Session to check
   * @returns Milliseconds until expiration (negative if already expired)
   *
   * @example
   * ```typescript
   * const session = await sessionOps.findSessionByToken('token_123');
   * if (session) {
   *   const msUntilExpiry = sessionOps.getTimeUntilExpiration(session);
   *   console.log(`Session expires in ${Math.round(msUntilExpiry / 1000)} seconds`);
   * }
   * ```
   */
  getTimeUntilExpiration(session: BetterAuthSession): number {
    return new Date(session.expiresAt).getTime() - Date.now();
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Validate data for session creation
   */
  private validateCreateSessionData(sessionData: {
    sessionToken: string;
    userId: string;
    expiresAt: Date;
  }): void {
    const errors: ValidationError[] = [];

    if (
      !sessionData.sessionToken ||
      typeof sessionData.sessionToken !== 'string'
    ) {
      errors.push({
        field: 'sessionToken',
        message: 'Session token is required and must be a string',
      });
    }

    if (!sessionData.userId || typeof sessionData.userId !== 'string') {
      errors.push({
        field: 'userId',
        message: 'User ID is required and must be a string',
      });
    }

    if (!sessionData.expiresAt || !(sessionData.expiresAt instanceof Date)) {
      errors.push({
        field: 'expiresAt',
        message: 'Expiration date is required and must be a Date',
      });
    } else if (sessionData.expiresAt <= new Date()) {
      errors.push({
        field: 'expiresAt',
        message: 'Expiration date must be in the future',
      });
    }

    if (errors.length > 0) {
      throw new AdapterErrorClass(
        AdapterErrorCode.VALIDATION_ERROR,
        'Session creation validation failed',
        { errors },
        false,
        400
      );
    }
  }

  /**
   * Validate data for session updates
   */
  private validateUpdateSessionData(updates: Partial<BetterAuthSession>): void {
    const errors: ValidationError[] = [];

    if (
      updates.sessionToken !== undefined &&
      (typeof updates.sessionToken !== 'string' ||
        updates.sessionToken.trim() === '')
    ) {
      errors.push({
        field: 'sessionToken',
        message: 'Session token must be a non-empty string if provided',
      });
    }

    if (
      updates.userId !== undefined &&
      (typeof updates.userId !== 'string' || updates.userId.trim() === '')
    ) {
      errors.push({
        field: 'userId',
        message: 'User ID must be a non-empty string if provided',
      });
    }

    if (updates.expiresAt !== undefined) {
      if (!(updates.expiresAt instanceof Date)) {
        errors.push({
          field: 'expiresAt',
          message: 'Expiration date must be a Date if provided',
        });
      } else if (updates.expiresAt <= new Date()) {
        errors.push({
          field: 'expiresAt',
          message: 'Expiration date must be in the future if provided',
        });
      }
    }

    if (updates.id !== undefined) {
      errors.push({ field: 'id', message: 'Session ID cannot be updated' });
    }

    if (errors.length > 0) {
      throw new AdapterErrorClass(
        AdapterErrorCode.VALIDATION_ERROR,
        'Session update validation failed',
        { errors },
        false,
        400
      );
    }
  }

  /**
   * Validate session token format and security
   */
  private validateSessionToken(
    token: string,
    throwOnInvalid: boolean = true
  ): boolean {
    if (!this.isValidTokenFormat(token)) {
      if (throwOnInvalid) {
        throw new AdapterErrorClass(
          AdapterErrorCode.VALIDATION_ERROR,
          'Invalid session token format',
          { tokenLength: token.length },
          false,
          400
        );
      }
      return false;
    }
    return true;
  }

  /**
   * Check if token format is valid
   */
  private isValidTokenFormat(token: string): boolean {
    return (
      typeof token === 'string' &&
      token.length >= this.minTokenLength &&
      token.length <= this.maxTokenLength &&
      this.tokenPattern.test(token)
    );
  }

  /**
   * Check for session token conflicts
   */
  private async checkTokenConflict(
    sessionToken: string,
    excludeId?: string
  ): Promise<void> {
    const existingSession = await this.findSessionByToken(sessionToken);

    if (existingSession && existingSession.id !== excludeId) {
      throw new AdapterErrorClass(
        AdapterErrorCode.CONFLICT,
        'Session token already exists',
        { sessionId: existingSession.id },
        false,
        409
      );
    }
  }

  /**
   * Validate that user exists (optional check)
   */
  private async validateUserExists(userId: string): Promise<void> {
    // This is a placeholder - in a real implementation, you might check with UserOperations
    // or make a direct API call to validate the user exists
    if (this.config.logger) {
      this.config.logger.debug('User existence validation skipped', { userId });
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
          this.config.logger.warn('Failed to get tenant scope value', {
            error,
          });
        }
      }
    }

    return headers;
  }

  /**
   * Convert sort options to query translator format
   */
  private convertSortOptions(
    sort?: Record<string, 'ASC' | 'DESC'>
  ): Record<string, 'asc' | 'desc'> | undefined {
    if (!sort) return undefined;

    const converted: Record<string, 'asc' | 'desc'> = {};
    for (const [field, order] of Object.entries(sort)) {
      converted[field] = order.toLowerCase() as 'asc' | 'desc';
    }
    return converted;
  }

  /**
   * Apply client-side filtering (fallback when API doesn't support advanced filtering)
   */
  private applyClientSideFiltering(
    sessions: ApsoSession[],
    where: Partial<BetterAuthSession>
  ): ApsoSession[] {
    return sessions.filter(session => {
      for (const [key, value] of Object.entries(where)) {
        if (key === 'expiresAt' && value instanceof Date) {
          // Date comparison for expiresAt
          if (new Date(session.expiresAt).getTime() !== value.getTime()) {
            return false;
          }
        } else {
          // Direct comparison for other fields
          if ((session as any)[key] !== value) {
            return false;
          }
        }
      }
      return true;
    });
  }

  /**
   * Apply client-side pagination (fallback when API doesn't support pagination)
   */
  private applyClientSidePagination(
    sessions: ApsoSession[],
    pagination: CrudPagination
  ): ApsoSession[] {
    if (!pagination.limit) return sessions;

    const offset =
      pagination.offset || ((pagination.page || 1) - 1) * pagination.limit;
    return sessions.slice(offset, offset + pagination.limit);
  }

  /**
   * Check if error is a 404 Not Found error
   */
  private isNotFoundError(error: any): boolean {
    return (
      (error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 404) ||
      ('status' in error && error.status === 404) ||
      ('code' in error && error.code === 'NOT_FOUND')
    );
  }

  /**
   * Handle and normalize errors
   */
  private handleError(error: any, operation: string): AdapterError {
    // If it's already an AdapterError, just rethrow it
    if (error instanceof AdapterErrorClass) {
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

    const message = `Session ${operation} operation failed: ${
      error instanceof Error ? error.message : String(error)
    }`;

    if (this.config.logger) {
      this.config.logger.error(message, { error, operation });
    }

    return new AdapterErrorClass(
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
    return (
      this.config.retryConfig?.retryableStatuses?.includes(statusCode) ?? false
    );
  }

  /**
   * Log operation for observability
   */
  private logOperation(
    operation: string,
    duration: number,
    success: boolean,
    error?: any
  ): void {
    if (this.config.logger) {
      const logData = {
        operation: `SessionOperations.${operation}`,
        duration: Math.round(duration),
        success,
        ...(error && {
          error: error instanceof Error ? error.message : String(error),
        }),
      };

      if (success) {
        this.config.logger.debug('Session operation completed', logData);
      } else {
        this.config.logger.error('Session operation failed', logData);
      }
    }
  }
}
