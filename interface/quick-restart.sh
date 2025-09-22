#!/bin/bash

echo "🔄 Quick restart with cache clearing..."

# Kill existing processes
pkill -f "vite.*3000" 2>/dev/null || true
pkill -f "node.*8000" 2>/dev/null || true

# Clear all caches
echo "🧹 Clearing caches..."
cd frontend
rm -rf node_modules/.vite dist .vite 2>/dev/null || true
cd ../backend
rm -rf dist 2>/dev/null || true
cd ..

echo "✅ Caches cleared. Now run:"
echo "   Terminal 1: cd interface/backend && npm run dev"
echo "   Terminal 2: cd interface/frontend && npm run dev"
echo ""
echo "Then open http://localhost:3000 in a NEW browser tab"
echo "Or use Cmd+Shift+R to hard refresh"