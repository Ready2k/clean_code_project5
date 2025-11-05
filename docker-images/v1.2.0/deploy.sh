#!/bin/bash
# Quick deployment script for v1.2.0

echo "🚀 Deploying Prompt Library v1.2.0 from backup..."

# Load images
docker load -i project5-app-v1.2.0.tar
docker load -i dependencies-v1.2.0.tar

# Start services
docker-compose up -d

echo "✅ Deployment complete!"
echo "🌐 Access the application at: http://localhost:8000"
echo "📊 Health check: curl http://localhost:8000/api/system/health"
