#!/bin/bash
set -e

echo "🧹 Cleaning previous build..."
rm -rf dist

echo "🔍 Running type checks..."
npx tsc --noEmit

echo "📦 Building TypeScript..."
npx tsc

echo "✨ Build completed successfully!"
echo "📂 Output directory: dist/"
ls -la dist/ || echo "No dist directory found"