# Contributing to Better Auth Apso Adapter

Thank you for your interest in contributing to the Better Auth Apso Adapter! This document provides guidelines and information for contributors.

## Table of Contents

- [Development Setup](#development-setup)
- [Contributing Process](#contributing-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [CI/CD Pipeline](#cicd-pipeline)

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/apso.git
   cd apso/packages/better-auth
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

5. **Start development mode:**
   ```bash
   npm run dev
   ```

## Contributing Process

### 1. Issue Creation

- Check existing issues before creating new ones
- Use the appropriate issue template (bug report, feature request)
- Provide detailed information and context
- Add relevant labels and assign to appropriate team members

### 2. Branch Strategy

- `main` - Production-ready code, protected branch
- `develop` - Integration branch for features, creates beta releases
- `feature/*` - Feature development branches
- `bugfix/*` - Bug fix branches
- `hotfix/*` - Critical production fixes

### 3. Development Workflow

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... development work ...

# Run quality checks
npm run ci

# Commit your changes (see commit guidelines)
git add .
git commit -m "feat: add new feature description"

# Push your branch
git push origin feature/your-feature-name

# Create a pull request
```

## Coding Standards

### TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer interfaces over types when possible
- Use generic types for reusable functionality
- Document complex types with JSDoc comments
- Use utility types when appropriate

### Code Style

- Follow the ESLint and Prettier configuration
- Use meaningful variable and function names
- Keep functions small and focused
- Add JSDoc comments for public APIs
- Use async/await over Promises where possible

### File Organization

```
src/
├── adapters/           # Adapter implementations
├── types/             # Type definitions
├── utils/             # Utility functions
├── errors/            # Custom error classes
├── constants/         # Constants and enums
└── index.ts          # Main exports
```

## Testing Guidelines

### Test Types

1. **Unit Tests** (`tests/unit/`)
   - Test individual functions and classes
   - Mock external dependencies
   - Focus on business logic

2. **Conformance Tests** (`tests/conformance/`)
   - Test Better Auth adapter contract compliance
   - Ensure all required methods are implemented
   - Validate adapter behavior

3. **Performance Tests** (`tests/performance/`)
   - Benchmark critical operations
   - Memory usage validation
   - Concurrent operation testing

4. **Integration Tests** (`tests/integration/`)
   - Test real API interactions
   - End-to-end workflow validation
   - Configuration testing

### Writing Tests

- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Use proper mocking for external dependencies
- Test both success and error scenarios
- Maintain >90% test coverage

```typescript
describe('ApsoAdapter', () => {
  describe('createUser', () => {
    it('should create a user successfully with valid data', async () => {
      // Arrange
      const userData = { email: 'test@example.com', name: 'Test User' };
      const mockResponse = { id: '123', ...userData };
      mockApiClient.post.mockResolvedValue(mockResponse);

      // Act
      const result = await adapter.createUser(userData);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith('/users', userData);
    });
  });
});
```

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning and changelog generation.

### Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

- `feat` - New feature (triggers minor version bump)
- `fix` - Bug fix (triggers patch version bump)
- `docs` - Documentation changes
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code refactoring without functionality changes
- `test` - Adding or updating tests
- `chore` - Maintenance tasks, dependency updates
- `ci` - CI/CD pipeline changes
- `perf` - Performance improvements
- `build` - Build system changes

### Examples

```bash
# Feature
git commit -m "feat: add user session management"
git commit -m "feat(auth): implement OAuth2 provider support"

# Bug fix
git commit -m "fix: resolve user creation validation error"
git commit -m "fix(adapter): handle null response from API"

# Breaking change
git commit -m "feat!: redesign adapter configuration API"
# or
git commit -m "feat: redesign adapter API

BREAKING CHANGE: The configuration object structure has changed.
See migration guide for details."
```

## Pull Request Process

### Before Creating a PR

1. **Run all quality checks:**
   ```bash
   npm run ci
   ```

2. **Update documentation if needed**
3. **Add/update tests for new functionality**
4. **Update CHANGELOG.md if making significant changes**

### PR Requirements

- [ ] All CI checks pass
- [ ] Tests maintain >90% coverage
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] Breaking changes are documented
- [ ] PR template is filled out completely

### Review Process

1. **Automated Checks** - CI pipeline runs automatically
2. **Code Review** - At least one team member review required
3. **Testing** - Manual testing if needed
4. **Approval** - PR approved by maintainer
5. **Merge** - Squash and merge to maintain clean history

## Release Process

### Automatic Releases

The project uses semantic-release for automatic versioning:

- **Main branch** - Production releases (latest tag)
- **Develop branch** - Beta releases (beta tag)
- **Feature branches** - Canary releases (canary tag)

### Release Types

- **Patch** (1.0.1) - Bug fixes, non-breaking changes
- **Minor** (1.1.0) - New features, backward compatible
- **Major** (2.0.0) - Breaking changes

### Manual Release Process

1. **Ensure main branch is ready**
2. **Create release tag:**
   ```bash
   git tag -a v1.2.3 -m "Release v1.2.3"
   git push origin v1.2.3
   ```
3. **Release workflow runs automatically**
4. **GitHub release created with changelog**
5. **Package published to npm**

## CI/CD Pipeline

### Workflows

1. **CI/CD Pipeline** (`.github/workflows/ci-cd.yml`)
   - Runs on push/PR to main/develop
   - Tests, linting, building
   - Canary/stable publishing

2. **Release** (`.github/workflows/release.yml`)
   - Triggered by version tags
   - Creates GitHub releases
   - Publishes to npm with proper tags

3. **Dependency Review** (`.github/workflows/dependency-review.yml`)
   - Reviews new dependencies in PRs
   - Security and license checking

4. **Maintenance** (`.github/workflows/maintenance.yml`)
   - Weekly scheduled maintenance
   - Security audits, health checks
   - Repository cleanup

### Quality Gates

All code must pass:
- ✅ ESLint (code quality)
- ✅ Prettier (code formatting)
- ✅ TypeScript compilation
- ✅ Unit tests (>90% coverage)
- ✅ Conformance tests
- ✅ Performance tests
- ✅ Security audit
- ✅ Build verification

### Environment Secrets

Required GitHub secrets:
- `NPM_TOKEN` - npm registry authentication
- `GITHUB_TOKEN` - Automatically provided

## Getting Help

- **Questions** - Use GitHub Discussions
- **Bugs** - Create an issue with bug report template
- **Features** - Create an issue with feature request template
- **Security** - Email security@mavric.team
- **Code Review** - Tag `@mavric-team` in PR

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive environment for all contributors.

## License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](LICENSE).