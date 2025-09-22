#!/bin/bash

# Production deployment script for Prompt Library system
# This script handles the complete deployment process including:
# - Environment validation
# - Service updates
# - Health checks
# - Rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
ENV_FILE="${PROJECT_DIR}/.env"

# Deployment settings
DEPLOYMENT_TIMEOUT="${DEPLOYMENT_TIMEOUT:-300}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-30}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-10}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✓ $1"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ⚠ $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✗ $1" >&2
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] [COMMAND]

Deploy Prompt Library system to production.

COMMANDS:
    deploy          Full deployment (default)
    update          Update services without downtime
    rollback        Rollback to previous version
    status          Show deployment status
    logs            Show service logs

OPTIONS:
    -h, --help              Show this help message
    -f, --force             Force deployment without confirmation
    --no-backup            Skip pre-deployment backup
    --timeout SECONDS      Deployment timeout (default: 300)
    --tag TAG              Docker image tag to deploy
    --env ENV_FILE         Environment file to use

EXAMPLES:
    $0 deploy
    $0 --force --tag v1.2.3 deploy
    $0 rollback
    $0 status

EOF
}

# Parse command line arguments
parse_args() {
    COMMAND="deploy"
    FORCE_DEPLOY="false"
    IMAGE_TAG="${IMAGE_TAG:-latest}"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -f|--force)
                FORCE_DEPLOY="true"
                shift
                ;;
            --no-backup)
                BACKUP_BEFORE_DEPLOY="false"
                shift
                ;;
            --timeout)
                DEPLOYMENT_TIMEOUT="$2"
                shift 2
                ;;
            --tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            --env)
                ENV_FILE="$2"
                shift 2
                ;;
            deploy|update|rollback|status|logs)
                COMMAND="$1"
                shift
                ;;
            -*)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                error "Unknown command: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Validate environment
validate_environment() {
    log "Validating deployment environment..."
    
    # Check if running as root or with sudo
    if [[ $EUID -ne 0 ]] && ! groups | grep -q docker; then
        error "This script must be run as root or user must be in docker group"
        exit 1
    fi
    
    # Check required files
    local required_files=("$COMPOSE_FILE" "$ENV_FILE")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Required file not found: $file"
            exit 1
        fi
    done
    
    # Check required commands
    local required_commands=("docker" "docker-compose" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    # Check disk space (require at least 2GB free)
    local available_space=$(df / | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 2097152 ]]; then
        error "Insufficient disk space. Available: ${available_space}KB, Required: 2GB"
        exit 1
    fi
    
    # Validate environment variables
    source "$ENV_FILE"
    local required_vars=("DOMAIN" "JWT_SECRET" "POSTGRES_PASSWORD")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable not set: $var"
            exit 1
        fi
    done
    
    success "Environment validation passed"
}

# Create pre-deployment backup
create_backup() {
    if [[ "$BACKUP_BEFORE_DEPLOY" != "true" ]]; then
        log "Skipping pre-deployment backup"
        return 0
    fi
    
    log "Creating pre-deployment backup..."
    
    if [[ -f "${SCRIPT_DIR}/backup.sh" ]]; then
        if "${SCRIPT_DIR}/backup.sh"; then
            success "Pre-deployment backup created"
        else
            error "Failed to create pre-deployment backup"
            return 1
        fi
    else
        warning "Backup script not found, skipping backup"
    fi
}

# Pull latest images
pull_images() {
    log "Pulling latest Docker images..."
    
    # Set image tag in environment
    export IMAGE_TAG="$IMAGE_TAG"
    
    if docker-compose -f "$COMPOSE_FILE" pull; then
        success "Images pulled successfully"
    else
        error "Failed to pull images"
        return 1
    fi
}

# Check service health
check_health() {
    local service="$1"
    local url="$2"
    local retries="$3"
    
    log "Checking health of $service..."
    
    for ((i=1; i<=retries; i++)); do
        if curl -f -s "$url" > /dev/null 2>&1; then
            success "$service is healthy"
            return 0
        fi
        
        if [[ $i -lt $retries ]]; then
            log "Health check $i/$retries failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
            sleep "$HEALTH_CHECK_INTERVAL"
        fi
    done
    
    error "$service health check failed after $retries attempts"
    return 1
}

# Deploy services
deploy_services() {
    log "Deploying services..."
    
    # Start services
    if docker-compose -f "$COMPOSE_FILE" up -d; then
        success "Services started"
    else
        error "Failed to start services"
        return 1
    fi
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    local domain="${DOMAIN:-localhost}"
    
    if ! check_health "Backend API" "http://$domain/api/system/health" "$HEALTH_CHECK_RETRIES"; then
        error "Backend health check failed"
        return 1
    fi
    
    if ! check_health "Frontend" "http://$domain/health" "$HEALTH_CHECK_RETRIES"; then
        error "Frontend health check failed"
        return 1
    fi
    
    success "All services are healthy"
}

# Update services without downtime
update_services() {
    log "Updating services with zero downtime..."
    
    # Update backend first
    log "Updating backend service..."
    docker-compose -f "$COMPOSE_FILE" up -d --no-deps backend
    
    # Wait for backend to be ready
    sleep 20
    if ! check_health "Backend API" "http://${DOMAIN:-localhost}/api/system/health" 10; then
        error "Backend update failed"
        return 1
    fi
    
    # Update frontend
    log "Updating frontend service..."
    docker-compose -f "$COMPOSE_FILE" up -d --no-deps frontend
    
    # Wait for frontend to be ready
    sleep 10
    if ! check_health "Frontend" "http://${DOMAIN:-localhost}/health" 10; then
        error "Frontend update failed"
        return 1
    fi
    
    success "Services updated successfully"
}

# Rollback deployment
rollback_deployment() {
    log "Rolling back deployment..."
    
    # Get previous image tags from backup metadata
    local backup_dir="${BACKUP_DIR:-/backups}"
    local latest_backup=$(find "$backup_dir" -name "prompt-library-backup-*.tar.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [[ -z "$latest_backup" ]]; then
        error "No backup found for rollback"
        return 1
    fi
    
    warning "Rolling back to backup: $(basename "$latest_backup")"
    
    # Confirm rollback
    if [[ "$FORCE_DEPLOY" != "true" ]]; then
        read -p "Are you sure you want to rollback? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log "Rollback cancelled"
            return 0
        fi
    fi
    
    # Stop current services
    docker-compose -f "$COMPOSE_FILE" down
    
    # Restore from backup
    if "${SCRIPT_DIR}/restore.sh" --force "$latest_backup"; then
        success "Rollback completed successfully"
    else
        error "Rollback failed"
        return 1
    fi
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo
    
    # Service status
    echo "Services:"
    docker-compose -f "$COMPOSE_FILE" ps
    echo
    
    # Health checks
    local domain="${DOMAIN:-localhost}"
    
    echo "Health Checks:"
    if curl -f -s "http://$domain/api/system/health" > /dev/null 2>&1; then
        echo "  ✓ Backend API: Healthy"
    else
        echo "  ✗ Backend API: Unhealthy"
    fi
    
    if curl -f -s "http://$domain/health" > /dev/null 2>&1; then
        echo "  ✓ Frontend: Healthy"
    else
        echo "  ✗ Frontend: Unhealthy"
    fi
    echo
    
    # Resource usage
    echo "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# Show service logs
show_logs() {
    local service="${1:-}"
    
    if [[ -n "$service" ]]; then
        docker-compose -f "$COMPOSE_FILE" logs -f "$service"
    else
        docker-compose -f "$COMPOSE_FILE" logs -f
    fi
}

# Cleanup old images and containers
cleanup() {
    log "Cleaning up old images and containers..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused volumes (be careful with this)
    # docker volume prune -f
    
    success "Cleanup completed"
}

# Send deployment notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Webhook notification
    if [[ -n "${DEPLOYMENT_WEBHOOK_URL:-}" ]]; then
        curl -X POST "$DEPLOYMENT_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"status\": \"$status\", \"message\": \"$message\", \"timestamp\": \"$(date -Iseconds)\", \"version\": \"$IMAGE_TAG\"}" \
            --max-time 10 --silent || true
    fi
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        [[ "$status" == "error" ]] && color="danger"
        [[ "$status" == "warning" ]] && color="warning"
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"attachments\": [{\"color\": \"$color\", \"title\": \"Deployment $status\", \"text\": \"$message\", \"fields\": [{\"title\": \"Version\", \"value\": \"$IMAGE_TAG\", \"short\": true}], \"ts\": $(date +%s)}]}" \
            --max-time 10 --silent || true
    fi
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    parse_args "$@"
    
    case "$COMMAND" in
        deploy)
            log "Starting full deployment (tag: $IMAGE_TAG)..."
            send_notification "info" "Deployment started: $IMAGE_TAG"
            
            if validate_environment && \
               create_backup && \
               pull_images && \
               deploy_services && \
               cleanup; then
                
                local end_time=$(date +%s)
                local duration=$((end_time - start_time))
                
                success "Deployment completed successfully in ${duration}s"
                send_notification "success" "Deployment completed successfully: $IMAGE_TAG (${duration}s)"
            else
                error "Deployment failed"
                send_notification "error" "Deployment failed: $IMAGE_TAG"
                exit 1
            fi
            ;;
        
        update)
            log "Starting service update (tag: $IMAGE_TAG)..."
            
            if validate_environment && \
               pull_images && \
               update_services; then
                
                success "Services updated successfully"
                send_notification "success" "Services updated successfully: $IMAGE_TAG"
            else
                error "Service update failed"
                send_notification "error" "Service update failed: $IMAGE_TAG"
                exit 1
            fi
            ;;
        
        rollback)
            rollback_deployment
            ;;
        
        status)
            show_status
            ;;
        
        logs)
            show_logs "${2:-}"
            ;;
        
        *)
            error "Unknown command: $COMMAND"
            usage
            exit 1
            ;;
    esac
}

# Handle signals
trap 'error "Deployment interrupted"; send_notification "error" "Deployment interrupted: $IMAGE_TAG"; exit 1' INT TERM

# Run main function
main "$@"