#!/bin/bash

echo "🚀 Starting Prompt Library Professional Interface Demo"
echo ""
echo "This demo shows the complete UI with mock data."
echo "No backend or database setup required!"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the interface directory"
    echo "   cd interface && ./start-demo.sh"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ to continue."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    cd frontend && npm install && cd ..
fi

echo "🎯 Starting demo server..."
echo ""
echo "📍 Demo will be available at: http://localhost:3000"
echo "   (or the next available port if 3000 is busy)"
echo ""
echo "🎮 Demo Features:"
echo "   • Dashboard with system overview"
echo "   • Prompt library management"
echo "   • LLM connection management"
echo "   • User settings and preferences"
echo ""
echo "💡 Tip: This is a fully interactive demo with mock data"
echo "    All UI features are functional for testing"
echo ""
echo "Press Ctrl+C to stop the demo"
echo ""

cd frontend
npm run demo