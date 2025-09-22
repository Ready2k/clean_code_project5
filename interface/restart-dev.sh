#!/bin/bash

echo "🔄 Restarting Prompt Library Development Environment"
echo "=================================================="

# Kill any existing processes on ports 3000 and 8000
echo "🛑 Stopping existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Clear frontend cache
echo "🧹 Clearing frontend cache..."
cd frontend
rm -rf node_modules/.vite dist 2>/dev/null || true
cd ..

# Start backend
echo "🚀 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend development server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Development servers started!"
echo "📍 Frontend: http://localhost:3000"
echo "📍 Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
trap "echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

wait