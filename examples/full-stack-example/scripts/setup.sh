#!/bin/bash

# Better Auth + Apso Example Setup Script
# This script sets up the complete development environment

set -e  # Exit on any error

echo "🚀 Setting up Better Auth + Apso Full-Stack Example..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL client not found. Make sure PostgreSQL is running."
    fi
    
    print_success "Requirements check complete"
}

# Install Apso CLI globally if not already installed
install_apso_cli() {
    print_status "Checking for Apso CLI..."
    
    if ! command -v apso &> /dev/null; then
        print_status "Installing Apso CLI globally..."
        npm install -g apso-cli
        print_success "Apso CLI installed"
    else
        print_success "Apso CLI is already installed"
    fi
}

# Set up environment variables
setup_env() {
    print_status "Setting up environment variables..."
    
    # Root .env
    if [ ! -f .env ]; then
        cp .env.example .env
        print_success "Created root .env file"
    else
        print_warning "Root .env file already exists, skipping..."
    fi
    
    # Backend .env
    if [ ! -f apso-backend/.env ]; then
        cp apso-backend/.env.example apso-backend/.env
        print_success "Created backend .env file"
    else
        print_warning "Backend .env file already exists, skipping..."
    fi
    
    # Frontend .env.local
    if [ ! -f nextjs-frontend/.env.local ]; then
        cp nextjs-frontend/.env.local.example nextjs-frontend/.env.local
        print_success "Created frontend .env.local file"
    else
        print_warning "Frontend .env.local file already exists, skipping..."
    fi
    
    print_warning "Please review and update the environment files with your configuration:"
    print_warning "  - .env (global settings)"
    print_warning "  - apso-backend/.env (database credentials)"
    print_warning "  - nextjs-frontend/.env.local (auth secrets)"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Root dependencies (for dev scripts)
    print_status "Installing root dependencies..."
    npm install
    
    # Backend dependencies
    print_status "Installing backend dependencies..."
    cd apso-backend && npm install && cd ..
    print_success "Backend dependencies installed"
    
    # Frontend dependencies
    print_status "Installing frontend dependencies..."
    cd nextjs-frontend && npm install && cd ..
    print_success "Frontend dependencies installed"
}

# Generate Apso backend code
generate_backend() {
    print_status "Generating Apso backend code..."
    cd apso-backend
    
    if apso generate; then
        print_success "Backend code generated successfully"
    else
        print_error "Failed to generate backend code. Check your .apsorc configuration."
        exit 1
    fi
    
    cd ..
}

# Check database connection and run migrations
setup_database() {
    print_status "Setting up database..."
    
    # Check if PostgreSQL is running by trying to connect
    DB_HOST=$(grep DB_HOST apso-backend/.env | cut -d '=' -f2)
    DB_PORT=$(grep DB_PORT apso-backend/.env | cut -d '=' -f2)
    DB_DATABASE=$(grep DB_DATABASE apso-backend/.env | cut -d '=' -f2)
    DB_USERNAME=$(grep DB_USERNAME apso-backend/.env | cut -d '=' -f2)
    
    if command -v psql &> /dev/null; then
        print_status "Testing database connection..."
        if PGPASSWORD=$(grep DB_PASSWORD apso-backend/.env | cut -d '=' -f2) psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -c "SELECT 1;" &> /dev/null; then
            print_success "Database connection successful"
            
            # Run migrations
            print_status "Running database migrations..."
            cd apso-backend
            if npm run migration:run; then
                print_success "Database migrations completed"
            else
                print_error "Failed to run database migrations"
                cd ..
                exit 1
            fi
            cd ..
        else
            print_warning "Could not connect to database. Please ensure:"
            print_warning "  1. PostgreSQL is running"
            print_warning "  2. Database '$DB_DATABASE' exists"
            print_warning "  3. User '$DB_USERNAME' has access"
            print_warning "  4. Credentials in apso-backend/.env are correct"
            print_warning ""
            print_warning "You can run migrations later with: npm run db:migrate"
        fi
    else
        print_warning "PostgreSQL client not available. Skipping database setup."
        print_warning "Please run migrations manually: npm run db:migrate"
    fi
}

# Build the applications
build_apps() {
    print_status "Building applications..."
    
    # Build backend
    print_status "Building backend..."
    cd apso-backend && npm run build && cd ..
    print_success "Backend built successfully"
    
    # Build frontend  
    print_status "Building frontend..."
    cd nextjs-frontend && npm run build && cd ..
    print_success "Frontend built successfully"
}

# Main setup process
main() {
    echo "This script will set up the Better Auth + Apso full-stack example."
    echo "It will:"
    echo "  1. Check requirements"
    echo "  2. Install Apso CLI"
    echo "  3. Set up environment variables"
    echo "  4. Install dependencies"
    echo "  5. Generate backend code"
    echo "  6. Set up database"
    echo "  7. Build applications"
    echo ""
    
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Setup cancelled"
        exit 0
    fi
    
    echo ""
    
    check_requirements
    install_apso_cli
    setup_env
    install_dependencies
    generate_backend
    setup_database
    build_apps
    
    echo ""
    print_success "🎉 Setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Review and update environment variables if needed"
    echo "  2. Start the development servers:"
    echo "     npm run dev"
    echo ""
    echo "  Or use Docker:"
    echo "     npm run docker:up"
    echo ""
    echo "  The application will be available at:"
    echo "    Frontend: http://localhost:3000"
    echo "    Backend:  http://localhost:3001"
    echo ""
    print_success "Happy coding! 🚀"
}

# Run main function
main "$@"