#!/bin/bash

# Development startup script for Prompt Library Interface
# This script starts the application without Docker dependencies

echo "🚀 Starting Prompt Library Interface Development Environment"

# Set environment
export NODE_ENV=development

# Create necessary directories
mkdir -p data/prompts
mkdir -p logs

# Check if we have Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ to continue."
    exit 1
fi

# Check if we have npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm to continue."
    exit 1
fi

echo "✅ Node.js and npm are available"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Copy environment file
if [ ! -f ".env" ]; then
    echo "📝 Creating development environment file..."
    cp .env.development .env
fi

echo "🔧 Starting development servers..."

# Start the development servers
echo "🖥️  Starting backend and frontend servers..."
echo "📍 Backend will be available at: http://localhost:8000"
echo "📍 Frontend will be available at: http://localhost:3000"
echo ""
echo "Note: This demo runs without database services."
echo "Some features may not work without PostgreSQL and Redis."
echo ""
echo "Press Ctrl+C to stop the servers"

# Start both servers concurrently
npm run dev