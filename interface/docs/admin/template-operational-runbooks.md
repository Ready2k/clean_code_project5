# Template System Operational Runbooks

## Overview

This document provides step-by-step operational procedures for managing the Template System in production. These runbooks are designed for operations teams, DevOps engineers, and on-call personnel.

## Table of Contents

1. [System Startup and Shutdown](#system-startup-and-shutdown)
2. [Template Management Operations](#template-management-operations)
3. [Performance Optimization](#performance-optimization)
4. [Security Incident Response](#security-incident-response)
5. [Database Operations](#database-operations)
6. [Cache Management](#cache-management)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting Common Issues](#troubleshooting-common-issues)

## System Startup and Shutdown

### System Startup Procedure

**Estimated Time**: 10-15 minutes

**Prerequisites**:
- Database server is running
- Redis server is running
- Environment variables are configured
- SSL certificates are valid

**Steps**:

1. **Pre-startup Checks**
   ```bash
   # Check database connectivity
   pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER
   
   # Check Redis connectivity
   redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
   
   # Verify environment configuration
   node -e "console.log('Environment:', process.env.NODE_ENV)"
   ```

2. **Start Core Services**
   ```bash
   # Start database migrations (if needed)
   npm run migrate:check
   npm run migrate:up
   
   # Start application
   pm2 start ecosystem.config.js
   
   # Verify application started
   pm2 status
   ```

3. **Initialize Template Services**
   ```bash
   # Wait for application to be ready
   sleep 30
   
   # Initialize template system
   curl -X POST http://localhost:8000/api/admin/templates/initialize \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   
   # Verify template services
   curl http://localhost:8000/api/admin/templates/health
   ```

4. **Validate System Health**
   ```bash
   # Run health checks
   curl http://localhost:8000/health
   
   # Check template functionality
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     http://localhost:8000/api/admin/templates
   
   # Verify cache is working
   curl http://localhost:8000/api/admin/templates/cache/stats
   ```

5. **Enable Monitoring**
   ```bash
   # Start monitoring services
   systemctl start prometheus
   systemctl start grafana-server
   
   # Verify monitoring endpoints
   curl http://localhost:9090/api/v1/query?query=up
   ```

**Success Criteria**:
- [ ] Application responds to health checks
- [ ] Template API endpoints are accessible
- [ ] Database connections are established
- [ ] Cache is functioning
- [ ] Monitoring is active
- [ ] No critical errors in logs

### System Shutdown Procedure

**Estimated Time**: 5-10 minutes

**Steps**:

1. **Enable Maintenance Mode**
   ```bash
   # Enable maintenance mode
   curl -X POST http://localhost:8000/api/admin/maintenance \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"enabled": true, "message": "System maintenance in progress"}'
   ```

2. **Graceful Application Shutdown**
   ```bash
   # Stop accepting new requests
   pm2 stop all --wait-ready
   
   # Wait for existing requests to complete
   sleep 60
   
   # Force stop if needed
   pm2 kill
   ```

3. **Stop Supporting Services**
   ```bash
   # Stop monitoring (optional)
   systemctl stop prometheus
   systemctl stop grafana-server
   
   # Stop log aggregation (optional)
   systemctl stop logstash
   ```

4. **Verify Shutdown**
   ```bash
   # Verify no processes are running
   ps aux | grep node
   
   # Check port availability
   netstat -tlnp | grep :8000
   ```

## Template Management Operations

### Creating Default Templates

**Use Case**: Initial system setup or template reset

**Steps**:

1. **Prepare Template Definitions**
   ```bash
   # Navigate to template definitions
   cd /opt/prompt-library/templates/defaults
   
   # Verify template files exist
   ls -la *.json
   ```

2. **Load Default Templates**
   ```bash
   # Load enhancement templates
   curl -X POST http://localhost:8000/api/admin/templates/import \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d @enhancement-templates.json
   
   # Load question generation templates
   curl -X POST http://localhost:8000/api/admin/templates/import \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d @question-templates.json
   
   # Load system prompt templates
   curl -X POST http://localhost:8000/api/admin/templates/import \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d @system-templates.json
   ```

3. **Verify Template Loading**
   ```bash
   # Check template count
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/templates?count=true"
   
   # Verify each category has templates
   for category in enhancement question_generation system_prompts; do
     count=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
       "http://localhost:8000/api/admin/templates?category=$category&count=true" | jq '.count')
     echo "Category $category: $count templates"
   done
   ```

### Template Backup Operations

**Use Case**: Regular backups or pre-deployment backup

**Steps**:

1. **Create Template Backup**
   ```bash
   # Create backup directory
   mkdir -p /backups/templates/$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR="/backups/templates/$(date +%Y%m%d_%H%M%S)"
   
   # Export all templates
   curl -X POST http://localhost:8000/api/admin/templates/export-all \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"includeHistory": true, "includeAnalytics": false}' \
     > $BACKUP_DIR/all-templates.json
   
   # Export by category
   for category in enhancement question_generation system_prompts custom; do
     curl -X POST http://localhost:8000/api/admin/templates/export \
       -H "Authorization: Bearer $ADMIN_TOKEN" \
       -d "{\"category\": \"$category\", \"includeHistory\": true}" \
       > $BACKUP_DIR/templates-$category.json
   done
   ```

2. **Verify Backup Integrity**
   ```bash
   # Check backup files
   ls -la $BACKUP_DIR/
   
   # Validate JSON format
   for file in $BACKUP_DIR/*.json; do
     if jq empty "$file" 2>/dev/null; then
       echo "✓ $file is valid JSON"
     else
       echo "✗ $file is invalid JSON"
     fi
   done
   
   # Check backup completeness
   TOTAL_TEMPLATES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/templates?count=true" | jq '.count')
   BACKUP_TEMPLATES=$(jq '.templates | length' $BACKUP_DIR/all-templates.json)
   
   if [ "$TOTAL_TEMPLATES" -eq "$BACKUP_TEMPLATES" ]; then
     echo "✓ Backup complete: $BACKUP_TEMPLATES templates"
   else
     echo "✗ Backup incomplete: $BACKUP_TEMPLATES/$TOTAL_TEMPLATES templates"
   fi
   ```

### Template Restoration

**Use Case**: Disaster recovery or rollback

**Steps**:

1. **Prepare for Restoration**
   ```bash
   # Create current state backup
   curl -X POST http://localhost:8000/api/admin/templates/export-all \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     > /backups/pre-restore-$(date +%Y%m%d_%H%M%S).json
   
   # Verify backup file
   RESTORE_FILE="/backups/templates/20241104_120000/all-templates.json"
   if [ ! -f "$RESTORE_FILE" ]; then
     echo "Error: Backup file not found"
     exit 1
   fi
   ```

2. **Clear Current Templates (if needed)**
   ```bash
   # WARNING: This will delete all current templates
   read -p "Are you sure you want to delete all current templates? (yes/no): " confirm
   if [ "$confirm" = "yes" ]; then
     curl -X DELETE http://localhost:8000/api/admin/templates/all \
       -H "Authorization: Bearer $ADMIN_TOKEN"
   fi
   ```

3. **Restore Templates**
   ```bash
   # Import templates from backup
   curl -X POST http://localhost:8000/api/admin/templates/import \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d @$RESTORE_FILE
   
   # Verify restoration
   RESTORED_COUNT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/templates?count=true" | jq '.count')
   echo "Restored $RESTORED_COUNT templates"
   ```

## Performance Optimization

### Cache Optimization

**Use Case**: Poor cache performance or high cache miss rate

**Steps**:

1. **Analyze Cache Performance**
   ```bash
   # Get cache statistics
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     http://localhost:8000/api/admin/templates/cache/stats
   
   # Check Redis memory usage
   redis-cli info memory
   
   # Analyze cache hit patterns
   redis-cli --latency-history -i 1
   ```

2. **Optimize Cache Configuration**
   ```bash
   # Increase cache TTL for stable templates
   curl -X PUT http://localhost:8000/api/admin/templates/cache/config \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"ttl": 7200, "maxSize": "100MB"}'
   
   # Warm cache with frequently used templates
   curl -X POST http://localhost:8000/api/admin/templates/cache/warm \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

3. **Monitor Cache Performance**
   ```bash
   # Monitor cache hit rate
   watch -n 5 'curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     http://localhost:8000/api/admin/templates/cache/stats | jq ".hitRate"'
   ```

### Database Performance Optimization

**Use Case**: Slow database queries or high database load

**Steps**:

1. **Analyze Database Performance**
   ```sql
   -- Check slow queries
   SELECT query, mean_time, calls, total_time
   FROM pg_stat_statements
   WHERE query LIKE '%prompt_template%'
   ORDER BY mean_time DESC
   LIMIT 10;
   
   -- Check database connections
   SELECT count(*) as active_connections
   FROM pg_stat_activity
   WHERE state = 'active';
   
   -- Check table sizes
   SELECT schemaname, tablename, 
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
   FROM pg_tables
   WHERE tablename LIKE '%template%'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

2. **Optimize Database Queries**
   ```sql
   -- Add missing indexes
   CREATE INDEX CONCURRENTLY idx_template_category_active 
   ON prompt_templates(category, is_active) 
   WHERE is_active = true;
   
   CREATE INDEX CONCURRENTLY idx_template_usage_date 
   ON prompt_template_usage(created_at, template_id);
   
   -- Update table statistics
   ANALYZE prompt_templates;
   ANALYZE prompt_template_versions;
   ANALYZE prompt_template_usage;
   ```

3. **Monitor Database Performance**
   ```bash
   # Monitor database connections
   watch -n 5 'psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = '\''active'\'';"'
   
   # Monitor query performance
   psql -c "SELECT query, mean_time FROM pg_stat_statements WHERE query LIKE '%template%' ORDER BY mean_time DESC LIMIT 5;"
   ```

## Security Incident Response

### Security Violation Response

**Use Case**: High rate of security violations detected

**Steps**:

1. **Assess Security Threat**
   ```bash
   # Get recent security violations
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/security/violations?hours=1"
   
   # Analyze violation patterns
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/security/analysis" | jq '.patterns'
   
   # Check for coordinated attacks
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/security/threats" | jq '.coordinated_attacks'
   ```

2. **Immediate Response Actions**
   ```bash
   # Block malicious IP addresses
   MALICIOUS_IPS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/security/malicious-ips" | jq -r '.ips[]')
   
   for ip in $MALICIOUS_IPS; do
     iptables -A INPUT -s $ip -j DROP
     echo "Blocked IP: $ip"
   done
   
   # Increase security validation strictness
   curl -X PUT http://localhost:8000/api/admin/templates/security/config \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"strictMode": true, "blockSuspiciousPatterns": true}'
   ```

3. **Investigation and Documentation**
   ```bash
   # Export security logs for analysis
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/security/export?hours=24" \
     > security-incident-$(date +%Y%m%d_%H%M%S).json
   
   # Generate incident report
   curl -X POST http://localhost:8000/api/admin/security/incident-report \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"incidentId": "'$(uuidgen)'", "severity": "high"}'
   ```

### Compromised Account Response

**Use Case**: User account suspected of being compromised

**Steps**:

1. **Identify Compromised Account**
   ```bash
   # Get suspicious user activity
   USER_ID="suspected-user-id"
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/users/$USER_ID/activity?suspicious=true"
   ```

2. **Immediate Account Security**
   ```bash
   # Disable user account
   curl -X PUT http://localhost:8000/api/admin/users/$USER_ID \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"status": "disabled", "reason": "security_incident"}'
   
   # Revoke all user sessions
   curl -X DELETE http://localhost:8000/api/admin/users/$USER_ID/sessions \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   
   # Reset user password
   curl -X POST http://localhost:8000/api/admin/users/$USER_ID/reset-password \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

3. **Audit User Actions**
   ```bash
   # Get user's template modifications
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/audit/user/$USER_ID/templates"
   
   # Check for malicious templates created by user
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8000/api/admin/templates?createdBy=$USER_ID&security=review"
   ```

## Database Operations

### Database Maintenance

**Use Case**: Regular database maintenance

**Frequency**: Weekly

**Steps**:

1. **Database Health Check**
   ```sql
   -- Check database size
   SELECT pg_size_pretty(pg_database_size('promptlib_production'));
   
   -- Check table bloat
   SELECT schemaname, tablename, 
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size
   FROM pg_tables 
   WHERE tablename LIKE '%template%';
   
   -- Check index usage
   SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public' AND tablename LIKE '%template%'
   ORDER BY idx_tup_read DESC;
   ```

2. **Database Optimization**
   ```sql
   -- Update statistics
   ANALYZE;
   
   -- Vacuum tables
   VACUUM ANALYZE prompt_templates;
   VACUUM ANALYZE prompt_template_versions;
   VACUUM ANALYZE prompt_template_usage;
   VACUUM ANALYZE prompt_template_metrics;
   
   -- Reindex if needed
   REINDEX INDEX CONCURRENTLY idx_prompt_templates_category_key;
   ```

3. **Cleanup Old Data**
   ```sql
   -- Clean up old usage data (older than 90 days)
   DELETE FROM prompt_template_usage 
   WHERE created_at < NOW() - INTERVAL '90 days';
   
   -- Clean up old metrics (older than 30 days)
   DELETE FROM prompt_template_metrics 
   WHERE measurement_date < NOW() - INTERVAL '30 days';
   
   -- Archive old template versions (keep last 10 versions)
   WITH versions_to_keep AS (
     SELECT id FROM (
       SELECT id, ROW_NUMBER() OVER (PARTITION BY template_id ORDER BY version_number DESC) as rn
       FROM prompt_template_versions
     ) t WHERE rn <= 10
   )
   DELETE FROM prompt_template_versions 
   WHERE id NOT IN (SELECT id FROM versions_to_keep);
   ```

### Database Backup

**Use Case**: Regular database backups

**Frequency**: Daily

**Steps**:

1. **Create Database Backup**
   ```bash
   # Create backup directory
   BACKUP_DIR="/backups/database/$(date +%Y%m%d)"
   mkdir -p $BACKUP_DIR
   
   # Full database backup
   pg_dump -h $DB_HOST -U $DB_USER -d promptlib_production \
     --verbose --format=custom --compress=9 \
     > $BACKUP_DIR/promptlib_full_$(date +%Y%m%d_%H%M%S).backup
   
   # Schema-only backup
   pg_dump -h $DB_HOST -U $DB_USER -d promptlib_production \
     --schema-only --verbose \
     > $BACKUP_DIR/promptlib_schema_$(date +%Y%m%d_%H%M%S).sql
   
   # Data-only backup for template tables
   pg_dump -h $DB_HOST -U $DB_USER -d promptlib_production \
     --data-only --table=prompt_templates --table=prompt_template_versions \
     > $BACKUP_DIR/template_data_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Verify Backup Integrity**
   ```bash
   # Test backup file
   pg_restore --list $BACKUP_DIR/promptlib_full_*.backup | head -10
   
   # Check backup size
   ls -lh $BACKUP_DIR/
   
   # Verify backup completeness
   TABLE_COUNT=$(psql -h $DB_HOST -U $DB_USER -d promptlib_production -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
   BACKUP_TABLE_COUNT=$(pg_restore --list $BACKUP_DIR/promptlib_full_*.backup | grep "TABLE DATA" | wc -l)
   
   echo "Database tables: $TABLE_COUNT"
   echo "Backup tables: $BACKUP_TABLE_COUNT"
   ```

3. **Backup Rotation**
   ```bash
   # Keep daily backups for 7 days
   find /backups/database -name "*.backup" -mtime +7 -delete
   
   # Keep weekly backups for 4 weeks
   if [ $(date +%u) -eq 7 ]; then  # Sunday
     cp $BACKUP_DIR/promptlib_full_*.backup /backups/database/weekly/
     find /backups/database/weekly -name "*.backup" -mtime +28 -delete
   fi
   
   # Keep monthly backups for 12 months
   if [ $(date +%d) -eq 01 ]; then  # First day of month
     cp $BACKUP_DIR/promptlib_full_*.backup /backups/database/monthly/
     find /backups/database/monthly -name "*.backup" -mtime +365 -delete
   fi
   ```

## Cache Management

### Redis Cache Operations

**Use Case**: Cache maintenance and optimization

**Steps**:

1. **Cache Health Check**
   ```bash
   # Check Redis status
   redis-cli info server
   
   # Check memory usage
   redis-cli info memory
   
   # Check connected clients
   redis-cli info clients
   
   # Check cache statistics
   redis-cli info stats
   ```

2. **Cache Maintenance**
   ```bash
   # Clear expired keys
   redis-cli --scan --pattern "template:*" | xargs -L 1000 redis-cli DEL
   
   # Optimize memory usage
   redis-cli MEMORY PURGE
   
   # Save current state
   redis-cli BGSAVE
   
   # Check fragmentation
   redis-cli info memory | grep mem_fragmentation_ratio
   ```

3. **Cache Performance Tuning**
   ```bash
   # Adjust cache configuration
   redis-cli CONFIG SET maxmemory 2gb
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   
   # Enable keyspace notifications for monitoring
   redis-cli CONFIG SET notify-keyspace-events Ex
   
   # Optimize for template workload
   redis-cli CONFIG SET hash-max-ziplist-entries 512
   redis-cli CONFIG SET hash-max-ziplist-value 64
   ```

## Troubleshooting Common Issues

### Issue: High Memory Usage

**Symptoms**: Memory usage > 90%, application slowdown

**Investigation**:
```bash
# Check process memory usage
ps aux --sort=-%mem | head -10

# Check Node.js heap usage
curl http://localhost:8000/api/admin/system/memory

# Check for memory leaks
node --inspect=9229 --expose-gc app.js &
# Use Chrome DevTools to analyze heap
```

**Resolution**:
```bash
# Restart application to clear memory
pm2 restart all

# Increase memory limit if needed
export NODE_OPTIONS="--max-old-space-size=4096"
pm2 restart all

# Enable garbage collection monitoring
export NODE_OPTIONS="--expose-gc --trace-gc"
pm2 restart all
```

### Issue: Database Connection Pool Exhausted

**Symptoms**: "Connection pool exhausted" errors

**Investigation**:
```sql
-- Check active connections
SELECT count(*) as active_connections, state
FROM pg_stat_activity
WHERE datname = 'promptlib_production'
GROUP BY state;

-- Check long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
AND state = 'active';
```

**Resolution**:
```bash
# Increase connection pool size
export DATABASE_POOL_SIZE=50
pm2 restart all

# Kill long-running queries if needed
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND (now() - query_start) > interval '10 minutes';"

# Optimize connection usage
curl -X POST http://localhost:8000/api/admin/database/optimize-connections \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Issue: Template Validation Failures

**Symptoms**: High template validation error rate

**Investigation**:
```bash
# Get validation error statistics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/admin/templates/validation/stats"

# Analyze error patterns
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/admin/templates/validation/errors?limit=50"

# Check validation service health
curl http://localhost:8000/api/admin/templates/validation/health
```

**Resolution**:
```bash
# Restart validation service
curl -X POST http://localhost:8000/api/admin/templates/validation/restart \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Update validation rules if needed
curl -X PUT http://localhost:8000/api/admin/templates/validation/config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"strictMode": false, "allowLegacyPatterns": true}'

# Clear validation cache
curl -X DELETE http://localhost:8000/api/admin/templates/validation/cache \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Emergency Procedures

### Complete System Recovery

**Use Case**: Total system failure

**Steps**:

1. **Assess System State**
   ```bash
   # Check all services
   systemctl status postgresql redis-server nginx
   pm2 status
   
   # Check disk space
   df -h
   
   # Check system resources
   top -n 1
   ```

2. **Recovery Sequence**
   ```bash
   # 1. Start database
   systemctl start postgresql
   
   # 2. Start cache
   systemctl start redis-server
   
   # 3. Restore from backup if needed
   if [ "$RESTORE_FROM_BACKUP" = "true" ]; then
     pg_restore -d promptlib_production /backups/database/latest/promptlib_full.backup
   fi
   
   # 4. Start application
   pm2 start ecosystem.config.js
   
   # 5. Initialize template system
   sleep 30
   curl -X POST http://localhost:8000/api/admin/templates/initialize \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

3. **Verify Recovery**
   ```bash
   # Run comprehensive health check
   ./scripts/health-check-comprehensive.sh
   
   # Test critical functionality
   ./scripts/test-critical-paths.sh
   
   # Monitor for stability
   watch -n 30 'curl -s http://localhost:8000/health | jq .status'
   ```

This operational runbook should be kept up-to-date and tested regularly through disaster recovery drills.