#!/bin/bash

# Prompt Library Application Status Script
# This script checks the status of all services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=8000
FRONTEND_PORT=3000
REDIS_PORT=6379
POSTGRES_PORT=5432

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "${PURPLE}ℹ️  $1${NC}"
}

# Function to check if a port is open
check_port() {
    local port=$1
    nc -z localhost $port 2>/dev/null
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local url=$1
    local timeout=${2:-5}
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $timeout "$url" 2>/dev/null || echo "000")
    echo "$status_code"
}

# Function to get process info
get_process_info() {
    local pattern=$1
    pgrep -f "$pattern" 2>/dev/null | head -5  # Limit to 5 PIDs to avoid clutter
}

# Function to check Docker service
check_docker_service() {
    local service_name=$1
    local port=$2
    
    echo -n "  $service_name: "
    
    if check_port $port; then
        local container_id=$(docker ps -q --filter "publish=$port" 2>/dev/null | head -1)
        if [ -n "$container_id" ]; then
            local container_name=$(docker ps --format "table {{.Names}}" --filter "id=$container_id" | tail -1)
            success "Running (Container: $container_name, Port: $port)"
        else
            warning "Port $port is open but no Docker container found"
        fi
    else
        error "Not running (Port $port not accessible)"
    fi
}

# Function to check application service
check_app_service() {
    local service_name=$1
    local port=$2
    local process_pattern=$3
    local health_url=$4
    
    echo -n "  $service_name: "
    
    local pids=$(get_process_info "$process_pattern")
    
    if [ -n "$pids" ]; then
        if check_port $port; then
            if [ -n "$health_url" ]; then
                local status_code=$(check_http_endpoint "$health_url")
                if [ "$status_code" = "200" ]; then
                    success "Running and healthy (PID: $pids, Port: $port)"
                else
                    warning "Running but health check failed (PID: $pids, HTTP: $status_code)"
                fi
            else
                success "Running (PID: $pids, Port: $port)"
            fi
        else
            warning "Process running but port $port not accessible (PID: $pids)"
        fi
    else
        if check_port $port; then
            warning "Port $port is open but no matching process found"
        else
            error "Not running (No process found, Port $port closed)"
        fi
    fi
}

# Function to show service URLs
show_service_urls() {
    echo ""
    echo "🔗 Service URLs:"
    
    if check_port $FRONTEND_PORT; then
        echo "  • Frontend:     http://localhost:$FRONTEND_PORT"
    else
        echo "  • Frontend:     ❌ Not accessible"
    fi
    
    if check_port $BACKEND_PORT; then
        echo "  • Backend API:  http://localhost:$BACKEND_PORT"
        echo "  • API Health:   http://localhost:$BACKEND_PORT/api/health"
        echo "  • API Docs:     http://localhost:$BACKEND_PORT/api/docs"
    else
        echo "  • Backend API:  ❌ Not accessible"
    fi
    
    if check_port $POSTGRES_PORT; then
        echo "  • PostgreSQL:   localhost:$POSTGRES_PORT"
    else
        echo "  • PostgreSQL:   ❌ Not accessible"
    fi
    
    if check_port $REDIS_PORT; then
        echo "  • Redis:        localhost:$REDIS_PORT"
    else
        echo "  • Redis:        ❌ Not accessible"
    fi
}

# Function to show log information
show_log_info() {
    echo ""
    echo "📝 Log Files:"
    
    if [ -f "logs/backend.log" ]; then
        local backend_size=$(du -h logs/backend.log | cut -f1)
        local backend_lines=$(wc -l < logs/backend.log)
        echo "  • Backend:  logs/backend.log ($backend_size, $backend_lines lines)"
    else
        echo "  • Backend:  ❌ No log file found"
    fi
    
    if [ -f "logs/frontend.log" ]; then
        local frontend_size=$(du -h logs/frontend.log | cut -f1)
        local frontend_lines=$(wc -l < logs/frontend.log)
        echo "  • Frontend: logs/frontend.log ($frontend_size, $frontend_lines lines)"
    else
        echo "  • Frontend: ❌ No log file found"
    fi
    
    if [ -f "logs/startup.log" ]; then
        local startup_size=$(du -h logs/startup.log | cut -f1)
        local startup_lines=$(wc -l < logs/startup.log)
        echo "  • Startup:  logs/startup.log ($startup_size, $startup_lines lines)"
    else
        echo "  • Startup:  ❌ No log file found"
    fi
}

# Function to show resource usage
show_resource_usage() {
    echo ""
    echo "💻 Resource Usage:"
    
    # Backend process resource usage
    local backend_pids=$(get_process_info "node.*dist/index.js")
    if [ -n "$backend_pids" ]; then
        for pid in $backend_pids; do
            if kill -0 "$pid" 2>/dev/null; then
                local cpu_mem=$(ps -p "$pid" -o %cpu,%mem --no-headers 2>/dev/null || echo "N/A N/A")
                echo "  • Backend (PID $pid): CPU ${cpu_mem% *}%, Memory ${cpu_mem#* }%"
            fi
        done
    fi
    
    # Frontend process resource usage
    local frontend_pids=$(get_process_info "vite.*--port.*3000")
    if [ -z "$frontend_pids" ]; then
        frontend_pids=$(get_process_info "npm run dev")
    fi
    if [ -n "$frontend_pids" ]; then
        for pid in $frontend_pids; do
            if kill -0 "$pid" 2>/dev/null; then
                local cpu_mem=$(ps -p "$pid" -o %cpu,%mem --no-headers 2>/dev/null || echo "N/A N/A")
                echo "  • Frontend (PID $pid): CPU ${cpu_mem% *}%, Memory ${cpu_mem#* }%"
            fi
        done
    fi
    
    # Docker container resource usage
    local containers=$(docker ps --format "{{.Names}}" 2>/dev/null | grep -E "(postgres|redis)" || true)
    if [ -n "$containers" ]; then
        echo "$containers" | while read container; do
            local stats=$(docker stats --no-stream --format "{{.CPUPerc}} {{.MemPerc}}" "$container" 2>/dev/null || echo "N/A N/A")
            echo "  • Docker ($container): CPU ${stats% *}, Memory ${stats#* }"
        done
    fi
}

# Function to check Docker status
check_docker_status() {
    echo ""
    echo "🐳 Docker Services:"
    
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running"
        return 1
    fi
    
    check_docker_service "PostgreSQL" $POSTGRES_PORT
    check_docker_service "Redis" $REDIS_PORT
}

# Function to check application status
check_app_status() {
    echo ""
    echo "🚀 Application Services:"
    
    check_app_service "Backend API" $BACKEND_PORT "node.*dist/index.js" "http://localhost:$BACKEND_PORT/api/health"
    
    # Special handling for frontend (may be in separate Terminal)
    echo -n "  Frontend: "
    local frontend_pids=$(get_process_info "vite.*--port.*3000")
    if [ -z "$frontend_pids" ]; then
        frontend_pids=$(get_process_info "npm run dev")
    fi
    
    if [ -n "$frontend_pids" ]; then
        if check_port $FRONTEND_PORT; then
            local status_code=$(check_http_endpoint "http://localhost:$FRONTEND_PORT")
            if [ "$status_code" = "200" ]; then
                success "Running and accessible (PID: $frontend_pids, Port: $FRONTEND_PORT)"
            else
                warning "Running but not yet ready (PID: $frontend_pids, HTTP: $status_code)"
            fi
        else
            warning "Process running but port $FRONTEND_PORT not accessible (PID: $frontend_pids)"
        fi
    else
        if check_port $FRONTEND_PORT; then
            warning "Port $FRONTEND_PORT is open but no Vite process found (may be in separate Terminal)"
        else
            # Check if frontend was started in new terminal mode
            if [ -f "interface/.frontend.pid" ]; then
                local frontend_status="$(cat "interface/.frontend.pid" 2>/dev/null || echo "")"
                if [ "$frontend_status" = "new-terminal" ]; then
                    warning "Started in separate Terminal window (check Terminal for status)"
                else
                    error "Not running (No process found, Port $FRONTEND_PORT closed)"
                fi
            else
                error "Not running (No process found, Port $FRONTEND_PORT closed)"
            fi
        fi
    fi
}

# Function to show overall status
show_overall_status() {
    echo ""
    echo "=========================================="
    
    local services_running=0
    local total_services=4
    
    # Count running services
    check_port $POSTGRES_PORT && services_running=$((services_running + 1))
    check_port $REDIS_PORT && services_running=$((services_running + 1))
    check_port $BACKEND_PORT && services_running=$((services_running + 1))
    check_port $FRONTEND_PORT && services_running=$((services_running + 1))
    
    if [ $services_running -eq $total_services ]; then
        success "🎉 ALL SERVICES RUNNING ($services_running/$total_services)"
        echo "🚀 Application is fully operational!"
    elif [ $services_running -gt 0 ]; then
        warning "⚠️  PARTIAL SERVICE STATUS ($services_running/$total_services running)"
        echo "🔧 Some services may need attention"
    else
        error "❌ NO SERVICES RUNNING ($services_running/$total_services)"
        echo "🛠️  Use ./scripts/start.sh to start services"
    fi
    
    echo "=========================================="
}

# Function to show management commands
show_management_commands() {
    echo ""
    echo "🛠️  Management Commands:"
    echo "  • Start services:   ./scripts/start.sh"
    echo "  • Stop services:    ./scripts/stop.sh"
    echo "  • Restart services: ./scripts/restart.sh"
    echo "  • View logs:        tail -f logs/backend.log"
    echo "  • Check status:     ./scripts/status.sh"
}

# Main execution
main() {
    echo "=========================================="
    echo -e "${PURPLE}📊 PROMPT LIBRARY APPLICATION STATUS${NC}"
    echo "=========================================="
    
    # Check Docker services
    check_docker_status
    
    # Check application services
    check_app_status
    
    # Show service URLs
    show_service_urls
    
    # Show log information
    show_log_info
    
    # Show resource usage
    show_resource_usage
    
    # Show overall status
    show_overall_status
    
    # Show management commands
    show_management_commands
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Prompt Library Application Status Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --quiet        Show only service status without details"
        echo "  --docker       Show only Docker service status"
        echo "  --local        Show only local service status"
        echo ""
        exit 0
        ;;
    --quiet)
        # Quick status check
        echo "Service Status:"
        check_port $POSTGRES_PORT && echo "  PostgreSQL: ✅" || echo "  PostgreSQL: ❌"
        check_port $REDIS_PORT && echo "  Redis: ✅" || echo "  Redis: ❌"
        check_port $BACKEND_PORT && echo "  Backend: ✅" || echo "  Backend: ❌"
        check_port $FRONTEND_PORT && echo "  Frontend: ✅" || echo "  Frontend: ❌"
        exit 0
        ;;
    --docker)
        echo "Docker Services Status:"
        check_docker_status
        exit 0
        ;;
    --local)
        echo "Local Services Status:"
        check_app_status
        exit 0
        ;;
    "")
        # Default behavior
        main
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac