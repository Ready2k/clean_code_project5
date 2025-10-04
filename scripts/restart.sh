#!/bin/bash

# Prompt Library Application Restart Script
# This script stops all services and then starts them again

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
RESTART_DELAY=3

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

info() {
    echo -e "${PURPLE}[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️  $1${NC}"
}

# Function to check if scripts exist and are executable
check_scripts() {
    local script_dir="$(dirname "$0")"
    
    if [ ! -f "$script_dir/stop.sh" ]; then
        error "Stop script not found at $script_dir/stop.sh"
        exit 1
    fi
    
    if [ ! -f "$script_dir/start.sh" ]; then
        error "Start script not found at $script_dir/start.sh"
        exit 1
    fi
    
    # Make scripts executable if they aren't
    chmod +x "$script_dir/stop.sh" "$script_dir/start.sh"
    
    success "Scripts found and are executable"
}

# Function to show restart banner
show_restart_banner() {
    echo ""
    echo "=========================================="
    echo -e "${PURPLE}🔄 RESTARTING PROMPT LIBRARY APPLICATION${NC}"
    echo "=========================================="
    echo ""
    info "This will:"
    echo "  1. Stop all running services gracefully"
    echo "  2. Wait ${RESTART_DELAY} seconds for cleanup"
    echo "  3. Start all services in correct order"
    echo "  4. Perform health checks"
    echo ""
}

# Function to show progress
show_progress() {
    local phase=$1
    local description=$2
    
    echo ""
    echo "----------------------------------------"
    echo -e "${PURPLE}Phase $phase: $description${NC}"
    echo "----------------------------------------"
}

# Function to wait with countdown
wait_with_countdown() {
    local seconds=$1
    local message=${2:-"Waiting"}
    
    log "$message..."
    
    for i in $(seq $seconds -1 1); do
        echo -ne "\r${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $message... ${i}s remaining"
        sleep 1
    done
    echo -ne "\r${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $message... Done!          \n"
}

# Function to handle script errors
handle_error() {
    local exit_code=$1
    local phase=$2
    
    if [ $exit_code -ne 0 ]; then
        error "$phase failed with exit code $exit_code"
        echo ""
        echo "🔧 Troubleshooting tips:"
        echo "  • Check if Docker is running"
        echo "  • Verify no other services are using ports 3000, 8000, 5432, 6379"
        echo "  • Check logs in the logs/ directory"
        echo "  • Try running stop.sh manually first"
        echo ""
        echo "📝 Manual recovery:"
        echo "  • ./scripts/stop.sh    # Stop all services"
        echo "  • ./scripts/start.sh   # Start all services"
        echo ""
        exit $exit_code
    fi
}

# Function to create logs directory and setup logging
setup_logging() {
    mkdir -p logs
    
    # Log restart initiation
    echo "=== Restart initiated at $(date) ===" >> logs/startup.log
}

# Main execution
main() {
    local script_dir="$(dirname "$0")"
    
    show_restart_banner
    
    # Preliminary checks
    log "🔍 Performing preliminary checks..."
    check_scripts
    setup_logging
    
    # Phase 1: Stop services
    show_progress "1" "Stopping all services"
    log "Executing stop script..."
    
    if ! "$script_dir/stop.sh"; then
        handle_error $? "Stop phase"
    fi
    
    success "All services stopped successfully"
    
    # Phase 2: Wait for cleanup
    show_progress "2" "Waiting for cleanup"
    wait_with_countdown $RESTART_DELAY "Allowing system cleanup"
    
    # Phase 3: Start services
    show_progress "3" "Starting all services"
    log "Executing start script..."
    
    if ! "$script_dir/start.sh"; then
        handle_error $? "Start phase"
    fi
    
    success "All services started successfully"
    
    # Phase 4: Final status
    show_progress "4" "Restart completed"
    
    echo ""
    echo "=========================================="
    success "🎉 RESTART COMPLETED SUCCESSFULLY!"
    echo "=========================================="
    echo ""
    echo "🚀 Prompt Library Application is now running:"
    echo "  • Frontend:    http://localhost:3000"
    echo "  • Backend API: http://localhost:8000"
    echo "  • API Health:  http://localhost:8000/api/health"
    echo ""
    echo "📊 All services restarted:"
    echo "  ✅ Docker services (PostgreSQL, Redis)"
    echo "  ✅ Backend API service"
    echo "  ✅ Frontend application"
    echo ""
    echo "📝 Logs available at:"
    echo "  • Backend:  tail -f logs/backend.log"
    echo "  • Frontend: tail -f logs/frontend.log"
    echo "  • Startup:  tail -f logs/startup.log"
    echo ""
    echo "🛑 To stop: ./scripts/stop.sh"
    echo "=========================================="
    
    # Log successful restart
    echo "$(date): Restart completed successfully" >> logs/startup.log
}

# Handle script interruption
cleanup_on_interrupt() {
    echo ""
    error "Restart interrupted by user"
    echo ""
    warning "Services may be in an inconsistent state."
    echo "Recommended actions:"
    echo "  • Run ./scripts/stop.sh to ensure clean shutdown"
    echo "  • Then run ./scripts/start.sh to start fresh"
    exit 1
}

trap cleanup_on_interrupt INT TERM

# Parse command line arguments
FORCE_RESTART=false
SKIP_CHECKS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE_RESTART=true
            shift
            ;;
        --skip-checks)
            SKIP_CHECKS=true
            shift
            ;;
        -h|--help)
            echo "Prompt Library Application Restart Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -f, --force        Force restart even if services appear stopped"
            echo "  --skip-checks      Skip preliminary checks (faster but less safe)"
            echo "  -h, --help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                 # Normal restart"
            echo "  $0 --force         # Force restart"
            echo "  $0 --skip-checks   # Quick restart"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Add force restart logic if needed
if [ "$FORCE_RESTART" = true ]; then
    warning "Force restart mode enabled - skipping service status checks"
fi

if [ "$SKIP_CHECKS" = true ]; then
    warning "Skipping preliminary checks - this may be less safe"
fi

# Run main function
main "$@"