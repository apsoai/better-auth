/**
 * Response Normalizer Implementation
 * 
 * This class handles the normalization of various response formats from the Apso API.
 * It supports both array responses and paginated responses, extracting data and metadata
 * consistently regardless of the response format.
 * 
 * @class ResponseNormalizer
 * @description Provides methods to normalize API responses from different formats into
 * consistent structures expected by Better Auth adapter operations.
 * 
 * Supported Response Formats:
 * - Direct arrays: [item1, item2, item3]
 * - Paginated responses: { data: [...], meta: {...} }
 * - API wrapper responses: { data: [...] }
 * - Single item responses: { id: 1, name: 'item' }
 * - Error responses and empty results
 */

import type {
  ApiResponse,
  PaginatedResponse,
  ResponseMeta,
  PaginationMeta,
  Logger,
} from '../types';

/**
 * Represents metadata extracted from paginated responses
 */
export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  hasMore: boolean;
}

/**
 * Supported operation types for response normalization
 */
export type OperationType = 'findOne' | 'findMany' | 'count';

/**
 * Configuration options for response normalization
 */
export interface NormalizationOptions {
  /** Whether to throw errors for malformed responses */
  strict?: boolean;
  /** Default page size for pagination calculations */
  defaultPageSize?: number;
  /** Whether to log normalization warnings */
  logWarnings?: boolean;
}

/**
 * Enhanced Response Normalizer for Apso SDK responses
 * 
 * Provides comprehensive normalization of API responses from various formats
 * into consistent structures expected by Better Auth operations.
 */
export class ResponseNormalizer {
  private readonly logger?: Logger;

  constructor(logger?: Logger) {
    if (logger !== undefined) {
      this.logger = logger;
    }
  }

  // =============================================================================
  // Main Normalization Methods
  // =============================================================================

  /**
   * Normalizes any response format to an array of items
   * 
   * @template T The expected item type
   * @param response The raw response from the API
   * @param options Optional normalization configuration
   * @returns Array of normalized items
   * 
   * @example
   * ```typescript
   * // Direct array
   * normalizeToArray([{id: 1}, {id: 2}]) // Returns [{id: 1}, {id: 2}]
   * 
   * // Paginated response
   * normalizeToArray({ data: [{id: 1}], meta: {...} }) // Returns [{id: 1}]
   * 
   * // API wrapper
   * normalizeToArray({ data: [{id: 1}] }) // Returns [{id: 1}]
   * ```
   */
  normalizeToArray<T>(response: unknown, options?: NormalizationOptions): T[] {
    const opts = { strict: false, logWarnings: true, ...options };
    
    try {
      // Handle null/undefined responses
      if (response === null || response === undefined) {
        if (opts.logWarnings) {
          this.logger?.debug('Received null/undefined response, returning empty array');
        }
        return [];
      }

      // Direct array response
      if (this.isDirectArray(response)) {
        this.logger?.debug('Normalized direct array response', { itemCount: response.length });
        return response as T[];
      }

      // Paginated response format
      if (this.isPaginatedResponse(response)) {
        const items = response.data as T[];
        this.logger?.debug('Normalized paginated response', { 
          itemCount: items.length,
          total: response.meta?.total 
        });
        return items;
      }

      // API wrapper response
      if (this.isApiResponse(response)) {
        const data = response.data;
        
        // Nested array in API response
        if (Array.isArray(data)) {
          this.logger?.debug('Normalized API wrapper with array data', { itemCount: data.length });
          return data as T[];
        }
        
        // Nested paginated response in API wrapper
        if (this.isPaginatedResponse(data)) {
          const items = data.data as T[];
          this.logger?.debug('Normalized nested paginated response', { 
            itemCount: items.length,
            total: data.meta?.total 
          });
          return items;
        }
        
        // Single item in API wrapper - convert to array
        if (data && typeof data === 'object') {
          this.logger?.debug('Normalized single item in API wrapper to array');
          return [data as T];
        }
      }

      // Handle common wrapper patterns
      if (response && typeof response === 'object') {
        const responseObj = response as Record<string, any>;
        
        // Check for 'items' property
        if (responseObj.items && Array.isArray(responseObj.items)) {
          this.logger?.debug('Normalized items property', { itemCount: responseObj.items.length });
          return responseObj.items as T[];
        }
        
        // Check for 'results' property
        if (responseObj.results && Array.isArray(responseObj.results)) {
          this.logger?.debug('Normalized results property', { itemCount: responseObj.results.length });
          return responseObj.results as T[];
        }
        
        // Check for 'records' property
        if (responseObj.records && Array.isArray(responseObj.records)) {
          this.logger?.debug('Normalized records property', { itemCount: responseObj.records.length });
          return responseObj.records as T[];
        }
        
        // Single object response - convert to array
        if (!Array.isArray(responseObj) && Object.keys(responseObj).length > 0) {
          this.logger?.debug('Normalized single object to array');
          return [responseObj as T];
        }
      }

      // Primitive values - return empty array
      if (typeof response !== 'object') {
        if (opts.logWarnings) {
          this.logger?.warn('Received primitive value for array normalization', { 
            type: typeof response, 
            value: response 
          });
        }
        return [];
      }

      // Fallback for unrecognized formats
      if (opts.logWarnings) {
        this.logger?.warn('Unable to normalize response to array, unknown format', { 
          responseType: typeof response,
          hasData: response && typeof response === 'object' && 'data' in response,
          keys: response && typeof response === 'object' ? Object.keys(response) : []
        });
      }
      
      if (opts.strict) {
        throw new Error('Unable to normalize response to array format');
      }
      
      return [];
      
    } catch (error) {
      this.logger?.error('Error during array normalization', { error, response });
      
      if (opts.strict) {
        throw error;
      }
      
      return [];
    }
  }

  /**
   * Extracts a single item from any response format, returning null if not found
   * 
   * @template T The expected item type
   * @param response The raw response from the API
   * @param options Optional normalization configuration
   * @returns Single normalized item or null
   * 
   * @example
   * ```typescript
   * // Direct object
   * extractSingleItem({id: 1, name: 'user'}) // Returns {id: 1, name: 'user'}
   * 
   * // Array with items
   * extractSingleItem([{id: 1}, {id: 2}]) // Returns {id: 1} (first item)
   * 
   * // Paginated response
   * extractSingleItem({ data: [{id: 1}], meta: {...} }) // Returns {id: 1}
   * 
   * // Empty results
   * extractSingleItem([]) // Returns null
   * extractSingleItem({ data: [], meta: {...} }) // Returns null
   * ```
   */
  extractSingleItem<T>(response: unknown, options?: NormalizationOptions): T | null {
    const opts = { strict: false, logWarnings: true, ...options };
    
    try {
      // Handle null/undefined responses
      if (response === null || response === undefined) {
        this.logger?.debug('Received null/undefined response for single item extraction');
        return null;
      }

      // API wrapper response
      if (this.isApiResponse(response)) {
        this.logger?.debug('Extracting single item from API wrapper response');
        return this.extractSingleItem<T>(response.data, { ...opts, logWarnings: false });
      }

      // Array response - take first item
      if (Array.isArray(response)) {
        if (response.length === 0) {
          this.logger?.debug('Array response is empty, returning null');
          return null;
        }
        
        const firstItem = response[0] as T;
        this.logger?.debug('Extracted first item from array response', { 
          totalItems: response.length,
          hasItem: firstItem !== null && firstItem !== undefined
        });
        return firstItem;
      }

      // Paginated response - take first item from data array
      if (this.isPaginatedResponse(response)) {
        const items = response.data;
        
        if (items.length === 0) {
          this.logger?.debug('Paginated response data is empty, returning null');
          return null;
        }
        
        const firstItem = items[0] as T;
        this.logger?.debug('Extracted first item from paginated response', {
          totalItems: items.length,
          totalCount: response.meta?.total,
          hasItem: firstItem !== null && firstItem !== undefined
        });
        return firstItem;
      }

      // Handle common wrapper patterns
      if (response && typeof response === 'object') {
        const responseObj = response as Record<string, any>;
        
        // Check for array properties and extract first item
        const arrayProperties = ['items', 'results', 'records', 'data'];
        
        for (const prop of arrayProperties) {
          if (responseObj[prop] && Array.isArray(responseObj[prop])) {
            const items = responseObj[prop] as T[];
            if (items.length > 0) {
              this.logger?.debug(`Extracted first item from ${prop} property`, { totalItems: items.length });
              return items[0] ?? null;
            } else {
              this.logger?.debug(`${prop} property is empty array, returning null`);
              return null;
            }
          }
        }
      }

      // Direct object response (not an array or wrapper)
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        const responseObj = response as Record<string, any>;
        
        // Skip empty objects
        if (Object.keys(responseObj).length === 0) {
          this.logger?.debug('Received empty object, returning null');
          return null;
        }
        
        this.logger?.debug('Returning direct object response as single item');
        return responseObj as T;
      }

      // Primitive values
      if (typeof response !== 'object') {
        if (opts.logWarnings) {
          this.logger?.warn('Received primitive value for single item extraction', { 
            type: typeof response, 
            value: response 
          });
        }
        return null;
      }

      // Fallback for unrecognized formats
      if (opts.logWarnings) {
        this.logger?.warn('Unable to extract single item, unknown response format', { 
          responseType: typeof response,
          isArray: Array.isArray(response),
          keys: response && typeof response === 'object' ? Object.keys(response) : []
        });
      }
      
      if (opts.strict) {
        throw new Error('Unable to extract single item from response format');
      }
      
      return null;
      
    } catch (error) {
      this.logger?.error('Error during single item extraction', { error, response });
      
      if (opts.strict) {
        throw error;
      }
      
      return null;
    }
  }

  /**
   * Normalizes any response to extract count information
   * 
   * @param response The raw response from the API
   * @param options Optional normalization configuration
   * @returns The count as a number, or 0 if no count found
   * 
   * @example
   * ```typescript
   * // Paginated response
   * normalizeCount({ data: [...], meta: { total: 100 } }) // Returns 100
   * 
   * // Direct count
   * normalizeCount({ count: 50 }) // Returns 50
   * 
   * // Array length
   * normalizeCount([1, 2, 3]) // Returns 3
   * 
   * // Number response
   * normalizeCount(42) // Returns 42
   * ```
   */
  normalizeCount(response: unknown, options?: NormalizationOptions): number {
    const opts = { strict: false, logWarnings: true, ...options };
    
    try {
      // Handle null/undefined responses
      if (response === null || response === undefined) {
        this.logger?.debug('Received null/undefined response for count, returning 0');
        return 0;
      }

      // Direct number response
      if (typeof response === 'number') {
        if (response < 0) {
          if (opts.logWarnings) {
            this.logger?.warn('Received negative count, using 0 instead', { count: response });
          }
          return 0;
        }
        this.logger?.debug('Using direct number response as count', { count: response });
        return Math.floor(response); // Ensure integer
      }

      // Paginated response with meta.total
      if (this.isPaginatedResponse(response)) {
        const total = response.meta?.total;
        if (typeof total === 'number') {
          this.logger?.debug('Extracted count from paginated response meta', { total });
          return Math.max(0, Math.floor(total));
        }
      }

      // API wrapper response
      if (this.isApiResponse(response)) {
        this.logger?.debug('Extracting count from API wrapper response');
        return this.normalizeCount(response.data, { ...opts, logWarnings: false });
      }

      // Object with count fields
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        const responseObj = response as Record<string, any>;
        
        // Priority order for count field names
        const countFields = ['total', 'count', 'totalCount', 'totalRecords', 'length', 'size'];
        
        for (const field of countFields) {
          const value = responseObj[field];
          if (typeof value === 'number') {
            const count = Math.max(0, Math.floor(value));
            this.logger?.debug(`Extracted count from ${field} field`, { count });
            return count;
          }
        }
        
        // Check if response has a data array we can count
        if (Array.isArray(responseObj.data)) {
          const count = responseObj.data.length;
          this.logger?.debug('Using data array length as count', { count });
          return count;
        }
        
        // Check for other array properties
        const arrayFields = ['items', 'results', 'records'];
        for (const field of arrayFields) {
          if (Array.isArray(responseObj[field])) {
            const count = responseObj[field].length;
            this.logger?.debug(`Using ${field} array length as count`, { count });
            return count;
          }
        }
      }

      // Direct array response
      if (Array.isArray(response)) {
        const count = response.length;
        this.logger?.debug('Using array length as count', { count });
        return count;
      }

      // String that might be a number
      if (typeof response === 'string') {
        const parsed = parseInt(response, 10);
        if (!isNaN(parsed) && isFinite(parsed)) {
          const count = Math.max(0, parsed);
          if (opts.logWarnings) {
            this.logger?.warn('Parsed string as count', { original: response, parsed: count });
          }
          return count;
        }
      }

      // Fallback for unrecognized formats
      if (opts.logWarnings) {
        this.logger?.warn('Unable to extract count from response, returning 0', { 
          responseType: typeof response,
          isArray: Array.isArray(response),
          keys: response && typeof response === 'object' ? Object.keys(response) : []
        });
      }
      
      if (opts.strict) {
        throw new Error('Unable to extract count from response format');
      }
      
      return 0;
      
    } catch (error) {
      this.logger?.error('Error during count normalization', { error, response });
      
      if (opts.strict) {
        throw error;
      }
      
      return 0;
    }
  }

  /**
   * Main response normalization method that handles different operation types
   * 
   * @template T The expected return type
   * @param response The raw response from the API
   * @param operation The type of operation being performed
   * @param options Optional normalization configuration
   * @returns Normalized response based on operation type
   * 
   * @example
   * ```typescript
   * // Find one operation
   * normalizeResponse(response, 'findOne') // Returns T | null
   * 
   * // Find many operation
   * normalizeResponse(response, 'findMany') // Returns T[]
   * 
   * // Count operation
   * normalizeResponse(response, 'count') // Returns number
   * ```
   */
  normalizeResponse<T>(
    response: unknown, 
    operation: OperationType,
    options?: NormalizationOptions
  ): T | T[] | number | null {
    const opts = { strict: false, logWarnings: true, ...options };
    
    try {
      this.logger?.debug('Normalizing response for operation', { operation, responseType: typeof response });
      
      switch (operation) {
        case 'findOne':
          return this.extractSingleItem<T>(response, opts);
          
        case 'findMany':
          return this.normalizeToArray<T>(response, opts);
          
        case 'count':
          return this.normalizeCount(response, opts);
          
        default:
          if (opts.logWarnings) {
            this.logger?.warn('Unknown operation type, defaulting to findMany behavior', { operation });
          }
          return this.normalizeToArray<T>(response, opts);
      }
      
    } catch (error) {
      this.logger?.error('Error during response normalization', { error, operation, response });
      
      if (opts.strict) {
        throw error;
      }
      
      // Return safe defaults based on operation
      switch (operation) {
        case 'findOne':
          return null;
        case 'findMany':
          return [];
        case 'count':
          return 0;
        default:
          return [];
      }
    }
  }

  // =============================================================================
  // Metadata Extraction
  // =============================================================================

  /**
   * Extracts pagination metadata from any response format
   * 
   * @param response The raw response from the API
   * @param options Optional normalization configuration
   * @returns Extracted pagination metadata or null if not found
   * 
   * @example
   * ```typescript
   * // Paginated response
   * extractMetadata({ 
   *   data: [...], 
   *   meta: { total: 100, page: 1, limit: 20 } 
   * }) // Returns PaginationMetadata object
   * ```
   */
  extractMetadata(response: unknown, options?: NormalizationOptions): PaginationMetadata | null {
    const opts = { strict: false, logWarnings: true, defaultPageSize: 20, ...options };
    
    try {
      // Handle null/undefined responses
      if (response === null || response === undefined) {
        return null;
      }

      let meta: any = null;

      // Extract meta from paginated response
      if (this.isPaginatedResponse(response)) {
        meta = response.meta;
      }
      // Extract meta from API response
      else if (this.isApiResponse(response) && response.meta) {
        meta = response.meta;
      }
      // Check for direct meta object in response
      else if (response && typeof response === 'object') {
        const responseObj = response as Record<string, any>;
        
        // Look for meta field
        if (responseObj.meta && typeof responseObj.meta === 'object') {
          meta = responseObj.meta;
        }
        // Look for pagination fields directly in response
        else if (responseObj.total !== undefined || responseObj.page !== undefined) {
          meta = responseObj;
        }
      }

      if (!meta || typeof meta !== 'object') {
        return null;
      }

      // Extract required fields
      const total = typeof meta.total === 'number' ? meta.total : 
                   typeof meta.totalCount === 'number' ? meta.totalCount :
                   typeof meta.count === 'number' ? meta.count : null;
      
      const page = typeof meta.page === 'number' ? meta.page :
                  typeof meta.currentPage === 'number' ? meta.currentPage :
                  typeof meta.pageNumber === 'number' ? meta.pageNumber : null;
      
      const limit = typeof meta.limit === 'number' ? meta.limit :
                   typeof meta.pageSize === 'number' ? meta.pageSize :
                   typeof meta.perPage === 'number' ? meta.perPage :
                   opts.defaultPageSize;

      // Validate required fields
      if (total === null || page === null || !limit) {
        if (opts.logWarnings) {
          this.logger?.debug('Incomplete pagination metadata', { 
            hasTotal: total !== null,
            hasPage: page !== null,
            hasLimit: !!limit,
            meta
          });
        }
        return null;
      }

      // Calculate derived fields
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      const hasMore = hasNext; // Alias for hasNext

      const paginationMetadata: PaginationMetadata = {
        total: Math.max(0, total),
        page: Math.max(1, page),
        limit: Math.max(1, limit),
        totalPages,
        hasNext,
        hasPrev,
        hasMore
      };

      this.logger?.debug('Extracted pagination metadata', paginationMetadata);
      return paginationMetadata;
      
    } catch (error) {
      this.logger?.error('Error during metadata extraction', { error, response });
      
      if (opts.strict) {
        throw error;
      }
      
      return null;
    }
  }

  // =============================================================================
  // Error Handling
  // =============================================================================

  /**
   * Handles 404/not found responses consistently
   * 
   * @template T The expected return type
   * @param operation The operation type that resulted in not found
   * @returns Appropriate null/empty response based on operation
   */
  handleNotFound<T>(operation: OperationType = 'findOne'): T | T[] | number | null {
    this.logger?.debug('Handling not found response', { operation });
    
    switch (operation) {
      case 'findOne':
        return null;
      case 'findMany':
        return [] as T[];
      case 'count':
        return 0;
      default:
        return null;
    }
  }

  /**
   * Handles empty responses consistently
   * 
   * @template T The expected array item type
   * @returns Empty array for list responses
   */
  handleEmpty<T>(): T[] {
    this.logger?.debug('Handling empty response');
    return [];
  }

  /**
   * Handles malformed responses with comprehensive error reporting
   * 
   * @param response The malformed response
   * @param operation The operation that failed
   * @param error The error that occurred
   * @param options Error handling options
   * @returns Safe fallback value or throws error
   */
  handleMalformedResponse<T>(
    response: unknown,
    operation: OperationType,
    error: Error,
    options: { strict?: boolean; fallback?: any } = {}
  ): T | T[] | number | null {
    const { strict = false, fallback } = options;
    
    const errorContext = {
      operation,
      error: error.message,
      responseStructure: this.debugResponseStructure(response),
      stack: error.stack
    };
    
    this.logger?.error('Malformed response detected', errorContext);
    
    if (strict) {
      throw new Error(`ResponseNormalizer: Unable to handle malformed response for ${operation}: ${error.message}`);
    }
    
    if (fallback !== undefined) {
      return fallback;
    }
    
    // Return safe defaults
    return this.handleNotFound<T>(operation);
  }

  /**
   * Handles network or API errors during response processing
   * 
   * @param error The network/API error
   * @param operation The operation that failed
   * @param options Error handling options
   * @returns Safe fallback value or throws error
   */
  handleApiError<T>(
    error: Error,
    operation: OperationType,
    options: { strict?: boolean; retryable?: boolean } = {}
  ): T | T[] | number | null {
    const { strict = false, retryable = false } = options;
    
    this.logger?.error('API error during response processing', {
      operation,
      error: error.message,
      retryable,
      stack: error.stack
    });
    
    if (strict) {
      throw error;
    }
    
    // Return safe defaults for non-strict mode
    return this.handleNotFound<T>(operation);
  }

  /**
   * Handles timeout errors during response processing
   * 
   * @param operation The operation that timed out
   * @param timeoutMs The timeout duration
   * @returns Safe fallback value
   */
  handleTimeout<T>(operation: OperationType, timeoutMs: number): T | T[] | number | null {
    this.logger?.warn('Response processing timeout', { operation, timeoutMs });
    return this.handleNotFound<T>(operation);
  }

  /**
   * Validates that a response contains the expected data structure
   * 
   * @param response The response to validate
   * @param operation The operation type being performed
   * @param options Optional validation configuration
   * @returns True if response is valid for the operation type
   */
  validateResponseForOperation(
    response: unknown, 
    operation: OperationType,
    options?: { allowEmpty?: boolean }
  ): boolean {
    const opts = { allowEmpty: true, ...options };
    
    try {
      // Handle null/undefined
      if (response === null || response === undefined) {
        return opts.allowEmpty;
      }
      
      switch (operation) {
        case 'findOne':
          // findOne can return null, single object, or array with one item
          return response === null || 
                 (typeof response === 'object' && !Array.isArray(response)) ||
                 (Array.isArray(response) && (response.length <= 1 || opts.allowEmpty)) ||
                 this.isApiResponse(response) ||
                 this.isPaginatedResponse(response);
                 
        case 'findMany':
          // findMany should return arrays or paginated responses
          return Array.isArray(response) ||
                 this.isPaginatedResponse(response) ||
                 this.isApiResponse(response) ||
                 (typeof response === 'object' && response !== null);
                 
        case 'count':
          // count should return numbers or responses with count info
          return typeof response === 'number' ||
                 (typeof response === 'object' && response !== null) ||
                 typeof response === 'string'; // Parseable string
                 
        default:
          return false;
      }
      
    } catch (error) {
      this.logger?.error('Error during response validation', { error, response, operation });
      return false;
    }
  }

  // =============================================================================
  // Type Guards and Detection
  // =============================================================================

  /**
   * Type guard to check if value is a direct array
   */
  private isDirectArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  }

  /**
   * Type guard to check if value is an API response wrapper
   */
  private isApiResponse(value: unknown): value is ApiResponse<unknown> {
    return (
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      'data' in value &&
      (value as any).data !== undefined
    );
  }

  /**
   * Type guard to check if value is a paginated response
   */
  private isPaginatedResponse(value: unknown): value is PaginatedResponse<unknown> {
    return (
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      'data' in value &&
      Array.isArray((value as any).data) &&
      'meta' in value &&
      (value as any).meta !== null &&
      typeof (value as any).meta === 'object'
    );
  }

  /**
   * Type guard to check if value is a response with count information
   */
  private isCountResponse(value: unknown): boolean {
    if (typeof value === 'number') {
      return true;
    }
    
    if (value && typeof value === 'object') {
      const obj = value as Record<string, any>;
      return typeof obj.total === 'number' ||
             typeof obj.count === 'number' ||
             typeof obj.totalCount === 'number';
    }
    
    return false;
  }

  /**
   * Type guard to check if value looks like an error response
   */
  private isErrorResponse(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }
    
    const obj = value as Record<string, any>;
    return 'error' in obj || 'message' in obj || 'errors' in obj;
  }

  // =============================================================================
  // Response Validation (Legacy)
  // =============================================================================

  /**
   * Validates basic response structure (legacy method)
   * 
   * @param response The response to validate
   * @returns True if response has valid basic structure
   * @deprecated Use validateResponseForOperation for operation-specific validation
   */
  validateResponse(response: any): boolean {
    if (response === null || response === undefined) {
      return false;
    }

    // Allow direct arrays
    if (Array.isArray(response)) {
      return true;
    }

    // Allow direct objects
    if (typeof response === 'object') {
      return true;
    }

    // Allow numbers (for count responses)
    if (typeof response === 'number') {
      return true;
    }

    return false;
  }

  // =============================================================================
  // Debug and Logging
  // =============================================================================
  
  /**
   * Creates a detailed summary of response structure for debugging
   * 
   * @param response The response to analyze
   * @returns Debug information about the response structure
   */
  debugResponseStructure(response: unknown): Record<string, any> {
    const debug: Record<string, any> = {
      type: typeof response,
      isNull: response === null,
      isUndefined: response === undefined,
      isArray: Array.isArray(response),
      isApiResponse: this.isApiResponse(response),
      isPaginatedResponse: this.isPaginatedResponse(response),
      isCountResponse: this.isCountResponse(response),
      isErrorResponse: this.isErrorResponse(response)
    };
    
    if (response && typeof response === 'object') {
      debug.keys = Object.keys(response);
      
      if (Array.isArray(response)) {
        debug.arrayLength = response.length;
        debug.firstItemType = response.length > 0 ? typeof response[0] : null;
      } else {
        const obj = response as Record<string, any>;
        debug.hasData = 'data' in obj;
        debug.hasMeta = 'meta' in obj;
        debug.hasTotal = 'total' in obj;
        debug.hasCount = 'count' in obj;
        debug.hasPage = 'page' in obj;
        
        if (debug.hasData) {
          debug.dataType = typeof obj.data;
          debug.dataIsArray = Array.isArray(obj.data);
          if (Array.isArray(obj.data)) {
            debug.dataLength = obj.data.length;
          }
        }
      }
    }
    
    return debug;
  }
  
  /**
   * Logs detailed information about response normalization attempt
   * 
   * @param response The response being normalized
   * @param operation The operation type
   * @param result The normalization result
   */
  logNormalizationResult<T>(
    response: unknown,
    operation: OperationType,
    result: T | T[] | number | null
  ): void {
    if (!this.logger) {
      return;
    }
    
    const debugInfo = this.debugResponseStructure(response);
    const resultInfo = {
      resultType: typeof result,
      isNull: result === null,
      isArray: Array.isArray(result),
      length: Array.isArray(result) ? result.length : null,
      value: typeof result === 'number' ? result : null
    };
    
    this.logger.debug('Response normalization completed', {
      operation,
      input: debugInfo,
      output: resultInfo
    });
  }

  // =============================================================================
  // Legacy Methods (Backwards Compatibility)
  // =============================================================================

  /**
   * Legacy method - delegates to normalizeToArray for backwards compatibility
   * @deprecated Use normalizeToArray instead
   */
  normalizeList<T>(response: any): T[] {
    return this.normalizeToArray<T>(response, { logWarnings: false });
  }

  /**
   * Legacy method - delegates to extractSingleItem for backwards compatibility
   * @deprecated Use extractSingleItem instead
   */
  normalizeSingle<T>(response: any): T | null {
    return this.extractSingleItem<T>(response, { logWarnings: false });
  }

  /**
   * Legacy method - extracts basic response metadata
   * @deprecated Use extractMetadata instead for full pagination support
   */
  extractMeta(response: any): ResponseMeta | null {
    if (this.isPaginatedResponse(response)) {
      return response.meta;
    }

    if (this.isApiResponse(response) && response.meta) {
      return response.meta;
    }

    return null;
  }

  /**
   * Legacy method - extracts pagination metadata
   * @deprecated Use extractMetadata instead
   */
  extractPaginationMeta(response: any): PaginationMeta | null {
    const metadata = this.extractMetadata(response, { logWarnings: false });
    if (!metadata) {
      return null;
    }
    
    // Convert to legacy PaginationMeta format
    return {
      total: metadata.total,
      page: metadata.page,
      pageSize: metadata.limit,
      totalPages: metadata.totalPages,
      hasNext: metadata.hasNext,
      hasPrev: metadata.hasPrev,
      hasMore: metadata.hasMore
    };
  }

  /**
   * Normalizes a response to extract count information
   * 
   * Attempts to extract count from:
   * 1. response.meta.total (paginated responses)
   * 2. response.length (if array)
   * 3. response.count (if present)
   * 4. response.data.length (if wrapped array)
   * 
   * @param response The raw response from the API
   * @param options Optional normalization configuration
   * @returns The count as a number
   */
  normalizeCountResponse(response: unknown, options?: NormalizationOptions): number {
    const opts = { strict: false, logWarnings: true, ...options };
    
    try {
      // Check for null/undefined
      if (response == null) {
        return 0;
      }

      // If it's a number, return it directly
      if (typeof response === 'number') {
        return Math.max(0, Math.floor(response));
      }

      // If it's not an object, can't extract count
      if (typeof response !== 'object') {
        if (opts.logWarnings && this.logger) {
          this.logger.warn('Cannot extract count from non-object response', { response, type: typeof response });
        }
        return 0;
      }

      const resp = response as any;

      // Try to get count from meta.total (paginated responses)
      if (resp.meta && typeof resp.meta.total === 'number') {
        return Math.max(0, Math.floor(resp.meta.total));
      }

      // Try to get count from response.count
      if (typeof resp.count === 'number') {
        return Math.max(0, Math.floor(resp.count));
      }

      // Try to get count from response.total
      if (typeof resp.total === 'number') {
        return Math.max(0, Math.floor(resp.total));
      }

      // If response is an array, return its length
      if (Array.isArray(resp)) {
        return resp.length;
      }

      // If response.data is an array, return its length
      if (resp.data && Array.isArray(resp.data)) {
        return resp.data.length;
      }

      // If response has a single item, count is 1
      if (resp.id || resp._id || (typeof resp === 'object' && Object.keys(resp).length > 0)) {
        return 1;
      }

      // Default to 0
      if (opts.logWarnings && this.logger) {
        this.logger.warn('Could not extract count from response, defaulting to 0', { response });
      }
      
      return 0;
    } catch (error) {
      if (opts.logWarnings && this.logger) {
        this.logger.warn('Error normalizing count response', { error, response });
      }
      
      if (opts.strict) {
        throw new Error(`Failed to normalize count response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      return 0;
    }
  }

  // =============================================================================
  // Adapter Integration Methods (Aliases for compatibility)
  // =============================================================================

  /**
   * Alias for normalizeToArray - used by ApsoAdapter
   */
  normalizeArrayResponse<T>(response: unknown, options?: NormalizationOptions): T[] {
    return this.normalizeToArray<T>(response, options);
  }

  /**
   * Alias for extractSingleItem - used by ApsoAdapter
   */
  normalizeSingleResponse<T>(response: unknown, options?: NormalizationOptions): T | null {
    return this.extractSingleItem<T>(response, options);
  }
  
}