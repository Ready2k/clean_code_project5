#!/bin/bash

# Health check script for Prompt Library system
# This script performs comprehensive health checks on all system components

set -euo pipefail

# Configuration
DOMAIN="${DOMAIN:-localhost}"
TIMEOUT="${HEALTH_CHECK_TIMEOUT:-10}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Logging functions
log() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
    fi
}

success() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_CHECKS++))
}

failure() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_CHECKS++))
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Increment total checks counter
check() {
    ((TOTAL_CHECKS++))
}

# HTTP health check
http_check() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    check
    log "Checking $name at $url"
    
    local response
    local status_code
    
    if response=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null); then
        status_code="${response: -3}"
        if [[ "$status_code" == "$expected_status" ]]; then
            success "$name is healthy (HTTP $status_code)"
            return 0
        else
            failure "$name returned HTTP $status_code (expected $expected_status)"
            return 1
        fi
    else
        failure "$name is unreachable"
        return 1
    fi
}

# Docker service check
docker_service_check() {
    local service="$1"
    
    check
    log "Checking Docker service: $service"
    
    if docker-compose -f docker-compose.prod.yml ps "$service" | grep -q "Up"; then
        success "Docker service $service is running"
        return 0
    else
        failure "Docker service $service is not running"
        return 1
    fi
}

# Database connectivity check
database_check() {
    check
    log "Checking database connectivity"
    
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        success "Database is accessible"
        return 0
    else
        failure "Database is not accessible"
        return 1
    fi
}

# Redis connectivity check
redis_check() {
    check
    log "Checking Redis connectivity"
    
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping >/dev/null 2>&1; then
        success "Redis is accessible"
        return 0
    else
        failure "Redis is not accessible"
        return 1
    fi
}

# Disk space check
disk_space_check() {
    local path="${1:-/}"
    local threshold="${2:-90}"
    
    check
    log "Checking disk space for $path"
    
    local usage
    usage=$(df "$path" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $usage -lt $threshold ]]; then
        success "Disk space OK ($usage% used)"
        return 0
    else
        failure "Disk space critical ($usage% used, threshold: $threshold%)"
        return 1
    fi
}

# Memory usage check
memory_check() {
    local threshold="${1:-90}"
    
    check
    log "Checking memory usage"
    
    local usage
    usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [[ $usage -lt $threshold ]]; then
        success "Memory usage OK ($usage% used)"
        return 0
    else
        failure "Memory usage high ($usage% used, threshold: $threshold%)"
        return 1
    fi
}

# SSL certificate check
ssl_check() {
    local domain="$1"
    local days_threshold="${2:-30}"
    
    check
    log "Checking SSL certificate for $domain"
    
    local expiry_date
    local days_until_expiry
    
    if expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2); then
        local expiry_epoch
        expiry_epoch=$(date -d "$expiry_date" +%s)
        local current_epoch
        current_epoch=$(date +%s)
        days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
        
        if [[ $days_until_expiry -gt $days_threshold ]]; then
            success "SSL certificate valid ($days_until_expiry days remaining)"
            return 0
        else
            failure "SSL certificate expires soon ($days_until_expiry days remaining)"
            return 1
        fi
    else
        failure "Could not check SSL certificate for $domain"
        return 1
    fi
}

# API endpoint functionality check
api_functionality_check() {
    check
    log "Checking API functionality"
    
    # Test system health endpoint
    local health_response
    if health_response=$(curl -s --max-time "$TIMEOUT" "http://$DOMAIN/api/system/health" 2>/dev/null); then
        if echo "$health_response" | grep -q "healthy\|ok"; then
            success "API health endpoint is functional"
        else
            failure "API health endpoint returned unexpected response"
            return 1
        fi
    else
        failure "API health endpoint is not accessible"
        return 1
    fi
    
    # Test metrics endpoint
    check
    if curl -s --max-time "$TIMEOUT" "http://$DOMAIN/metrics" >/dev/null 2>&1; then
        success "Metrics endpoint is accessible"
    else
        failure "Metrics endpoint is not accessible"
        return 1
    fi
}

# WebSocket connectivity check
websocket_check() {
    check
    log "Checking WebSocket connectivity"
    
    # Simple WebSocket connection test using curl (if available)
    if command -v wscat >/dev/null 2>&1; then
        if timeout 5 wscat -c "ws://$DOMAIN/socket.io/?EIO=4&transport=websocket" --close >/dev/null 2>&1; then
            success "WebSocket connection is working"
            return 0
        else
            failure "WebSocket connection failed"
            return 1
        fi
    else
        warning "WebSocket check skipped (wscat not available)"
        ((TOTAL_CHECKS--))  # Don't count this check
        return 0
    fi
}

# Log file check
log_file_check() {
    local log_dir="${1:-/app/logs}"
    
    check
    log "Checking log files in $log_dir"
    
    if [[ -d "$log_dir" ]]; then
        local recent_logs
        recent_logs=$(find "$log_dir" -name "*.log" -mtime -1 | wc -l)
        
        if [[ $recent_logs -gt 0 ]]; then
            success "Log files are being written ($recent_logs recent files)"
            return 0
        else
            failure "No recent log files found"
            return 1
        fi
    else
        failure "Log directory not found: $log_dir"
        return 1
    fi
}

# Backup check
backup_check() {
    local backup_dir="${1:-/backups}"
    local max_age_hours="${2:-24}"
    
    check
    log "Checking recent backups in $backup_dir"
    
    if [[ -d "$backup_dir" ]]; then
        local recent_backups
        recent_backups=$(find "$backup_dir" -name "*.tar.gz" -mtime -1 | wc -l)
        
        if [[ $recent_backups -gt 0 ]]; then
            success "Recent backups found ($recent_backups files)"
            return 0
        else
            warning "No recent backups found (older than $max_age_hours hours)"
            return 1
        fi
    else
        failure "Backup directory not found: $backup_dir"
        return 1
    fi
}

# Performance check
performance_check() {
    check
    log "Checking system performance"
    
    # Check load average
    local load_avg
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores
    cpu_cores=$(nproc)
    local load_threshold
    load_threshold=$(echo "$cpu_cores * 2" | bc -l 2>/dev/null || echo $((cpu_cores * 2)))
    
    if (( $(echo "$load_avg < $load_threshold" | bc -l 2>/dev/null || echo 0) )); then
        success "System load is normal ($load_avg)"
    else
        failure "System load is high ($load_avg, threshold: $load_threshold)"
        return 1
    fi
}

# Network connectivity check
network_check() {
    check
    log "Checking network connectivity"
    
    # Check external connectivity
    if ping -c 1 -W 5 8.8.8.8 >/dev/null 2>&1; then
        success "External network connectivity OK"
    else
        failure "External network connectivity failed"
        return 1
    fi
    
    # Check DNS resolution
    check
    if nslookup google.com >/dev/null 2>&1; then
        success "DNS resolution is working"
    else
        failure "DNS resolution failed"
        return 1
    fi
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Perform comprehensive health checks on the Prompt Library system.

OPTIONS:
    -h, --help          Show this help message
    -v, --verbose       Enable verbose output
    -d, --domain DOMAIN Set domain for checks (default: localhost)
    -t, --timeout SEC   Set timeout for HTTP checks (default: 10)
    --quick             Perform only essential checks
    --full              Perform all available checks (default)

EXAMPLES:
    $0                          # Basic health check
    $0 --verbose --domain prod.example.com
    $0 --quick                  # Fast essential checks only

EOF
}

# Parse command line arguments
parse_args() {
    QUICK_MODE="false"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -v|--verbose)
                VERBOSE="true"
                shift
                ;;
            -d|--domain)
                DOMAIN="$2"
                shift 2
                ;;
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --quick)
                QUICK_MODE="true"
                shift
                ;;
            --full)
                QUICK_MODE="false"
                shift
                ;;
            -*)
                echo "Unknown option: $1" >&2
                usage
                exit 1
                ;;
            *)
                echo "Unknown argument: $1" >&2
                usage
                exit 1
                ;;
        esac
    done
}

# Main health check function
main() {
    parse_args "$@"
    
    echo "🏥 Prompt Library Health Check"
    echo "================================"
    echo "Domain: $DOMAIN"
    echo "Timeout: ${TIMEOUT}s"
    echo
    
    # Essential checks (always performed)
    echo "📋 Essential Checks:"
    http_check "Frontend" "http://$DOMAIN/health"
    http_check "Backend API" "http://$DOMAIN/api/system/health"
    docker_service_check "backend"
    docker_service_check "frontend"
    database_check
    redis_check
    
    if [[ "$QUICK_MODE" != "true" ]]; then
        echo
        echo "🔍 Extended Checks:"
        api_functionality_check
        websocket_check
        disk_space_check "/" 85
        memory_check 85
        performance_check
        network_check
        log_file_check
        backup_check
        
        # SSL check only if domain is not localhost
        if [[ "$DOMAIN" != "localhost" && "$DOMAIN" != "127.0.0.1" ]]; then
            ssl_check "$DOMAIN"
        fi
    fi
    
    echo
    echo "📊 Health Check Summary:"
    echo "========================"
    echo "Total Checks: $TOTAL_CHECKS"
    echo "Passed: $PASSED_CHECKS"
    echo "Failed: $FAILED_CHECKS"
    
    local success_rate
    if [[ $TOTAL_CHECKS -gt 0 ]]; then
        success_rate=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
        echo "Success Rate: $success_rate%"
        
        if [[ $FAILED_CHECKS -eq 0 ]]; then
            echo -e "${GREEN}🎉 All checks passed! System is healthy.${NC}"
            exit 0
        elif [[ $success_rate -ge 80 ]]; then
            echo -e "${YELLOW}⚠️  Some checks failed, but system is mostly healthy.${NC}"
            exit 1
        else
            echo -e "${RED}🚨 Multiple checks failed! System needs attention.${NC}"
            exit 2
        fi
    else
        echo -e "${RED}❌ No checks were performed.${NC}"
        exit 3
    fi
}

# Run main function
main "$@"