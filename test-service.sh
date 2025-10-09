#!/bin/bash

# Quick service test script
echo "🧪 Testing Prompt Library Services..."
echo ""

# Test frontend
echo "🌐 Frontend (http://localhost:3000):"
if curl -s --max-time 5 http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is responding"
else
    echo "❌ Frontend is not responding"
fi

# Test backend API
echo ""
echo "🔧 Backend API (http://localhost:8000):"
if curl -s --max-time 5 http://localhost:8000/api/auth/login > /dev/null; then
    echo "✅ Backend API is responding"
else
    echo "❌ Backend API is not responding"
fi

# Test database connection
echo ""
echo "🗄️  Database Connection:"
if docker-compose -f interface/docker-compose.dev.yml exec -T postgres psql -U postgres -d promptlib -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database is connected"
else
    echo "❌ Database connection failed"
fi

# Test Redis connection
echo ""
echo "🔴 Redis Connection:"
if docker-compose -f interface/docker-compose.dev.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is connected"
else
    echo "❌ Redis connection failed"
fi

echo ""
echo "🎉 Service Status Check Complete!"
echo ""
echo "📝 Ready for testing at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"