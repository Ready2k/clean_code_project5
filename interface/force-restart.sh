#!/bin/bash

echo "🔥 FORCE RESTART - Clearing everything..."

# Kill all node processes
echo "🛑 Killing all processes..."
pkill -f "vite" 2>/dev/null || true
pkill -f "node.*8000" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true
sleep 2

# Clear all possible caches
echo "🧹 Clearing all caches..."
cd frontend
rm -rf node_modules/.vite
rm -rf node_modules/.cache  
rm -rf dist
rm -rf .vite
rm -rf .cache
cd ../backend
rm -rf dist
rm -rf .cache
cd ..

# Clear browser cache instruction
echo ""
echo "🌐 BROWSER CACHE CLEARING:"
echo "1. Open Chrome DevTools (F12)"
echo "2. Right-click the refresh button"
echo "3. Select 'Empty Cache and Hard Reload'"
echo "OR"
echo "4. Go to chrome://settings/clearBrowserData"
echo "5. Select 'Cached images and files' and clear"
echo ""

echo "✅ All caches cleared!"
echo ""
echo "NOW RUN THESE COMMANDS IN SEPARATE TERMINALS:"
echo "Terminal 1: cd interface/backend && npm run dev"
echo "Terminal 2: cd interface/frontend && npm run dev"
echo ""
echo "Then open: http://localhost:3000"
echo "Use Cmd+Shift+R or Ctrl+Shift+R for hard refresh"