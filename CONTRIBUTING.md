# Contributing Guide

Thank you for your interest in contributing to the Better Auth Apso Adapter! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)
- [Getting Help](#getting-help)

## Code of Conduct

This project adheres to a code of conduct that ensures a welcoming environment for everyone. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** (version 8 or higher)
- **Git**
- A **GitHub account**

### Types of Contributions

We welcome various types of contributions:

- 🐛 **Bug reports** - Help us identify and fix issues
- 🚀 **Feature requests** - Suggest new features or improvements
- 📝 **Documentation** - Improve or add to our documentation
- 💻 **Code contributions** - Fix bugs or implement new features
- 🧪 **Testing** - Add or improve tests
- 🎨 **Design** - UI/UX improvements
- 🌍 **Translation** - Help make the project accessible globally

## Development Setup

### 1. Fork the Repository

1. Visit the [repository on GitHub](https://github.com/your-org/apso)
2. Click the "Fork" button in the top-right corner
3. Clone your fork locally:

```bash
git clone https://github.com/YOUR-USERNAME/apso.git
cd apso/packages/better-auth
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

Create a `.env.test` file for testing:

```env
# .env.test
TEST_APSO_BASE_URL=https://test-api.apso.com
TEST_APSO_API_KEY=your-test-api-key
INTEGRATION_TESTS=false  # Set to true for integration tests
```

### 4. Verify Setup

Run the test suite to ensure everything is working:

```bash
npm test
```

Run the build to verify compilation:

```bash
npm run build
```

## Making Changes

### 1. Create a Branch

Create a new branch for your changes:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b bugfix/issue-description
```

Branch naming conventions:
- `feature/feature-name` - for new features
- `bugfix/issue-description` - for bug fixes
- `docs/improvement-description` - for documentation changes
- `refactor/component-name` - for refactoring
- `test/test-description` - for test improvements

### 2. Understand the Codebase

The project is organized as follows:

```
src/
├── adapter/           # Core adapter implementation
│   ├── ApsoAdapter.ts
│   └── ApsoAdapterFactory.ts
├── client/           # HTTP client implementation
│   └── HttpClient.ts
├── operations/       # CRUD operations
│   ├── CreateOperation.ts
│   ├── ReadOperations.ts
│   └── ...
├── query/           # Query translation
│   └── QueryTranslator.ts
├── response/        # Response handling
│   ├── EntityMapper.ts
│   └── ResponseNormalizer.ts
├── utils/           # Utility functions
│   ├── EmailNormalizer.ts
│   ├── RetryHandler.ts
│   └── ...
├── types/           # TypeScript type definitions
│   └── index.ts
└── index.ts         # Main entry point
```

### 3. Make Your Changes

#### For Bug Fixes

1. **Reproduce the issue** - Create a test that demonstrates the bug
2. **Fix the issue** - Make the minimal necessary changes
3. **Verify the fix** - Ensure the test now passes
4. **Check for regressions** - Run the full test suite

#### For New Features

1. **Design the API** - Consider how the feature will be used
2. **Update types** - Add necessary TypeScript definitions
3. **Implement the feature** - Write the actual code
4. **Add tests** - Ensure good test coverage
5. **Update documentation** - Add docs for the new feature

#### Code Organization Guidelines

- **Single responsibility** - Each module should have one clear purpose
- **Consistent naming** - Use clear, descriptive names
- **Proper error handling** - Always handle errors appropriately
- **Type safety** - Use TypeScript features for better type safety
- **Performance considerations** - Be mindful of performance implications

### 4. Write Tests

All changes should include appropriate tests:

#### Unit Tests

```typescript
// tests/unit/EmailNormalizer.test.ts
import { EmailNormalizer } from '@/utils/EmailNormalizer';

describe('EmailNormalizer', () => {
  describe('normalize', () => {
    it('should convert email to lowercase', () => {
      const result = EmailNormalizer.normalize('USER@EXAMPLE.COM');
      expect(result).toBe('user@example.com');
    });

    it('should trim whitespace', () => {
      const result = EmailNormalizer.normalize('  user@example.com  ');
      expect(result).toBe('user@example.com');
    });

    it('should handle null input', () => {
      expect(() => EmailNormalizer.normalize(null as any))
        .toThrow('Email cannot be null or undefined');
    });
  });
});
```

#### Integration Tests

```typescript
// tests/integration/adapter.test.ts
import { apsoAdapter } from '@/index';

describe('Adapter Integration', () => {
  let adapter: any;

  beforeAll(async () => {
    adapter = apsoAdapter({
      baseUrl: process.env.TEST_APSO_BASE_URL!,
      apiKey: process.env.TEST_APSO_API_KEY,
    });
  });

  afterAll(async () => {
    await adapter.close();
  });

  it('should perform CRUD operations', async () => {
    // Test implementation
  });
});
```

#### Test Guidelines

- **Test naming** - Use descriptive test names
- **Test isolation** - Each test should be independent
- **Setup and teardown** - Clean up after tests
- **Mock external dependencies** - Don't rely on external services in unit tests
- **Edge cases** - Test boundary conditions and error scenarios

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests (requires test environment)
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Environment

For integration tests, you'll need access to a test API endpoint:

1. **Request test access** from maintainers
2. **Set environment variables** in `.env.test`
3. **Run integration tests**:

```bash
INTEGRATION_TESTS=true npm run test:integration
```

### Performance Tests

```bash
# Run performance tests
npm run test:performance
```

### Test Coverage

We aim for high test coverage:

- **Unit tests**: >90% coverage
- **Integration tests**: Critical paths covered
- **Edge cases**: Error conditions tested

Check coverage with:

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Code Style

### TypeScript Standards

We use strict TypeScript configuration:

```typescript
// Good
interface UserData {
  readonly id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

function createUser(data: UserData): Promise<User> {
  // Implementation
}

// Avoid
function createUser(data: any): any {
  // Implementation
}
```

### Code Formatting

We use Prettier for code formatting:

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

### Linting

We use ESLint for code quality:

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### Naming Conventions

- **Classes**: PascalCase (`ApsoAdapter`)
- **Functions/Variables**: camelCase (`createAdapter`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)
- **Types/Interfaces**: PascalCase (`AdapterConfig`)
- **Files**: PascalCase for classes, camelCase for utilities

### Documentation Standards

All public APIs must be documented with JSDoc:

```typescript
/**
 * Creates a Better Auth adapter for Apso APIs.
 * 
 * @param config - Configuration options for the adapter
 * @returns Configured adapter instance
 * 
 * @example
 * ```typescript
 * const adapter = apsoAdapter({
 *   baseUrl: 'https://api.example.com',
 *   apiKey: 'your-api-key',
 * });
 * ```
 */
export function apsoAdapter(config: ApsoAdapterConfig): ApsoAdapter {
  // Implementation
}
```

## Submitting Changes

### 1. Before You Submit

- [ ] Code follows style guidelines
- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation is updated
- [ ] Changelog is updated (if applicable)

### 2. Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding/updating tests
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(adapter): add support for bulk operations

Add createMany method to adapter interface to support
batch creation of entities for improved performance.

Closes #123
```

```
fix(retry): handle network timeout errors correctly

Network timeout errors were not being properly classified
as retryable, causing unnecessary failures.

Fixes #456
```

### 3. Pull Request Process

1. **Push your branch** to your fork:
```bash
git push origin feature/your-feature-name
```

2. **Create a Pull Request**:
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill out the PR template

3. **PR Template**:
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
```

### 4. Review Process

1. **Automated checks** run on your PR
2. **Maintainer review** - usually within 48 hours
3. **Address feedback** - make requested changes
4. **Approval and merge** - once approved, we'll merge

#### Review Criteria

- **Code quality** - Clean, readable, maintainable
- **Test coverage** - Adequate tests for changes
- **Documentation** - Updated docs where needed
- **Performance** - No significant performance regressions
- **Compatibility** - Maintains backward compatibility

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0) - Breaking changes
- **MINOR** (0.1.0) - New features, backward compatible
- **PATCH** (0.0.1) - Bug fixes, backward compatible

### Release Steps

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with changes
3. **Create release commit**:
```bash
git commit -m "chore: release v1.2.3"
```
4. **Create tag**:
```bash
git tag -a v1.2.3 -m "Release v1.2.3"
```
5. **Push changes**:
```bash
git push origin main --tags
```

### Automated Release

We use GitHub Actions for automated releases:

- **On tag push**: Builds and publishes to npm
- **On PR merge**: Updates development builds
- **Weekly**: Dependency updates

## Getting Help

### Where to Ask Questions

- **GitHub Discussions** - General questions and ideas
- **GitHub Issues** - Bug reports and feature requests
- **Discord** - Real-time chat (if available)

### Documentation

- [README.md](./README.md) - Getting started
- [API Reference](./docs/api-reference.md) - Complete API docs
- [Configuration Guide](./docs/configuration.md) - Configuration options
- [Examples](./docs/examples.md) - Usage examples
- [Troubleshooting](./docs/troubleshooting.md) - Common issues

### Maintainer Contact

- **Project Lead**: [Maintainer Name] (@username)
- **Core Team**: Listed in package.json
- **Response Time**: Usually within 48 hours

## Development Workflow

### Daily Development

1. **Sync your fork**:
```bash
git fetch upstream
git checkout main
git merge upstream/main
```

2. **Create feature branch**:
```bash
git checkout -b feature/new-feature
```

3. **Make changes and test**:
```bash
npm test
npm run lint
npm run format
```

4. **Commit and push**:
```bash
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
```

5. **Create PR** when ready

### Debugging Tips

1. **Enable debug mode**:
```typescript
const adapter = apsoAdapter({
  baseUrl: process.env.APSO_BASE_URL!,
  debugMode: true,
});
```

2. **Use test environment**:
```bash
NODE_ENV=test npm test
```

3. **Inspect network requests**:
```typescript
// Add logging to HttpClient
console.log('Request:', config);
```

### Best Practices

- **Small commits** - Make focused, atomic commits
- **Descriptive messages** - Clear commit and PR descriptions
- **Test thoroughly** - Don't skip testing
- **Document changes** - Update docs with your changes
- **Stay current** - Keep your fork up to date

## Recognition

Contributors are recognized in several ways:

- **Contributors list** in README
- **Release notes** mention contributors
- **Special recognition** for significant contributions

Thank you for contributing to the Better Auth Apso Adapter! Your contributions help make authentication better for everyone. 🚀