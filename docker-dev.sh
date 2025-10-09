#!/bin/bash

# Docker development script for Prompt Library
# This script manages the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[DOCKER]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start development environment"
    echo "  stop      Stop development environment"
    echo "  restart   Restart development environment"
    echo "  logs      Show logs"
    echo "  status    Show service status"
    echo "  clean     Clean up containers and volumes"
    echo "  build     Build images"
    echo "  shell     Open shell in backend container"
    echo "  db        Connect to PostgreSQL database"
    echo "  redis     Connect to Redis"
    echo ""
}

# Function to start services
start_services() {
    print_header "Starting development environment..."
    
    # Start infrastructure services first
    print_status "Starting infrastructure services (Redis, PostgreSQL)..."
    cd interface
    docker-compose -f docker-compose.dev.yml up -d redis postgres
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are healthy
    if docker-compose -f docker-compose.dev.yml ps | grep -q "Up"; then
        print_status "✅ Infrastructure services are running"
    else
        print_error "❌ Failed to start infrastructure services"
        exit 1
    fi
    
    cd ..
    
    print_status "🎉 Development environment is ready!"
    print_status "You can now run the application locally with:"
    print_status "  cd interface && npm run dev"
    print_status ""
    print_status "Or start the full Docker stack with:"
    print_status "  docker-compose up -d"
}

# Function to stop services
stop_services() {
    print_header "Stopping development environment..."
    
    # Stop root services
    if [ -f docker-compose.yml ]; then
        docker-compose down
    fi
    
    # Stop interface services
    cd interface
    if [ -f docker-compose.yml ]; then
        docker-compose down
    fi
    if [ -f docker-compose.dev.yml ]; then
        docker-compose -f docker-compose.dev.yml down
    fi
    cd ..
    
    print_status "✅ Development environment stopped"
}

# Function to show logs
show_logs() {
    print_header "Showing logs..."
    if [ -f interface/docker-compose.dev.yml ]; then
        cd interface
        docker-compose -f docker-compose.dev.yml logs -f
        cd ..
    else
        docker-compose logs -f
    fi
}

# Function to show status
show_status() {
    print_header "Service Status:"
    echo ""
    
    # Check root services
    if [ -f docker-compose.yml ]; then
        print_status "Root services:"
        docker-compose ps
        echo ""
    fi
    
    # Check interface services
    if [ -f interface/docker-compose.yml ]; then
        print_status "Interface services:"
        cd interface
        docker-compose ps
        cd ..
        echo ""
    fi
    
    # Check development services
    if [ -f interface/docker-compose.dev.yml ]; then
        print_status "Development services:"
        cd interface
        docker-compose -f docker-compose.dev.yml ps
        cd ..
    fi
}

# Function to clean up
clean_up() {
    print_header "Cleaning up Docker resources..."
    
    print_warning "This will remove all containers, networks, and volumes!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Stop and remove everything
        stop_services
        
        # Remove volumes
        docker volume prune -f
        
        # Remove unused networks
        docker network prune -f
        
        # Remove unused images
        docker image prune -f
        
        print_status "✅ Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to build images
build_images() {
    print_header "Building Docker images..."
    ./docker-build.sh
}

# Function to open shell
open_shell() {
    print_header "Opening shell in backend container..."
    
    # Check if backend container is running
    if docker-compose ps | grep -q "backend.*Up"; then
        docker-compose exec backend sh
    elif [ -f interface/docker-compose.yml ] && cd interface && docker-compose ps | grep -q "backend.*Up"; then
        docker-compose exec backend sh
        cd ..
    else
        print_error "Backend container is not running. Start it first with: $0 start"
        exit 1
    fi
}

# Function to connect to database
connect_db() {
    print_header "Connecting to PostgreSQL database..."
    
    # Check if postgres container is running
    if docker-compose ps | grep -q "postgres.*Up"; then
        docker-compose exec postgres psql -U postgres -d promptlib
    elif [ -f interface/docker-compose.dev.yml ]; then
        cd interface
        docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d promptlib
        cd ..
    else
        print_error "PostgreSQL container is not running. Start it first with: $0 start"
        exit 1
    fi
}

# Function to connect to Redis
connect_redis() {
    print_header "Connecting to Redis..."
    
    # Check if redis container is running
    if docker-compose ps | grep -q "redis.*Up"; then
        docker-compose exec redis redis-cli
    elif [ -f interface/docker-compose.dev.yml ]; then
        cd interface
        docker-compose -f docker-compose.dev.yml exec redis redis-cli
        cd ..
    else
        print_error "Redis container is not running. Start it first with: $0 start"
        exit 1
    fi
}

# Main script logic
case "${1:-}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        start_services
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    clean)
        clean_up
        ;;
    build)
        build_images
        ;;
    shell)
        open_shell
        ;;
    db)
        connect_db
        ;;
    redis)
        connect_redis
        ;;
    *)
        show_usage
        exit 1
        ;;
esac