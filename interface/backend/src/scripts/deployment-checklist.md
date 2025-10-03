# Dynamic Provider Management Deployment Checklist

## Pre-Deployment Preparation

### 1. Environment Verification
- [ ] Verify target environment (staging/production)
- [ ] Confirm database connectivity and credentials
- [ ] Check application version and compatibility
- [ ] Verify backup systems are operational
- [ ] Confirm maintenance window schedule

### 2. Database Backup
- [ ] Create full database backup
- [ ] Verify backup integrity
- [ ] Document backup location and restore procedure
- [ ] Test backup restoration process (on non-production)
- [ ] Ensure backup retention policy is followed

### 3. Code Preparation
- [ ] Verify all dynamic provider code is merged and tested
- [ ] Confirm migration scripts are ready
- [ ] Check environment configuration files
- [ ] Verify API documentation is updated
- [ ] Ensure rollback procedures are documented

### 4. Dependencies Check
- [ ] Verify Node.js version compatibility (18.x or higher)
- [ ] Check PostgreSQL version (13.x or higher)
- [ ] Confirm Redis availability (if used for caching)
- [ ] Verify SSL certificates are valid
- [ ] Check network connectivity to external APIs

## Deployment Steps

### Phase 1: Database Migration

#### 1.1 Pre-Migration Validation
```bash
# Connect to database and verify current state
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Check current schema version
SELECT * FROM migration_audit ORDER BY executed_at DESC LIMIT 5;

# Verify existing connections
SELECT id, name, provider, created_at FROM connections LIMIT 10;

# Check table sizes
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename IN ('connections', 'users', 'prompts');
```

#### 1.2 Execute Migration
```bash
# Run the production migration script
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f interface/backend/src/scripts/production-migration.sql

# Verify migration success
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 'providers' as table_name, count(*) as row_count FROM providers
UNION ALL
SELECT 'models' as table_name, count(*) as row_count FROM models
UNION ALL
SELECT 'provider_templates' as table_name, count(*) as row_count FROM provider_templates;"
```

#### 1.3 Post-Migration Validation
```bash
# Check that all tables were created
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('providers', 'models', 'provider_templates');"

# Verify indexes were created
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('providers', 'models', 'provider_templates') 
AND indexname LIKE 'idx_%';"

# Check connections table was updated
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'connections' AND column_name = 'provider_id';"
```

### Phase 2: Application Deployment

#### 2.1 Application Update
```bash
# Stop the application
sudo systemctl stop prompt-library-backend
sudo systemctl stop prompt-library-frontend

# Update application code
git pull origin main
npm ci --production

# Build the application
npm run build

# Update environment variables if needed
# Check .env files for any new configuration requirements
```

#### 2.2 System Provider Population
```bash
# Start the backend application
sudo systemctl start prompt-library-backend

# Wait for application to start and populate system providers
sleep 30

# Verify system providers were created
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_BASE_URL/api/admin/providers" | jq '.data[] | {identifier, name, is_system}'
```

#### 2.3 Application Startup Verification
```bash
# Check application logs
sudo journalctl -u prompt-library-backend -f --since "5 minutes ago"

# Verify API endpoints are responding
curl -f "$API_BASE_URL/api/system/health"
curl -f "$API_BASE_URL/api/system/status"

# Test provider registry status
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_BASE_URL/api/admin/providers/registry-status"
```

### Phase 3: Frontend Deployment

#### 3.1 Frontend Update
```bash
# Build and deploy frontend
cd interface/frontend
npm ci --production
npm run build

# Deploy built files to web server
sudo cp -r dist/* /var/www/html/

# Restart web server
sudo systemctl restart nginx
```

#### 3.2 Frontend Verification
```bash
# Check web server status
sudo systemctl status nginx

# Verify frontend is accessible
curl -f "$FRONTEND_URL"

# Check for JavaScript errors in browser console
# Manual step: Open browser and check console
```

## Post-Deployment Verification

### 1. Functional Testing

#### 1.1 Admin Interface Testing
- [ ] Login as admin user
- [ ] Navigate to Provider Management page
- [ ] Verify system providers are listed
- [ ] Test provider connectivity (click "Test" on each provider)
- [ ] Verify model lists are populated
- [ ] Test creating a new custom provider
- [ ] Test provider template functionality

#### 1.2 User Interface Testing
- [ ] Login as regular user
- [ ] Navigate to Connections page
- [ ] Verify providers are available for connection creation
- [ ] Create a test connection using dynamic provider
- [ ] Test connection functionality
- [ ] Verify existing connections still work

#### 1.3 API Testing
```bash
# Test provider management endpoints
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_BASE_URL/api/admin/providers"

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_BASE_URL/api/admin/provider-templates"

# Test connection creation with dynamic provider
curl -X POST -H "Authorization: Bearer $USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Connection", "provider_id": "provider-uuid", "credentials": {...}}' \
     "$API_BASE_URL/api/connections"
```

### 2. Performance Verification

#### 2.1 Database Performance
```sql
-- Check query performance
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%providers%' OR query LIKE '%models%'
ORDER BY mean_time DESC LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats 
WHERE tablename IN ('providers', 'models', 'provider_templates');
```

#### 2.2 Application Performance
```bash
# Check memory usage
ps aux | grep node | grep -v grep

# Check response times
time curl -H "Authorization: Bearer $ADMIN_TOKEN" \
          "$API_BASE_URL/api/admin/providers"

# Monitor application logs for performance issues
sudo journalctl -u prompt-library-backend --since "10 minutes ago" | grep -i "slow\|timeout\|error"
```

### 3. Security Verification

#### 3.1 Access Control
- [ ] Verify only admin users can access provider management
- [ ] Test that regular users cannot modify providers
- [ ] Confirm API endpoints require proper authentication
- [ ] Verify sensitive data (API keys) are encrypted

#### 3.2 Data Protection
```bash
# Check that credentials are encrypted in database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT identifier, name, 
       CASE WHEN auth_config::text LIKE '%sk-%' THEN 'UNENCRYPTED' ELSE 'ENCRYPTED' END as credential_status
FROM providers 
WHERE is_system = false;"
```

## Rollback Procedures

### When to Rollback
- Critical functionality is broken
- Database corruption detected
- Security vulnerabilities discovered
- Performance degradation beyond acceptable limits
- User-reported critical issues

### Rollback Steps

#### 1. Immediate Rollback (Application Only)
```bash
# Stop current application
sudo systemctl stop prompt-library-backend
sudo systemctl stop prompt-library-frontend

# Revert to previous version
git checkout previous-stable-tag
npm ci --production
npm run build

# Restart with previous version
sudo systemctl start prompt-library-backend
sudo systemctl start prompt-library-frontend
```

#### 2. Full Rollback (Database + Application)
```bash
# Stop application
sudo systemctl stop prompt-library-backend

# Run database rollback script
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f interface/backend/src/scripts/rollback-migration.sql

# Revert application code
git checkout previous-stable-tag
npm ci --production
npm run build

# Restart application
sudo systemctl start prompt-library-backend
```

#### 3. Rollback Verification
```bash
# Verify rollback completed successfully
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('providers', 'models', 'provider_templates');"

# Should return no rows if rollback was successful

# Test application functionality
curl -f "$API_BASE_URL/api/system/health"
curl -H "Authorization: Bearer $USER_TOKEN" "$API_BASE_URL/api/connections"
```

## Monitoring and Alerts

### 1. Set Up Monitoring
```bash
# Database monitoring
# Add queries to monitor provider table sizes and performance

# Application monitoring  
# Monitor API response times for provider endpoints

# Error monitoring
# Set up alerts for provider connectivity failures
```

### 2. Key Metrics to Monitor
- Provider connectivity success rates
- API response times for provider management
- Database query performance for new tables
- Memory usage after deployment
- Error rates in application logs

### 3. Alert Thresholds
- Provider test failure rate > 10%
- API response time > 5 seconds
- Database connection pool exhaustion
- Memory usage > 80%
- Error rate > 1%

## Post-Deployment Tasks

### 1. Documentation Updates
- [ ] Update API documentation with new endpoints
- [ ] Update user guides with dynamic provider information
- [ ] Update admin documentation
- [ ] Create troubleshooting guides for new features

### 2. Team Communication
- [ ] Notify team of successful deployment
- [ ] Share new feature documentation
- [ ] Schedule training sessions for admin users
- [ ] Update support procedures

### 3. Monitoring Setup
- [ ] Configure monitoring dashboards
- [ ] Set up alerting rules
- [ ] Create runbooks for common issues
- [ ] Schedule regular health checks

### 4. Backup Verification
- [ ] Verify post-deployment backups are working
- [ ] Test backup restoration procedures
- [ ] Update backup retention policies
- [ ] Document new backup requirements

## Troubleshooting Common Issues

### Database Migration Failures
```bash
# Check migration status
SELECT * FROM migration_audit ORDER BY executed_at DESC;

# Check for constraint violations
SELECT conname, contype FROM pg_constraint WHERE conrelid = 'providers'::regclass;

# Verify foreign key relationships
SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY' AND tc.table_name='connections';
```

### Application Startup Issues
```bash
# Check application logs
sudo journalctl -u prompt-library-backend -n 100

# Verify environment variables
env | grep -E "(DB_|API_|NODE_)"

# Test database connectivity
node -e "
const { Pool } = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query('SELECT NOW()', (err, res) => {
  console.log(err ? err : res.rows[0]);
  pool.end();
});
"
```

### Provider Registry Issues
```bash
# Check provider registry status
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_BASE_URL/api/admin/providers/registry-status"

# Manually refresh registry
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_BASE_URL/api/admin/providers/refresh-registry"

# Check system providers
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_BASE_URL/api/admin/providers?isSystem=true"
```

## Success Criteria

Deployment is considered successful when:
- [ ] All database migrations completed without errors
- [ ] Application starts successfully and passes health checks
- [ ] System providers are populated and functional
- [ ] Admin interface allows provider management
- [ ] Users can create connections with dynamic providers
- [ ] Existing connections continue to work
- [ ] API endpoints respond within acceptable time limits
- [ ] No critical errors in application logs
- [ ] Monitoring and alerting are functional

## Contact Information

**Deployment Team:**
- Lead: [Name] - [Email] - [Phone]
- Database Admin: [Name] - [Email] - [Phone]
- DevOps: [Name] - [Email] - [Phone]

**Escalation:**
- Technical Lead: [Name] - [Email] - [Phone]
- Product Owner: [Name] - [Email] - [Phone]
- On-call Engineer: [Phone/Pager]

**External Dependencies:**
- Cloud Provider Support: [Contact Info]
- Database Vendor Support: [Contact Info]
- Monitoring Service: [Contact Info]