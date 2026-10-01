/**
 * AccountOperations for handling account-related database operations
 *
 * This class provides methods for creating, reading, updating, and deleting
 * account records, which store authentication credentials (like password hashes)
 * for users.
 *
 * @example
 * ```typescript
 * const accountOps = new AccountOperations(config, httpClient, entityMapper, responseNormalizer);
 * const account = await accountOps.findAccountByUserId('user123');
 * ```
 */

import { HttpClient } from '../client/HttpClient';
import { EntityMapper } from '../response/EntityMapper';
import { ResponseNormalizer } from '../response/ResponseNormalizer';
import {
  BetterAuthAccount,
  ApsoAccount,
  AdapterError,
  AdapterErrorCode,
  ApiResponseWithStatus,
  Logger,
} from '../types/index';

/**
 * Compare a stored field to a where-clause value. The API returns numeric ids
 * (userId: 21) while BetterAuth passes strings ('21'), so strict equality
 * missed every match and findMany({ userId }) returned [].
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  return String(a) === String(b);
}

/** Where-clause keys the API can't compare reliably; matched in memory. */
const IN_MEMORY_ONLY_KEYS = new Set(['accountId']);
const PAGE_SIZE = 100;
/** Safety cap: 50 pages = 5,000 accounts per provider/user. */
const MAX_PAGES = 50;

/**
 * Configuration for AccountOperations
 */
export interface AccountOperationsConfig {
  baseUrl: string;
  timeout?: number;
  enableRetries?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  /** Shared adapter key sent as a bearer token to authenticate adapter calls. */
  apiKey?: string;
  /** Header name for the adapter key (defaults to Authorization). */
  authHeader?: string;
  logger?: Logger;
}

/**
 * AccountOperations class for handling account-related operations
 */
export class AccountOperations {
  private readonly config: AccountOperationsConfig;
  private readonly httpClient: HttpClient;
  private readonly entityMapper: EntityMapper;
  private readonly responseNormalizer: ResponseNormalizer;
  private readonly apiPath = 'accounts';

  constructor(
    config: AccountOperationsConfig,
    httpClient: HttpClient,
    entityMapper: EntityMapper,
    responseNormalizer: ResponseNormalizer
  ) {
    this.config = config;
    this.httpClient = httpClient;
    this.entityMapper = entityMapper;
    this.responseNormalizer = responseNormalizer;
  }

  // =============================================================================
  // Read Operations
  // =============================================================================

  /**
   * Find an account by its unique ID
   *
   * @param id - Account ID to search for
   * @returns Promise resolving to the account or null if not found
   * @throws {AdapterError} If API errors occur
   *
   * @example
   * ```typescript
   * const account = await accountOps.findAccountById('account123');
   * if (account) {
   *   console.log('Found account:', account.type);
   * }
   * ```
   */
  async findAccountById(id: string): Promise<BetterAuthAccount | null> {
    const startTime = performance.now();

    try {
      if (!id || typeof id !== 'string') {
        throw new AdapterError(
          AdapterErrorCode.VALIDATION_ERROR,
          'Account ID must be a non-empty string',
          { id },
          false,
          400
        );
      }

      const url = `${this.config.baseUrl}/${this.apiPath}/${id}`;

      let apiData: ApsoAccount;
      try {
        apiData = await this.httpClient.get<ApsoAccount>(url, {
          headers: this.buildHeaders(),
          ...(this.config.timeout && { timeout: this.config.timeout }),
        });
      } catch (error) {
        // HttpClient throws on non-2xx responses
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes('404') ||
          errorMessage.includes('Not Found')
        ) {
          return null;
        }
        throw error;
      }

      // Wrap in expected format for normalizer
      const wrappedResponse = { status: 200, data: apiData };

      const normalizedResponse =
        this.responseNormalizer.normalizeSingleResponse(wrappedResponse);
      const result = this.entityMapper.transformInbound(
        'account',
        normalizedResponse
      );

      this.logOperation('findAccountById', performance.now() - startTime, true);
      return result;
    } catch (error) {
      this.logOperation(
        'findAccountById',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'findAccountById');
    }
  }

  /**
   * Find an account by user ID
   *
   * @param userId - User ID to search for
   * @returns Promise resolving to the account or null if not found
   * @throws {AdapterError} If API errors occur
   *
   * @example
   * ```typescript
   * const account = await accountOps.findAccountByUserId('user123');
   * if (account) {
   *   console.log('Found account for user:', account.userId);
   * }
   * ```
   */
  async findAccountByUserId(userId: string): Promise<BetterAuthAccount | null> {
    const startTime = performance.now();

    try {
      if (!userId || typeof userId !== 'string') {
        throw new AdapterError(
          AdapterErrorCode.VALIDATION_ERROR,
          'User ID must be a non-empty string',
          { userId },
          false,
          400
        );
      }

      // Filter server-side; the in-memory match below stays as a safety net.
      const filter = encodeURIComponent(`userId||$eq||${userId}`);
      const url = `${this.config.baseUrl}/${this.apiPath}?filter=${filter}&limit=1`;

      const response = await this.httpClient.get<
        ApiResponseWithStatus<ApsoAccount[]>
      >(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      if (response.status !== 200) {
        throw new AdapterError(
          AdapterErrorCode.API_ERROR,
          `Account lookup failed with status ${response.status}`,
          { userId, status: response.status },
          true,
          response.status
        );
      }

      const normalizedResponse =
        this.responseNormalizer.normalizeArrayResponse(response);
      const accounts = this.entityMapper.transformInbound(
        'account',
        normalizedResponse
      ) as BetterAuthAccount[];

      // Find account with matching userId
      const matchingAccount = accounts.find(account =>
        sameValue(account.userId, userId)
      );

      this.logOperation(
        'findAccountByUserId',
        performance.now() - startTime,
        true
      );
      return matchingAccount || null;
    } catch (error) {
      this.logOperation(
        'findAccountByUserId',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'findAccountByUserId');
    }
  }

  /**
   * Find multiple accounts based on criteria
   *
   * @param options - Search criteria and pagination options
   * @returns Promise resolving to array of accounts
   * @throws {AdapterError} If API errors occur
   */
  async findManyAccounts(
    options: {
      where?: Record<string, any>;
      pagination?: { limit?: number; offset?: number };
    } = {}
  ): Promise<BetterAuthAccount[]> {
    const startTime = performance.now();

    try {
      // Narrow server-side by the where clause, except accountId: OAuth
      // provider account ids can be long digit strings (Google sends 21
      // digits) that the API coerces to a number, losing precision and
      // matching nothing, which broke Google sign-in in 2.0.18. accountId is
      // matched in memory below. Page through results: the API caps pages at
      // 100 rows, so a single request could miss the matching account.
      const params = Object.entries(options.where ?? {})
        .filter(
          ([key, value]) =>
            value !== undefined &&
            value !== null &&
            !IN_MEMORY_ONLY_KEYS.has(key)
        )
        .map(
          ([key, value]) =>
            `filter=${encodeURIComponent(`${key}||$eq||${String(value)}`)}`
        );

      const accounts: BetterAuthAccount[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${this.config.baseUrl}/${this.apiPath}?${[...params, `limit=${PAGE_SIZE}`, `page=${page}`].join('&')}`;
        const response = await this.httpClient.get<{ data: ApsoAccount[] }>(
          url,
          {
            headers: this.buildHeaders(),
            ...(this.config.timeout && { timeout: this.config.timeout }),
          }
        );
        const normalized =
          this.responseNormalizer.normalizeArrayResponse(response);
        const rows = Array.isArray(normalized) ? normalized : [normalized];
        for (const item of rows) {
          accounts.push(this.entityMapper.transformInbound('account', item));
        }
        if (rows.length < PAGE_SIZE) break;
      }

      // Apply filtering and pagination
      let filteredAccounts = accounts;

      if (options.where) {
        filteredAccounts = accounts.filter(account => {
          const matches = Object.entries(options.where!).every(
            ([key, value]) => {
              const accountValue = (account as any)[key];
              const isMatch = sameValue(accountValue, value);
              return isMatch;
            }
          );
          return matches;
        });
      }

      if (options.pagination?.limit) {
        const offset = options.pagination.offset || 0;
        filteredAccounts = filteredAccounts.slice(
          offset,
          offset + options.pagination.limit
        );
      }

      this.logOperation(
        'findManyAccounts',
        performance.now() - startTime,
        true
      );
      return filteredAccounts;
    } catch (error) {
      this.logOperation(
        'findManyAccounts',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'findManyAccounts');
    }
  }

  // =============================================================================
  // Create Operations
  // =============================================================================

  /**
   * Create a new account
   *
   * @param accountData - Account data to create
   * @returns Promise resolving to the created account
   * @throws {AdapterError} If validation fails or API errors occur
   *
   * @example
   * ```typescript
   * const account = await accountOps.createAccount({
   *   userId: 'user123',
   *   type: 'credential',
   *   provider: 'credential',
   *   providerAccountId: 'user123',
   *   password: 'hashed-password'
   * });
   * ```
   */
  async createAccount(
    accountData: Partial<BetterAuthAccount>
  ): Promise<BetterAuthAccount> {
    const startTime = performance.now();

    try {
      // Do NOT include ID - let the backend auto-generate it (SERIAL/integer)
      // Create account data without ID to let backend generate it
      const accountDataWithId = {
        ...accountData,
        id: '', // Empty ID tells EntityMapper to skip ID in API request
      };

      // Transform account data to API format
      const transformedData = this.entityMapper.transformOutbound(
        'account',
        accountDataWithId
      );
      const url = `${this.config.baseUrl}/${this.apiPath}`;

      const response = await this.httpClient.post<
        ApiResponseWithStatus<ApsoAccount>
      >(url, transformedData, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      // HttpClient already handles error responses internally, no need to check status
      const normalizedResponse =
        this.responseNormalizer.normalizeSingleResponse(response);
      const result = this.entityMapper.transformInbound(
        'account',
        normalizedResponse
      );

      this.logOperation('createAccount', performance.now() - startTime, true);
      return result;
    } catch (error: any) {
      // Handle duplicate key error - return existing account instead of failing
      // This happens when the account already exists (e.g., re-linking OAuth)
      const errorMessage =
        error?.message || error?.details?.message || String(error);
      if (
        errorMessage.includes('duplicate key') ||
        errorMessage.includes('unique constraint')
      ) {
        // Try to find the existing account by providerId + accountId
        const providerId = accountData.providerId;
        const accountId = accountData.accountId;

        if (providerId && accountId) {
          try {
            const existingAccounts = await this.findManyAccounts({
              where: { providerId, accountId },
              pagination: { limit: 1 },
            });

            if (existingAccounts.length > 0 && existingAccounts[0]) {
              this.logOperation(
                'createAccount',
                performance.now() - startTime,
                true
              );
              return existingAccounts[0]!;
            }
          } catch {
            // Lookup of an existing account is best-effort; create below.
          }
        }
      }

      this.logOperation(
        'createAccount',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'createAccount');
    }
  }

  // =============================================================================
  // Update Operations
  // =============================================================================

  /**
   * Update an account by ID
   *
   * @param id - Account ID to update
   * @param updateData - Data to update
   * @returns Promise resolving to the updated account
   * @throws {AdapterError} If validation fails or API errors occur
   */
  async updateAccount(
    id: string,
    updateData: Partial<BetterAuthAccount>
  ): Promise<BetterAuthAccount> {
    const startTime = performance.now();

    try {
      // Use partial transform to avoid setting defaults for fields not being updated
      const transformedData =
        this.entityMapper.mapAccountPartialToApi(updateData);
      const url = `${this.config.baseUrl}/${this.apiPath}/${id}`;

      // HttpClient returns raw JSON, not { status, data }
      const apiData = await this.httpClient.patch<ApsoAccount>(
        url,
        transformedData,
        {
          headers: this.buildHeaders(),
          ...(this.config.timeout && { timeout: this.config.timeout }),
        }
      );

      // Wrap in expected format for normalizer
      const wrappedResponse = { status: 200, data: apiData };
      const normalizedResponse =
        this.responseNormalizer.normalizeSingleResponse(wrappedResponse);
      const result = this.entityMapper.transformInbound(
        'account',
        normalizedResponse
      );

      this.logOperation('updateAccount', performance.now() - startTime, true);
      return result;
    } catch (error) {
      this.logOperation(
        'updateAccount',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'updateAccount');
    }
  }

  // =============================================================================
  // Delete Operations
  // =============================================================================

  /**
   * Delete an account by ID
   *
   * @param id - Account ID to delete
   * @returns Promise resolving when deletion is complete
   * @throws {AdapterError} If API errors occur
   */
  async deleteAccount(id: string): Promise<void> {
    const startTime = performance.now();

    try {
      const url = `${this.config.baseUrl}/${this.apiPath}/${id}`;

      const response = await this.httpClient.delete<
        ApiResponseWithStatus<void>
      >(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      if (response.status !== 204 && response.status !== 200) {
        throw new AdapterError(
          AdapterErrorCode.API_ERROR,
          `Account deletion failed with status ${response.status}`,
          { id, status: response.status },
          true,
          response.status
        );
      }

      this.logOperation('deleteAccount', performance.now() - startTime, true);
    } catch (error) {
      this.logOperation(
        'deleteAccount',
        performance.now() - startTime,
        false,
        error
      );
      throw this.handleError(error, 'deleteAccount');
    }
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Build HTTP headers for API requests
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Authenticate adapter calls the same way UserOperations does. Without
    // this, account creation hits the server unauthenticated (401) once the
    // server stops exposing /accounts publicly.
    if (this.config.apiKey) {
      const authHeader = this.config.authHeader || 'Authorization';
      headers[authHeader] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * Log operation metrics
   */
  private logOperation(
    operation: string,
    duration: number,
    success: boolean,
    error?: any
  ): void {
    const logData = { operation, duration, success };
    if (success) {
      this.config.logger?.debug('Account operation completed', logData);
    } else {
      this.config.logger?.error('Account operation failed', {
        ...logData,
        error,
      });
    }
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: any, operation: string): AdapterError {
    if (error instanceof AdapterError) {
      return error;
    }

    return new AdapterError(
      AdapterErrorCode.UNKNOWN,
      `Account ${operation} operation failed: ${error?.message || error}`,
      error,
      true
    );
  }
}
