# Template System Deployment Guide

This guide provides comprehensive instructions for deploying the template management system across different environments.

## Overview

The template system deployment includes:
- Database schema migrations
- Template service configuration
- Environment-specific settings
- Monitoring and alerting setup
- Performance optimization
- Security configuration

## Prerequisites

### System Requirements

#### Minimum Requirements
- **CPU**: 2 cores
- **Memory**: 4GB RAM
- **Storage**: 20GB available space
- **Network**: Stable internet connection

#### Recommended Requirements
- **CPU**: 4+ cores
- **Memory**: 8GB+ RAM
- **Storage**: 50GB+ SSD storage
- **Network**: High-speed connection with low latency

### Software Dependencies

#### Required Software
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Node.js**: Version 18+
- **npm**: Version 8+
- **PostgreSQL**: Version 15+ (if not using Docker)
- **Redis**: Version 7+ (if not using Docker)

#### Optional Software
- **Git**: For version control
- **curl**: For health checks and testing
- **jq**: For JSON processing in scripts

### Environment Setup

#### Development Environment
```bash
# Install Node.js dependencies
cd interface/backend && npm install
cd ../frontend && npm install

# Set up environment variables
cp .env.example .env.development

# Start development services
docker-compose -f docker-compose.dev.yml up -d
```

#### Staging Environment
```bash
# Set up staging configuration
cp .env.example .env.staging

# Configure staging-specific variables
export DATABASE_URL="postgresql://user:pass@staging-db:5432/promptlib"
export REDIS_URL="redis://staging-redis:6379"
export JWT_SECRET="staging-jwt-secret"
```

#### Production Environment
```bash
# Set up production configuration
cp .env.example .env.production

# Configure production variables (use secure values)
export DATABASE_URL="postgresql://user:pass@prod-db:5432/promptlib"
export REDIS_URL="redis://prod-redis:6379"
export JWT_SECRET="secure-production-jwt-secret"
export ENCRYPTION_KEY="secure-32-character-encryption-key"
```

## Deployment Methods

### Method 1: Automated Deployment Script

The recommended deployment method using the provided script:

```bash
# Deploy to production (default)
./scripts/deploy-template-system.sh

# Deploy to staging
./scripts/deploy-template-system.sh --environment staging

# Deploy to development
./scripts/deploy-template-system.sh --environment development

# Dry run (show what would be done)
./scripts/deploy-template-system.sh --dry-run

# Skip tests (faster deployment)
./scripts/deploy-template-system.sh --skip-tests

# Skip migrations (if already up to date)
./scripts/deploy-template-system.sh --skip-migrations
```

#### Script Options
- `--environment ENV`: Target environment (development|staging|production)
- `--skip-tests`: Skip running tests
- `--skip-migrations`: Skip database migrations
- `--skip-build`: Skip building applications
- `--dry-run`: Show deployment plan without executing
- `--no-backup`: Skip backup before deployment
- `--help`: Show help message

### Method 2: Manual Deployment

For custom deployments or troubleshooting:

#### Step 1: Prepare Environment
```bash
# Set environment variables
export ENVIRONMENT=production
export DATABASE_URL="your-database-url"
export REDIS_URL="your-redis-url"
export JWT_SECRET="your-jwt-secret"
export ENCRYPTION_KEY="your-encryption-key"

# Load template system configuration
export TEMPLATE_CACHE_TTL=3600
export TEMPLATE_CACHE_SIZE=1000
export TEMPLATE_ANALYTICS_ENABLED=true
export TEMPLATE_VALIDATION_STRICT=true
```

#### Step 2: Run Database Migrations
```bash
cd interface/backend
node src/scripts/migrate-database.js migrate
node src/scripts/migrate-database.js validate
```

#### Step 3: Build Applications
```bash
# Build backend
cd interface/backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

#### Step 4: Deploy Services
```bash
# Start services with Docker Compose
cd ..
docker-compose up -d

# Verify deployment
curl http://localhost:8000/api/system/health
curl http://localhost:8000/api/system/health/templates
```

### Method 3: Kubernetes Deployment

For Kubernetes environments:

#### Create ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: template-system-config
data:
  TEMPLATE_CACHE_TTL: "3600"
  TEMPLATE_CACHE_SIZE: "1000"
  TEMPLATE_ANALYTICS_ENABLED: "true"
  TEMPLATE_VALIDATION_STRICT: "true"
  TEMPLATE_FALLBACK_ENABLED: "true"
```

#### Create Secret
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: template-system-secrets
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  REDIS_URL: <base64-encoded-redis-url>
  JWT_SECRET: <base64-encoded-jwt-secret>
  ENCRYPTION_KEY: <base64-encoded-encryption-key>
```

#### Deploy Application
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: template-system-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: template-system-backend
  template:
    metadata:
      labels:
        app: template-system-backend
    spec:
      containers:
      - name: backend
        image: template-system-backend:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: template-system-config
        - secretRef:
            name: template-system-secrets
        livenessProbe:
          httpGet:
            path: /api/system/health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/system/health/templates
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Database Migration

### Migration Process

The template system uses a structured migration approach:

#### Migration Files
- `001_create_template_tables.sql`: Creates core template tables
- `002_seed_default_templates.sql`: Inserts default system templates

#### Running Migrations
```bash
# Check migration status
node src/scripts/migrate-database.js status

# Apply all pending migrations
node src/scripts/migrate-database.js migrate

# Validate database schema
node src/scripts/migrate-database.js validate

# Rollback last migration (use with caution)
node src/scripts/migrate-database.js rollback
```

#### Migration Safety
- All migrations run in transactions
- Automatic rollback on failure
- Version tracking prevents duplicate execution
- Backup recommendations before major migrations

### Database Schema

The template system creates these tables:

#### Core Tables
- `prompt_templates`: Main template storage
- `prompt_template_versions`: Version history
- `prompt_template_usage`: Usage analytics
- `prompt_template_metrics`: Performance metrics

#### Indexes
- Performance-optimized indexes for queries
- Full-text search indexes for template content
- Composite indexes for analytics queries

#### Views
- `template_analytics`: Comprehensive analytics view
- Performance-optimized for dashboard queries

## Configuration Management

### Environment Variables

#### Core System Variables
```bash
# Database and Cache
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379

# Security
JWT_SECRET=your-secure-jwt-secret
ENCRYPTION_KEY=your-32-character-encryption-key

# Application
NODE_ENV=production
PORT=8000
LOG_LEVEL=info
```

#### Template System Variables
```bash
# Cache Configuration
TEMPLATE_CACHE_TTL=3600
TEMPLATE_CACHE_SIZE=1000
TEMPLATE_CACHE_ENABLED=true

# Analytics and Monitoring
TEMPLATE_ANALYTICS_ENABLED=true
TEMPLATE_METRICS_ENABLED=true
TEMPLATE_DEBUG_LOGGING=false

# Validation and Security
TEMPLATE_VALIDATION_STRICT=true
TEMPLATE_SECURITY_SCAN_ENABLED=true
TEMPLATE_CONTENT_SANITIZATION=true

# Performance Limits
TEMPLATE_MAX_CONTENT_LENGTH=50000
TEMPLATE_MAX_VARIABLES=50
TEMPLATE_RENDER_TIMEOUT=5000
TEMPLATE_CONCURRENT_RENDERS=100
```

### Configuration Files

#### Docker Compose Configuration
```yaml
services:
  backend:
    environment:
      # Template System Configuration
      - TEMPLATE_CACHE_TTL=${TEMPLATE_CACHE_TTL:-3600}
      - TEMPLATE_CACHE_SIZE=${TEMPLATE_CACHE_SIZE:-1000}
      - TEMPLATE_ANALYTICS_ENABLED=${TEMPLATE_ANALYTICS_ENABLED:-true}
      - TEMPLATE_VALIDATION_STRICT=${TEMPLATE_VALIDATION_STRICT:-true}
```

#### Environment-Specific Files
- `.env.development`: Development settings
- `.env.staging`: Staging configuration
- `.env.production`: Production configuration

## Monitoring and Alerting

### Health Checks

#### System Health Endpoints
```bash
# Overall system health
curl http://localhost:8000/api/system/health

# Template system health
curl http://localhost:8000/api/system/health/templates

# Database health
curl http://localhost:8000/api/system/health/template-db

# Cache health
curl http://localhost:8000/api/system/health/template-cache
```

#### Health Check Configuration
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/api/system/health/templates"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Monitoring Setup

#### Prometheus Metrics
The system exposes metrics for monitoring:
- Template rendering performance
- Cache hit rates
- Error rates
- Database query performance
- System resource usage

#### Grafana Dashboards
Pre-configured dashboards for:
- Template system overview
- Performance metrics
- Error tracking
- Usage analytics
- Resource utilization

#### Alerting Rules
Configured alerts for:
- High error rates
- Performance degradation
- Cache issues
- Database problems
- Resource exhaustion

### Log Management

#### Log Configuration
```bash
# Log levels
LOG_LEVEL=info  # error, warn, info, debug

# Template-specific logging
TEMPLATE_DEBUG_LOGGING=false
TEMPLATE_AUDIT_LOGGING=true
```

#### Log Aggregation
- Structured JSON logging
- Centralized log collection
- Log retention policies
- Search and analysis capabilities

## Security Configuration

### Authentication and Authorization

#### JWT Configuration
```bash
# JWT settings
JWT_SECRET=your-secure-secret-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

#### Role-Based Access Control
- Template management permissions
- Category-specific access
- Read/write/admin roles
- Audit trail for all changes

### Data Security

#### Encryption
```bash
# Data encryption
ENCRYPTION_KEY=your-32-character-key
TEMPLATE_CONTENT_SANITIZATION=true
TEMPLATE_SECURITY_SCAN_ENABLED=true
```

#### Security Headers
- HTTPS enforcement
- CORS configuration
- Content Security Policy
- Security headers middleware

### Network Security

#### Firewall Configuration
```bash
# Allow only necessary ports
# 80/443 for web traffic
# 5432 for database (internal only)
# 6379 for Redis (internal only)
```

#### SSL/TLS Configuration
- TLS 1.3 minimum
- Strong cipher suites
- Certificate management
- HSTS headers

## Performance Optimization

### Database Optimization

#### Connection Pooling
```bash
# Database pool settings
TEMPLATE_DB_POOL_SIZE=10
TEMPLATE_DB_TIMEOUT=10000
TEMPLATE_DB_IDLE_TIMEOUT=30000
```

#### Query Optimization
- Proper indexing strategy
- Query performance monitoring
- Connection pool tuning
- Read replica configuration

### Cache Optimization

#### Redis Configuration
```bash
# Cache settings
TEMPLATE_CACHE_TTL=3600
TEMPLATE_CACHE_SIZE=1000
TEMPLATE_CACHE_ENABLED=true
```

#### Cache Strategy
- Multi-level caching
- Cache warming
- Intelligent invalidation
- Performance monitoring

### Application Optimization

#### Resource Limits
```bash
# Performance limits
TEMPLATE_RENDER_TIMEOUT=5000
TEMPLATE_CONCURRENT_RENDERS=100
TEMPLATE_MAX_CONTENT_LENGTH=50000
```

#### Scaling Configuration
- Horizontal scaling support
- Load balancing
- Auto-scaling policies
- Resource monitoring

## Backup and Recovery

### Backup Strategy

#### Database Backups
```bash
# Daily database backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Automated backup script
0 2 * * * /path/to/backup-script.sh
```

#### Application Backups
```bash
# Backup application files
tar -czf app-backup-$(date +%Y%m%d).tar.gz \
    --exclude="node_modules" \
    --exclude="dist" \
    /path/to/application
```

#### Template Data Backup
```bash
# Export template data
curl -H "Authorization: Bearer $TOKEN" \
     -X POST \
     -d '{"format": "json", "includeHistory": true}' \
     http://localhost:8000/api/templates/export > templates-backup.json
```

### Recovery Procedures

#### Database Recovery
```bash
# Restore database from backup
psql $DATABASE_URL < backup-20240115.sql

# Run migrations to ensure schema is current
node src/scripts/migrate-database.js migrate
```

#### Application Recovery
```bash
# Restore application files
tar -xzf app-backup-20240115.tar.gz

# Rebuild and restart
npm install
npm run build
docker-compose restart
```

#### Template Data Recovery
```bash
# Import template data
curl -H "Authorization: Bearer $TOKEN" \
     -X POST \
     -H "Content-Type: application/json" \
     -d @templates-backup.json \
     http://localhost:8000/api/templates/import
```

## Troubleshooting

### Common Deployment Issues

#### Database Connection Issues
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Verify database permissions
psql $DATABASE_URL -c "SELECT current_user, current_database()"

# Check migration status
node src/scripts/migrate-database.js status
```

#### Cache Connection Issues
```bash
# Test Redis connectivity
redis-cli -u $REDIS_URL ping

# Check Redis memory usage
redis-cli -u $REDIS_URL info memory

# Clear cache if needed
redis-cli -u $REDIS_URL flushall
```

#### Application Startup Issues
```bash
# Check application logs
docker-compose logs backend

# Verify environment variables
docker-compose exec backend env | grep TEMPLATE

# Test health endpoints
curl http://localhost:8000/api/system/health
```

### Performance Issues

#### Slow Template Rendering
```bash
# Check template analytics
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/templates/TEMPLATE_ID/analytics

# Monitor cache performance
redis-cli -u $REDIS_URL info stats

# Check database query performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10"
```

#### High Memory Usage
```bash
# Monitor memory usage
docker stats

# Check cache size
redis-cli -u $REDIS_URL info memory

# Analyze memory leaks
node --inspect src/index.js
```

### Recovery Procedures

#### Service Recovery
```bash
# Restart specific service
docker-compose restart backend

# Full system restart
docker-compose down && docker-compose up -d

# Check service health
docker-compose ps
```

#### Data Recovery
```bash
# Restore from backup
./scripts/restore-backup.sh backup-20240115

# Verify data integrity
node src/scripts/migrate-database.js validate

# Test template functionality
curl -X POST -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/templates/test-template/test
```

## Post-Deployment Checklist

### Immediate Verification
- [ ] All services are running and healthy
- [ ] Database migrations completed successfully
- [ ] Template system health checks pass
- [ ] Admin interface is accessible
- [ ] API endpoints respond correctly

### Functional Testing
- [ ] Template creation works
- [ ] Template editing and versioning works
- [ ] Template testing interface functions
- [ ] Analytics data is being collected
- [ ] Cache is working properly

### Performance Verification
- [ ] Template rendering times are acceptable
- [ ] Cache hit rates are optimal
- [ ] Database query performance is good
- [ ] No memory leaks detected
- [ ] Error rates are within acceptable limits

### Security Verification
- [ ] Authentication is working
- [ ] Authorization controls are enforced
- [ ] Audit logging is active
- [ ] Security headers are present
- [ ] HTTPS is properly configured

### Monitoring Setup
- [ ] Monitoring dashboards are accessible
- [ ] Alerts are configured and working
- [ ] Log aggregation is functioning
- [ ] Backup procedures are scheduled
- [ ] Health checks are running

This deployment guide ensures a successful and secure deployment of the template management system across all environments.