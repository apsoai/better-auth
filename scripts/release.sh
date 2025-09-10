#!/bin/bash
set -e

echo "🚀 Starting release process..."

# Check if we're on the main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  echo "❌ Release must be run from main/master branch. Current branch: $CURRENT_BRANCH"
  exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Working directory is not clean. Please commit all changes before releasing."
  git status --short
  exit 1
fi

echo "🔍 Running linting..."
npm run lint

echo "🔍 Running type checks..."
npm run typecheck

echo "🧪 Running tests..."
npm run test

echo "📦 Building package..."
npm run build

echo "✅ All checks passed! Package is ready for release."
echo "📦 Build output:"
ls -la dist/

echo "🏷️  To publish, run: npm publish"