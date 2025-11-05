#!/bin/bash

# Docker Image Manager for Prompt Library v1.2.0
# Manages Docker image tagging, saving, loading, and deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VERSION="v1.2.0"
APP_IMAGE="project5-app"
IMAGES_DIR="docker-images"
COMPOSE_FILE="docker-compose.yml"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Docker Image Manager for Prompt Library"
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  tag-current     Tag current images with version labels"
    echo "  save-images     Save Docker images to tar files"
    echo "  load-images     Load Docker images from tar files"
    echo "  list-images     List all project Docker images"
    echo "  clean-old       Remove old/untagged images"
    echo "  deploy-saved    Deploy from saved images"
    echo "  backup-full     Create complete backup (save + metadata)"
    echo "  restore-full    Restore from complete backup"
    echo "  push-registry   Push images to Docker registry (if configured)"
    echo "  help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 tag-current              # Tag current build as v1.2.0"
    echo "  $0 save-images              # Save images to tar files"
    echo "  $0 deploy-saved             # Deploy using saved images"
    echo "  $0 backup-full              # Create complete backup"
}

# Function to tag current images
tag_current() {
    print_status "Tagging current images with version $VERSION..."
    
    # Check if base image exists
    if ! docker images | grep -q "$APP_IMAGE.*latest"; then
        print_error "Base image $APP_IMAGE:latest not found. Build the project first."
        exit 1
    fi
    
    # Tag with version
    docker tag $APP_IMAGE:latest $APP_IMAGE:$VERSION
    docker tag $APP_IMAGE:latest $APP_IMAGE:stable
    docker tag $APP_IMAGE:latest $APP_IMAGE:prompt-templates-fixed
    
    # Add timestamp tag
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    docker tag $APP_IMAGE:latest $APP_IMAGE:backup-$TIMESTAMP
    
    print_success "Images tagged successfully:"
    docker images | grep $APP_IMAGE
}

# Function to save images
save_images() {
    print_status "Saving Docker images to $IMAGES_DIR/$VERSION/..."
    
    # Create directory
    mkdir -p "$IMAGES_DIR/$VERSION"
    
    # Save main application image
    print_status "Saving application image..."
    docker save $APP_IMAGE:$VERSION -o "$IMAGES_DIR/$VERSION/$APP_IMAGE-$VERSION.tar"
    
    # Save dependency images
    print_status "Saving dependency images..."
    docker save postgres:15-alpine redis:7-alpine nginx:alpine -o "$IMAGES_DIR/$VERSION/dependencies-$VERSION.tar"
    
    # Create metadata file
    cat > "$IMAGES_DIR/$VERSION/metadata.json" << EOF
{
  "version": "$VERSION",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_tag": "$(git describe --tags --exact-match 2>/dev/null || echo 'unknown')",
  "images": {
    "application": "$APP_IMAGE-$VERSION.tar",
    "dependencies": "dependencies-$VERSION.tar"
  },
  "docker_compose": "$COMPOSE_FILE",
  "description": "LLM Prompt Templates Interface Fixes - Production Ready"
}
EOF
    
    # Copy docker-compose file
    cp "$COMPOSE_FILE" "$IMAGES_DIR/$VERSION/"
    
    # Create checksums
    print_status "Creating checksums..."
    cd "$IMAGES_DIR/$VERSION"
    sha256sum *.tar > checksums.sha256
    cd - > /dev/null
    
    # Show results
    print_success "Images saved successfully:"
    ls -lh "$IMAGES_DIR/$VERSION/"
    
    print_status "Total backup size: $(du -sh "$IMAGES_DIR/$VERSION" | cut -f1)"
}

# Function to load images
load_images() {
    print_status "Loading Docker images from $IMAGES_DIR/$VERSION/..."
    
    if [ ! -d "$IMAGES_DIR/$VERSION" ]; then
        print_error "Backup directory $IMAGES_DIR/$VERSION not found"
        exit 1
    fi
    
    # Verify checksums
    print_status "Verifying checksums..."
    cd "$IMAGES_DIR/$VERSION"
    if sha256sum -c checksums.sha256; then
        print_success "Checksums verified"
    else
        print_error "Checksum verification failed"
        exit 1
    fi
    cd - > /dev/null
    
    # Load images
    print_status "Loading application image..."
    docker load -i "$IMAGES_DIR/$VERSION/$APP_IMAGE-$VERSION.tar"
    
    print_status "Loading dependency images..."
    docker load -i "$IMAGES_DIR/$VERSION/dependencies-$VERSION.tar"
    
    print_success "Images loaded successfully"
    docker images | grep -E "(project5|postgres|redis|nginx)"
}

# Function to list images
list_images() {
    print_status "Project Docker images:"
    echo ""
    docker images | grep -E "(project5|postgres.*15|redis.*7|nginx)" || print_warning "No project images found"
    echo ""
    print_status "Saved image backups:"
    if [ -d "$IMAGES_DIR" ]; then
        find "$IMAGES_DIR" -name "*.tar" -exec ls -lh {} \; 2>/dev/null || print_warning "No saved images found"
    else
        print_warning "No backup directory found"
    fi
}

# Function to clean old images
clean_old() {
    print_warning "This will remove untagged and old Docker images"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up old images..."
        
        # Remove dangling images
        docker image prune -f
        
        # Remove old backup tags (keep last 3)
        OLD_BACKUPS=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep "$APP_IMAGE:backup-" | tail -n +4)
        if [ ! -z "$OLD_BACKUPS" ]; then
            echo "$OLD_BACKUPS" | xargs docker rmi 2>/dev/null || true
        fi
        
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to deploy from saved images
deploy_saved() {
    print_status "Deploying from saved images..."
    
    # Stop current containers
    if [ -f "$COMPOSE_FILE" ]; then
        print_status "Stopping current containers..."
        docker-compose down
    fi
    
    # Load images
    load_images
    
    # Start containers
    print_status "Starting containers with saved images..."
    docker-compose up -d
    
    # Wait for health check
    print_status "Waiting for application to be healthy..."
    sleep 10
    
    # Verify deployment
    if curl -s http://localhost:8000/api/system/health | grep -q '"healthy":true'; then
        print_success "Deployment successful! Application is healthy."
    else
        print_warning "Deployment completed but health check failed. Check logs with: docker-compose logs"
    fi
}

# Function to create full backup
backup_full() {
    print_status "Creating full backup for $VERSION..."
    
    # Tag current images
    tag_current
    
    # Save images
    save_images
    
    # Create deployment script
    cat > "$IMAGES_DIR/$VERSION/deploy.sh" << 'EOF'
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
EOF
    
    chmod +x "$IMAGES_DIR/$VERSION/deploy.sh"
    
    # Create README
    cat > "$IMAGES_DIR/$VERSION/README.md" << EOF
# Prompt Library v1.2.0 Backup

This backup contains a complete, working version of the Prompt Library application with all LLM Prompt Templates interface fixes.

## Contents
- \`project5-app-v1.2.0.tar\` - Main application image
- \`dependencies-v1.2.0.tar\` - PostgreSQL, Redis, Nginx images
- \`docker-compose.yml\` - Container orchestration configuration
- \`metadata.json\` - Backup metadata and checksums
- \`deploy.sh\` - Quick deployment script

## Quick Deployment
\`\`\`bash
./deploy.sh
\`\`\`

## Manual Deployment
\`\`\`bash
# Load images
docker load -i project5-app-v1.2.0.tar
docker load -i dependencies-v1.2.0.tar

# Start services
docker-compose up -d

# Verify
curl http://localhost:8000/api/system/health
\`\`\`

## Features Fixed in v1.2.0
- ✅ LLM Prompt Templates Editor tab working
- ✅ Template Testing interface functional
- ✅ Analytics dashboard with graceful error handling
- ✅ API endpoints accept timeRange parameters
- ✅ No more 400/500 errors on analytics
- ✅ Frontend TypeError crashes eliminated

## Access Points
- Main Application: http://localhost:8000
- Admin Interface: http://localhost:8000/admin
- API Documentation: http://localhost:8000/api/docs
- Health Check: http://localhost:8000/api/system/health

Created: $(date)
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')
EOF
    
    print_success "Full backup created in $IMAGES_DIR/$VERSION/"
    print_status "Backup includes:"
    ls -la "$IMAGES_DIR/$VERSION/"
}

# Function to restore from full backup
restore_full() {
    if [ ! -d "$IMAGES_DIR/$VERSION" ]; then
        print_error "Backup not found at $IMAGES_DIR/$VERSION"
        exit 1
    fi
    
    print_status "Restoring from full backup $VERSION..."
    
    # Show backup info
    if [ -f "$IMAGES_DIR/$VERSION/metadata.json" ]; then
        print_status "Backup metadata:"
        cat "$IMAGES_DIR/$VERSION/metadata.json" | jq . 2>/dev/null || cat "$IMAGES_DIR/$VERSION/metadata.json"
    fi
    
    # Deploy from saved images
    cd "$IMAGES_DIR/$VERSION"
    ./deploy.sh
    cd - > /dev/null
    
    print_success "Restore completed!"
}

# Function to push to registry (placeholder)
push_registry() {
    print_warning "Registry push not configured. To enable:"
    echo "1. Set up Docker registry (Docker Hub, AWS ECR, etc.)"
    echo "2. Configure authentication: docker login"
    echo "3. Tag images with registry prefix: docker tag $APP_IMAGE:$VERSION your-registry/$APP_IMAGE:$VERSION"
    echo "4. Push: docker push your-registry/$APP_IMAGE:$VERSION"
}

# Main script logic
case "${1:-help}" in
    "tag-current")
        tag_current
        ;;
    "save-images")
        save_images
        ;;
    "load-images")
        load_images
        ;;
    "list-images")
        list_images
        ;;
    "clean-old")
        clean_old
        ;;
    "deploy-saved")
        deploy_saved
        ;;
    "backup-full")
        backup_full
        ;;
    "restore-full")
        restore_full
        ;;
    "push-registry")
        push_registry
        ;;
    "help"|*)
        show_usage
        ;;
esac