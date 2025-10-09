# Docker Setup and Deployment Guide

This guide covers the Docker configuration for the Prompt Library project, including development and production setups.

## Overview

The project includes multiple Docker configurations:

- **Root Level**: Complete application stack (recommended for production)
- **Interface Level**: Separate frontend/backend containers (recommended for development)
- **Development**: Infrastructure services only (Redis, PostgreSQL)

## Quick Start

### 1. Development with Infrastructure Services

Start only the database and cache services, run the application locally:

```bash
# Start infrastructure services
./docker-dev.sh start

# Run the application locally
cd interface
npm run dev
```

### 2. Full Docker Development Stack

Run everything in containers:

```bash
# Build images
./docker-build.sh

# Start all services
cd interface
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Production Deployment

Use the root-level configuration for production:

```bash
# Build production images
docker-compose build

# Start production stack
docker-compose up -d

# Monitor services
docker-compose ps
```

## Docker Configurations

### Root Level (`docker-compose.yml`)

**Services:**
- `app`: Combined backend + frontend application
- `postgres`: PostgreSQL database
- `redis`: Redis cache and session store
- `nginx`: Reverse proxy (optional)

**Ports:**
- `8000`: Application server
- `5432`: PostgreSQL
- `6379`: Redis
- `80`: Nginx (HTTP)

### Interface Level (`interface/docker-compose.yml`)

**Services:**
- `frontend`: React application (port 3000)
- `backend`: Node.js API server (port 8000)
- `postgres`: PostgreSQL database (port 5432)
- `redis`: Redis cache (port 6379)
- `nginx`: Reverse proxy (ports 80, 443)

### Development Level (`interface/docker-compose.dev.yml`)

**Services:**
- `postgres`: PostgreSQL database
- `redis`: Redis cache

## Environment Variables

### Required Variables

```bash
# Security
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key

# Database
POSTGRES_PASSWORD=your-database-password
DATABASE_URL=postgresql://postgres:password@postgres:5432/promptlib

# Redis
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=production
PORT=8000
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

### Optional Variables

```bash
# Logging
LOG_LEVEL=info
LOGS_DIR=/app/logs

# Storage
STORAGE_DIR=/app/data

# External APIs
OPENAI_API_KEY=your-openai-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

## Management Scripts

### `./docker-dev.sh`

Development environment management:

```bash
./docker-dev.sh start     # Start infrastructure services
./docker-dev.sh stop      # Stop all services
./docker-dev.sh restart   # Restart services
./docker-dev.sh logs      # Show logs
./docker-dev.sh status    # Show service status
./docker-dev.sh clean     # Clean up resources
./docker-dev.sh build     # Build images
./docker-dev.sh shell     # Open backend shell
./docker-dev.sh db        # Connect to PostgreSQL
./docker-dev.sh redis     # Connect to Redis
```

### `./docker-build.sh`

Build all Docker images with error handling and verification.

## Health Checks

All services include health checks:

- **Application**: `GET /api/system/health`
- **PostgreSQL**: `pg_isready -U postgres`
- **Redis**: `redis-cli ping`
- **Nginx**: `nginx -t`

## Volumes

### Persistent Data

- `postgres_data`: Database files
- `redis_data`: Redis persistence
- `prompt_data`: Application data (prompts, uploads)
- `app_logs`: Application logs

### Development Mounts

- `../src:/app/prompt-library/src:ro`: Core library source (read-only)

## Networks

All services communicate through the `prompt-library` bridge network.

## Security Features

### Container Security

- Non-root users in all containers
- Read-only root filesystems where possible
- Security updates in base images
- Minimal attack surface

### Network Security

- Internal network isolation
- Rate limiting in Nginx
- Security headers
- CORS configuration

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using the port
   lsof -i :8000
   
   # Stop conflicting services
   ./docker-dev.sh stop
   ```

2. **Permission Issues**
   ```bash
   # Fix volume permissions
   docker-compose down
   docker volume rm $(docker volume ls -q)
   docker-compose up -d
   ```

3. **Build Failures**
   ```bash
   # Clean build
   docker-compose build --no-cache
   
   # Remove old images
   docker image prune -f
   ```

4. **Database Connection Issues**
   ```bash
   # Check database status
   ./docker-dev.sh db
   
   # Reset database
   docker-compose down
   docker volume rm interface_postgres_data
   docker-compose up -d postgres
   ```

### Debugging

1. **View Logs**
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f backend
   ```

2. **Execute Commands**
   ```bash
   # Backend shell
   docker-compose exec backend sh
   
   # Database shell
   docker-compose exec postgres psql -U postgres -d promptlib
   ```

3. **Inspect Containers**
   ```bash
   # Container details
   docker inspect <container_name>
   
   # Resource usage
   docker stats
   ```

## Production Considerations

### Performance

- Use production-optimized images
- Configure resource limits
- Enable connection pooling
- Use Redis for caching

### Monitoring

- Health check endpoints
- Prometheus metrics
- Structured logging
- Error tracking

### Backup

- Database backups
- Volume snapshots
- Configuration backups
- Disaster recovery plan

### Security

- Use secrets management
- Regular security updates
- Network policies
- Access controls

## Development Workflow

### Local Development

1. Start infrastructure services:
   ```bash
   ./docker-dev.sh start
   ```

2. Run application locally:
   ```bash
   cd interface
   npm run dev
   ```

3. Make changes and test

4. Stop services when done:
   ```bash
   ./docker-dev.sh stop
   ```

### Container Development

1. Build images:
   ```bash
   ./docker-build.sh
   ```

2. Start full stack:
   ```bash
   cd interface
   docker-compose up -d
   ```

3. View logs and debug:
   ```bash
   docker-compose logs -f
   ./docker-dev.sh shell
   ```

4. Clean up:
   ```bash
   ./docker-dev.sh clean
   ```

## Deployment

### Staging

Use the interface-level configuration with production environment variables:

```bash
cd interface
cp .env.production .env
docker-compose -f docker-compose.prod.yml up -d
```

### Production

Use the root-level configuration with proper secrets:

```bash
# Set environment variables
export JWT_SECRET="your-production-jwt-secret"
export ENCRYPTION_KEY="your-production-encryption-key"
export POSTGRES_PASSWORD="your-production-db-password"

# Deploy
docker-compose up -d

# Monitor
docker-compose ps
docker-compose logs -f
```

## Maintenance

### Regular Tasks

- Update base images monthly
- Rotate secrets quarterly
- Clean up unused resources weekly
- Monitor resource usage daily

### Updates

1. Pull latest images:
   ```bash
   docker-compose pull
   ```

2. Rebuild custom images:
   ```bash
   ./docker-build.sh
   ```

3. Rolling update:
   ```bash
   docker-compose up -d --no-deps backend
   docker-compose up -d --no-deps frontend
   ```

4. Verify deployment:
   ```bash
   ./docker-dev.sh status
   curl http://localhost:8000/api/system/health
   ```