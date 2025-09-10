/**
 * Core type definitions for the Better Auth Apso Adapter
 * This file defines all the interfaces and types required by the adapter
 */

// =============================================================================
// Better Auth Adapter Interface (Required by Better Auth)
// =============================================================================

export interface BetterAuthAdapter {
  create<T>(params: CreateParams): Promise<T>;
  update<T>(params: UpdateParams): Promise<T>;
  updateMany(params: UpdateManyParams): Promise<number>;
  delete<T>(params: DeleteParams): Promise<T>;
  deleteMany(params: DeleteManyParams): Promise<number>;
  findOne<T>(params: FindOneParams): Promise<T | null>;
  findMany<T>(params: FindManyParams): Promise<T[]>;
  count(params: CountParams): Promise<number>;
}

// =============================================================================
// Parameter Types for Adapter Methods
// =============================================================================

export interface CreateParams {
  model: string;
  data: Record<string, any>;
  select?: string[];
}

export interface UpdateParams {
  model: string;
  where: Record<string, any>;
  update: Record<string, any>;
  select?: string[];
}

export interface UpdateManyParams {
  model: string;
  where?: Record<string, any>;
  update: Record<string, any>;
}

export interface DeleteParams {
  model: string;
  where: Record<string, any>;
  select?: string[];
}

export interface DeleteManyParams {
  model: string;
  where?: Record<string, any>;
}

export interface FindOneParams {
  model: string;
  where: Record<string, any>;
  select?: string[];
}

export interface FindManyParams {
  model: string;
  where?: Record<string, any>;
  select?: string[];
  pagination?: PaginationOptions;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export interface CountParams {
  model: string;
  where?: Record<string, any>;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Adapter Configuration
// =============================================================================

export interface ApsoAdapterConfig {
  // Required
  baseUrl: string;

  // Authentication
  apiKey?: string;
  authHeader?: string;

  // HTTP Client
  fetchImpl?: HttpClient;
  timeout?: number;

  // Retry
  retryConfig?: RetryConfig;

  // Performance
  cacheConfig?: CacheConfig;
  batchConfig?: BatchConfig;

  // Multi-tenancy
  multiTenancy?: MultiTenancyConfig;

  // Observability
  observability?: ObservabilityConfig;
  logger?: Logger;

  // Behavior
  usePlural?: boolean;
  emailNormalization?: boolean;
  softDeletes?: boolean;

  // Development
  debugMode?: boolean;
  dryRun?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

export interface CacheConfig {
  enabled: boolean;
  ttlMs: number;
  maxSize: number;
}

export interface BatchConfig {
  batchSize: number;
  concurrency: number;
  delayBetweenBatches?: number;
}

export interface MultiTenancyConfig {
  enabled: boolean;
  scopeField: string;
  getScopeValue: () => string | Promise<string>;
}

export interface ObservabilityConfig {
  metricsEnabled: boolean;
  tracingEnabled: boolean;
  logLevel: LogLevel;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// =============================================================================
// HTTP Client Interface
// =============================================================================

export interface HttpClient {
  request<T>(config: RequestConfig): Promise<T>;
  get<T>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<T>;
  post<T>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<T>;
  put<T>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<T>;
  patch<T>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<T>;
  delete<T>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<T>;
}

export interface RequestConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// =============================================================================
// Query Translation Types
// =============================================================================

export interface CrudFilter {
  field: string;
  operator: CrudOperator;
  value: any;
  not?: boolean;
}

export type CrudOperator = 
  | 'equals'
  | 'not'
  | 'in'
  | 'notIn'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'isNull'
  | 'isNotNull';

export interface CrudPagination {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface CrudSort {
  field: string;
  order: 'ASC' | 'DESC';
}

// =============================================================================
// Response Types
// =============================================================================

export interface ApiResponse<T> {
  data: T;
  meta?: ResponseMeta;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ResponseMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

export interface PaginationMeta extends ResponseMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// =============================================================================
// Error Types
// =============================================================================

export enum AdapterErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export class AdapterError extends Error {
  public readonly code: AdapterErrorCode;
  public readonly details?: any;
  public readonly retryable: boolean;
  public readonly statusCode?: number;

  constructor(
    code: AdapterErrorCode,
    message: string,
    details?: any,
    retryable: boolean = false,
    statusCode?: number
  ) {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

// =============================================================================
// Entity Mapper Types
// =============================================================================

export interface EntityMapper {
  getApiPath(modelName: string): string;
  transformOutbound(model: string, data: any): any;
  transformInbound(model: string, data: any): any;
  validate(model: string, data: any): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationRule {
  field: string;
  type: ValidationRuleType;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export type ValidationRuleType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'email'
  | 'url'
  | 'uuid'
  | 'array'
  | 'object';

// =============================================================================
// Observability Types
// =============================================================================

export interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

export interface ObservabilityProvider {
  logOperation(params: OperationLog): void;
  recordMetric(params: MetricRecord): void;
  startSpan(name: string): Span;
}

export interface OperationLog {
  operation: string;
  model: string;
  duration: number;
  success: boolean;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface MetricRecord {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export interface Span {
  setTag(key: string, value: any): void;
  setError(error: Error): void;
  finish(): void;
}

// =============================================================================
// Adapter Metrics
// =============================================================================

export interface AdapterMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  cacheHitRate: number;
  retryCount: number;
  errorsByType: Map<AdapterErrorCode, number>;
  requestsByModel: Map<string, number>;
  lastResetTime: Date;
}

// =============================================================================
// Extended Adapter Interface
// =============================================================================

export interface ApsoAdapter extends BetterAuthAdapter {
  // Core configuration
  readonly config: ApsoAdapterConfig;

  // Health check
  healthCheck(): Promise<boolean>;

  // Metrics
  getMetrics(): AdapterMetrics;
  resetMetrics(): void;

  // Cache management
  clearCache(): void;

  // Multi-tenancy
  setTenantContext(tenantId: string): void;
  getTenantContext(): string | null;

  // Batch operations
  createMany<T>(params: CreateManyParams): Promise<T[]>;
  
  // Connection management
  close(): Promise<void>;
}

export interface CreateManyParams {
  model: string;
  data: Record<string, any>[];
  select?: string[];
}

// =============================================================================
// Internal Types
// =============================================================================

export interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export interface RequestStats {
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: Error;
}

export interface BatchOperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  index: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  timestamp: Date;
  latency?: number;
  error?: string;
}

// =============================================================================
// Type Guards
// =============================================================================

export const isApiResponse = <T>(value: any): value is ApiResponse<T> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value
  );
};

export const isPaginatedResponse = <T>(value: any): value is PaginatedResponse<T> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Array.isArray(value.data) &&
    'meta' in value &&
    typeof value.meta === 'object'
  );
};

export const isAdapterError = (value: any): value is AdapterError => {
  return value instanceof AdapterError;
};

// =============================================================================
// Utility Types
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type NonNullable<T> = T extends null | undefined ? never : T;