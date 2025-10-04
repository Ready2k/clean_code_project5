#!/bin/bash

# Prompt Library Application Health Check Script
# Quick health verification for CI/CD or monitoring

set -e

# Configuration
BACKEND_PORT=8000
FRONTEND_PORT=3000
REDIS_PORT=6379
POSTGRES_PORT=5432
TIMEOUT=5

# Colors (only if terminal supports it)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    NC=''
fi

# Exit codes
EXIT_SUCCESS=0
EXIT_PARTIAL=1
EXIT_FAILURE=2

# Function to check if a port is open
check_port() {
    local port=$1
    nc -z localhost $port 2>/dev/null
}

# Function to check HTTP endpoint
check_http() {
    local url=$1
    local expected=${2:-200}
    
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
    [ "$status" = "$expected" ]
}

# Main health check
main() {
    local healthy=0
    local total=4
    local issues=()
    
    # Check PostgreSQL
    if check_port $POSTGRES_PORT; then
        echo -e "${GREEN}✓${NC} PostgreSQL (port $POSTGRES_PORT)"
        healthy=$((healthy + 1))
    else
        echo -e "${RED}✗${NC} PostgreSQL (port $POSTGRES_PORT)"
        issues+=("PostgreSQL not accessible")
    fi
    
    # Check Redis
    if check_port $REDIS_PORT; then
        echo -e "${GREEN}✓${NC} Redis (port $REDIS_PORT)"
        healthy=$((healthy + 1))
    else
        echo -e "${RED}✗${NC} Redis (port $REDIS_PORT)"
        issues+=("Redis not accessible")
    fi
    
    # Check Backend API
    if check_port $BACKEND_PORT && check_http "http://localhost:$BACKEND_PORT/api/health"; then
        echo -e "${GREEN}✓${NC} Backend API (port $BACKEND_PORT)"
        healthy=$((healthy + 1))
    else
        echo -e "${RED}✗${NC} Backend API (port $BACKEND_PORT)"
        issues+=("Backend API not healthy")
    fi
    
    # Check Frontend
    if check_port $FRONTEND_PORT && check_http "http://localhost:$FRONTEND_PORT"; then
        echo -e "${GREEN}✓${NC} Frontend (port $FRONTEND_PORT)"
        healthy=$((healthy + 1))
    else
        echo -e "${RED}✗${NC} Frontend (port $FRONTEND_PORT)"
        issues+=("Frontend not accessible")
    fi
    
    # Summary
    echo ""
    echo "Health Check Summary: $healthy/$total services healthy"
    
    if [ $healthy -eq $total ]; then
        echo -e "${GREEN}Status: All services operational${NC}"
        exit $EXIT_SUCCESS
    elif [ $healthy -gt 0 ]; then
        echo -e "${RED}Status: Partial failure${NC}"
        printf '%s\n' "${issues[@]}"
        exit $EXIT_PARTIAL
    else
        echo -e "${RED}Status: System failure${NC}"
        printf '%s\n' "${issues[@]}"
        exit $EXIT_FAILURE
    fi
}

# Handle arguments
case "${1:-}" in
    --help|-h)
        echo "Prompt Library Health Check Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Exit codes:"
        echo "  0 - All services healthy"
        echo "  1 - Partial failure (some services down)"
        echo "  2 - Complete failure (all services down)"
        echo ""
        echo "Options:"
        echo "  --help, -h    Show this help"
        echo "  --json        Output in JSON format"
        exit 0
        ;;
    --json)
        # JSON output for programmatic use
        healthy=0
        total=4
        services=()
        
        check_port $POSTGRES_PORT && healthy=$((healthy + 1))
        services+=("{\"name\":\"postgresql\",\"port\":$POSTGRES_PORT,\"healthy\":$(check_port $POSTGRES_PORT && echo true || echo false)}")
        
        check_port $REDIS_PORT && healthy=$((healthy + 1))
        services+=("{\"name\":\"redis\",\"port\":$REDIS_PORT,\"healthy\":$(check_port $REDIS_PORT && echo true || echo false)}")
        
        backend_healthy=$(check_port $BACKEND_PORT && check_http "http://localhost:$BACKEND_PORT/api/health" && echo true || echo false)
        [ "$backend_healthy" = "true" ] && healthy=$((healthy + 1))
        services+=("{\"name\":\"backend\",\"port\":$BACKEND_PORT,\"healthy\":$backend_healthy}")
        
        frontend_healthy=$(check_port $FRONTEND_PORT && check_http "http://localhost:$FRONTEND_PORT" && echo true || echo false)
        [ "$frontend_healthy" = "true" ] && healthy=$((healthy + 1))
        services+=("{\"name\":\"frontend\",\"port\":$FRONTEND_PORT,\"healthy\":$frontend_healthy}")
        
        status="failure"
        [ $healthy -eq $total ] && status="healthy"
        [ $healthy -gt 0 ] && [ $healthy -lt $total ] && status="partial"
        
        echo "{"
        echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
        echo "  \"status\": \"$status\","
        echo "  \"healthy_count\": $healthy,"
        echo "  \"total_count\": $total,"
        echo "  \"services\": [$(IFS=,; echo "${services[*]}")]"
        echo "}"
        
        [ $healthy -eq $total ] && exit $EXIT_SUCCESS
        [ $healthy -gt 0 ] && exit $EXIT_PARTIAL
        exit $EXIT_FAILURE
        ;;
    "")
        main
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac