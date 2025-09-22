#!/bin/bash

echo "🔍 Checking Prompt Library Interface Status"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the interface directory"
    exit 1
fi

echo "📦 Checking Dependencies..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js: Not installed"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm: $NPM_VERSION"
else
    echo "❌ npm: Not installed"
fi

# Check main dependencies
if [ -d "node_modules" ]; then
    echo "✅ Main dependencies: Installed"
else
    echo "❌ Main dependencies: Not installed (run: npm install)"
fi

# Check frontend dependencies
if [ -d "frontend/node_modules" ]; then
    echo "✅ Frontend dependencies: Installed"
else
    echo "❌ Frontend dependencies: Not installed (run: cd frontend && npm install)"
fi

# Check backend dependencies
if [ -d "backend/node_modules" ]; then
    echo "✅ Backend dependencies: Installed"
else
    echo "❌ Backend dependencies: Not installed (run: cd backend && npm install)"
fi

echo ""
echo "🎯 Available Commands:"
echo ""
echo "Frontend Development:"
echo "  cd frontend && npm run dev         # Development server"
echo ""
echo "Full Development (Requires Docker):"
echo "  npm run dev                        # Start both frontend and backend"
echo "  npm run dev:frontend               # Frontend only"
echo "  npm run dev:backend                # Backend only"
echo ""
echo "💡 Tip: Start with the demo to see the UI working immediately!"