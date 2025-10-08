#!/bin/bash

echo "🚀 Quick Start Script for Local Development"
echo "=========================================="

# Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "✅ Docker found - Starting dependencies with Docker..."
    
    # Start only the database dependencies
    docker-compose -f docker-compose.deps.yml up -d
    
    echo "⏳ Waiting for services to be ready..."
    sleep 10
    
    # Check if services are ready
    if docker-compose -f docker-compose.deps.yml ps | grep -q "Up"; then
        echo "✅ Database services are running!"
        echo "📊 PostgreSQL: localhost:5432"
        echo "🔴 Redis: localhost:6379"
    else
        echo "❌ Failed to start database services"
        exit 1
    fi
    
elif command -v psql &> /dev/null && command -v redis-cli &> /dev/null; then
    echo "✅ PostgreSQL and Redis found locally"
    
    # Test connections
    if pg_isready -h localhost -p 5432 &> /dev/null; then
        echo "✅ PostgreSQL is running"
    else
        echo "❌ PostgreSQL is not running. Please start it:"
        echo "   macOS: brew services start postgresql@15"
        echo "   Linux: sudo systemctl start postgresql"
        exit 1
    fi
    
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "❌ Redis is not running. Please start it:"
        echo "   macOS: brew services start redis"
        echo "   Linux: sudo systemctl start redis-server"
        exit 1
    fi
    
else
    echo "❌ Neither Docker nor local PostgreSQL/Redis found"
    echo ""
    echo "Please choose one option:"
    echo "1. Install Docker and run: docker-compose -f docker-compose.deps.yml up -d"
    echo "2. Install PostgreSQL and Redis locally (see setup-local-postgres.md)"
    exit 1
fi

echo ""
echo "🎯 Ready to start the backend!"
echo "Run: cd interface/backend && npm run dev"