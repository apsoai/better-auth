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
} from '../types/index';

/**
 * Configuration for AccountOperations
 */
export interface AccountOperationsConfig {
  baseUrl: string;
  timeout?: number;
  enableRetries?: boolean;
  maxRetries?: number;
  retryDelay?: number;
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

    console.log('🔍 [SIGN-IN DEBUG] findAccountById called with id:', id);

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
      console.log('🔍 [SIGN-IN DEBUG] Making API request to:', url);

      const response = await this.httpClient.get<
        ApiResponseWithStatus<ApsoAccount>
      >(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      console.log('🔍 [SIGN-IN DEBUG] API response status:', response.status);
      console.log('🔍 [SIGN-IN DEBUG] API response data:', response.data);

      if (response.status === 404) {
        console.log('🔍 [SIGN-IN DEBUG] Account not found');
        return null;
      }

      if (response.status !== 200) {
        throw new AdapterError(
          AdapterErrorCode.API_ERROR,
          `Account lookup failed with status ${response.status}`,
          { id, status: response.status },
          true,
          response.status
        );
      }

      const normalizedResponse =
        this.responseNormalizer.normalizeSingleResponse(response);
      const result = this.entityMapper.transformInbound(
        'account',
        normalizedResponse
      );

      console.log(
        '🔍 [SIGN-IN DEBUG] findAccountById result:',
        result
          ? { id: result.id, userId: result.userId, type: result.type }
          : 'null'
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

    console.log(
      '🔍 [SIGN-IN DEBUG] findAccountByUserId called with userId:',
      userId
    );

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

      // Use limit=10000 to fetch all accounts (pagination workaround)
      const url = `${this.config.baseUrl}/${this.apiPath}?limit=10000`;
      console.log('🔍 [SIGN-IN DEBUG] Making API request to:', url);

      // Get all accounts and filter by userId (in a real implementation, we'd use query parameters)
      const response = await this.httpClient.get<
        ApiResponseWithStatus<ApsoAccount[]>
      >(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      console.log('🔍 [SIGN-IN DEBUG] API response status:', response.status);
      console.log('🔍 [SIGN-IN DEBUG] API response data:', response.data);

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
      const matchingAccount = accounts.find(
        account => account.userId === userId
      );

      console.log(
        '🔍 [SIGN-IN DEBUG] findAccountByUserId - found accounts:',
        accounts.map(a => ({ id: a.id, userId: a.userId, type: a.type }))
      );
      console.log(
        '🔍 [SIGN-IN DEBUG] findAccountByUserId - matching account:',
        matchingAccount
          ? {
              id: matchingAccount.id,
              userId: matchingAccount.userId,
              type: matchingAccount.type,
            }
          : 'null'
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
      // Use limit=10000 to fetch all accounts (pagination workaround)
      const url = `${this.config.baseUrl}/${this.apiPath}?limit=10000`;
      console.log('🔍 [SIGN-IN DEBUG] findManyAccounts request to:', url);

      const response = await this.httpClient.get<{ data: ApsoAccount[] }>(url, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      console.log(
        '🔍 [SIGN-IN DEBUG] findManyAccounts response:',
        response && (response as any).data
          ? `Object with data array of ${(response as any).data.length} items`
          : typeof response
      );

      // HttpClient returns the full API response {data: [...], meta: {...}}
      // The normalizer expects this structure
      const normalizedResponse =
        this.responseNormalizer.normalizeArrayResponse(response);

      console.log(
        '🔍 [SIGN-IN DEBUG] normalizedResponse type:',
        Array.isArray(normalizedResponse) ? 'array' : typeof normalizedResponse
      );
      console.log(
        '🔍 [SIGN-IN DEBUG] normalizedResponse length:',
        Array.isArray(normalizedResponse) ? normalizedResponse.length : 'N/A'
      );

      // transformInbound expects an array for bulk transforms
      let accounts: BetterAuthAccount[];
      if (Array.isArray(normalizedResponse)) {
        accounts = normalizedResponse.map(item =>
          this.entityMapper.transformInbound('account', item)
        );
      } else {
        // Single item transform
        accounts = [
          this.entityMapper.transformInbound('account', normalizedResponse),
        ];
      }

      console.log(
        '🔍 [SIGN-IN DEBUG] accounts type:',
        Array.isArray(accounts) ? 'array' : typeof accounts
      );
      console.log(
        '🔍 [SIGN-IN DEBUG] accounts length:',
        Array.isArray(accounts) ? accounts.length : 'N/A'
      );

      // Apply filtering and pagination
      let filteredAccounts = accounts;

      if (options.where) {
        filteredAccounts = accounts.filter(account => {
          return Object.entries(options.where!).every(([key, value]) => {
            return (account as any)[key] === value;
          });
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
      console.log(
        '🔍 [SIGN-IN DEBUG] createAccount called with data:',
        JSON.stringify(accountData, null, 2)
      );

      // Generate a proper UUID for the account ID if not provided
      const accountId = accountData.id || this.generateUUID();

      // Create account data with UUID
      const accountDataWithId = {
        ...accountData,
        id: accountId,
      };

      // Transform account data to API format
      const transformedData = this.entityMapper.transformOutbound(
        'account',
        accountDataWithId
      );
      const url = `${this.config.baseUrl}/${this.apiPath}`;

      console.log('🔍 [SIGN-IN DEBUG] Creating account at:', url);
      console.log('🔍 [SIGN-IN DEBUG] Account data:', transformedData);

      const response = await this.httpClient.post<
        ApiResponseWithStatus<ApsoAccount>
      >(url, transformedData, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      console.log('🔍 [SIGN-IN DEBUG] Account creation response:', response);

      // HttpClient already handles error responses internally, no need to check status
      const normalizedResponse =
        this.responseNormalizer.normalizeSingleResponse(response);
      const result = this.entityMapper.transformInbound(
        'account',
        normalizedResponse
      );

      this.logOperation('createAccount', performance.now() - startTime, true);
      return result;
    } catch (error) {
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
      const transformedData = this.entityMapper.transformOutbound(
        'account',
        updateData
      );
      const url = `${this.config.baseUrl}/${this.apiPath}/${id}`;

      const response = await this.httpClient.put<
        ApiResponseWithStatus<ApsoAccount>
      >(url, transformedData, {
        headers: this.buildHeaders(),
        ...(this.config.timeout && { timeout: this.config.timeout }),
      });

      if (response.status !== 200) {
        throw new AdapterError(
          AdapterErrorCode.API_ERROR,
          `Account update failed with status ${response.status}`,
          { id, updateData, status: response.status },
          true,
          response.status
        );
      }

      const normalizedResponse =
        this.responseNormalizer.normalizeSingleResponse(response);
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
   * Generate a proper UUID v4
   */
  private generateUUID(): string {
    // Generate a proper UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Build HTTP headers for API requests
   */
  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
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
    if (success) {
      console.log(
        `✅ [AccountOps] ${operation} completed in ${duration.toFixed(2)}ms`
      );
    } else {
      console.log(
        `❌ [AccountOps] ${operation} failed in ${duration.toFixed(2)}ms:`,
        error?.message || error
      );
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
