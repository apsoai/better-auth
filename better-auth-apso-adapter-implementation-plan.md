# Better Auth Apso Adapter - Comprehensive Implementation Plan

## Executive Summary

This document provides a complete technical specification for implementing a Better Auth database adapter that interfaces with Apso-generated CRUD REST endpoints. The adapter serves as a bridge between Better Auth's authentication framework and our existing Apso service infrastructure, enabling centralized user management while maintaining the developer-friendly Better Auth interface.

The implementation leverages the existing Apso SDK components (ApsoClient, QueryBuilder, EntityClient) to minimize code duplication and ensure consistency with our current API patterns. The adapter implements all required Better Auth methods through HTTP calls to Apso endpoints, handling email normalization, bulk operations, error mapping, and observability requirements.

Key architectural decisions include:
- Reusing Apso SDK's QueryBuilder for consistent query construction
- Implementing bulk operations through batched individual requests
- Supporting both array and paginated response formats
- Providing comprehensive error mapping and retry logic
- Ensuring multi-tenancy readiness through configurable scope filters

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Component Design](#2-component-design)
3. [Implementation Specifications](#3-implementation-specifications)
4. [Task Breakdown](#4-task-breakdown)
5. [Quality Standards](#5-quality-standards)
6. [Testing Strategy](#6-testing-strategy)
7. [Error Handling](#7-error-handling)
8. [Performance Requirements](#8-performance-requirements)
9. [Security Considerations](#9-security-considerations)
10. [Documentation Requirements](#10-documentation-requirements)
11. [Risk Assessment](#11-risk-assessment)
12. [Success Criteria](#12-success-criteria)

---

## 1. Architecture Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Application                      │
├─────────────────────────────────────────────────────────────┤
│                        Better Auth                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Better Auth Apso Adapter                │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │         ApsoAdapterCore                     │     │    │
│  │  │  - Method implementations                   │     │    │
│  │  │  - Error handling                          │     │    │
│  │  │  - Response normalization                  │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │         QueryTranslator                     │     │    │
│  │  │  - Better Auth → nestjsx/crud translation  │     │    │
│  │  │  - Filter construction                     │     │    │
│  │  │  - Pagination handling                     │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │         HttpClient                          │     │    │
│  │  │  - Request execution                       │     │    │
│  │  │  - Retry logic                             │     │    │
│  │  │  - Timeout handling                        │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/REST
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      Apso Service (NestJS)                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            @nestjsx/crud Controllers                 │    │
│  │  - /users                                           │    │
│  │  - /sessions                                        │    │
│  │  - /verification-tokens                             │    │
│  │  - /accounts (optional)                             │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Database Layer                      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

1. **Authentication Request**: Better Auth initiates database operation
2. **Adapter Translation**: ApsoAdapter translates to HTTP request
3. **Query Building**: QueryTranslator constructs nestjsx/crud query
4. **HTTP Execution**: HttpClient sends request with retry logic
5. **Response Processing**: Adapter normalizes response format
6. **Result Return**: Better Auth receives standardized response

### 1.3 Key Design Decisions

#### Decision 1: Leverage Existing Apso SDK
**Rationale**: Reuse proven QueryBuilder and EntityClient patterns for consistency
**Alternative Considered**: Build custom query construction
**Impact**: Reduced code duplication, familiar patterns for team

#### Decision 2: Implement Bulk Operations via Iteration
**Rationale**: @nestjsx/crud doesn't natively support bulk PATCH/DELETE by filter
**Alternative Considered**: Extend Apso service with bulk endpoints
**Impact**: Slightly higher latency for bulk ops, simpler initial implementation

#### Decision 3: Support Dual Response Formats
**Rationale**: Apso controllers may return array or paginated format
**Alternative Considered**: Enforce single format at service level
**Impact**: More flexible integration, defensive parsing required

---

## 2. Component Design

### 2.1 Core Components

#### 2.1.1 ApsoAdapterFactory

```typescript
interface ApsoAdapterConfig {
  baseUrl: string;                    // Base URL for Apso service
  apiKey?: string;                    // Optional API key for auth
  fetchImpl?: HttpClient;             // Custom fetch implementation
  usePlural?: boolean;                // Use plural resource names (default: true)
  debugLogs?: boolean;                // Enable debug logging
  retryConfig?: RetryConfig;          // Retry configuration
  timeoutMs?: number;                 // Request timeout (default: 3000)
  multiTenancy?: MultiTenancyConfig;  // Multi-tenancy configuration
  observability?: ObservabilityConfig; // Logging/metrics config
}

interface RetryConfig {
  maxRetries: number;        // Maximum retry attempts
  initialDelayMs: number;    // Initial backoff delay
  maxDelayMs: number;        // Maximum backoff delay
  retryableStatuses: number[]; // HTTP statuses to retry
}

interface MultiTenancyConfig {
  enabled: boolean;          // Enable multi-tenancy
  scopeField: string;        // Field name (e.g., 'workspaceId')
  getScopeValue: () => string | Promise<string>; // Get current scope
}
```

#### 2.1.2 QueryTranslator

```typescript
class QueryTranslator {
  // Translates Better Auth where conditions to nestjsx/crud filters
  translateWhere(where: Record<string, any>): CrudFilter[];
  
  // Builds pagination parameters
  buildPagination(options?: PaginationOptions): CrudPagination;
  
  // Constructs field selection
  buildSelect(fields?: string[]): string[];
  
  // Applies email normalization
  normalizeEmailFilter(filter: CrudFilter): CrudFilter;
  
  // Injects multi-tenancy scope
  applyScope(filters: CrudFilter[], scope?: string): CrudFilter[];
}
```

#### 2.1.3 HttpClient Wrapper

```typescript
class ApsoHttpClient {
  // Execute HTTP request with retry logic
  async request<T>(config: RequestConfig): Promise<T>;
  
  // Batch execute for bulk operations
  async batchRequest<T>(configs: RequestConfig[]): Promise<T[]>;
  
  // Health check endpoint
  async healthCheck(): Promise<boolean>;
  
  private handleRetry(error: Error, attempt: number): Promise<void>;
  private parseResponse<T>(response: Response): Promise<T>;
  private mapHttpError(status: number, body?: any): AdapterError;
}
```

#### 2.1.4 Response Normalizer

```typescript
class ResponseNormalizer {
  // Normalize array or paginated response
  normalizeList<T>(response: any): T[];
  
  // Extract single item from response
  normalizeSingle<T>(response: any): T | null;
  
  // Extract count from response
  normalizeCount(response: any): number;
  
  // Handle 404 responses
  handleNotFound<T>(): T | null;
}
```

### 2.2 Entity Mappers

```typescript
interface EntityMapper {
  // Map Better Auth model name to API path
  getApiPath(modelName: string): string;
  
  // Transform data before sending
  transformOutbound(model: string, data: any): any;
  
  // Transform data after receiving
  transformInbound(model: string, data: any): any;
  
  // Apply model-specific validations
  validate(model: string, data: any): ValidationResult;
}

class DefaultEntityMapper implements EntityMapper {
  private readonly pathMappings = {
    user: 'users',
    session: 'sessions',
    verificationToken: 'verification-tokens',
    account: 'accounts'
  };
  
  getApiPath(modelName: string): string {
    return this.pathMappings[modelName.toLowerCase()] || modelName;
  }
  
  transformOutbound(model: string, data: any): any {
    // Apply transformations like email normalization
    if (model === 'user' && data.email) {
      data.email = data.email.toLowerCase();
    }
    return data;
  }
}
```

### 2.3 Method Implementations

#### 2.3.1 Create Method

```typescript
async create<T>({ model, data, select }): Promise<T> {
  // 1. Validate input data
  const validation = this.entityMapper.validate(model, data);
  if (!validation.valid) throw new ValidationError(validation.errors);
  
  // 2. Transform data
  const transformed = this.entityMapper.transformOutbound(model, data);
  
  // 3. Build request
  const path = this.entityMapper.getApiPath(model);
  const url = `${this.baseUrl}/${path}`;
  
  // 4. Execute request
  const response = await this.httpClient.request({
    method: 'POST',
    url,
    body: transformed,
    headers: this.buildHeaders()
  });
  
  // 5. Transform and return
  return this.entityMapper.transformInbound(model, response);
}
```

#### 2.3.2 FindOne Method

```typescript
async findOne<T>({ model, where, select }): Promise<T | null> {
  // 1. Check for ID-based lookup
  if (where.id) {
    const path = this.entityMapper.getApiPath(model);
    const url = `${this.baseUrl}/${path}/${where.id}`;
    
    try {
      const response = await this.httpClient.request({
        method: 'GET',
        url,
        headers: this.buildHeaders()
      });
      return this.entityMapper.transformInbound(model, response);
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }
  
  // 2. Query-based lookup
  const filters = this.queryTranslator.translateWhere(where);
  const query = this.buildQueryString({ filters, limit: 1, select });
  
  const path = this.entityMapper.getApiPath(model);
  const url = `${this.baseUrl}/${path}?${query}`;
  
  const response = await this.httpClient.request({
    method: 'GET',
    url,
    headers: this.buildHeaders()
  });
  
  const normalized = this.responseNormalizer.normalizeSingle(response);
  return normalized ? this.entityMapper.transformInbound(model, normalized) : null;
}
```

#### 2.3.3 Bulk Operations

```typescript
async updateMany({ model, where, update }): Promise<number> {
  // 1. Find all matching records
  const items = await this.findMany({ model, where, select: ['id'] });
  
  // 2. Batch update with concurrency control
  const batchSize = 50;
  const concurrency = 3;
  let updated = 0;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const promises = batch.map(item => 
      this.update({ model, where: { id: item.id }, update })
    );
    
    // Execute with concurrency limit
    const results = await this.executeConcurrent(promises, concurrency);
    updated += results.filter(r => r.success).length;
  }
  
  return updated;
}
```

---

## 3. Implementation Specifications

### 3.1 Interface Definitions

```typescript
// Main adapter interface (Better Auth requirement)
interface BetterAuthAdapter {
  create<T>(params: CreateParams): Promise<T>;
  update<T>(params: UpdateParams): Promise<T>;
  updateMany(params: UpdateManyParams): Promise<number>;
  delete<T>(params: DeleteParams): Promise<T>;
  deleteMany(params: DeleteManyParams): Promise<number>;
  findOne<T>(params: FindOneParams): Promise<T | null>;
  findMany<T>(params: FindManyParams): Promise<T[]>;
  count(params: CountParams): Promise<number>;
}

// Parameter types
interface CreateParams {
  model: string;
  data: Record<string, any>;
  select?: string[];
}

interface UpdateParams {
  model: string;
  where: Record<string, any>;
  update: Record<string, any>;
  select?: string[];
}

interface FindOneParams {
  model: string;
  where: Record<string, any>;
  select?: string[];
}

interface FindManyParams {
  model: string;
  where?: Record<string, any>;
  select?: string[];
  pagination?: {
    page?: number;
    limit?: number;
    offset?: number;
  };
  orderBy?: Record<string, 'asc' | 'desc'>;
}
```

### 3.2 Error Types

```typescript
enum AdapterErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN'
}

class AdapterError extends Error {
  constructor(
    public code: AdapterErrorCode,
    public message: string,
    public details?: any,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}
```

### 3.3 Observability Interface

```typescript
interface ObservabilityProvider {
  // Log adapter operations
  logOperation(params: {
    operation: string;
    model: string;
    duration: number;
    success: boolean;
    error?: Error;
  }): void;
  
  // Track metrics
  recordMetric(params: {
    name: string;
    value: number;
    tags?: Record<string, string>;
  }): void;
  
  // Create trace span
  startSpan(name: string): Span;
}

interface Span {
  setTag(key: string, value: any): void;
  finish(): void;
}
```

---

## 4. Task Breakdown

### Phase 1: Foundation (Week 1)

#### Task 1.1: Project Setup
**Description**: Initialize package structure and dependencies
**Acceptance Criteria**:
- Package.json configured with all dependencies
- TypeScript configuration set up
- Build pipeline configured
- Linting and formatting rules established

**Subtasks**:
1. Create package directory structure
2. Install dependencies (better-auth, @nestjsx/crud-request, etc.)
3. Configure TypeScript with strict mode
4. Set up ESLint and Prettier
5. Configure Jest for testing
6. Create build scripts

#### Task 1.2: Core Interfaces
**Description**: Define all TypeScript interfaces and types
**Acceptance Criteria**:
- All adapter interfaces defined
- Error types implemented
- Configuration interfaces complete
- Type exports configured

**Subtasks**:
1. Define BetterAuthAdapter interface
2. Create parameter type definitions
3. Implement error class hierarchy
4. Define configuration interfaces
5. Create type index file

#### Task 1.3: HttpClient Implementation
**Description**: Implement HTTP client with retry logic
**Acceptance Criteria**:
- Request execution working
- Retry logic implemented with exponential backoff
- Timeout handling functional
- Error mapping complete

**Subtasks**:
1. Implement base request method
2. Add retry logic with configurable backoff
3. Implement timeout handling
4. Create error mapping function
5. Add request/response logging
6. Write unit tests

### Phase 2: Query Translation (Week 1-2)

#### Task 2.1: QueryTranslator Implementation
**Description**: Build query translation layer
**Acceptance Criteria**:
- Where clause translation working
- Pagination parameters correct
- Field selection functional
- Email normalization applied

**Subtasks**:
1. Implement translateWhere method
2. Build pagination parameter construction
3. Create field selection builder
4. Add email normalization logic
5. Implement scope injection for multi-tenancy
6. Write comprehensive unit tests

#### Task 2.2: ResponseNormalizer Implementation
**Description**: Handle various response formats
**Acceptance Criteria**:
- Array responses parsed correctly
- Paginated responses handled
- Single item extraction working
- Count extraction functional

**Subtasks**:
1. Implement array response normalization
2. Handle paginated response format
3. Create single item extractor
4. Build count extraction logic
5. Add 404 handling
6. Write unit tests

### Phase 3: CRUD Operations (Week 2)

#### Task 3.1: Create and Update Methods
**Description**: Implement create and update operations
**Acceptance Criteria**:
- Create method functional
- Update method working
- Data transformation applied
- Validation in place

**Subtasks**:
1. Implement create method
2. Implement update method
3. Add data transformation logic
4. Create validation framework
5. Handle unique constraint violations
6. Write integration tests

#### Task 3.2: Find Operations
**Description**: Implement find methods
**Acceptance Criteria**:
- FindOne working with ID and query
- FindMany with pagination functional
- Field selection working
- Null handling correct for 404s

**Subtasks**:
1. Implement findOne with ID lookup
2. Add findOne with query support
3. Implement findMany with filters
4. Add pagination support
5. Implement field selection
6. Write integration tests

#### Task 3.3: Delete Operations
**Description**: Implement delete methods
**Acceptance Criteria**:
- Single delete functional
- Bulk delete working
- Proper response handling
- Error cases handled

**Subtasks**:
1. Implement single delete
2. Implement deleteMany with batching
3. Add cascading delete handling
4. Handle not found cases
5. Write integration tests

#### Task 3.4: Count Method
**Description**: Implement count operation
**Acceptance Criteria**:
- Count from meta.total working
- Fallback logic functional
- Filtered counts accurate

**Subtasks**:
1. Implement meta.total extraction
2. Add fallback count logic
3. Handle filtered counts
4. Write unit tests

### Phase 4: Advanced Features (Week 2-3)

#### Task 4.1: Bulk Operations Optimization
**Description**: Optimize bulk operations
**Acceptance Criteria**:
- Batch processing implemented
- Concurrency control working
- Progress tracking available
- Error handling robust

**Subtasks**:
1. Implement batch processor
2. Add concurrency limiter
3. Create progress tracker
4. Implement partial failure handling
5. Add retry logic for failed items
6. Write performance tests

#### Task 4.2: Multi-Tenancy Support
**Description**: Add multi-tenancy capabilities
**Acceptance Criteria**:
- Scope injection working
- Tenant isolation verified
- Configuration flexible
- No cross-tenant leaks

**Subtasks**:
1. Implement scope filter injection
2. Add tenant context management
3. Create tenant isolation tests
4. Add configuration validation
5. Write security tests

#### Task 4.3: Observability Integration
**Description**: Add logging and metrics
**Acceptance Criteria**:
- Structured logging implemented
- Metrics collection working
- Trace propagation functional
- Debug mode available

**Subtasks**:
1. Implement logging provider interface
2. Add operation logging
3. Create metrics collection
4. Implement trace propagation
5. Add debug mode with verbose logging
6. Write observability tests

### Phase 5: Testing & Conformance (Week 3)

#### Task 5.1: Unit Test Suite
**Description**: Complete unit test coverage
**Acceptance Criteria**:
- 90%+ code coverage
- All edge cases tested
- Mocks properly implemented
- Tests run in CI

**Subtasks**:
1. Write HttpClient tests
2. Test QueryTranslator thoroughly
3. Test ResponseNormalizer
4. Test all CRUD methods
5. Test error handling
6. Set up coverage reporting

#### Task 5.2: Integration Tests
**Description**: Test against real Apso service
**Acceptance Criteria**:
- Docker compose setup working
- All operations tested end-to-end
- Data consistency verified
- Performance benchmarked

**Subtasks**:
1. Create Docker compose configuration
2. Set up test data seeding
3. Write end-to-end tests
4. Add performance benchmarks
5. Test error scenarios
6. Verify data consistency

#### Task 5.3: Better Auth Conformance
**Description**: Run Better Auth adapter tests
**Acceptance Criteria**:
- All conformance tests passing
- Adapter behavior matches spec
- Edge cases handled correctly

**Subtasks**:
1. Set up Better Auth test suite
2. Run adapter conformance tests
3. Fix any failing tests
4. Add adapter-specific tests
5. Document any deviations

### Phase 6: Documentation & Deployment (Week 3-4)

#### Task 6.1: API Documentation
**Description**: Create comprehensive API docs
**Acceptance Criteria**:
- All methods documented
- Examples provided
- Configuration explained
- Troubleshooting guide included

**Subtasks**:
1. Write method documentation
2. Create configuration guide
3. Add usage examples
4. Write troubleshooting section
5. Create migration guide
6. Generate API reference

#### Task 6.2: Performance Optimization
**Description**: Optimize for production
**Acceptance Criteria**:
- P50 < 100ms achieved
- P95 < 300ms achieved
- Memory usage optimized
- Connection pooling implemented

**Subtasks**:
1. Profile current performance
2. Optimize hot paths
3. Implement connection pooling
4. Add response caching where appropriate
5. Optimize batch operations
6. Run load tests

#### Task 6.3: Production Readiness
**Description**: Prepare for production deployment
**Acceptance Criteria**:
- Security review complete
- Monitoring configured
- Deployment pipeline ready
- Rollback plan documented

**Subtasks**:
1. Conduct security review
2. Set up monitoring dashboards
3. Configure alerts
4. Create deployment scripts
5. Document rollback procedures
6. Perform staging deployment

---

## 5. Quality Standards

### 5.1 Code Quality Standards

#### TypeScript Configuration
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

#### Coding Standards
- **Naming Conventions**:
  - Classes: PascalCase
  - Interfaces: PascalCase with 'I' prefix for implementation interfaces
  - Methods/Functions: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Private members: prefixed with underscore

- **File Organization**:
  - One class per file
  - Related interfaces in same file as implementation
  - Test files co-located with source
  - Index files for public exports

- **Documentation Requirements**:
  - JSDoc for all public methods
  - Inline comments for complex logic
  - README for each module
  - Examples for public APIs

### 5.2 Testing Standards

#### Coverage Requirements
- Unit Tests: 90% minimum coverage
- Integration Tests: All critical paths covered
- Performance Tests: Key operations benchmarked
- Security Tests: All auth flows validated

#### Test Structure
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle normal case', () => {});
    it('should handle edge case', () => {});
    it('should handle error case', () => {});
  });
});
```

### 5.3 Performance Standards

| Operation | P50 Target | P95 Target | Max Timeout |
|-----------|------------|------------|-------------|
| create    | 50ms       | 150ms      | 3000ms      |
| findOne   | 30ms       | 100ms      | 3000ms      |
| findMany  | 75ms       | 200ms      | 5000ms      |
| update    | 50ms       | 150ms      | 3000ms      |
| delete    | 40ms       | 120ms      | 3000ms      |
| bulk ops  | 100ms/item | 300ms/item | 30000ms     |

### 5.4 Security Standards

- All API keys stored in environment variables
- No sensitive data in logs
- Input validation on all public methods
- SQL injection prevention through parameterized queries
- Rate limiting configuration available
- Audit logging for all operations

---

## 6. Testing Strategy

### 6.1 Unit Testing

#### Test Categories
1. **Component Tests**: Individual class/function testing
2. **Integration Tests**: Component interaction testing
3. **Contract Tests**: API contract validation
4. **Performance Tests**: Latency and throughput testing

#### Mock Strategy
```typescript
// Mock Apso service responses
class MockApsoService {
  private responses: Map<string, any> = new Map();
  
  setResponse(path: string, response: any): void {
    this.responses.set(path, response);
  }
  
  async fetch(url: string, options?: any): Promise<Response> {
    const response = this.responses.get(url);
    if (!response) {
      return new Response(null, { status: 404 });
    }
    return new Response(JSON.stringify(response), { status: 200 });
  }
}
```

### 6.2 Integration Testing

#### Test Environment Setup
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5432:5432"
  
  apso-service:
    build: ./apso-service
    environment:
      DATABASE_URL: postgresql://test:test@postgres:5432/test_db
    ports:
      - "3000:3000"
    depends_on:
      - postgres
```

#### Test Data Management
```typescript
class TestDataBuilder {
  async seedUsers(count: number): Promise<User[]>;
  async seedSessions(userId: string, count: number): Promise<Session[]>;
  async cleanup(): Promise<void>;
}
```

### 6.3 Conformance Testing

#### Better Auth Test Suite Integration
```typescript
import { runAdapterTest } from 'better-auth/test';
import { apsoAdapter } from '../src/adapter';

describe('Better Auth Conformance', () => {
  const adapter = apsoAdapter({
    baseUrl: process.env.TEST_APSO_URL,
    apiKey: process.env.TEST_API_KEY
  });
  
  runAdapterTest(adapter);
});
```

### 6.4 Performance Testing

#### Load Test Scenarios
```typescript
interface LoadTestScenario {
  name: string;
  duration: number;
  virtualUsers: number;
  operations: Operation[];
}

const scenarios: LoadTestScenario[] = [
  {
    name: 'Normal Load',
    duration: 300, // 5 minutes
    virtualUsers: 10,
    operations: [
      { type: 'create', weight: 0.1 },
      { type: 'findOne', weight: 0.5 },
      { type: 'findMany', weight: 0.3 },
      { type: 'update', weight: 0.1 }
    ]
  },
  {
    name: 'Peak Load',
    duration: 60, // 1 minute
    virtualUsers: 100,
    operations: [
      { type: 'findOne', weight: 0.7 },
      { type: 'findMany', weight: 0.3 }
    ]
  }
];
```

---

## 7. Error Handling

### 7.1 Error Classification

| Error Type | HTTP Status | Retryable | Action |
|------------|-------------|-----------|---------|
| ValidationError | 400 | No | Return error to client |
| NotFoundError | 404 | No | Return null or error |
| ConflictError | 409 | No | Handle unique constraint |
| UnauthorizedError | 401 | No | Refresh auth token |
| RateLimitError | 429 | Yes | Exponential backoff |
| NetworkError | - | Yes | Retry with backoff |
| TimeoutError | - | Yes | Retry with increased timeout |
| ServerError | 500-599 | Yes | Retry with backoff |

### 7.2 Error Handling Patterns

#### Retry Logic Implementation
```typescript
class RetryHandler {
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryable(error, config)) {
          throw error;
        }
        
        if (attempt < config.maxRetries) {
          const delay = this.calculateDelay(attempt, config);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.initialDelayMs * Math.pow(2, attempt);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5);
    return Math.min(jitteredDelay, config.maxDelayMs);
  }
}
```

#### Error Mapping
```typescript
class ErrorMapper {
  mapHttpError(status: number, body?: any): AdapterError {
    switch (status) {
      case 400:
        return new AdapterError(
          AdapterErrorCode.VALIDATION_ERROR,
          'Validation failed',
          body,
          false
        );
      case 404:
        return new AdapterError(
          AdapterErrorCode.NOT_FOUND,
          'Resource not found',
          body,
          false
        );
      case 409:
        return new AdapterError(
          AdapterErrorCode.CONFLICT,
          'Resource conflict',
          body,
          false
        );
      case 429:
        return new AdapterError(
          AdapterErrorCode.RATE_LIMIT,
          'Rate limit exceeded',
          body,
          true
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new AdapterError(
          AdapterErrorCode.SERVER_ERROR,
          'Server error',
          body,
          true
        );
      default:
        return new AdapterError(
          AdapterErrorCode.UNKNOWN,
          `Unexpected error: ${status}`,
          body,
          false
        );
    }
  }
}
```

### 7.3 Error Recovery Strategies

1. **Transient Errors**: Automatic retry with exponential backoff
2. **Rate Limiting**: Queue and throttle requests
3. **Connection Errors**: Circuit breaker pattern
4. **Timeout Errors**: Increase timeout and retry
5. **Validation Errors**: Log and return to caller

---

## 8. Performance Requirements

### 8.1 Latency Targets

| Percentile | Target | Maximum |
|------------|--------|---------|
| P50 | 100ms | 150ms |
| P75 | 150ms | 200ms |
| P95 | 300ms | 500ms |
| P99 | 500ms | 1000ms |

### 8.2 Throughput Requirements

- Minimum: 100 requests/second per instance
- Target: 500 requests/second per instance
- Peak: 1000 requests/second with horizontal scaling

### 8.3 Optimization Strategies

#### Connection Pooling
```typescript
class ConnectionPool {
  private readonly maxConnections: number = 10;
  private readonly connections: Connection[] = [];
  private readonly waiting: Array<(conn: Connection) => void> = [];
  
  async getConnection(): Promise<Connection> {
    const available = this.connections.find(c => !c.inUse);
    if (available) {
      available.inUse = true;
      return available;
    }
    
    if (this.connections.length < this.maxConnections) {
      const conn = await this.createConnection();
      this.connections.push(conn);
      return conn;
    }
    
    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }
  
  releaseConnection(conn: Connection): void {
    conn.inUse = false;
    const waiter = this.waiting.shift();
    if (waiter) {
      conn.inUse = true;
      waiter(conn);
    }
  }
}
```

#### Response Caching
```typescript
class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize = 1000;
  private readonly ttlMs = 60000; // 1 minute
  
  set(key: string, value: any): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttlMs
    });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
}
```

#### Batch Operation Optimization
```typescript
class BatchProcessor {
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize: number;
      concurrency: number;
      onProgress?: (completed: number, total: number) => void;
    }
  ): Promise<R[]> {
    const results: R[] = [];
    const { batchSize, concurrency, onProgress } = options;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await this.processWithConcurrency(
        batch,
        processor,
        concurrency
      );
      
      results.push(...batchResults);
      
      if (onProgress) {
        onProgress(results.length, items.length);
      }
    }
    
    return results;
  }
  
  private async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];
    
    for (const item of items) {
      const promise = processor(item).then(result => {
        results.push(result);
      });
      
      executing.push(promise);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => p === promise),
          1
        );
      }
    }
    
    await Promise.all(executing);
    return results;
  }
}
```

---

## 9. Security Considerations

### 9.1 Authentication & Authorization

#### API Key Management
```typescript
class ApiKeyManager {
  private currentKey: string;
  private rotationInterval: number = 86400000; // 24 hours
  
  async getApiKey(): Promise<string> {
    // Retrieve from secure storage (e.g., AWS Secrets Manager)
    if (this.shouldRotate()) {
      await this.rotateKey();
    }
    return this.currentKey;
  }
  
  private async rotateKey(): Promise<void> {
    // Implement key rotation logic
    const newKey = await this.generateNewKey();
    await this.updateKeyInSecureStorage(newKey);
    this.currentKey = newKey;
  }
}
```

### 9.2 Input Validation

#### Validation Rules
```typescript
class InputValidator {
  private readonly rules: Map<string, ValidationRule[]> = new Map([
    ['user', [
      { field: 'email', type: 'email', required: true, maxLength: 255 },
      { field: 'name', type: 'string', maxLength: 100 },
      { field: 'image', type: 'url', maxLength: 500 }
    ]],
    ['session', [
      { field: 'sessionToken', type: 'string', required: true, pattern: /^[a-zA-Z0-9-_]+$/ },
      { field: 'userId', type: 'uuid', required: true },
      { field: 'expiresAt', type: 'date', required: true }
    ]]
  ]);
  
  validate(model: string, data: any): ValidationResult {
    const modelRules = this.rules.get(model);
    if (!modelRules) {
      return { valid: true };
    }
    
    const errors: ValidationError[] = [];
    
    for (const rule of modelRules) {
      const value = data[rule.field];
      
      if (rule.required && !value) {
        errors.push({
          field: rule.field,
          message: `${rule.field} is required`
        });
        continue;
      }
      
      if (value && !this.validateType(value, rule)) {
        errors.push({
          field: rule.field,
          message: `Invalid ${rule.type} format`
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### 9.3 Data Protection

#### Sensitive Data Handling
```typescript
class SensitiveDataHandler {
  private readonly sensitiveFields = new Set([
    'password',
    'hashedPassword',
    'sessionToken',
    'apiKey',
    'refreshToken'
  ]);
  
  sanitizeForLogging(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const sanitized = { ...data };
    
    for (const key of Object.keys(sanitized)) {
      if (this.sensitiveFields.has(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeForLogging(sanitized[key]);
      }
    }
    
    return sanitized;
  }
}
```

### 9.4 Multi-Tenancy Security

#### Tenant Isolation
```typescript
class TenantIsolation {
  private readonly scopeField: string = 'workspaceId';
  
  applyTenantScope(filters: any[], tenantId: string): any[] {
    return [
      ...filters,
      { field: this.scopeField, operator: 'equals', value: tenantId }
    ];
  }
  
  validateTenantAccess(data: any, tenantId: string): boolean {
    return data[this.scopeField] === tenantId;
  }
  
  injectTenantScope(data: any, tenantId: string): any {
    return {
      ...data,
      [this.scopeField]: tenantId
    };
  }
}
```

---

## 10. Documentation Requirements

### 10.1 API Documentation Structure

```markdown
# Better Auth Apso Adapter API Reference

## Installation
\`\`\`bash
npm install @company/better-auth-apso-adapter
\`\`\`

## Configuration
\`\`\`typescript
import { apsoAdapter } from '@company/better-auth-apso-adapter';

const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL,
  apiKey: process.env.APSO_API_KEY,
  // Optional configurations
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 100
  }
});
\`\`\`

## Methods

### create(params)
Creates a new record in the specified model.

**Parameters:**
- model: string - The model name
- data: object - The data to create
- select?: string[] - Fields to return

**Returns:** Promise<T> - The created record

**Example:**
\`\`\`typescript
const user = await adapter.create({
  model: 'user',
  data: {
    email: 'user@example.com',
    name: 'John Doe'
  }
});
\`\`\`
```

### 10.2 Usage Examples

#### Basic Authentication Flow
```typescript
// Sign up a new user
const user = await adapter.create({
  model: 'user',
  data: {
    email: 'user@example.com',
    emailVerified: false,
    name: 'John Doe'
  }
});

// Create verification token
const token = await adapter.create({
  model: 'verificationToken',
  data: {
    identifier: user.email,
    token: generateToken(),
    expiresAt: new Date(Date.now() + 3600000)
  }
});

// Verify email
const verificationToken = await adapter.findOne({
  model: 'verificationToken',
  where: { token: submittedToken }
});

if (verificationToken) {
  await adapter.update({
    model: 'user',
    where: { email: verificationToken.identifier },
    update: { emailVerified: true }
  });
  
  await adapter.delete({
    model: 'verificationToken',
    where: { token: submittedToken }
  });
}

// Create session
const session = await adapter.create({
  model: 'session',
  data: {
    sessionToken: generateSessionToken(),
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000)
  }
});
```

### 10.3 Troubleshooting Guide

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| 404 errors on create | Incorrect API path | Check usePlural configuration |
| Timeout errors | Network latency | Increase timeout configuration |
| 401 errors | Invalid API key | Verify API key in environment |
| Duplicate key errors | Unique constraint violation | Handle conflict errors |
| Bulk operations slow | Large dataset | Adjust batch size and concurrency |

### 10.4 Migration Guide

#### From Cognito to Better Auth
```typescript
// Step 1: Export Cognito users
const cognitoUsers = await exportCognitoUsers();

// Step 2: Transform and import
for (const cognitoUser of cognitoUsers) {
  const user = {
    email: cognitoUser.email.toLowerCase(),
    emailVerified: cognitoUser.email_verified,
    name: cognitoUser.name,
    image: cognitoUser.picture
  };
  
  try {
    await adapter.create({
      model: 'user',
      data: user
    });
  } catch (error) {
    if (error.code === 'CONFLICT') {
      // User already exists, update instead
      await adapter.update({
        model: 'user',
        where: { email: user.email },
        update: user
      });
    }
  }
}

// Step 3: Invalidate Cognito sessions
await invalidateCognitoSessions();
```

---

## 11. Risk Assessment

### 11.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| API Breaking Changes | Medium | High | Version pinning, contract tests |
| Performance Degradation | Medium | High | Performance monitoring, caching |
| Network Instability | Low | Medium | Retry logic, circuit breakers |
| Data Inconsistency | Low | High | Transaction support, validation |
| Security Vulnerabilities | Low | Critical | Security audits, penetration testing |

### 11.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Service Downtime | Low | High | Multi-region deployment, failover |
| Key Rotation Failure | Low | Medium | Automated rotation, monitoring |
| Rate Limiting | Medium | Medium | Request throttling, queuing |
| Database Overload | Low | High | Connection pooling, read replicas |

### 11.3 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Migration Failures | Medium | High | Phased rollout, rollback plan |
| User Experience Impact | Low | Medium | Feature flags, A/B testing |
| Compliance Issues | Low | High | Audit logging, data encryption |

### 11.4 Mitigation Strategies

#### Circuit Breaker Implementation
```typescript
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures: number = 0;
  private lastFailureTime: number = 0;
  
  private readonly threshold: number = 5;
  private readonly timeout: number = 60000; // 1 minute
  private readonly halfOpenRequests: number = 3;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        this.failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
    this.failures = 0;
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

---

## 12. Success Criteria

### 12.1 Functional Success Criteria

- [ ] All Better Auth adapter methods implemented
- [ ] Email normalization working correctly
- [ ] Bulk operations functional with batching
- [ ] Multi-tenancy support configurable
- [ ] Error mapping comprehensive
- [ ] Retry logic operational

### 12.2 Performance Success Criteria

- [ ] P50 latency < 100ms
- [ ] P95 latency < 300ms
- [ ] Throughput > 500 req/s
- [ ] Memory usage < 256MB
- [ ] CPU usage < 50% under normal load

### 12.3 Quality Success Criteria

- [ ] Code coverage > 90%
- [ ] All Better Auth conformance tests passing
- [ ] No critical security vulnerabilities
- [ ] Documentation complete and reviewed
- [ ] Integration tests passing

### 12.4 Operational Success Criteria

- [ ] Monitoring dashboards configured
- [ ] Alerts set up for critical metrics
- [ ] Runbooks documented
- [ ] Deployment pipeline automated
- [ ] Rollback procedures tested

### 12.5 Business Success Criteria

- [ ] Migration from Cognito completed
- [ ] User authentication working in production
- [ ] Session management stable
- [ ] No increase in authentication failures
- [ ] Cost reduction achieved vs Cognito

---

## Appendix A: Complete Interface Definitions

```typescript
// Complete adapter implementation interface
export interface ApsoAdapter extends BetterAuthAdapter {
  // Core configuration
  readonly config: ApsoAdapterConfig;
  
  // Health check
  healthCheck(): Promise<boolean>;
  
  // Metrics
  getMetrics(): AdapterMetrics;
  
  // Cache management
  clearCache(): void;
  
  // Multi-tenancy
  setTenantContext(tenantId: string): void;
}

// Metrics interface
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
  errorsByType: Map<string, number>;
}

// Extended configuration
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
```

---

## Appendix B: Implementation Checklist

### Week 1 Checklist
- [ ] Project structure created
- [ ] Dependencies installed
- [ ] TypeScript configured
- [ ] Core interfaces defined
- [ ] HttpClient implemented
- [ ] Basic unit tests written
- [ ] CI pipeline configured

### Week 2 Checklist
- [ ] QueryTranslator complete
- [ ] ResponseNormalizer implemented
- [ ] All CRUD methods functional
- [ ] Error handling robust
- [ ] Integration tests written
- [ ] Performance benchmarks run

### Week 3 Checklist
- [ ] Bulk operations optimized
- [ ] Multi-tenancy supported
- [ ] Observability integrated
- [ ] All tests passing
- [ ] Documentation drafted
- [ ] Security review initiated

### Week 4 Checklist
- [ ] Performance optimized
- [ ] Production configuration ready
- [ ] Monitoring configured
- [ ] Documentation complete
- [ ] Staging deployment successful
- [ ] Production rollout plan approved

---

## Appendix C: Code Organization

```
packages/better-auth-apso-adapter/
├── src/
│   ├── adapter/
│   │   ├── index.ts              # Main adapter factory
│   │   ├── ApsoAdapter.ts        # Core adapter implementation
│   │   └── types.ts              # Adapter-specific types
│   ├── client/
│   │   ├── HttpClient.ts         # HTTP client with retry
│   │   ├── ConnectionPool.ts     # Connection pooling
│   │   └── CircuitBreaker.ts     # Circuit breaker pattern
│   ├── query/
│   │   ├── QueryTranslator.ts    # Query translation logic
│   │   ├── FilterBuilder.ts      # Filter construction
│   │   └── PaginationBuilder.ts  # Pagination handling
│   ├── response/
│   │   ├── ResponseNormalizer.ts # Response normalization
│   │   ├── ErrorMapper.ts        # Error mapping
│   │   └── ResponseCache.ts      # Response caching
│   ├── operations/
│   │   ├── CreateOperation.ts    # Create implementation
│   │   ├── ReadOperations.ts     # Find implementations
│   │   ├── UpdateOperations.ts   # Update implementations
│   │   ├── DeleteOperations.ts   # Delete implementations
│   │   └── BulkOperations.ts     # Bulk operation handling
│   ├── security/
│   │   ├── InputValidator.ts     # Input validation
│   │   ├── TenantIsolation.ts    # Multi-tenancy
│   │   └── ApiKeyManager.ts      # API key management
│   ├── observability/
│   │   ├── Logger.ts             # Logging implementation
│   │   ├── Metrics.ts            # Metrics collection
│   │   └── Tracing.ts            # Distributed tracing
│   ├── utils/
│   │   ├── EmailNormalizer.ts    # Email normalization
│   │   ├── RetryHandler.ts       # Retry logic
│   │   └── BatchProcessor.ts     # Batch processing
│   └── index.ts                  # Public exports
├── tests/
│   ├── unit/
│   │   ├── adapter.test.ts
│   │   ├── query.test.ts
│   │   └── response.test.ts
│   ├── integration/
│   │   ├── crud.test.ts
│   │   ├── bulk.test.ts
│   │   └── error.test.ts
│   ├── conformance/
│   │   └── better-auth.test.ts
│   ├── performance/
│   │   └── load.test.ts
│   └── fixtures/
│       ├── mockData.ts
│       └── testHelpers.ts
├── docs/
│   ├── API.md
│   ├── CONFIGURATION.md
│   ├── MIGRATION.md
│   └── TROUBLESHOOTING.md
├── examples/
│   ├── basic-usage.ts
│   ├── advanced-config.ts
│   └── migration-script.ts
├── scripts/
│   ├── build.sh
│   ├── test.sh
│   └── release.sh
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── .prettierrc
└── README.md
```

---

## Conclusion

This comprehensive implementation plan provides a complete blueprint for building the Better Auth Apso Adapter. The plan addresses all technical requirements, quality standards, and operational considerations necessary for a production-ready implementation.

The modular architecture ensures maintainability and testability, while the emphasis on performance optimization and error handling ensures reliability at scale. The detailed task breakdown with acceptance criteria enables accurate project tracking and ensures all requirements are met.

By following this specification, the development team can implement the adapter with confidence, knowing that all edge cases, performance requirements, and security considerations have been addressed. The comprehensive testing strategy ensures the adapter will function correctly in production, while the documentation requirements ensure long-term maintainability.

The success criteria provide clear, measurable goals that align with both technical and business objectives, ensuring the project delivers value to the organization while maintaining high engineering standards.