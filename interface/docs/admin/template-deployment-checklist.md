# Template System Deployment Checklist

## Pre-Deployment Checklist

### Infrastructure Requirements
- [ ] **Database Setup**
  - [ ] PostgreSQL 15+ instance configured
  - [ ] Database user with appropriate permissions created
  - [ ] Connection pooling configured (recommended: 20-50 connections)
  - [ ] Database backup strategy implemented
  - [ ] Performance monitoring enabled

- [ ] **Cache Infrastructure**
  - [ ] Redis 7+ instance configured
  - [ ] Redis persistence enabled (RDB + AOF)
  - [ ] Memory allocation optimized (recommend 2-4GB for production)
  - [ ] Redis monitoring and alerting configured

- [ ] **Application Infrastructure**
  - [ ] Node.js 18+ runtime environment
  - [ ] Load balancer configured (if using multiple instances)
  - [ ] SSL/TLS certificates installed and configured
  - [ ] Firewall rules configured
  - [ ] Log aggregation system configured

### Environment Configuration
- [ ] **Environment Variables**
  - [ ] `NODE_ENV=production`
  - [ ] `DATABASE_URL` configured with production database
  - [ ] `REDIS_URL` configured with production Redis
  - [ ] `JWT_SECRET` set to secure random value
  - [ ] `ENCRYPTION_KEY` set to secure 32-byte key
  - [ ] `TEMPLATE_CACHE_TTL` configured (default: 3600 seconds)
  - [ ] `TEMPLATE_MAX_SIZE` configured (default: 50KB)
  - [ ] `SECURITY_SCAN_ENABLED=true`

- [ ] **Security Configuration**
  - [ ] CORS origins configured for production domains
  - [ ] Rate limiting configured
  - [ ] Security headers configured
  - [ ] Input validation enabled
  - [ ] SQL injection protection enabled
  - [ ] XSS protection enabled

### Database Migration
- [ ] **Migration Preparation**
  - [ ] Database backup created before migration
  - [ ] Migration scripts tested in staging environment
  - [ ] Rollback procedures documented and tested
  - [ ] Migration execution time estimated
  - [ ] Downtime window scheduled (if required)

- [ ] **Template System Tables**
  - [ ] `prompt_templates` table created
  - [ ] `prompt_template_versions` table created
  - [ ] `prompt_template_usage` table created
  - [ ] `prompt_template_metrics` table created
  - [ ] Indexes created for performance
  - [ ] Foreign key constraints configured

- [ ] **Default Templates**
  - [ ] Default enhancement templates seeded
  - [ ] Default question generation templates seeded
  - [ ] Default system prompt templates seeded
  - [ ] Template categories configured
  - [ ] Template permissions configured

### Application Deployment
- [ ] **Code Deployment**
  - [ ] Latest stable version deployed
  - [ ] Dependencies installed and updated
  - [ ] Build process completed successfully
  - [ ] Static assets deployed
  - [ ] Configuration files deployed

- [ ] **Service Configuration**
  - [ ] Template services initialized
  - [ ] Cache services initialized
  - [ ] Validation services initialized
  - [ ] Analytics services initialized
  - [ ] Security services initialized

### Testing and Validation
- [ ] **Smoke Tests**
  - [ ] Application starts successfully
  - [ ] Database connection established
  - [ ] Redis connection established
  - [ ] Template API endpoints responding
  - [ ] Authentication working
  - [ ] Admin interface accessible

- [ ] **Functional Tests**
  - [ ] Template creation working
  - [ ] Template validation working
  - [ ] Template rendering working
  - [ ] Template caching working
  - [ ] Security validation working
  - [ ] Analytics collection working

- [ ] **Performance Tests**
  - [ ] Template loading performance acceptable
  - [ ] Cache performance acceptable
  - [ ] Database query performance acceptable
  - [ ] Memory usage within limits
  - [ ] CPU usage within limits

### Monitoring and Alerting
- [ ] **Application Monitoring**
  - [ ] Health check endpoints configured
  - [ ] Performance metrics collection enabled
  - [ ] Error tracking configured
  - [ ] Log aggregation configured
  - [ ] Uptime monitoring configured

- [ ] **Template-Specific Monitoring**
  - [ ] Template usage metrics collection
  - [ ] Template performance monitoring
  - [ ] Cache hit rate monitoring
  - [ ] Security violation monitoring
  - [ ] Template error rate monitoring

- [ ] **Alerting Configuration**
  - [ ] High error rate alerts
  - [ ] Performance degradation alerts
  - [ ] Security violation alerts
  - [ ] Cache failure alerts
  - [ ] Database connection alerts

## Deployment Execution

### Phase 1: Infrastructure Preparation
1. **Database Setup**
   ```bash
   # Create database and user
   createdb promptlib_production
   createuser promptlib_user
   
   # Grant permissions
   GRANT ALL PRIVILEGES ON DATABASE promptlib_production TO promptlib_user;
   ```

2. **Redis Setup**
   ```bash
   # Start Redis with production configuration
   redis-server /etc/redis/redis-production.conf
   
   # Verify Redis is running
   redis-cli ping
   ```

3. **Environment Configuration**
   ```bash
   # Copy production environment file
   cp .env.production .env
   
   # Verify environment variables
   node -e "console.log(process.env.NODE_ENV)"
   ```

### Phase 2: Database Migration
1. **Backup Current Database**
   ```bash
   pg_dump promptlib_production > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run Migrations**
   ```bash
   npm run migrate:production
   ```

3. **Seed Default Templates**
   ```bash
   npm run seed:templates:production
   ```

4. **Verify Migration**
   ```bash
   npm run migrate:status
   ```

### Phase 3: Application Deployment
1. **Deploy Application Code**
   ```bash
   # Pull latest code
   git pull origin main
   
   # Install dependencies
   npm ci --production
   
   # Build application
   npm run build
   ```

2. **Start Services**
   ```bash
   # Start application
   npm run start:production
   
   # Verify services are running
   curl http://localhost:8000/health
   ```

3. **Initialize Template Services**
   ```bash
   # Initialize template system
   curl -X POST http://localhost:8000/api/admin/templates/initialize \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

### Phase 4: Validation and Testing
1. **Run Smoke Tests**
   ```bash
   npm run test:smoke:production
   ```

2. **Validate Template System**
   ```bash
   # Test template creation
   curl -X POST http://localhost:8000/api/admin/templates \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d @test-template.json
   
   # Test template rendering
   curl -X POST http://localhost:8000/api/admin/templates/test-id/test \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"variables": {"test": "value"}, "provider": "openai"}'
   ```

3. **Performance Validation**
   ```bash
   # Run performance tests
   npm run test:performance:production
   
   # Check memory usage
   ps aux | grep node
   
   # Check database connections
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'promptlib_production';
   ```

## Post-Deployment Checklist

### Immediate Verification (0-1 hour)
- [ ] Application is responding to requests
- [ ] All services are healthy
- [ ] Database connections are stable
- [ ] Cache is functioning properly
- [ ] No critical errors in logs
- [ ] Performance metrics are within acceptable ranges

### Short-term Monitoring (1-24 hours)
- [ ] Template usage is being recorded
- [ ] Analytics are being collected
- [ ] Security monitoring is active
- [ ] Performance remains stable
- [ ] No memory leaks detected
- [ ] Error rates are acceptable

### Long-term Monitoring (1-7 days)
- [ ] Template performance trends are positive
- [ ] Cache hit rates are optimal
- [ ] Database performance is stable
- [ ] Security violations are minimal
- [ ] User adoption is progressing
- [ ] System resources are adequate

## Rollback Procedures

### Immediate Rollback (Critical Issues)
1. **Stop Current Application**
   ```bash
   pm2 stop all
   ```

2. **Restore Previous Version**
   ```bash
   git checkout previous-stable-tag
   npm ci --production
   npm run build
   pm2 start ecosystem.config.js
   ```

3. **Restore Database (if needed)**
   ```bash
   psql promptlib_production < backup_YYYYMMDD_HHMMSS.sql
   ```

### Gradual Rollback (Performance Issues)
1. **Disable Template Features**
   ```bash
   # Set environment variable to disable template system
   export TEMPLATE_SYSTEM_ENABLED=false
   pm2 restart all
   ```

2. **Fall Back to Default Templates**
   ```bash
   # Reset to default templates only
   curl -X POST http://localhost:8000/api/admin/templates/reset-defaults \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

## Success Criteria

### Technical Metrics
- [ ] Application uptime > 99.9%
- [ ] Response time < 200ms for template operations
- [ ] Cache hit rate > 90%
- [ ] Database query time < 50ms
- [ ] Memory usage < 80% of allocated
- [ ] CPU usage < 70% under normal load

### Functional Metrics
- [ ] Template creation success rate > 99%
- [ ] Template validation accuracy > 99%
- [ ] Security violation detection > 95%
- [ ] Template rendering success rate > 99%
- [ ] Analytics data accuracy > 99%

### Business Metrics
- [ ] Admin user adoption > 80%
- [ ] Template usage growth > 20% week-over-week
- [ ] User satisfaction score > 4.0/5.0
- [ ] Support ticket reduction > 30%
- [ ] Template optimization improvements > 15%

## Emergency Contacts

### Technical Team
- **DevOps Lead**: [Contact Information]
- **Backend Lead**: [Contact Information]
- **Database Administrator**: [Contact Information]
- **Security Lead**: [Contact Information]

### Business Team
- **Product Manager**: [Contact Information]
- **Customer Success**: [Contact Information]
- **Support Lead**: [Contact Information]

## Documentation Links
- [Template System Architecture](./template-architecture.md)
- [API Documentation](../api/template-api-examples.md)
- [Troubleshooting Guide](../troubleshooting/template-troubleshooting.md)
- [Security Guidelines](./template-security-guide.md)
- [Performance Tuning](./template-performance-guide.md)