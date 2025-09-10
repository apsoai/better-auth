/**
 * Error Mapper Implementation
 * 
 * This class maps HTTP errors and API responses to AdapterError instances.
 * It provides consistent error handling and categorization across the adapter.
 */

import { AdapterError, AdapterErrorCode, type Logger } from '../types';

export class ErrorMapper {
  private readonly logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  // =============================================================================
  // Main Error Mapping Methods
  // =============================================================================

  mapHttpError(
    status: number,
    statusText: string,
    body?: any,
    url?: string
  ): AdapterError {
    // TODO: Map HTTP status codes to AdapterError instances
    // 1. Map common HTTP status codes to error types
    // 2. Extract error details from response body
    // 3. Determine if error is retryable
    // 4. Create appropriate AdapterError instance
    
    const errorInfo = this.getErrorInfo(status, statusText, body);
    const error = new AdapterError(
      errorInfo.code,
      errorInfo.message,
      {
        status,
        statusText,
        body,
        url,
      },
      errorInfo.retryable,
      status
    );

    this.logger?.error('HTTP Error mapped to AdapterError', {
      status,
      statusText,
      code: error.code,
      retryable: error.retryable,
      url,
    });

    return error;
  }

  mapNetworkError(originalError: Error, url?: string): AdapterError {
    // TODO: Map network errors to AdapterError
    // 1. Handle timeout errors
    // 2. Handle connection errors
    // 3. Handle DNS resolution errors
    // 4. Create appropriate AdapterError
    
    let code: AdapterErrorCode;
    let retryable = true;

    if (originalError.message.includes('timeout')) {
      code = AdapterErrorCode.TIMEOUT;
    } else if (originalError.message.includes('network')) {
      code = AdapterErrorCode.NETWORK_ERROR;
    } else {
      code = AdapterErrorCode.UNKNOWN;
      retryable = false;
    }

    return new AdapterError(
      code,
      `Network error: ${originalError.message}`,
      {
        originalError: originalError.message,
        url,
      },
      retryable
    );
  }

  mapValidationError(
    field: string,
    message: string,
    details?: any
  ): AdapterError {
    // TODO: Map validation errors to AdapterError
    return new AdapterError(
      AdapterErrorCode.VALIDATION_ERROR,
      `Validation error for field '${field}': ${message}`,
      {
        field,
        details,
      },
      false // Validation errors are not retryable
    );
  }

  // =============================================================================
  // Error Type Determination
  // =============================================================================

  private getErrorInfo(
    status: number,
    statusText: string,
    body?: any
  ): {
    code: AdapterErrorCode;
    message: string;
    retryable: boolean;
  } {
    // TODO: Determine error type based on HTTP status and response body
    switch (status) {
      case 400:
        return {
          code: AdapterErrorCode.VALIDATION_ERROR,
          message: this.extractErrorMessage(body) || 'Bad Request',
          retryable: false,
        };

      case 401:
        return {
          code: AdapterErrorCode.UNAUTHORIZED,
          message: 'Unauthorized: Invalid or missing credentials',
          retryable: false,
        };

      case 403:
        return {
          code: AdapterErrorCode.FORBIDDEN,
          message: 'Forbidden: Insufficient permissions',
          retryable: false,
        };

      case 404:
        return {
          code: AdapterErrorCode.NOT_FOUND,
          message: 'Resource not found',
          retryable: false,
        };

      case 409:
        return {
          code: AdapterErrorCode.CONFLICT,
          message: this.extractErrorMessage(body) || 'Resource conflict',
          retryable: false,
        };

      case 429:
        return {
          code: AdapterErrorCode.RATE_LIMIT,
          message: 'Rate limit exceeded',
          retryable: true,
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: AdapterErrorCode.SERVER_ERROR,
          message: `Server error: ${statusText}`,
          retryable: true,
        };

      default:
        return {
          code: AdapterErrorCode.UNKNOWN,
          message: `HTTP ${status}: ${statusText}`,
          retryable: status >= 500,
        };
    }
  }

  private extractErrorMessage(body: any): string | null {
    // TODO: Extract meaningful error messages from response body
    // 1. Handle various error response formats
    // 2. Look for common error message fields
    // 3. Return the most relevant error message
    
    if (!body) return null;

    // Common error message fields
    if (typeof body === 'string') {
      return body;
    }

    if (typeof body === 'object') {
      // Try common error message fields
      const messageFields = [
        'message',
        'error',
        'errorMessage',
        'detail',
        'details',
        'description',
      ];

      for (const field of messageFields) {
        if (body[field] && typeof body[field] === 'string') {
          return body[field];
        }
      }

      // Handle validation errors with multiple messages
      if (body.errors && Array.isArray(body.errors)) {
        const errorMessages = body.errors
          .map((err: any) => {
            if (typeof err === 'string') return err;
            if (err.message) return err.message;
            if (err.error) return err.error;
            return null;
          })
          .filter(Boolean);

        if (errorMessages.length > 0) {
          return errorMessages.join(', ');
        }
      }
    }

    return null;
  }

  // =============================================================================
  // Error Enhancement
  // =============================================================================

  enhanceError(error: AdapterError, context: {
    operation?: string;
    model?: string;
    params?: any;
  }): AdapterError {
    // TODO: Enhance error with additional context
    // 1. Add operation context
    // 2. Add model information
    // 3. Add sanitized parameters
    // 4. Return enhanced error
    
    const enhancedDetails = {
      ...error.details,
      operation: context.operation,
      model: context.model,
      // Sanitize sensitive data from params
      params: this.sanitizeParams(context.params),
    };

    return new AdapterError(
      error.code,
      error.message,
      enhancedDetails,
      error.retryable,
      error.statusCode
    );
  }

  private sanitizeParams(params: any): any {
    // TODO: Remove sensitive data from params for logging
    // 1. Remove password fields
    // 2. Remove API keys
    // 3. Remove other sensitive data
    // 4. Return sanitized params
    
    if (!params || typeof params !== 'object') {
      return params;
    }

    const sensitive = ['password', 'apiKey', 'token', 'secret'];
    const sanitized = { ...params };

    for (const key of Object.keys(sanitized)) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  // =============================================================================
  // Error Classification
  // =============================================================================

  isRetryable(error: Error): boolean {
    // TODO: Determine if an error is retryable
    if (error instanceof AdapterError) {
      return error.retryable;
    }

    // Network errors are generally retryable
    return error.message.includes('timeout') || 
           error.message.includes('network') ||
           error.message.includes('ECONNRESET') ||
           error.message.includes('ENOTFOUND');
  }

  isClientError(error: AdapterError): boolean {
    return error.statusCode ? error.statusCode >= 400 && error.statusCode < 500 : false;
  }

  isServerError(error: AdapterError): boolean {
    return error.statusCode ? error.statusCode >= 500 : false;
  }
}