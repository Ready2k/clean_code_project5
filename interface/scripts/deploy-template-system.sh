#!/bin/bash

# Template System Deployment Script
# This script handles the complete deployment of the template management system

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Default values
ENVIRONMENT="${ENVIRONMENT:-production}"
SKIP_TESTS="${SKIP_TESTS:-false}"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"
DRY_RUN="${DRY_RUN:-false}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"

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

# Help function
show_help() {
    cat << EOF
Template System Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV     Target environment (development|staging|production) [default: production]
    -s, --skip-tests         Skip running tests
    -m, --skip-migrations    Skip database migrations
    -b, --skip-build         Skip building applications
    -d, --dry-run           Show what would be done without executing
    -n, --no-backup         Skip backup before deployment
    -h, --help              Show this help message

Environment Variables:
    DATABASE_URL            Database connection string
    REDIS_URL              Redis connection string
    JWT_SECRET             JWT signing secret
    ENCRYPTION_KEY         Data encryption key
    
Examples:
    $0                                    # Deploy to production
    $0 -e staging                        # Deploy to staging
    $0 -e development --skip-tests       # Deploy to dev without tests
    $0 --dry-run                         # Show deployment plan
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
            -s|--skip-tests)
                SKIP_TESTS="true"
                shift
                ;;
            -m|--skip-migrations)
                SKIP_MIGRATIONS="true"
                shift
                ;;
            -b|--skip-build)
                SKIP_BUILD="true"
                shift
                ;;
            -d|--dry-run)
                DRY_RUN="true"
                shift
                ;;
            -n|--no-backup)
                BACKUP_BEFORE_DEPLOY="false"
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

# Validate environment
validate_environment() {
    log_info "Validating environment: $ENVIRONMENT"
    
    case $ENVIRONMENT in
        development|staging|production)
            log_success "Environment '$ENVIRONMENT' is valid"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_error "Must be one of: development, staging, production"
            exit 1
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    for tool in docker docker-compose node npm; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Check environment variables for production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        local missing_vars=()
        
        for var in DATABASE_URL REDIS_URL JWT_SECRET ENCRYPTION_KEY; do
            if [[ -z "${!var:-}" ]]; then
                missing_vars+=("$var")
            fi
        done
        
        if [[ ${#missing_vars[@]} -gt 0 ]]; then
            log_error "Missing required environment variables for production: ${missing_vars[*]}"
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Load environment configuration
load_environment_config() {
    log_info "Loading environment configuration..."
    
    local env_file="$PROJECT_ROOT/.env.$ENVIRONMENT"
    if [[ -f "$env_file" ]]; then
        log_info "Loading environment file: $env_file"
        set -a
        source "$env_file"
        set +a
    else
        log_warning "Environment file not found: $env_file"
    fi
    
    # Set template system defaults
    export TEMPLATE_CACHE_TTL="${TEMPLATE_CACHE_TTL:-3600}"
    export TEMPLATE_CACHE_SIZE="${TEMPLATE_CACHE_SIZE:-1000}"
    export TEMPLATE_CACHE_ENABLED="${TEMPLATE_CACHE_ENABLED:-true}"
    export TEMPLATE_ANALYTICS_ENABLED="${TEMPLATE_ANALYTICS_ENABLED:-true}"
    export TEMPLATE_FALLBACK_ENABLED="${TEMPLATE_FALLBACK_ENABLED:-true}"
    export TEMPLATE_VALIDATION_STRICT="${TEMPLATE_VALIDATION_STRICT:-true}"
    
    log_success "Environment configuration loaded"
}

# Create backup
create_backup() {
    if [[ "$BACKUP_BEFORE_DEPLOY" != "true" ]]; then
        log_info "Skipping backup (disabled)"
        return 0
    fi
    
    log_info "Creating backup before deployment..."
    
    local backup_dir="$PROJECT_ROOT/backups/deployment-$(date +%Y%m%d-%H%M%S)"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create backup in: $backup_dir"
        return 0
    fi
    
    mkdir -p "$backup_dir"
    
    # Backup database
    if [[ -n "${DATABASE_URL:-}" ]]; then
        log_info "Backing up database..."
        pg_dump "$DATABASE_URL" > "$backup_dir/database.sql" || {
            log_warning "Database backup failed, continuing..."
        }
    fi
    
    # Backup current application files
    log_info "Backing up application files..."
    tar -czf "$backup_dir/application.tar.gz" \
        --exclude="node_modules" \
        --exclude="dist" \
        --exclude="*.log" \
        -C "$PROJECT_ROOT" . || {
        log_warning "Application backup failed, continuing..."
    }
    
    log_success "Backup created: $backup_dir"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_info "Skipping tests (disabled)"
        return 0
    fi
    
    log_info "Running tests..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run tests"
        return 0
    fi
    
    # Backend tests
    log_info "Running backend tests..."
    cd "$BACKEND_DIR"
    npm test -- --run || {
        log_error "Backend tests failed"
        exit 1
    }
    
    # Frontend tests
    log_info "Running frontend tests..."
    cd "$FRONTEND_DIR"
    npm test -- --run || {
        log_error "Frontend tests failed"
        exit 1
    }
    
    cd "$PROJECT_ROOT"
    log_success "All tests passed"
}

# Build applications
build_applications() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "Skipping build (disabled)"
        return 0
    fi
    
    log_info "Building applications..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would build applications"
        return 0
    fi
    
    # Build backend
    log_info "Building backend..."
    cd "$BACKEND_DIR"
    npm run build || {
        log_error "Backend build failed"
        exit 1
    }
    
    # Build frontend
    log_info "Building frontend..."
    cd "$FRONTEND_DIR"
    npm run build || {
        log_error "Frontend build failed"
        exit 1
    }
    
    cd "$PROJECT_ROOT"
    log_success "Applications built successfully"
}

# Run database migrations
run_migrations() {
    if [[ "$SKIP_MIGRATIONS" == "true" ]]; then
        log_info "Skipping migrations (disabled)"
        return 0
    fi
    
    log_info "Running database migrations..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run database migrations"
        return 0
    fi
    
    cd "$BACKEND_DIR"
    
    # Check migration status first
    log_info "Checking migration status..."
    node src/scripts/migrate-database.js status || {
        log_error "Failed to check migration status"
        exit 1
    }
    
    # Run migrations
    log_info "Applying migrations..."
    node src/scripts/migrate-database.js migrate || {
        log_error "Database migrations failed"
        exit 1
    }
    
    # Validate schema
    log_info "Validating database schema..."
    node src/scripts/migrate-database.js validate || {
        log_error "Database schema validation failed"
        exit 1
    }
    
    cd "$PROJECT_ROOT"
    log_success "Database migrations completed"
}

# Deploy with Docker Compose
deploy_with_docker() {
    log_info "Deploying with Docker Compose..."
    
    local compose_file="docker-compose.yml"
    if [[ "$ENVIRONMENT" != "production" ]]; then
        compose_file="docker-compose.$ENVIRONMENT.yml"
    fi
    
    if [[ ! -f "$compose_file" ]]; then
        log_error "Docker Compose file not found: $compose_file"
        exit 1
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would deploy using: $compose_file"
        return 0
    fi
    
    # Pull latest images
    log_info "Pulling latest images..."
    docker-compose -f "$compose_file" pull || {
        log_warning "Failed to pull some images, continuing..."
    }
    
    # Deploy services
    log_info "Starting services..."
    docker-compose -f "$compose_file" up -d || {
        log_error "Failed to start services"
        exit 1
    }
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose -f "$compose_file" ps | grep -q "unhealthy\|starting"; then
            log_info "Waiting for services... (attempt $attempt/$max_attempts)"
            sleep 10
            ((attempt++))
        else
            break
        fi
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        log_error "Services failed to become healthy within timeout"
        docker-compose -f "$compose_file" ps
        exit 1
    fi
    
    log_success "Services deployed and healthy"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would verify deployment"
        return 0
    fi
    
    local base_url="http://localhost:8000"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        base_url="${PRODUCTION_URL:-http://localhost:8000}"
    fi
    
    # Check system health
    log_info "Checking system health..."
    local health_response
    health_response=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/api/system/health" || echo "000")
    
    if [[ "$health_response" != "200" ]]; then
        log_error "Health check failed (HTTP $health_response)"
        exit 1
    fi
    
    # Check template system health
    log_info "Checking template system health..."
    local template_health_response
    template_health_response=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/api/system/health/templates" || echo "000")
    
    if [[ "$template_health_response" != "200" ]]; then
        log_error "Template system health check failed (HTTP $template_health_response)"
        exit 1
    fi
    
    # Check database connectivity
    log_info "Checking database connectivity..."
    cd "$BACKEND_DIR"
    node src/scripts/migrate-database.js validate || {
        log_error "Database validation failed"
        exit 1
    }
    
    cd "$PROJECT_ROOT"
    log_success "Deployment verification passed"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would setup monitoring"
        return 0
    fi
    
    local monitoring_dir="$PROJECT_ROOT/monitoring"
    
    if [[ -f "$monitoring_dir/docker-compose.monitoring.yml" ]]; then
        log_info "Starting monitoring services..."
        docker-compose -f "$monitoring_dir/docker-compose.monitoring.yml" up -d || {
            log_warning "Failed to start monitoring services"
        }
    else
        log_warning "Monitoring configuration not found, skipping..."
    fi
    
    log_success "Monitoring setup completed"
}

# Cleanup old resources
cleanup_old_resources() {
    log_info "Cleaning up old resources..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would cleanup old resources"
        return 0
    fi
    
    # Remove unused Docker images
    log_info "Removing unused Docker images..."
    docker image prune -f || {
        log_warning "Failed to prune Docker images"
    }
    
    # Remove old backups (keep last 10)
    if [[ -d "$PROJECT_ROOT/backups" ]]; then
        log_info "Cleaning up old backups..."
        find "$PROJECT_ROOT/backups" -type d -name "deployment-*" | sort -r | tail -n +11 | xargs rm -rf || {
            log_warning "Failed to cleanup old backups"
        }
    fi
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting Template System Deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Dry Run: $DRY_RUN"
    
    # Deployment steps
    validate_environment
    check_prerequisites
    load_environment_config
    create_backup
    run_tests
    build_applications
    run_migrations
    deploy_with_docker
    verify_deployment
    setup_monitoring
    cleanup_old_resources
    
    log_success "Template System Deployment Completed Successfully!"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        log_info "Services are running at:"
        log_info "  Frontend: http://localhost:3000"
        log_info "  Backend API: http://localhost:8000"
        log_info "  Admin Interface: http://localhost:8000/admin"
        
        if [[ "$ENVIRONMENT" == "production" ]]; then
            log_info ""
            log_info "Post-deployment checklist:"
            log_info "  □ Verify all services are healthy"
            log_info "  □ Check monitoring dashboards"
            log_info "  □ Test template management interface"
            log_info "  □ Verify template rendering performance"
            log_info "  □ Check error rates and logs"
        fi
    fi
}

# Trap errors and cleanup
trap 'log_error "Deployment failed at line $LINENO"' ERR

# Parse arguments and run
parse_args "$@"
main