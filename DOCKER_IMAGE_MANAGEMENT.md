# Docker Image Management Guide

## 🐳 Overview

This guide explains how to manage, save, and reuse Docker images for the Prompt Library v1.2.0 application.

## 📦 Available Images

### Tagged Images
- `project5-app:v1.2.0` - Versioned release image
- `project5-app:stable` - Stable release alias
- `project5-app:prompt-templates-fixed` - Descriptive feature tag
- `project5-app:latest` - Latest build
- `project5-app:backup-YYYYMMDD-HHMMSS` - Timestamped backups

### Dependency Images
- `postgres:15-alpine` - PostgreSQL database
- `redis:7-alpine` - Redis cache and sessions
- `nginx:alpine` - Reverse proxy

## 🛠️ Management Commands

### Using the Docker Image Manager Script

```bash
# Show all available commands
./docker-image-manager.sh help

# Create complete backup (recommended)
./docker-image-manager.sh backup-full

# List all project images
./docker-image-manager.sh list-images

# Deploy from saved images
./docker-image-manager.sh deploy-saved

# Clean up old images
./docker-image-manager.sh clean-old
```

### Manual Commands

```bash
# Tag current image with version
docker tag project5-app:latest project5-app:v1.2.0

# Save images to tar files
docker save project5-app:v1.2.0 -o project5-app-v1.2.0.tar
docker save postgres:15-alpine redis:7-alpine nginx:alpine -o dependencies-v1.2.0.tar

# Load images from tar files
docker load -i project5-app-v1.2.0.tar
docker load -i dependencies-v1.2.0.tar

# List all images
docker images | grep -E "(project5|postgres|redis|nginx)"
```

## 💾 Backup Storage

### Complete Backup Location
```
docker-images/v1.2.0/
├── project5-app-v1.2.0.tar      # Main application (81MB)
├── dependencies-v1.2.0.tar      # PostgreSQL, Redis, Nginx (139MB)
├── docker-compose.yml           # Container orchestration
├── deploy.sh                    # Quick deployment script
├── README.md                    # Backup documentation
├── metadata.json                # Backup metadata
└── checksums.sha256             # File integrity verification
```

### Backup Metadata
```json
{
  "version": "v1.2.0",
  "created": "2025-11-05T16:55:28Z",
  "git_commit": "588c1d6",
  "git_tag": "v1.2.0",
  "images": {
    "application": "project5-app-v1.2.0.tar",
    "dependencies": "dependencies-v1.2.0.tar"
  },
  "description": "LLM Prompt Templates Interface Fixes - Production Ready"
}
```

## 🚀 Deployment Scenarios

### 1. Quick Deployment from Backup
```bash
cd docker-images/v1.2.0/
./deploy.sh
```

### 2. Fresh Environment Setup
```bash
# Copy backup to new machine
scp -r docker-images/v1.2.0/ user@newserver:/path/to/project/

# On new machine
cd /path/to/project/docker-images/v1.2.0/
./deploy.sh
```

### 3. Rollback to Stable Version
```bash
# Stop current version
docker-compose down

# Load stable images
./docker-image-manager.sh load-images

# Start stable version
docker-compose up -d
```

### 4. Development with Saved Images
```bash
# Load specific version for testing
docker load -i docker-images/v1.2.0/project5-app-v1.2.0.tar

# Run with different tag
docker run -d --name test-app project5-app:v1.2.0
```

## 🔄 Image Lifecycle Management

### Regular Maintenance
```bash
# Weekly cleanup of old images
./docker-image-manager.sh clean-old

# Monthly backup creation
./docker-image-manager.sh backup-full

# List current storage usage
./docker-image-manager.sh list-images
```

### Version Management
```bash
# Tag new releases
docker tag project5-app:latest project5-app:v1.3.0

# Create release backup
VERSION=v1.3.0 ./docker-image-manager.sh backup-full

# Archive old versions
mv docker-images/v1.1.0 docker-images/archive/
```

## 📊 Storage Requirements

### Disk Space Usage
- **Application Image**: ~81MB (compressed)
- **Dependencies**: ~139MB (compressed)
- **Total per backup**: ~225MB
- **Recommended free space**: 1GB (for multiple versions)

### Retention Policy
- **Latest**: Keep indefinitely
- **Stable**: Keep last 3 versions
- **Feature branches**: Keep 30 days
- **Backup timestamps**: Keep last 10

## 🔐 Security Considerations

### Image Security
- Images are scanned during build process
- Base images use Alpine Linux for minimal attack surface
- Regular security updates applied
- No secrets embedded in images

### Backup Security
- Tar files contain no sensitive data
- Configuration secrets loaded at runtime
- Checksums verify integrity
- Store backups in secure locations

## 🌐 Registry Integration

### Docker Hub (Optional)
```bash
# Login to Docker Hub
docker login

# Tag for registry
docker tag project5-app:v1.2.0 yourusername/project5-app:v1.2.0

# Push to registry
docker push yourusername/project5-app:v1.2.0

# Pull from registry
docker pull yourusername/project5-app:v1.2.0
```

### Private Registry (Optional)
```bash
# Tag for private registry
docker tag project5-app:v1.2.0 registry.company.com/project5-app:v1.2.0

# Push to private registry
docker push registry.company.com/project5-app:v1.2.0
```

## 🧪 Testing Saved Images

### Verification Steps
```bash
# 1. Load images
./docker-image-manager.sh load-images

# 2. Start services
docker-compose up -d

# 3. Run verification
./verify-v1.2.0-deployment.sh

# 4. Manual checks
curl http://localhost:8000/api/system/health
open http://localhost:8000/admin/prompt-templates
```

### Expected Results
- ✅ All containers start successfully
- ✅ Health check returns "healthy": true
- ✅ Admin interface loads without errors
- ✅ All prompt template tabs functional

## 📝 Troubleshooting

### Common Issues

**Image not found:**
```bash
# Check available images
docker images | grep project5

# Load from backup if missing
docker load -i docker-images/v1.2.0/project5-app-v1.2.0.tar
```

**Checksum verification failed:**
```bash
# Re-download or re-create backup
./docker-image-manager.sh backup-full
```

**Container startup issues:**
```bash
# Check logs
docker-compose logs

# Restart services
docker-compose restart
```

**Port conflicts:**
```bash
# Check port usage
lsof -i :8000

# Stop conflicting services
docker-compose down
```

## 🎯 Best Practices

1. **Regular Backups**: Create backups before major changes
2. **Version Tagging**: Use semantic versioning for releases
3. **Testing**: Always test restored images before production use
4. **Documentation**: Keep backup metadata up to date
5. **Cleanup**: Regularly remove old images to save space
6. **Security**: Scan images for vulnerabilities
7. **Monitoring**: Track image sizes and storage usage

This comprehensive image management system ensures you can reliably deploy, rollback, and maintain the Prompt Library application across different environments.