#!/bin/bash

# Docker setup script for Better Auth + Apso Example
# Sets up the entire stack using Docker Compose

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

# Check if Docker is available
check_docker() {
    print_status "Checking Docker availability..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker and try again."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
    
    print_success "Docker is available and running"
}

# Stop any running containers
stop_existing() {
    print_status "Stopping any existing containers..."
    docker-compose down --remove-orphans || true
    print_success "Stopped existing containers"
}

# Build and start containers
start_containers() {
    print_status "Building and starting containers..."
    print_status "This may take a few minutes on first run..."
    
    docker-compose up --build -d
    
    print_success "Containers started"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    print_status "Waiting for PostgreSQL..."
    timeout=60
    counter=0
    while ! docker-compose exec -T postgres pg_isready -U postgres -d better_auth_example &> /dev/null; do
        if [ $counter -ge $timeout ]; then
            print_error "PostgreSQL failed to start within $timeout seconds"
            exit 1
        fi
        sleep 1
        counter=$((counter + 1))
        echo -n "."
    done
    echo ""
    print_success "PostgreSQL is ready"
    
    # Wait for backend
    print_status "Waiting for backend..."
    timeout=120
    counter=0
    while ! curl -f http://localhost:3001/health &> /dev/null; do
        if [ $counter -ge $timeout ]; then
            print_error "Backend failed to start within $timeout seconds"
            print_error "Check logs with: docker-compose logs backend"
            exit 1
        fi
        sleep 2
        counter=$((counter + 2))
        echo -n "."
    done
    echo ""
    print_success "Backend is ready"
    
    # Wait for frontend
    print_status "Waiting for frontend..."
    timeout=60
    counter=0
    while ! curl -f http://localhost:3000 &> /dev/null; do
        if [ $counter -ge $timeout ]; then
            print_error "Frontend failed to start within $timeout seconds"
            print_error "Check logs with: docker-compose logs frontend"
            exit 1
        fi
        sleep 2
        counter=$((counter + 2))
        echo -n "."
    done
    echo ""
    print_success "Frontend is ready"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    if docker-compose exec -T backend npm run migration:run; then
        print_success "Database migrations completed"
    else
        print_error "Failed to run database migrations"
        print_error "Check logs with: docker-compose logs backend"
        exit 1
    fi
}

# Show status
show_status() {
    print_success "🎉 Docker setup complete!"
    echo ""
    echo "Services are now running:"
    echo "  📱 Frontend:    http://localhost:3000"
    echo "  🔧 Backend:     http://localhost:3001"
    echo "  🗄️  PostgreSQL:  localhost:5432"
    echo ""
    echo "Useful commands:"
    echo "  📋 View logs:           docker-compose logs -f"
    echo "  🔍 View specific logs:  docker-compose logs -f [frontend|backend|postgres]"
    echo "  🛑 Stop services:       docker-compose down"
    echo "  🔄 Restart services:    docker-compose restart"
    echo "  🧹 Clean up:            docker-compose down --volumes"
    echo ""
    print_status "The application is ready to use!"
}

main() {
    echo "🐳 Setting up Better Auth + Apso Example with Docker..."
    echo ""
    
    check_docker
    stop_existing
    start_containers
    wait_for_services
    run_migrations
    show_status
}

main "$@"