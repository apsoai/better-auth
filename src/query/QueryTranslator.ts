/**
 * Query Translator Implementation
 * 
 * This class translates Better Auth query conditions into Apso SDK-compatible
 * QueryParams. It handles where clauses, pagination, sorting, field selection,
 * email normalization, and multi-tenant scoping.
 * 
 * The translator bridges the gap between Better Auth adapter queries and the
 * Apso SDK's QueryBuilder format, enabling seamless integration.
 */

import type {
  PaginationOptions,
  Logger,
  ApsoAdapterConfig,
} from '../types';
// Define QueryParams interface locally since SDK export is inconsistent
export interface QueryParams {
  fields?: string[];
  filter?: Record<string, any>;
  or?: Record<string, any>;
  join?: string[];
  sort?: Record<string, 'ASC' | 'DESC'>;
  limit?: number;
  offset?: number;
  page?: number;
}
import { EmailNormalizer } from '../utils/EmailNormalizer';

/**
 * Options for building queries
 */
export interface QueryBuildOptions {
  where?: Record<string, any>;
  select?: string[];
  pagination?: PaginationOptions;
  sort?: Record<string, 'asc' | 'desc'>;
}

/**
 * QueryTranslator translates Better Auth queries to Apso SDK QueryParams format
 */
export class QueryTranslator {
  private readonly emailNormalization: boolean;
  private readonly tenantConfig?: ApsoAdapterConfig['multiTenancy'];
  private readonly logger: Logger | undefined;

  constructor(
    config: {
      emailNormalization?: boolean;
      tenantConfig?: ApsoAdapterConfig['multiTenancy'];
      logger?: Logger;
    } = {}
  ) {
    this.emailNormalization = config.emailNormalization ?? true;
    this.tenantConfig = config.tenantConfig;
    this.logger = config.logger;
  }

  // =============================================================================
  // Main Translation Methods
  // =============================================================================

  /**
   * Translates Better Auth where conditions to Apso SDK QueryParams format
   * 
   * @param where - Better Auth where conditions
   * @returns QueryParams with filter conditions
   */
  translateWhere(where: Record<string, any>): QueryParams {
    const filter: Record<string, any> = {};
    const or: Record<string, any> = {};
    let hasOrConditions = false;

    for (const [key, value] of Object.entries(where)) {
      if (key === 'OR' && Array.isArray(value)) {
        // Handle OR conditions
        const orConditions = this.processOrConditions(value);
        if (Object.keys(orConditions).length > 0) {
          Object.assign(or, orConditions);
          hasOrConditions = true;
        }
      } else if (key === 'AND' && Array.isArray(value)) {
        // Handle AND conditions (merge into main filter)
        for (const condition of value) {
          if (typeof condition === 'object' && condition !== null) {
            Object.assign(filter, this.processWhereCondition(condition));
          }
        }
      } else {
        // Handle direct conditions
        const processedCondition = this.processWhereCondition({ [key]: value });
        Object.assign(filter, processedCondition);
      }
    }

    const queryParams: QueryParams = {};
    
    if (Object.keys(filter).length > 0) {
      queryParams.filter = filter;
    }
    
    if (hasOrConditions) {
      queryParams.or = or;
    }

    return queryParams;
  }

  /**
   * Builds pagination parameters for Apso SDK QueryParams
   * 
   * @param options - Pagination options from Better Auth
   * @returns Partial QueryParams with pagination settings
   */
  private buildPagination(options?: PaginationOptions): Partial<QueryParams> {
    if (!options) {
      return {};
    }

    const queryParams: Partial<QueryParams> = {};

    // Handle page-based pagination
    if (options.page !== undefined) {
      queryParams.page = Math.max(1, options.page);
    }

    // Handle limit
    if (options.limit !== undefined) {
      queryParams.limit = Math.max(1, Math.min(1000, options.limit)); // Cap at 1000
    }

    // Handle offset-based pagination
    if (options.offset !== undefined) {
      queryParams.offset = Math.max(0, options.offset);
    }

    this.logger?.debug('Built pagination parameters', { 
      input: options, 
      output: queryParams 
    });

    return queryParams;
  }

  /**
   * Builds sorting parameters for Apso SDK QueryParams
   * 
   * @param orderBy - Better Auth sorting configuration
   * @returns Partial QueryParams with sort settings
   */
  private buildSort(orderBy?: Record<string, 'asc' | 'desc'>): Partial<QueryParams> {
    if (!orderBy || Object.keys(orderBy).length === 0) {
      return {};
    }

    const sort: Record<string, 'ASC' | 'DESC'> = {};

    for (const [field, order] of Object.entries(orderBy)) {
      if (this.isValidFieldName(field)) {
        sort[field] = order.toUpperCase() as 'ASC' | 'DESC';
      } else {
        this.logger?.warn('Invalid field name in sort', { field });
      }
    }

    return Object.keys(sort).length > 0 ? { sort } : {};
  }

  /**
   * Builds field selection for Apso SDK QueryParams
   * 
   * @param fields - Better Auth field selection
   * @returns Partial QueryParams with fields setting
   */
  private buildSelect(fields?: string[]): Partial<QueryParams> {
    if (!fields || fields.length === 0) {
      return {}; // Return all fields
    }

    const validFields = fields.filter(field => {
      const isValid = this.isValidFieldName(field);
      if (!isValid) {
        this.logger?.warn('Invalid field name in select', { field });
      }
      return isValid;
    });

    return validFields.length > 0 ? { fields: validFields } : {};
  }

  /**
   * Main method to build complete query for Better Auth operations
   * 
   * @param options - Query build options
   * @returns Complete QueryParams for Apso SDK
   */
  buildQuery(options: QueryBuildOptions): QueryParams {
    let queryParams: QueryParams = {};

    // Handle where conditions
    if (options.where) {
      const whereParams = this.translateWhere(options.where);
      queryParams = { ...queryParams, ...whereParams };
    }

    // Handle field selection
    if (options.select) {
      const selectParams = this.buildSelect(options.select);
      queryParams = { ...queryParams, ...selectParams };
    }

    // Handle pagination
    if (options.pagination) {
      const paginationParams = this.buildPagination(options.pagination);
      queryParams = { ...queryParams, ...paginationParams };
    }

    // Handle sorting
    if (options.sort) {
      const sortParams = this.buildSort(options.sort);
      queryParams = { ...queryParams, ...sortParams };
    }

    this.logger?.debug('Built complete query', { 
      input: options, 
      output: queryParams 
    });

    return queryParams;
  }

  /**
   * Adds tenant scoping to query when multi-tenancy is configured
   * 
   * @param query - Base QueryParams
   * @param tenantId - Optional tenant ID (uses config if not provided)
   * @returns QueryParams with tenant scope applied
   */
  addTenantScope(query: QueryParams, tenantId?: string): QueryParams {
    if (!this.tenantConfig?.enabled) {
      return query;
    }

    const effectiveTenantId = tenantId || (typeof this.tenantConfig.getScopeValue === 'function' 
      ? this.tenantConfig.getScopeValue() 
      : undefined);

    if (!effectiveTenantId) {
      this.logger?.warn('Multi-tenancy enabled but no tenant ID provided');
      return query;
    }

    // Clone the query to avoid mutation
    const scopedQuery: QueryParams = { ...query };
    
    // Add tenant scope to filter
    const tenantFilter = { [this.tenantConfig.scopeField]: effectiveTenantId };
    
    if (scopedQuery.filter) {
      scopedQuery.filter = { ...scopedQuery.filter, ...tenantFilter };
    } else {
      scopedQuery.filter = tenantFilter;
    }

    this.logger?.debug('Applied tenant scope', { 
      tenantId: effectiveTenantId,
      scopeField: this.tenantConfig.scopeField
    });

    return scopedQuery;
  }

  // =============================================================================
  // Filter Construction Helpers
  // =============================================================================

  /**
   * Processes individual where conditions, applying transformations as needed
   * 
   * @param condition - Single where condition object
   * @returns Processed condition for Apso SDK filter
   */
  private processWhereCondition(condition: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(condition)) {
      if (value === null || value === undefined) {
        // Handle null/undefined values
        result[key] = null;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle complex operators (e.g., { gt: 5, lt: 10 })
        result[key] = this.processComplexOperator(value);
      } else {
        // Handle simple values with email normalization
        result[key] = this.emailNormalization && this.isEmailField(key)
          ? this.normalizeEmailValue(value)
          : value;
      }
    }

    return result;
  }

  /**
   * Processes OR conditions from Better Auth format
   * 
   * For now, we take the first condition as the OR condition since
   * the Apso SDK QueryParams format doesn't clearly specify how to handle
   * multiple OR conditions. This may need to be refined based on SDK behavior.
   * 
   * @param orConditions - Array of OR conditions
   * @returns Processed OR conditions for Apso SDK
   */
  private processOrConditions(orConditions: any[]): Record<string, any> {
    if (orConditions.length === 0) {
      return {};
    }

    // For simplicity, use the first OR condition
    // The Apso SDK QueryParams structure doesn't clearly define how to handle multiple OR conditions
    const firstCondition = orConditions[0];
    
    if (typeof firstCondition === 'object' && firstCondition !== null) {
      return this.processWhereCondition(firstCondition);
    }

    return {};
  }

  /**
   * Processes complex operators (gt, lt, in, etc.)
   * 
   * @param operatorObj - Object containing operators and values
   * @returns Processed operator object
   */
  private processComplexOperator(operatorObj: Record<string, any>): any {
    // For Apso SDK, we may need to transform operators
    // Currently passing through as-is since the SDK format isn't fully specified
    return operatorObj;
  }

  // =============================================================================
  // Email Normalization
  // =============================================================================

  /**
   * Checks if a field name represents an email field
   * 
   * @param fieldName - Field name to check
   * @returns True if field is email-related
   */
  private isEmailField(fieldName: string): boolean {
    const emailFields = ['email', 'identifier', 'emailAddress', 'userEmail'];
    return emailFields.some(field => 
      fieldName.toLowerCase().includes(field.toLowerCase())
    );
  }

  /**
   * Normalizes email values using the EmailNormalizer utility
   * 
   * @param value - Value to normalize (string or array)
   * @returns Normalized value
   */
  private normalizeEmailValue(value: any): any {
    if (typeof value === 'string') {
      try {
        return EmailNormalizer.normalize(value);
      } catch (error) {
        this.logger?.warn('Failed to normalize email', { value, error });
        return value.toLowerCase().trim(); // Fallback to basic normalization
      }
    }

    if (Array.isArray(value)) {
      return value.map(v => {
        if (typeof v === 'string') {
          try {
            return EmailNormalizer.normalize(v);
          } catch (error) {
            this.logger?.warn('Failed to normalize email in array', { value: v, error });
            return v.toLowerCase().trim(); // Fallback
          }
        }
        return v;
      });
    }

    return value;
  }

  // =============================================================================
  // Validation and Normalization
  // =============================================================================

  /**
   * Validates field names for security and format compliance
   * 
   * @param fieldName - Field name to validate
   * @returns True if field name is valid
   */
  private isValidFieldName(fieldName: string): boolean {
    if (!fieldName || typeof fieldName !== 'string') {
      return false;
    }

    // Check length constraints
    if (fieldName.length === 0 || fieldName.length > 50) {
      return false;
    }

    // Check for valid field pattern (alphanumeric + underscore, must start with letter)
    const validFieldPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    if (!validFieldPattern.test(fieldName)) {
      return false;
    }

    // Check for potential SQL injection patterns
    const suspiciousPatterns = [
      /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|UNION|EXEC|SCRIPT)\b/i,
      /-{2,}/, // SQL comments
      /\/\*.*\*\//s, // Block comments
      /[;\x00]/, // Null bytes and semicolons
    ];

    return !suspiciousPatterns.some(pattern => pattern.test(fieldName));
  }
}