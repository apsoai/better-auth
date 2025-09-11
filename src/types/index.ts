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
  retryConfig?: RetryConfig;
  signal?: AbortSignal;
}

// =============================================================================
// HTTP Client Configuration and Backend Types
// =============================================================================

export type HttpBackend = 'fetch' | 'axios';

export interface HttpClientConfig {
  backend?: HttpBackend;
  timeout?: number;
  retryConfig?: RetryConfig;
  connectionPool?: ConnectionPoolConfig;
  circuitBreaker?: CircuitBreakerConfig;
  interceptors?: HttpInterceptors;
  observability?: HttpObservabilityConfig;
  ssl?: SslConfig;
  logger?: Logger;
}

export interface ConnectionPoolConfig {
  maxConnections?: number;
  maxConnectionsPerHost?: number;
  keepAlive?: boolean;
  keepAliveTimeout?: number;
  idleTimeout?: number;
  connectionTimeout?: number;
  enableHttp2?: boolean;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  minimumRequests: number;
}

export interface HttpInterceptors {
  request?: RequestInterceptor[];
  response?: ResponseInterceptor[];
  error?: ErrorInterceptor[];
}

export interface HttpObservabilityConfig {
  enableMetrics: boolean;
  enableTracing: boolean;
  enableLogging: boolean;
  logLevel: LogLevel;
  metricsReporter?: MetricsReporter;
}

export interface SslConfig {
  rejectUnauthorized?: boolean;
  ca?: string | string[];
  cert?: string;
  key?: string;
  ciphers?: string;
  secureProtocol?: string;
}

export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
export type ResponseInterceptor = <T>(response: HttpResponse<T>) => HttpResponse<T> | Promise<HttpResponse<T>>;
export type ErrorInterceptor = (error: Error) => Error | Promise<Error>;

export interface HttpResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  duration: number;
}

export interface MetricsReporter {
  reportRequest(metrics: RequestMetrics): void;
  reportError(metrics: ErrorMetrics): void;
}

export interface RequestMetrics {
  method: string;
  url: string;
  duration: number;
  status: number;
  success: boolean;
  retries: number;
  timestamp: Date;
}

export interface ErrorMetrics {
  method: string;
  url: string;
  error: string;
  retryable: boolean;
  timestamp: Date;
}

// =============================================================================
// Circuit Breaker Types
// =============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  requests: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
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
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
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
  retries?: number;
  circuitBreakerState?: CircuitState;
}

// =============================================================================
// Connection Pool Types
// =============================================================================

export interface ConnectionPoolStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  connectionErrors: number;
  connectionTimeouts: number;
  requestsWaiting: number;
}

export interface ConnectionInfo {
  id: string;
  host: string;
  port: number;
  protocol: 'http:' | 'https:';
  connected: boolean;
  lastUsed: Date;
  requestCount: number;
  errorCount: number;
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

// =============================================================================
// Entity Types for Better Auth and Apso API
// =============================================================================

/**
 * Better Auth User entity format
 */
export interface BetterAuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  image?: string;
}

/**
 * Better Auth Session entity format
 */
export interface BetterAuthSession {
  id: string;
  sessionToken: string;
  userId: string;
  expiresAt: Date;
}

/**
 * Better Auth VerificationToken entity format
 */
export interface BetterAuthVerificationToken {
  identifier: string;
  token: string;
  expiresAt: Date;
}

/**
 * Better Auth Account entity format (optional)
 */
export interface BetterAuthAccount {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
}

/**
 * Apso API User entity format
 */
export interface ApsoUser {
  id: string;
  email: string;
  emailVerified: boolean;
  hashedPassword?: string;
  name?: string;
  image?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Apso API Session entity format
 */
export interface ApsoSession {
  id: string;
  sessionToken: string;
  userId: string;
  expiresAt: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Apso API VerificationToken entity format
 */
export interface ApsoVerificationToken {
  id?: string;
  identifier: string;
  token: string;
  expiresAt: Date;
  created_at: Date;
}

/**
 * Apso API Account entity format (optional)
 */
export interface ApsoAccount {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Entity type enumeration
 */
export enum EntityType {
  USER = 'user',
  SESSION = 'session',
  VERIFICATION_TOKEN = 'verificationToken',
  ACCOUNT = 'account'
}

/**
 * Transformation direction
 */
export type TransformationDirection = 'toApi' | 'fromApi';

/**
 * Union type for Better Auth entities
 */
export type BetterAuthEntity = BetterAuthUser | BetterAuthSession | BetterAuthVerificationToken | BetterAuthAccount;

/**
 * Union type for Apso API entities
 */
export type ApsoEntity = ApsoUser | ApsoSession | ApsoVerificationToken | ApsoAccount;