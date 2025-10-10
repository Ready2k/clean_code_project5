#!/bin/bash

# Prompt Library Application Stop Script
# This script gracefully stops all services
# Usage: ./scripts/stop.sh [--docker-only] [--local-only] [--full-docker] [--help]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/interface/docker-compose.dev.yml"
ROOT_DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
BACKEND_PORT=8000
FRONTEND_PORT=3000
GRACEFUL_SHUTDOWN_TIMEOUT=10

# Mode configuration
MODE="${MODE:-auto}"
DOCKER_ONLY=false
LOCAL_ONLY=false
FULL_DOCKER=false

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

# Function to check if a port is open
check_port() {
    local port=$1
    nc -z localhost $port 2>/dev/null
}

# Function to stop a process by PID file
stop_process_by_pid() {
    local pid_file=$1
    local service_name=$2
    local timeout=${3:-$GRACEFUL_SHUTDOWN_TIMEOUT}
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping $service_name (PID: $pid)..."
            
            # Send SIGTERM for graceful shutdown
            kill -TERM "$pid" 2>/dev/null || true
            
            # Wait for graceful shutdown
            local elapsed=0
            while [ $elapsed -lt $timeout ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                elapsed=$((elapsed + 1))
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                warning "$service_name didn't stop gracefully, force killing..."
                kill -KILL "$pid" 2>/dev/null || true
                sleep 1
            fi
            
            if ! kill -0 "$pid" 2>/dev/null; then
                success "$service_name stopped successfully"
            else
                error "Failed to stop $service_name"
            fi
        else
            warning "$service_name PID file exists but process is not running"
        fi
        
        # Clean up PID file
        rm -f "$pid_file"
    else
        log "$service_name PID file not found, checking for running processes..."
    fi
}

# Function to stop processes by pattern
stop_process_by_pattern() {
    local pattern=$1
    local service_name=$2
    local timeout=${3:-$GRACEFUL_SHUTDOWN_TIMEOUT}
    
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        log "Found $service_name processes: $pids"
        
        # Send SIGTERM to all matching processes
        echo "$pids" | xargs -r kill -TERM 2>/dev/null || true
        
        # Wait for graceful shutdown
        sleep 2
        
        # Check if any are still running and force kill
        local remaining_pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$remaining_pids" ]; then
            warning "Force killing remaining $service_name processes: $remaining_pids"
            echo "$remaining_pids" | xargs -r kill -KILL 2>/dev/null || true
            sleep 1
        fi
        
        # Final check
        local final_pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -z "$final_pids" ]; then
            success "$service_name processes stopped"
        else
            error "Some $service_name processes are still running: $final_pids"
        fi
    else
        log "No $service_name processes found"
    fi
}

# Function to stop frontend service
stop_frontend() {
    log "🎨 Stopping frontend service..."
    
    # Check if frontend was started in new terminal
    if [ -f "interface/.frontend.pid" ]; then
        local frontend_status="$(cat "interface/.frontend.pid" 2>/dev/null || echo "")"
        if [ "$frontend_status" = "new-terminal" ]; then
            log "Frontend was started in separate Terminal window"
            warning "Please manually close the Terminal window running the frontend"
            warning "Or press Ctrl+C in that Terminal window to stop the frontend"
        elif [ "$frontend_status" = "manual" ]; then
            log "Frontend was set to manual mode"
        else
            # Try PID file approach for older versions
            stop_process_by_pid "interface/.frontend.pid" "Frontend"
        fi
    fi
    
    # Always try to stop any vite processes that might be running
    stop_process_by_pattern "vite.*--port.*3000" "Frontend (Vite)"
    stop_process_by_pattern "npm run dev" "Frontend (npm run dev)"
    stop_process_by_pattern "node.*vite" "Frontend (Node Vite)"
    
    # Verify frontend is stopped
    if check_port $FRONTEND_PORT; then
        warning "Frontend port $FRONTEND_PORT is still in use"
        warning "You may need to manually stop the frontend in its Terminal window"
    else
        success "Frontend service stopped"
    fi
}

# Function to stop backend service
stop_backend() {
    log "🔧 Stopping backend service..."
    
    # Try PID file first
    stop_process_by_pid "interface/.backend.pid" "Backend"
    
    # Fallback to pattern matching
    stop_process_by_pattern "node.*backend/dist/index.js" "Backend (Node.js)"
    stop_process_by_pattern "node.*dist/index.js" "Backend (Node.js dist)"
    stop_process_by_pattern "npm run start:backend" "Backend (npm)"
    
    # Also kill any process using port 8000
    local port_pid=$(lsof -nP -iTCP:8000 -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2}' | head -1)
    if [ -n "$port_pid" ]; then
        log "Killing process using port 8000 (PID: $port_pid)"
        kill -TERM "$port_pid" 2>/dev/null || true
        sleep 2
        if kill -0 "$port_pid" 2>/dev/null; then
            kill -KILL "$port_pid" 2>/dev/null || true
        fi
    fi
    
    # Verify backend is stopped
    if check_port $BACKEND_PORT; then
        warning "Backend port $BACKEND_PORT is still in use"
    else
        success "Backend service stopped"
    fi
}

# Function to stop Docker services
stop_docker_services() {
    log "📦 Stopping Docker services..."
    
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        # Determine compose command
        local dc_cmd="docker-compose"
        if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
            dc_cmd="docker compose"
        fi
        
        # Graceful shutdown of Docker services
        $dc_cmd -f "$DOCKER_COMPOSE_FILE" stop
        
        if [ $? -eq 0 ]; then
            success "Docker services stopped gracefully"
        else
            error "Failed to stop Docker services gracefully"
            
            # Force stop containers
            warning "Attempting to force stop Docker containers..."
            $dc_cmd -f "$DOCKER_COMPOSE_FILE" kill
            $dc_cmd -f "$DOCKER_COMPOSE_FILE" down
        fi
    else
        warning "Docker Compose file not found at $DOCKER_COMPOSE_FILE"
        
        # Stop any containers that might be related to the project
        local containers=$(docker ps -q --filter "name=prompt-library\|redis\|postgres" 2>/dev/null || true)
        if [ -n "$containers" ]; then
            log "Stopping related containers: $containers"
            echo "$containers" | xargs -r docker stop
        fi
    fi
}

# Function to stop full Docker stack
stop_full_docker() {
    log "📦 Stopping full Docker stack..."
    
    if [ -f "$ROOT_DOCKER_COMPOSE_FILE" ]; then
        # Determine compose command
        local dc_cmd="docker-compose"
        if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
            dc_cmd="docker compose"
        fi
        
        $dc_cmd -f "$ROOT_DOCKER_COMPOSE_FILE" down
        
        if [ $? -eq 0 ]; then
            success "Full Docker stack stopped"
        else
            error "Failed to stop full Docker stack"
        fi
    else
        warning "Root docker-compose.yml not found at $ROOT_DOCKER_COMPOSE_FILE"
    fi
}

# Function to clean up temporary files
cleanup_temp_files() {
    log "🧹 Cleaning up temporary files..."
    
    # Remove PID files
    rm -f interface/.backend.pid interface/.frontend.pid
    
    # Clean up any lock files
    rm -f interface/backend/package-lock.json.lock interface/frontend/package-lock.json.lock
    
    # Log shutdown
    if [ -d "logs" ]; then
        echo "=== Shutdown completed at $(date) ===" >> logs/startup.log
    fi
    
    success "Cleanup completed"
}

# Function to show final status
show_final_status() {
    echo ""
    echo "=========================================="
    success "🛑 Prompt Library Application stopped"
    echo "=========================================="
    echo ""
    echo "📊 Services stopped based on mode ($MODE):"
    if [ "$MODE" = "docker-only" ]; then
        echo "  • Docker services (PostgreSQL, Redis)"
    elif [ "$MODE" = "local-only" ]; then
        echo "  • Frontend service"
        echo "  • Backend API service"
    elif [ "$MODE" = "full-docker" ]; then
        echo "  • Full Docker stack (all containers)"
    else
        echo "  • Frontend service"
        echo "  • Backend API service"
        echo "  • Docker services (PostgreSQL, Redis)"
    fi
    echo ""
    echo "🔄 To start services again: ./scripts/start.sh"
    echo "🔄 To restart services: ./scripts/restart.sh"
    echo "=========================================="
}

# Function to show manual cleanup commands
show_manual_cleanup() {
    echo ""
    echo "Manual cleanup commands:"
    echo "  • Kill backend: pkill -f 'node.*backend/dist/index.js'"
    echo "  • Kill frontend: pkill -f 'vite.*--port 3000'"
    echo "  • Stop Docker dev: docker-compose -f interface/docker-compose.dev.yml down"
    echo "  • Stop Docker full: docker-compose -f docker-compose.yml down"
    echo "  • Kill all Node processes: pkill -f node"
}

# Function to verify all services are stopped
verify_shutdown() {
    log "🔍 Verifying all services are stopped..."
    
    local issues=0
    
    # Check if ports are still in use
    if check_port $FRONTEND_PORT; then
        warning "Frontend port $FRONTEND_PORT is still in use"
        issues=$((issues + 1))
    fi
    
    if check_port $BACKEND_PORT; then
        warning "Backend port $BACKEND_PORT is still in use"
        issues=$((issues + 1))
    fi
    
    # Check for remaining processes
    local backend_procs=$(pgrep -f "node interface/backend/dist/index.js\|node backend/dist/index.js" 2>/dev/null || true)
    if [ -n "$backend_procs" ]; then
        warning "Backend processes still running: $backend_procs"
        issues=$((issues + 1))
    fi
    
    local frontend_procs=$(pgrep -f "vite.*--port 3000" 2>/dev/null || true)
    if [ -n "$frontend_procs" ]; then
        warning "Frontend processes still running: $frontend_procs"
        issues=$((issues + 1))
    fi
    
    if [ $issues -eq 0 ]; then
        success "All services verified as stopped"
        return 0
    else
        error "$issues issues found during shutdown verification"
        return 1
    fi
}

# Function to parse arguments
parse_arguments() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --docker-only)
        DOCKER_ONLY=true
        MODE="docker-only"
        shift
        ;;
      --local-only)
        LOCAL_ONLY=true
        MODE="local-only"
        shift
        ;;
      --full-docker)
        FULL_DOCKER=true
        MODE="full-docker"
        shift
        ;;
      --help|-h)
        show_help
        exit 0
        ;;
      *)
        error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
    esac
  done
}

show_help() {
  echo "Prompt Library Application Stop Script"
  echo ""
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Modes:"
  echo "  --docker-only    Stop only Docker services"
  echo "  --local-only     Stop only local services"
  echo "  --full-docker    Stop full Docker stack"
  echo "  (no options)     Stop all services"
  echo ""
  echo "Options:"
  echo "  --help, -h       Show this help message"
}

# Main execution
main() {
    parse_arguments "$@"
    
    log "🛑 Stopping Prompt Library Application in $MODE mode..."
    
    case $MODE in
        "docker-only")
            log "📦 Docker-only mode: Stopping database services..."
            stop_docker_services
            ;;
        "local-only")
            log "🔧 Local-only mode: Stopping application services..."
            stop_frontend
            stop_backend
            cleanup_temp_files
            ;;
        "full-docker")
            log "🐳 Full Docker mode: Stopping all containers..."
            stop_full_docker
            ;;
        *)
            log "🛑 Auto mode: Stopping all services..."
            stop_frontend
            stop_backend
            stop_docker_services
            cleanup_temp_files
            ;;
    esac
    
    log "🔍 Verification..."
    if verify_shutdown; then
        show_final_status
    else
        warning "Some services may still be running. Check manually if needed."
        show_manual_cleanup
    fi
}

# Handle script interruption
trap 'error "Stop script interrupted"; exit 1' INT TERM

# Run main function
main "$@"