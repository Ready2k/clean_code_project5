#!/bin/bash

# Docker build script for Prompt Library
# This script builds all Docker images and handles common build issues

set -e

echo "🐳 Building Prompt Library Docker Images..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    print_error "docker-compose is not installed. Please install it and try again."
    exit 1
fi

# Build root application
print_status "Building root application image..."
if docker-compose build --no-cache app; then
    print_status "✅ Root application image built successfully"
else
    print_error "❌ Failed to build root application image"
    exit 1
fi

# Build interface components
print_status "Building interface components..."
cd interface

if docker-compose build --no-cache frontend backend; then
    print_status "✅ Interface components built successfully"
else
    print_error "❌ Failed to build interface components"
    exit 1
fi

cd ..

# Verify images
print_status "Verifying built images..."
docker images | grep -E "(project5|interface)" || true

print_status "🎉 All Docker images built successfully!"

echo ""
echo "Next steps:"
echo "  • Run 'docker-compose up -d' to start the full stack"
echo "  • Run 'cd interface && docker-compose up -d' to start interface only"
echo "  • Run 'docker-compose logs -f' to view logs"
echo "  • Run 'docker-compose down' to stop services"