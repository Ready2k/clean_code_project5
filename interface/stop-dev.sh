#!/bin/bash

# Stop development servers gracefully
echo "🛑 Stopping development servers..."

# Find and kill npm processes for this project
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "vite --port 3000" 2>/dev/null || true
pkill -f "tsx watch src/index.ts" 2>/dev/null || true

# Wait a moment for graceful shutdown
sleep 2

# Force kill if still running
pkill -9 -f "npm run dev" 2>/dev/null || true
pkill -9 -f "vite --port 3000" 2>/dev/null || true
pkill -9 -f "tsx watch src/index.ts" 2>/dev/null || true

echo "✅ Development servers stopped"