#!/bin/bash

echo "🚀 Starting Prompt Library Professional Interface - FULL VERSION"
echo ""
echo "This starts the complete application with backend and database services."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the interface directory"
    echo "   cd interface && ./start-real.sh"
    exit 1
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not running."
    echo "   The full version requires Docker for database services."
    echo ""
    echo "💡 Options:"
    echo "   1. Install Docker: https://docs.docker.com/get-docker/"
    echo "   2. Use demo mode instead: ./start-demo.sh"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "frontend/node_modules" ] || [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm run install:all
fi

echo "🐳 Starting database services..."
echo "   - PostgreSQL (user data and metadata)"
echo "   - Redis (caching and sessions)"
echo ""

# Start database services
if ! docker compose -f docker-compose.dev.yml up -d; then
    echo "❌ Failed to start database services"
    echo "   Make sure Docker is running and try again"
    exit 1
fi

echo "⏳ Waiting for databases to be ready..."
sleep 10

echo "🔧 Starting development servers..."
echo ""
echo "📍 Frontend: http://localhost:3000"
echo "📍 Backend API: http://localhost:8000"
echo "📍 API Docs: http://localhost:8000/api/docs"
echo ""
echo "🎯 Features available:"
echo "   • Full authentication system"
echo "   • Real database storage"
echo "   • LLM provider integrations"
echo "   • WebSocket real-time updates"
echo "   • Complete API functionality"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start both frontend and backend
npm run dev