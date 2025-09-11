/**
 * Response Normalizer Implementation
 * 
 * This class handles the normalization of various response formats from the Apso API.
 * It supports both array responses and paginated responses, extracting data and metadata
 * consistently regardless of the response format.
 */

import type {
  ApiResponse,
  PaginatedResponse,
  ResponseMeta,
  PaginationMeta,
  Logger,
} from '../types';

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

  normalizeList<T>(response: any): T[] {
    // TODO: Normalize array or paginated response to simple array
    // 1. Check if response is direct array
    // 2. Check if response is paginated format
    // 3. Check if response is wrapped in ApiResponse
    // 4. Extract data array from any format
    // 5. Return normalized array
    if (this.isDirectArray(response)) {
      return response as T[];
    }

    if (this.isPaginatedResponse(response)) {
      return response.data as T[];
    }

    if (this.isApiResponse(response)) {
      const data = response.data;
      if (Array.isArray(data)) {
        return data as T[];
      }
      if (this.isPaginatedResponse(data)) {
        return data.data as T[];
      }
    }

    // Fallback: try to extract from common wrapper patterns
    if (response && typeof response === 'object') {
      if (response.items && Array.isArray(response.items)) {
        return response.items as T[];
      }
      if (response.results && Array.isArray(response.results)) {
        return response.results as T[];
      }
    }

    this.logger?.warn('Unable to normalize list response', { response });
    return [];
  }

  normalizeSingle<T>(response: any): T | null {
    // TODO: Extract single item from response
    // 1. Check if response is direct object
    // 2. Check if response is wrapped in ApiResponse
    // 3. Handle array responses (take first item)
    // 4. Return single item or null
    if (response === null || response === undefined) {
      return null;
    }

    if (this.isApiResponse(response)) {
      return this.normalizeSingle(response.data);
    }

    if (Array.isArray(response)) {
      return response.length > 0 ? response[0] as T : null;
    }

    if (this.isPaginatedResponse(response)) {
      const items = response.data;
      return items.length > 0 ? items[0] as T : null;
    }

    // Direct object response
    if (typeof response === 'object' && response !== null) {
      return response as T;
    }

    return null;
  }

  normalizeCount(response: any): number {
    // TODO: Extract count from response metadata
    // 1. Check for meta.total in paginated responses
    // 2. Check for count field in various formats
    // 3. Fallback to array length
    // 4. Return 0 if no count found
    if (this.isPaginatedResponse(response) && response.meta?.total !== undefined) {
      return response.meta.total;
    }

    if (this.isApiResponse(response)) {
      return this.normalizeCount(response.data);
    }

    if (response && typeof response === 'object') {
      // Common count field names
      if (typeof response.total === 'number') {
        return response.total;
      }
      if (typeof response.count === 'number') {
        return response.count;
      }
      if (typeof response.totalCount === 'number') {
        return response.totalCount;
      }
    }

    if (Array.isArray(response)) {
      return response.length;
    }

    return 0;
  }

  // =============================================================================
  // Metadata Extraction
  // =============================================================================

  extractMeta(response: any): ResponseMeta | null {
    // TODO: Extract metadata from response
    // 1. Check for meta object in paginated responses
    // 2. Extract pagination info, totals, etc.
    // 3. Return null if no metadata found
    if (this.isPaginatedResponse(response)) {
      return response.meta;
    }

    if (this.isApiResponse(response) && response.meta) {
      return response.meta;
    }

    return null;
  }

  extractPaginationMeta(response: any): PaginationMeta | null {
    // TODO: Extract pagination-specific metadata
    // 1. Check for complete pagination metadata
    // 2. Calculate derived fields (hasNext, hasPrev, totalPages)
    // 3. Return null if not a paginated response
    const meta = this.extractMeta(response);
    
    if (!meta || typeof meta.total !== 'number' || typeof meta.page !== 'number') {
      return null;
    }

    const { total, page, pageSize = 10 } = meta as PaginationMeta;
    const totalPages = Math.ceil(total / pageSize);

    return {
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      hasMore: page < totalPages, // Alias for hasNext
    };
  }

  // =============================================================================
  // Error Handling
  // =============================================================================

  handleNotFound<T>(): T | null {
    // TODO: Handle 404 responses consistently
    // Return null for not found cases
    return null;
  }

  handleEmpty<T>(): T[] {
    // TODO: Handle empty responses
    // Return empty array for empty list responses
    return [];
  }

  // =============================================================================
  // Type Guards and Detection
  // =============================================================================

  private isDirectArray(value: any): boolean {
    return Array.isArray(value);
  }

  private isApiResponse(value: any): value is ApiResponse<any> {
    return (
      value &&
      typeof value === 'object' &&
      'data' in value &&
      value.data !== undefined
    );
  }

  private isPaginatedResponse(value: any): value is PaginatedResponse<any> {
    return (
      value &&
      typeof value === 'object' &&
      'data' in value &&
      Array.isArray(value.data) &&
      'meta' in value &&
      value.meta &&
      typeof value.meta === 'object'
    );
  }

  private _isEmptyResponse(value: any): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (this.isPaginatedResponse(value)) {
      return value.data.length === 0;
    }

    return false;
  }

  // =============================================================================
  // Response Validation
  // =============================================================================

  validateResponse(response: any): boolean {
    // TODO: Validate response structure
    // 1. Check for required fields
    // 2. Validate data types
    // 3. Check for malformed responses
    // 4. Return validation result
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

    return false;
  }

  // =============================================================================
  // Debug and Logging
  // =============================================================================

  private _logNormalization(
    type: string,
    original: any,
    normalized: any
  ): void {
    if (this.logger) {
      this.logger.debug(`Response normalization: ${type}`, {
        originalType: typeof original,
        originalKeys: original && typeof original === 'object' 
          ? Object.keys(original) 
          : undefined,
        normalizedType: typeof normalized,
        normalizedLength: Array.isArray(normalized) 
          ? normalized.length 
          : undefined,
      });
    }
  }
}