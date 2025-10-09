#!/bin/bash

# Real-time monitoring script for Prompt Library
# Shows current status of all services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Prompt Library Status Monitor${NC}"
    echo -e "${BLUE}  $(date)${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

check_port() {
    local port=$1
    local service=$2
    
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $service (Port $port): RUNNING${NC}"
        return 0
    else
        echo -e "${RED}❌ $service (Port $port): NOT RUNNING${NC}"
        return 1
    fi
}

check_docker_service() {
    local service=$1
    local container_name=$2
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up"; then
        echo -e "${GREEN}✅ $service: RUNNING${NC}"
        return 0
    else
        echo -e "${RED}❌ $service: NOT RUNNING${NC}"
        return 1
    fi
}

test_endpoint() {
    local url=$1
    local name=$2
    
    if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name: RESPONDING${NC}"
        return 0
    else
        echo -e "${RED}❌ $name: NOT RESPONDING${NC}"
        return 1
    fi
}

# Main monitoring loop
while true; do
    clear
    print_header
    
    echo -e "${YELLOW}🐳 Docker Services:${NC}"
    check_docker_service "PostgreSQL Database" "interface-postgres-1"
    check_docker_service "Redis Cache" "interface-redis-1"
    echo ""
    
    echo -e "${YELLOW}🚀 Application Services:${NC}"
    check_port 3000 "Frontend (React)"
    check_port 8000 "Backend (API)"
    echo ""
    
    echo -e "${YELLOW}🌐 Endpoint Health:${NC}"
    test_endpoint "http://localhost:3000" "Frontend"
    test_endpoint "http://localhost:8000/api/auth/login" "Backend API"
    echo ""
    
    echo -e "${YELLOW}📊 Quick Stats:${NC}"
    
    # Database connection test
    if docker-compose -f interface/docker-compose.dev.yml exec -T postgres psql -U postgres -d promptlib -c "SELECT COUNT(*) as user_count FROM users;" 2>/dev/null | grep -q "1"; then
        echo -e "${GREEN}✅ Database: Connected (1 user)${NC}"
    else
        echo -e "${RED}❌ Database: Connection failed${NC}"
    fi
    
    # Redis connection test
    if docker-compose -f interface/docker-compose.dev.yml exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}✅ Redis: Connected${NC}"
    else
        echo -e "${RED}❌ Redis: Connection failed${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Press Ctrl+C to exit monitoring${NC}"
    echo -e "${BLUE}Refreshing in 5 seconds...${NC}"
    
    sleep 5
done