#!/bin/bash

# Development script for Better Auth + Apso Example
# Starts both backend and frontend in development mode

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if setup has been run
check_setup() {
    if [ ! -d "apso-backend/node_modules" ] || [ ! -d "nextjs-frontend/node_modules" ]; then
        print_error "Dependencies not found. Please run setup first:"
        echo "  ./scripts/setup.sh"
        exit 1
    fi
    
    if [ ! -f "apso-backend/.env" ] || [ ! -f "nextjs-frontend/.env.local" ]; then
        print_error "Environment files not found. Please run setup first:"
        echo "  ./scripts/setup.sh"
        exit 1
    fi
}

# Check if ports are available
check_ports() {
    print_status "Checking if ports are available..."
    
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        print_error "Port 3000 is already in use. Please free it and try again."
        exit 1
    fi
    
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
        print_error "Port 3001 is already in use. Please free it and try again."
        exit 1
    fi
    
    print_success "Ports 3000 and 3001 are available"
}

# Start development servers
start_dev() {
    print_status "Starting development servers..."
    print_status "Frontend will be available at: http://localhost:3000"
    print_status "Backend will be available at: http://localhost:3001"
    print_status ""
    print_warning "Press Ctrl+C to stop both servers"
    print_status ""
    
    # Use concurrently to run both servers
    npm run dev
}

main() {
    echo "🚀 Starting Better Auth + Apso Example in development mode..."
    echo ""
    
    check_setup
    check_ports
    start_dev
}

main "$@"