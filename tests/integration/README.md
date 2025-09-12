# Integration Tests

This directory contains comprehensive integration tests for the Better Auth Apso adapter that use the real Apso SDK to validate end-to-end functionality with actual API communication.

## Overview

The integration tests are designed to:
- **Use Real Apso SDK**: Test with actual HTTP communication, not mocked responses
- **Validate End-to-End Functionality**: Ensure the adapter works correctly with real API operations
- **Test Error Scenarios**: Validate network failures, timeouts, and API error handling
- **Measure Performance**: Benchmark actual response times and throughput
- **Ensure Data Integrity**: Test data consistency and referential integrity

## Test Structure

### Test Files

- **`setup.ts`** - Integration test infrastructure and utilities
- **`ApsoSDKIntegration.test.ts`** - Main integration tests with real SDK operations
- **`PerformanceIntegration.test.ts`** - Performance benchmarks and load testing
- **`ErrorHandlingIntegration.test.ts`** - Network failure and error scenario testing
- **`ConfigurationIntegration.test.ts`** - Different adapter configuration testing
- **`DataIntegrityIntegration.test.ts`** - Data consistency and cleanup validation
- **`skipEnvironment.js`** - Jest environment for conditional test execution

### Test Categories

#### 1. Core Operations Testing
- User CRUD operations with real API calls
- Session management with actual token generation
- Account linking and OAuth provider integration
- Verification token handling

#### 2. Performance Testing
- Response time benchmarks (P95 < 300ms targets)
- Bulk operation efficiency
- Concurrent request handling
- Memory usage validation

#### 3. Error Handling Testing
- Network timeout scenarios
- Connection failure recovery
- HTTP error response handling
- Rate limiting behavior

#### 4. Configuration Testing
- Different timeout settings
- Retry configuration validation
- Batch processing settings
- Email normalization options

#### 5. Data Integrity Testing
- Referential integrity validation
- Concurrent operation safety
- Data cleanup verification
- Cascade deletion testing

## Environment Setup

### Required Environment Variables

Integration tests only run when properly configured:

```bash
# Enable integration tests (required)
export INTEGRATION_TESTS=true

# API configuration (required)
export APSO_TEST_BASE_URL="https://your-api-endpoint.com/api"

# Optional configuration
export APSO_TEST_API_KEY="your-test-api-key"
export APSO_TEST_TIMEOUT="5000"
export APSO_TEST_MAX_RETRIES="3"
export APSO_TEST_CLEANUP="true"  # Set to 'false' to disable cleanup
```

### Test Environment Requirements

1. **API Endpoint**: A running Apso-compatible API for testing
2. **Test Database**: Dedicated test database (will be modified during tests)
3. **Network Access**: Reliable internet connection for API communication
4. **Permissions**: API credentials with full CRUD permissions

## Running Integration Tests

### Individual Test Suites

```bash
# Run all integration tests (with environment setup)
npm run test:integration

# Run integration tests with existing environment
npm run test:integration:with-env

# Run specific integration test files
npx jest tests/integration/ApsoSDKIntegration.test.ts
npx jest tests/integration/PerformanceIntegration.test.ts
npx jest tests/integration/ErrorHandlingIntegration.test.ts

# Run with custom environment
INTEGRATION_TESTS=true APSO_TEST_BASE_URL="http://localhost:3000" npm run test:integration
```

### Combined Test Execution

```bash
# Run all integration and performance tests
npm run test:all-integration

# Run with verbose output
INTEGRATION_TESTS=true npx jest --selectProjects integration --verbose

# Run specific test patterns
INTEGRATION_TESTS=true npx jest --testNamePattern="should create user" --selectProjects integration
```

### Performance Testing

```bash
# Run performance tests separately
npm run test:performance

# Run with custom timeout
npx jest --selectProjects performance --testTimeout=60000
```

## Test Configuration

### Integration Test Helper

The `IntegrationTestHelper` class provides:
- **Automatic cleanup**: Tracks and cleans up created test data
- **Performance measurement**: Built-in operation timing
- **Health checking**: API connectivity validation
- **Test data generation**: Consistent test entity creation

```typescript
import { IntegrationTestHelper } from './setup';

const testHelper = new IntegrationTestHelper({
  baseUrl: 'https://api.example.com',
  timeout: 5000,
  enableCleanup: true,
});
```

### Custom Configuration

Override default settings:

```typescript
const customHelper = new IntegrationTestHelper({
  timeout: 10000,
  retryConfig: {
    maxRetries: 5,
    initialDelayMs: 100,
    maxDelayMs: 1000,
  },
  testUserPrefix: 'custom-test-user',
  enableCleanup: false, // Disable for debugging
});
```

## Data Management

### Test Data Cleanup

Integration tests automatically clean up created data:

1. **Automatic Registration**: All entities created through helpers are tracked
2. **Cascade Cleanup**: Related entities (sessions, accounts) are cleaned up first
3. **Error Resilient**: Cleanup continues even if some deletions fail
4. **Configurable**: Can be disabled for debugging purposes

### Test Data Isolation

- **Unique Identifiers**: All test data uses timestamps and random IDs
- **Prefixed Names**: Test entities are prefixed to avoid conflicts
- **Separate Cleanup**: Only test-created data is removed

## Performance Targets

### Response Time Targets
- **User Creation**: P95 < 300ms
- **User Lookup by ID**: P95 < 200ms
- **User Lookup by Email**: P95 < 250ms
- **Session Creation**: P95 < 250ms
- **Session Lookup**: P95 < 200ms (critical for auth)

### Throughput Targets
- **Concurrent Operations**: Handle 10+ concurrent requests
- **Batch Processing**: < 200ms average per user in batches
- **Memory Usage**: < 10MB growth for 50 operations

## Error Scenarios

### Network Failures
- Connection timeouts
- Unreachable hosts
- Network interruptions
- DNS resolution failures

### API Errors
- HTTP 404 (Not Found)
- HTTP 409 (Conflict/Duplicate)
- HTTP 422 (Validation Error)
- HTTP 429 (Rate Limited)
- HTTP 500 (Server Error)

### Data Validation
- Invalid email formats
- Missing required fields
- Constraint violations
- Type mismatches

## Debugging Integration Tests

### Enable Verbose Logging

```bash
# Run with debug output
DEBUG=apso:* INTEGRATION_TESTS=true npm run test:integration

# Run single test with full output
npx jest tests/integration/ApsoSDKIntegration.test.ts --verbose --no-cache
```

### Disable Cleanup for Investigation

```bash
# Keep test data for manual inspection
APSO_TEST_CLEANUP=false INTEGRATION_TESTS=true npm run test:integration
```

### Custom Logger

```typescript
const debugHelper = new IntegrationTestHelper({
  logger: {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug, // Enable debug logs
  },
});
```

## Continuous Integration

### CI Environment Setup

```yaml
# Example GitHub Actions configuration
- name: Run Integration Tests
  env:
    INTEGRATION_TESTS: true
    APSO_TEST_BASE_URL: ${{ secrets.TEST_API_URL }}
    APSO_TEST_API_KEY: ${{ secrets.TEST_API_KEY }}
  run: npm run test:integration
```

### Docker Setup

```dockerfile
# Test environment setup
ENV INTEGRATION_TESTS=true
ENV APSO_TEST_BASE_URL=http://test-api:3000/api
ENV APSO_TEST_CLEANUP=true
```

## Troubleshooting

### Common Issues

1. **Tests Skip Automatically**
   - Ensure `INTEGRATION_TESTS=true` is set
   - Check API connectivity with health check

2. **Network Timeouts**
   - Increase `APSO_TEST_TIMEOUT` value
   - Check API endpoint accessibility
   - Verify network connectivity

3. **API Authentication Failures**
   - Verify `APSO_TEST_API_KEY` is valid
   - Check API key permissions
   - Ensure API endpoint is correct

4. **Database Constraint Errors**
   - Ensure test database is clean before running
   - Check for unique constraint violations
   - Verify test data prefixes are unique

5. **Cleanup Failures**
   - Check API supports DELETE operations
   - Verify cascade deletion is configured
   - Review API permissions for test user

### Health Check

Run the health check independently:

```typescript
import { IntegrationTestHelper } from './tests/integration/setup';

const helper = new IntegrationTestHelper();
const isHealthy = await helper.healthCheck();
console.log('API Health:', isHealthy ? 'OK' : 'Failed');
```

## Best Practices

### Writing Integration Tests

1. **Use Test Helpers**: Always use `IntegrationTestHelper` for consistent data management
2. **Measure Performance**: Use `measureOperation()` for timing critical operations
3. **Handle Failures Gracefully**: Expect and test error scenarios
4. **Clean Test Data**: Ensure all created data is properly tracked and cleaned
5. **Validate Structure**: Use `toHaveValidEntityStructure()` matcher

### Test Organization

1. **Group Related Tests**: Use `describe` blocks for logical grouping
2. **Clear Test Names**: Be specific about what each test validates
3. **Setup and Teardown**: Use `beforeEach`/`afterEach` for test isolation
4. **Error Documentation**: Document expected error scenarios

### Performance Considerations

1. **Batch Operations**: Test bulk operations when possible
2. **Connection Reuse**: Use single adapter instance per test suite
3. **Concurrent Testing**: Test realistic concurrency levels
4. **Resource Monitoring**: Monitor memory and connection usage

## Contributing

When adding new integration tests:

1. **Follow Patterns**: Use existing test structure and helpers
2. **Add Cleanup**: Ensure new test data is properly registered for cleanup
3. **Document Performance**: Add performance expectations for new operations
4. **Test Error Cases**: Include corresponding error scenario tests
5. **Update Documentation**: Update this README with new test categories

## Security Considerations

- **Test Data**: Use obviously fake data that's safe to persist temporarily
- **API Keys**: Use test-specific API keys with limited scope
- **Data Cleanup**: Ensure all test data is removed after tests
- **Network Access**: Tests may make real HTTP requests to configured endpoints