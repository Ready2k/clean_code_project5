#!/bin/bash

# Dynamic Provider Management Deployment Script
# This script automates the deployment of dynamic provider management features

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Default values
ENVIRONMENT="${ENVIRONMENT:-production}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
SKIP_TESTS="${SKIP_TESTS:-false}"
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

# Help function
show_help() {
    cat << EOF
Dynamic Provider Management Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV    Target environment (production, staging, development)
    -s, --skip-backup       Skip database backup
    -t, --skip-tests        Skip running tests
    -d, --dry-run           Show what would be done without executing
    -v, --verbose           Enable verbose output
    -h, --help              Show this help message

Environment Variables:
    DATABASE_URL            PostgreSQL connection string
    REDIS_URL              Redis connection string
    JWT_SECRET             JWT secret key
    ENCRYPTION_KEY         Encryption key for credentials
    ADMIN_TOKEN            Admin JWT token for testing

Examples:
    $0 --environment production
    $0 --dry-run --verbose
    $0 --skip-backup --skip-tests

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -s|--skip-backup)
                SKIP_BACKUP="true"
                shift
                ;;
            -t|--skip-tests)
                SKIP_TESTS="true"
                shift
                ;;
            -d|--dry-run)
                DRY_RUN="true"
                shift
                ;;
            -v|--verbose)
                VERBOSE="true"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required commands
    local required_commands=("node" "npm" "psql" "curl" "jq" "docker" "docker-compose")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_node_version="18.0.0"
    if ! printf '%s\n%s\n' "$required_node_version" "$node_version" | sort -V -C; then
        log_error "Node.js version $node_version is too old. Required: $required_node_version+"
        exit 1
    fi
    
    # Check environment variables
    local required_env_vars=("DATABASE_URL" "JWT_SECRET" "ENCRYPTION_KEY")
    for var in "${required_env_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable not set: $var"
            exit 1
        fi
    done
    
    # Check database connectivity
    log_verbose "Testing database connectivity..."
    if ! psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        log_error "Cannot connect to database"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create database backup
create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log_warning "Skipping database backup"
        return 0
    fi
    
    log_info "Creating database backup..."
    
    local backup_dir="$PROJECT_ROOT/backups"
    local backup_file="$backup_dir/pre-dynamic-providers-$(date +%Y%m%d_%H%M%S).sql"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would create backup at $backup_file"
        return 0
    fi
    
    mkdir -p "$backup_dir"
    
    if pg_dump "$DATABASE_URL" > "$backup_file"; then
        log_success "Database backup created: $backup_file"
        
        # Verify backup
        if [[ -s "$backup_file" ]]; then
            log_success "Backup verification passed"
        else
            log_error "Backup file is empty"
            exit 1
        fi
    else
        log_error "Failed to create database backup"
        exit 1
    fi
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping tests"
        return 0
    fi
    
    log_info "Running tests..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would run tests"
        return 0
    fi
    
    # Backend tests
    log_verbose "Running backend tests..."
    cd "$BACKEND_DIR"
    if npm test -- --run; then
        log_success "Backend tests passed"
    else
        log_error "Backend tests failed"
        exit 1
    fi
    
    # Frontend tests
    log_verbose "Running frontend tests..."
    cd "$FRONTEND_DIR"
    if npm test -- --run; then
        log_success "Frontend tests passed"
    else
        log_error "Frontend tests failed"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
}

# Execute database migration
migrate_database() {
    log_info "Executing database migration..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute database migration"
        return 0
    fi
    
    local migration_file="$BACKEND_DIR/src/scripts/production-migration.sql"
    
    if [[ ! -f "$migration_file" ]]; then
        log_error "Migration file not found: $migration_file"
        exit 1
    fi
    
    log_verbose "Executing migration script..."
    if psql "$DATABASE_URL" -f "$migration_file"; then
        log_success "Database migration completed"
    else
        log_error "Database migration failed"
        exit 1
    fi
    
    # Verify migration
    log_verbose "Verifying migration..."
    local table_count=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_name IN ('providers', 'models', 'provider_templates');
    " | tr -d ' ')
    
    if [[ "$table_count" == "3" ]]; then
        log_success "Migration verification passed"
    else
        log_error "Migration verification failed: expected 3 tables, found $table_count"
        exit 1
    fi
}

# Build and deploy backend
deploy_backend() {
    log_info "Deploying backend..."
    
    cd "$BACKEND_DIR"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would deploy backend"
        return 0
    fi
    
    # Install dependencies
    log_verbose "Installing backend dependencies..."
    npm ci --production
    
    # Build application
    log_verbose "Building backend application..."
    npm run build
    
    # Stop existing service
    if systemctl is-active --quiet prompt-library-backend; then
        log_verbose "Stopping existing backend service..."
        sudo systemctl stop prompt-library-backend
    fi
    
    # Start service
    log_verbose "Starting backend service..."
    sudo systemctl start prompt-library-backend
    
    # Wait for service to start
    local max_attempts=30
    local attempt=0
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -f "http://localhost:8000/api/system/health" &> /dev/null; then
            log_success "Backend service started successfully"
            break
        fi
        
        attempt=$((attempt + 1))
        log_verbose "Waiting for backend to start... (attempt $attempt/$max_attempts)"
        sleep 2
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        log_error "Backend service failed to start"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
}

# Build and deploy frontend
deploy_frontend() {
    log_info "Deploying frontend..."
    
    cd "$FRONTEND_DIR"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would deploy frontend"
        return 0
    fi
    
    # Install dependencies
    log_verbose "Installing frontend dependencies..."
    npm ci --production
    
    # Build application
    log_verbose "Building frontend application..."
    npm run build
    
    # Deploy to web server
    log_verbose "Deploying frontend files..."
    sudo cp -r dist/* /var/www/html/
    
    # Restart web server
    log_verbose "Restarting web server..."
    sudo systemctl restart nginx
    
    # Verify deployment
    if curl -f "http://localhost" &> /dev/null; then
        log_success "Frontend deployed successfully"
    else
        log_error "Frontend deployment verification failed"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
}

# Populate system providers
populate_system_providers() {
    log_info "Populating system providers..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would populate system providers"
        return 0
    fi
    
    # Wait for backend to be ready
    local max_attempts=10
    local attempt=0
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -f "http://localhost:8000/api/system/health" &> /dev/null; then
            break
        fi
        
        attempt=$((attempt + 1))
        log_verbose "Waiting for backend to be ready... (attempt $attempt/$max_attempts)"
        sleep 3
    done
    
    # Check if system providers exist
    local provider_count=$(curl -s -H "Authorization: Bearer ${ADMIN_TOKEN:-}" \
        "http://localhost:8000/api/admin/providers?isSystem=true" | \
        jq -r '.data | length' 2>/dev/null || echo "0")
    
    if [[ "$provider_count" -gt "0" ]]; then
        log_success "System providers already populated ($provider_count providers)"
    else
        log_warning "System providers not found. They should be populated automatically on startup."
        log_info "Check application logs for any errors during provider initialization."
    fi
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would verify deployment"
        return 0
    fi
    
    local errors=0
    
    # Check database tables
    log_verbose "Checking database tables..."
    local tables=$(psql "$DATABASE_URL" -t -c "
        SELECT table_name FROM information_schema.tables 
        WHERE table_name IN ('providers', 'models', 'provider_templates');
    " | tr -d ' ' | wc -l)
    
    if [[ "$tables" == "3" ]]; then
        log_success "Database tables verified"
    else
        log_error "Database tables verification failed"
        errors=$((errors + 1))
    fi
    
    # Check backend health
    log_verbose "Checking backend health..."
    if curl -f "http://localhost:8000/api/system/health" &> /dev/null; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        errors=$((errors + 1))
    fi
    
    # Check frontend
    log_verbose "Checking frontend..."
    if curl -f "http://localhost" &> /dev/null; then
        log_success "Frontend check passed"
    else
        log_error "Frontend check failed"
        errors=$((errors + 1))
    fi
    
    # Check provider registry
    if [[ -n "${ADMIN_TOKEN:-}" ]]; then
        log_verbose "Checking provider registry..."
        local registry_status=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
            "http://localhost:8000/api/admin/providers/registry-status" | \
            jq -r '.status' 2>/dev/null || echo "error")
        
        if [[ "$registry_status" == "healthy" ]]; then
            log_success "Provider registry check passed"
        else
            log_error "Provider registry check failed (status: $registry_status)"
            errors=$((errors + 1))
        fi
    else
        log_warning "Skipping provider registry check (no admin token provided)"
    fi
    
    if [[ $errors -eq 0 ]]; then
        log_success "Deployment verification passed"
    else
        log_error "Deployment verification failed ($errors errors)"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Add any cleanup tasks here
}

# Main deployment function
main() {
    log_info "Starting Dynamic Provider Management deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Dry run: $DRY_RUN"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Execute deployment steps
    check_prerequisites
    create_backup
    run_tests
    migrate_database
    deploy_backend
    populate_system_providers
    deploy_frontend
    verify_deployment
    
    log_success "Dynamic Provider Management deployment completed successfully!"
    
    # Display post-deployment information
    cat << EOF

Post-Deployment Information:
- Backend API: http://localhost:8000
- Frontend: http://localhost
- Health Check: http://localhost:8000/api/system/health
- Provider Management: http://localhost/admin/providers

Next Steps:
1. Verify all existing connections still work
2. Test creating new providers through the admin interface
3. Monitor application logs for any issues
4. Update documentation and notify team members

EOF
}

# Parse arguments and run main function
parse_args "$@"
main