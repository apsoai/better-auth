#!/bin/bash

# Test CI/CD Pipeline Locally
# This script runs the same checks that will run in CI/CD

set -e

echo "🚀 Running CI/CD Pipeline Tests Locally"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "success" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "error" ]; then
        echo -e "${RED}❌ $message${NC}"
    elif [ "$status" = "warning" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    else
        echo -e "${BLUE}ℹ️  $message${NC}"
    fi
}

# Function to run a command and capture its status
run_check() {
    local name=$1
    local command=$2
    
    echo ""
    echo -e "${BLUE}Running: $name${NC}"
    echo "Command: $command"
    echo "----------------------------------------"
    
    if eval "$command"; then
        print_status "success" "$name passed"
        return 0
    else
        print_status "error" "$name failed"
        return 1
    fi
}

# Initialize counters
PASSED=0
FAILED=0
TOTAL=0

# Function to track test results
track_result() {
    TOTAL=$((TOTAL + 1))
    if [ $1 -eq 0 ]; then
        PASSED=$((PASSED + 1))
    else
        FAILED=$((FAILED + 1))
    fi
}

echo ""
print_status "info" "Starting CI/CD pipeline simulation..."

# Clean build artifacts
print_status "info" "Cleaning build artifacts..."
npm run clean > /dev/null 2>&1 || true

# 1. Dependency Check
run_check "Dependency Installation" "npm ci --silent"
track_result $?

# 2. Linting
run_check "ESLint Code Quality Check" "npm run lint"
track_result $?

# 3. Code Formatting
run_check "Prettier Code Formatting Check" "npm run format:check"
track_result $?

# 4. TypeScript Compilation
run_check "TypeScript Type Checking" "npm run typecheck"
track_result $?

# 5. Unit Tests
run_check "Unit Tests" "npm run test:unit"
track_result $?

# 6. Conformance Tests
run_check "Better Auth Conformance Tests" "npm run test:conformance"
track_result $?

# 7. Performance Tests
run_check "Performance Tests" "npm run test:performance"
track_result $?

# 8. Test Coverage
run_check "Test Coverage Report" "npm run test:coverage"
track_result $?

# 9. Build Process
run_check "TypeScript Build" "npm run build"
track_result $?

# 10. Package Validation
run_check "Package Validation" "npm pack --dry-run"
track_result $?

# 11. Security Audit
run_check "Security Audit" "npm audit --audit-level=moderate"
track_result $?

# 12. License Check (if license-checker is available)
if command -v license-checker >/dev/null 2>&1; then
    run_check "License Compatibility Check" "license-checker --summary --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD' --excludePrivatePackages"
    track_result $?
else
    print_status "warning" "license-checker not installed, skipping license check"
fi

# Summary
echo ""
echo "======================================="
echo "🏁 CI/CD Pipeline Test Summary"
echo "======================================="

if [ $FAILED -eq 0 ]; then
    print_status "success" "All $TOTAL checks passed! 🎉"
    echo ""
    echo "✅ Your code is ready for CI/CD pipeline"
    echo "✅ All quality gates will pass"
    echo "✅ Package can be published successfully"
else
    print_status "error" "$FAILED out of $TOTAL checks failed"
    echo ""
    echo "❌ Fix the failing checks before pushing"
    echo "❌ CI/CD pipeline will fail with current code"
fi

echo ""
echo "Results:"
echo "  - Passed: $PASSED"
echo "  - Failed: $FAILED"
echo "  - Total:  $TOTAL"

# Additional Information
echo ""
echo "======================================="
echo "📋 Next Steps"
echo "======================================="

if [ $FAILED -eq 0 ]; then
    echo "1. Commit your changes:"
    echo "   git add ."
    echo "   git commit -m 'feat: your commit message'"
    echo ""
    echo "2. Push to remote:"
    echo "   git push origin your-branch"
    echo ""
    echo "3. Create a pull request"
    echo "   The CI/CD pipeline will run automatically"
else
    echo "1. Fix the failing checks listed above"
    echo "2. Re-run this script to verify fixes:"
    echo "   ./scripts/test-ci-locally.sh"
    echo "3. Only push once all checks pass"
fi

echo ""
echo "🔗 Useful commands:"
echo "  - npm run lint:fix     # Auto-fix linting issues"
echo "  - npm run format       # Auto-format code"
echo "  - npm run test:watch   # Run tests in watch mode"
echo "  - npm run dev          # Start development mode"

# Exit with appropriate code
if [ $FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi