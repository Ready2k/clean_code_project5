#!/bin/bash

echo "🔍 Environment Check for Prompt Library Interface"
echo "=================================================="
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
else
    echo "❌ Node.js not found"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    echo "✅ npm: $(npm --version)"
else
    echo "❌ npm not found"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Not in interface directory. Please run: cd interface"
    exit 1
fi

echo "✅ In correct directory"

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "⚠️  Root dependencies not installed"
    echo "   Run: npm install"
else
    echo "✅ Root dependencies installed"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  Frontend dependencies not installed"
    echo "   Run: cd frontend && npm install"
else
    echo "✅ Frontend dependencies installed"
fi

if [ ! -d "backend/node_modules" ]; then
    echo "⚠️  Backend dependencies not installed"
    echo "   Run: cd backend && npm install"
else
    echo "✅ Backend dependencies installed"
fi

# Check ports
echo ""
echo "🔌 Checking ports..."

if lsof -i :8000 &> /dev/null; then
    echo "⚠️  Port 8000 (backend) is in use"
else
    echo "✅ Port 8000 (backend) is available"
fi

if lsof -i :3000 &> /dev/null; then
    echo "⚠️  Port 3000 (frontend) is in use"
else
    echo "✅ Port 3000 (frontend) is available"
fi

echo ""
echo "🚀 Ready to start! Use one of these commands:"
echo "   ./start-demo.sh    - Demo mode (no backend needed)"
echo "   ./start-real.sh    - Full application with backend"
echo ""