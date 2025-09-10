#!/bin/bash
set -e

echo "🧪 Running tests..."

# Parse command line arguments
TEST_TYPE=${1:-all}
WATCH=${2:-false}

case $TEST_TYPE in
  "unit")
    echo "Running unit tests..."
    if [ "$WATCH" = "watch" ]; then
      npx jest --testPathPattern=unit --watch
    else
      npx jest --testPathPattern=unit
    fi
    ;;
  "integration")
    echo "Running integration tests..."
    if [ "$WATCH" = "watch" ]; then
      npx jest --testPathPattern=integration --watch
    else
      npx jest --testPathPattern=integration
    fi
    ;;
  "conformance")
    echo "Running conformance tests..."
    npx jest --testPathPattern=conformance
    ;;
  "performance")
    echo "Running performance tests..."
    npx jest --testPathPattern=performance --detectOpenHandles
    ;;
  "coverage")
    echo "Running tests with coverage..."
    npx jest --coverage
    ;;
  "all"|*)
    echo "Running all tests..."
    if [ "$WATCH" = "watch" ]; then
      npx jest --watch
    else
      npx jest
    fi
    ;;
esac

echo "✅ Tests completed!"