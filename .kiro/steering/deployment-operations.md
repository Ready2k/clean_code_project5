---
inclusion: fileMatch
fileMatchPattern: "**/docker*"
---

# Deployment and Operations Guidelines

## Docker Usage and Container Strategy

### Docker Development Workflow

#### Quick Start Commands
```bash
# Development with infrastructure only (recommended for local dev)
./docker-dev.sh start          # Start PostgreSQL + Redis
npm run dev                    # Run app locally

# Full containerized development
./docker-build.sh              # Build all images
docker-compose up -d           # Start complete stack
docker-compose logs -f         # Monitor logs

# Production deployment
docker-compose -f docker-compose.secure.yml up -d
```

#### Available Docker Configurations
- **Root Level** (`docker-compose.yml`): Complete production stack
- **Interface Level** (`interface/docker-compose.yml`): Separate frontend/backend containers
- **Development** (`interface/docker-compose.dev.yml`): Infrastructure services only
- **Secure** (`docker-compose.secure.yml`): Hardened production deployment

### Docker Management Scripts

#### `./docker-dev.sh` Commands
```bash
./docker-dev.sh start          # Start infrastructure services
./docker-dev.sh stop           # Stop all services
./docker-dev.sh restart        # Restart services
./docker-dev.sh logs           # Show service logs
./docker-dev.sh status         # Check service status
./docker-dev.sh clean          # Clean up resources
./docker-dev.sh build          # Build images
./docker-dev.sh shell          # Open backend container shell
./docker-dev.sh db             # Connect to PostgreSQL
./docker-dev.sh redis          # Connect to Redis CLI
```

#### `./docker-build.sh`
- Builds all Docker images with error handling
- Verifies successful builds
- Handles multi-stage build process

### Docker Configuration Standards

#### Multi-Stage Builds
- Use `node:18-alpine` as base image for security and size
- Separate build and production stages
- Copy only necessary files to production stage
- Use `--chown` flags for proper file ownership

#### Container Security
- Run containers as non-root users (nodejs:1001)
- Use read-only root filesystems where possible
- Implement security labels and options
- Regular security updates in base images
- Use `dumb-init` for proper signal handling

#### Health Checks
All services must implement health checks:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/system/health || exit 1
```

### Environment Management

#### Environment Variables Structure
```bash
# Security (required)
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key

# Database (required)
POSTGRES_PASSWORD=your-database-password
DATABASE_URL=postgresql://postgres:password@postgres:5432/promptlib

# Redis (required)
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=production
PORT=8000
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# Optional
LOG_LEVEL=info
STORAGE_DIR=/app/data
```

#### Secrets Management
- Use Docker secrets for production (`docker-compose.secure.yml`)
- Never include secrets in Docker images
- Use `_FILE` suffix for file-based secrets
- External secret management for production environments

### Service Architecture

#### Core Services
- **app**: Combined backend + frontend (port 8000)
- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis cache and sessions (port 6379)
- **nginx**: Reverse proxy (ports 80, 443)

#### Volume Management
```yaml
volumes:
  prompt_data: # Application data persistence
  app_logs: # Application logs
  redis_data: # Redis persistence
  postgres_data: # Database files
```

#### Network Configuration
- Use bridge networks for service isolation
- Internal communication between services
- Expose only necessary ports externally

### Development Workflows

#### Local Development (Recommended)
1. Start infrastructure: `./docker-dev.sh start`
2. Run application locally: `npm run dev`
3. Develop with hot reload and debugging
4. Stop when done: `./docker-dev.sh stop`

#### Container Development
1. Build images: `./docker-build.sh`
2. Start stack: `docker-compose up -d`
3. Monitor: `docker-compose logs -f`
4. Debug: `./docker-dev.sh shell`
5. Clean up: `./docker-dev.sh clean`

### Production Deployment

#### Staging Environment
```bash
cd interface
cp .env.production .env
docker-compose -f docker-compose.prod.yml up -d
```

#### Production Environment
```bash
# Set production secrets
export JWT_SECRET="your-production-jwt-secret"
export ENCRYPTION_KEY="your-production-encryption-key"
export POSTGRES_PASSWORD="your-production-db-password"

# Deploy with secure configuration
docker-compose -f docker-compose.secure.yml up -d

# Monitor deployment
docker-compose ps
docker-compose logs -f app
```

### Troubleshooting Docker Issues

#### Common Problems and Solutions

**Port Conflicts:**
```bash
lsof -i :8000                  # Check port usage
./docker-dev.sh stop           # Stop conflicting services
```

**Permission Issues:**
```bash
docker-compose down
docker volume rm $(docker volume ls -q)
docker-compose up -d
```

**Build Failures:**
```bash
docker-compose build --no-cache
docker image prune -f
```

**Database Connection Issues:**
```bash
./docker-dev.sh db             # Test database connection
docker-compose logs postgres   # Check database logs
```

#### Debugging Commands
```bash
# View logs
docker-compose logs -f [service]

# Execute commands in containers
docker-compose exec backend sh
docker-compose exec postgres psql -U postgres -d promptlib

# Inspect containers
docker inspect <container_name>
docker stats                   # Resource usage
```

### Maintenance and Updates

#### Regular Maintenance Tasks
- Update base images monthly
- Rotate secrets quarterly
- Clean unused resources weekly
- Monitor resource usage daily

#### Update Process
```bash
# Pull latest images
docker-compose pull

# Rebuild custom images
./docker-build.sh

# Rolling update
docker-compose up -d --no-deps backend
docker-compose up -d --no-deps frontend

# Verify deployment
./docker-dev.sh status
curl http://localhost:8000/api/system/health
```

## Database Operations

### PostgreSQL Management
- Use connection pooling for better performance
- Implement proper backup and recovery procedures
- Use migrations for schema changes
- Monitor query performance and optimize slow queries
- Set up read replicas for high-availability scenarios

### Redis Configuration
- Configure appropriate memory limits and eviction policies
- Use Redis for session storage and application caching
- Implement proper key expiration strategies
- Monitor memory usage and connection counts

## Monitoring and Observability

### Logging Standards
- Use structured logging (JSON format) for all services
- Include correlation IDs for request tracing
- Log at appropriate levels (ERROR, WARN, INFO, DEBUG)
- Centralize logs for analysis and alerting
- Implement log rotation and retention policies

### Metrics Collection
- Use Prometheus for metrics collection
- Monitor application performance, database queries, and system resources
- Set up alerts for critical system conditions
- Track business metrics (prompt creation, enhancement usage, etc.)

### Health Checks
- Implement comprehensive health check endpoints
- Monitor database connectivity and external service availability
- Use health checks for container orchestration decisions
- Include dependency checks in health status

## Security Operations

### Access Control
- Implement principle of least privilege
- Use role-based access control (RBAC) for user permissions
- Regularly audit user access and permissions
- Implement proper session management and timeout policies

### Data Protection
- Encrypt sensitive data at rest using AES-256-GCM
- Use TLS 1.3 for all network communications
- Implement proper input validation and sanitization
- Regular security scanning of dependencies and containers

## Backup and Recovery

### Data Backup Strategy
- Automated daily backups of PostgreSQL databases
- Point-in-time recovery capability
- Regular backup restoration testing
- Offsite backup storage for disaster recovery

### Application Recovery
- Document recovery procedures for all services
- Implement graceful degradation for service failures
- Use circuit breakers for external service dependencies
- Maintain runbooks for common operational scenarios