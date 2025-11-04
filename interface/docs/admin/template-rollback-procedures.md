# Template System Rollback Procedures

## Overview

This document provides comprehensive rollback procedures for the Template System deployment. These procedures are designed to quickly restore service in case of deployment issues while minimizing data loss and downtime.

## Rollback Decision Matrix

### When to Execute Rollback

| Issue Type | Severity | Rollback Type | Max Decision Time |
|------------|----------|---------------|-------------------|
| Application won't start | Critical | Immediate Full | 5 minutes |
| Database corruption | Critical | Immediate Full | 10 minutes |
| Security vulnerability | Critical | Immediate Partial | 15 minutes |
| Performance degradation >50% | High | Gradual | 30 minutes |
| Template validation failures >10% | High | Feature Disable | 15 minutes |
| Cache failures | Medium | Service Restart | 10 minutes |
| Minor UI issues | Low | Hotfix | 2 hours |

### Rollback Authority

- **Immediate Rollback**: DevOps Lead, Backend Lead, or On-call Engineer
- **Gradual Rollback**: Product Manager approval required
- **Feature Disable**: Backend Lead or Product Manager
- **Database Rollback**: Database Administrator approval required

## Rollback Procedures

### 1. Immediate Full Rollback

**Use Case**: Critical system failures, application won't start, major security issues

**Estimated Time**: 10-15 minutes

**Prerequisites**:
- Previous stable version identified
- Database backup available
- Rollback authority obtained

**Steps**:

1. **Stop Current Services**
   ```bash
   # Stop all application processes
   pm2 stop all
   
   # Stop template-specific services
   systemctl stop template-cache-service
   systemctl stop template-analytics-service
   ```

2. **Restore Application Code**
   ```bash
   # Navigate to application directory
   cd /opt/prompt-library
   
   # Backup current deployment
   mv current current-failed-$(date +%Y%m%d_%H%M%S)
   
   # Restore previous stable version
   cp -r previous-stable current
   cd current
   
   # Restore dependencies
   npm ci --production
   
   # Rebuild if necessary
   npm run build
   ```

3. **Restore Database (if corrupted)**
   ```bash
   # Create backup of current state
   pg_dump promptlib_production > failed-state-$(date +%Y%m%d_%H%M%S).sql
   
   # Restore from last known good backup
   psql promptlib_production < backup-pre-deployment.sql
   
   # Verify database integrity
   psql promptlib_production -c "SELECT COUNT(*) FROM prompt_templates;"
   ```

4. **Restore Configuration**
   ```bash
   # Restore previous environment configuration
   cp .env.previous .env
   
   # Restore previous nginx configuration
   cp /etc/nginx/sites-available/prompt-library.previous /etc/nginx/sites-available/prompt-library
   nginx -t && systemctl reload nginx
   ```

5. **Restart Services**
   ```bash
   # Start application
   pm2 start ecosystem.config.js
   
   # Start supporting services
   systemctl start template-cache-service
   systemctl start template-analytics-service
   
   # Verify services are healthy
   curl http://localhost:8000/health
   ```

6. **Validate Rollback**
   ```bash
   # Run smoke tests
   npm run test:smoke
   
   # Test template functionality
   curl -X GET http://localhost:8000/api/admin/templates \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   
   # Check logs for errors
   tail -f /var/log/prompt-library/application.log
   ```

### 2. Gradual Rollback

**Use Case**: Performance issues, high error rates, gradual system degradation

**Estimated Time**: 30-45 minutes

**Steps**:

1. **Enable Maintenance Mode**
   ```bash
   # Enable maintenance mode for admin features
   curl -X POST http://localhost:8000/api/admin/maintenance \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"enabled": true, "message": "Template system maintenance in progress"}'
   ```

2. **Disable New Template Features**
   ```bash
   # Disable template creation
   export TEMPLATE_CREATION_ENABLED=false
   
   # Disable template editing
   export TEMPLATE_EDITING_ENABLED=false
   
   # Restart application with new settings
   pm2 restart all
   ```

3. **Revert to Default Templates**
   ```bash
   # Backup current custom templates
   curl -X POST http://localhost:8000/api/admin/templates/export-all \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     > custom-templates-backup-$(date +%Y%m%d_%H%M%S).json
   
   # Reset to default templates
   curl -X POST http://localhost:8000/api/admin/templates/reset-defaults \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

4. **Monitor System Recovery**
   ```bash
   # Monitor performance metrics
   curl http://localhost:8000/metrics
   
   # Check error rates
   grep ERROR /var/log/prompt-library/application.log | tail -20
   
   # Monitor database performance
   psql promptlib_production -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
   ```

5. **Gradual Re-enablement**
   ```bash
   # Re-enable template viewing first
   export TEMPLATE_VIEWING_ENABLED=true
   pm2 restart all
   
   # Wait 15 minutes, then enable creation if stable
   export TEMPLATE_CREATION_ENABLED=true
   pm2 restart all
   
   # Wait 15 minutes, then enable editing if stable
   export TEMPLATE_EDITING_ENABLED=true
   pm2 restart all
   ```

### 3. Feature-Specific Rollback

**Use Case**: Specific template features causing issues

**Estimated Time**: 15-20 minutes

**Steps**:

1. **Disable Problematic Features**
   ```bash
   # Disable template validation if causing issues
   export TEMPLATE_VALIDATION_ENABLED=false
   
   # Disable template caching if causing issues
   export TEMPLATE_CACHE_ENABLED=false
   
   # Disable template analytics if causing issues
   export TEMPLATE_ANALYTICS_ENABLED=false
   
   # Restart with new configuration
   pm2 restart all
   ```

2. **Fallback to Safe Mode**
   ```bash
   # Enable safe mode (basic functionality only)
   curl -X POST http://localhost:8000/api/admin/templates/safe-mode \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"enabled": true}'
   ```

3. **Isolate Problem Components**
   ```bash
   # Test individual components
   curl http://localhost:8000/api/admin/templates/health/validation
   curl http://localhost:8000/api/admin/templates/health/cache
   curl http://localhost:8000/api/admin/templates/health/analytics
   ```

### 4. Database-Only Rollback

**Use Case**: Database migration issues, data corruption

**Estimated Time**: 20-30 minutes

**Prerequisites**:
- Database Administrator approval
- Recent database backup available
- Application can handle database rollback

**Steps**:

1. **Stop Database-Dependent Services**
   ```bash
   # Stop application
   pm2 stop all
   
   # Stop database connections
   systemctl stop postgresql
   ```

2. **Backup Current Database State**
   ```bash
   # Create backup of current state for analysis
   pg_dump promptlib_production > current-state-$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Restore Database**
   ```bash
   # Start PostgreSQL
   systemctl start postgresql
   
   # Drop current database (CAUTION!)
   dropdb promptlib_production
   
   # Recreate database
   createdb promptlib_production
   
   # Restore from backup
   psql promptlib_production < backup-pre-deployment.sql
   
   # Verify restoration
   psql promptlib_production -c "\dt"
   ```

4. **Update Application Configuration**
   ```bash
   # Update database schema version if needed
   export DATABASE_SCHEMA_VERSION=previous_version
   
   # Restart application
   pm2 start ecosystem.config.js
   ```

## Rollback Validation

### Automated Validation Scripts

1. **System Health Check**
   ```bash
   #!/bin/bash
   # rollback-validation.sh
   
   echo "Validating rollback..."
   
   # Check application health
   if curl -f http://localhost:8000/health; then
     echo "✓ Application health check passed"
   else
     echo "✗ Application health check failed"
     exit 1
   fi
   
   # Check database connectivity
   if psql promptlib_production -c "SELECT 1;" > /dev/null 2>&1; then
     echo "✓ Database connectivity check passed"
   else
     echo "✗ Database connectivity check failed"
     exit 1
   fi
   
   # Check template functionality
   if curl -f -H "Authorization: Bearer $ADMIN_TOKEN" \
      http://localhost:8000/api/admin/templates > /dev/null 2>&1; then
     echo "✓ Template API check passed"
   else
     echo "✗ Template API check failed"
     exit 1
   fi
   
   echo "Rollback validation completed successfully"
   ```

2. **Performance Validation**
   ```bash
   #!/bin/bash
   # performance-validation.sh
   
   echo "Validating performance after rollback..."
   
   # Check response times
   RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:8000/health)
   if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
     echo "✓ Response time acceptable: ${RESPONSE_TIME}s"
   else
     echo "✗ Response time too high: ${RESPONSE_TIME}s"
   fi
   
   # Check memory usage
   MEMORY_USAGE=$(ps aux | grep node | awk '{sum+=$6} END {print sum/1024}')
   if (( $(echo "$MEMORY_USAGE < 1000" | bc -l) )); then
     echo "✓ Memory usage acceptable: ${MEMORY_USAGE}MB"
   else
     echo "✗ Memory usage too high: ${MEMORY_USAGE}MB"
   fi
   ```

### Manual Validation Checklist

- [ ] Application starts without errors
- [ ] All critical endpoints respond correctly
- [ ] Database queries execute successfully
- [ ] Template operations work as expected
- [ ] User authentication functions properly
- [ ] Admin interface is accessible
- [ ] Performance metrics are within acceptable ranges
- [ ] No critical errors in application logs
- [ ] Cache functionality works (if enabled)
- [ ] Security features are operational

## Communication Procedures

### Internal Communication

1. **Immediate Notification** (within 5 minutes)
   - Notify DevOps team via Slack/Teams
   - Update incident management system
   - Inform on-call manager

2. **Status Updates** (every 15 minutes during rollback)
   - Progress updates to stakeholders
   - ETA for resolution
   - Any complications or delays

3. **Resolution Notification**
   - Confirm successful rollback
   - Provide summary of actions taken
   - Schedule post-incident review

### External Communication

1. **Customer Notification** (if user-facing impact)
   ```
   Subject: Service Maintenance - Template System
   
   We are currently performing emergency maintenance on our template system.
   
   Impact: [Describe impact]
   ETA: [Estimated resolution time]
   
   We apologize for any inconvenience and will provide updates as available.
   ```

2. **Status Page Updates**
   - Update system status page
   - Provide regular progress updates
   - Confirm resolution

## Post-Rollback Actions

### Immediate Actions (0-2 hours)
- [ ] Confirm all systems are stable
- [ ] Monitor error rates and performance
- [ ] Document rollback actions taken
- [ ] Preserve logs and data for analysis
- [ ] Notify stakeholders of resolution

### Short-term Actions (2-24 hours)
- [ ] Conduct post-incident review
- [ ] Analyze root cause of deployment failure
- [ ] Update deployment procedures if needed
- [ ] Plan remediation for rolled-back features
- [ ] Communicate lessons learned to team

### Long-term Actions (1-7 days)
- [ ] Implement fixes for identified issues
- [ ] Enhance testing procedures
- [ ] Update rollback procedures based on experience
- [ ] Plan re-deployment strategy
- [ ] Update monitoring and alerting

## Rollback Testing

### Regular Rollback Drills

**Frequency**: Monthly

**Scope**: Practice rollback procedures in staging environment

**Objectives**:
- Validate rollback procedures
- Train team on rollback execution
- Identify improvements to procedures
- Measure rollback execution time

### Rollback Simulation Scenarios

1. **Database Corruption Simulation**
   - Corrupt database in staging
   - Execute full rollback procedure
   - Measure recovery time

2. **Application Failure Simulation**
   - Deploy broken code to staging
   - Execute immediate rollback
   - Validate system recovery

3. **Performance Degradation Simulation**
   - Introduce performance issues
   - Execute gradual rollback
   - Monitor system recovery

## Emergency Contacts

### Primary Contacts
- **DevOps Lead**: [Phone] [Email] [Slack]
- **Backend Lead**: [Phone] [Email] [Slack]
- **Database Administrator**: [Phone] [Email] [Slack]

### Secondary Contacts
- **Product Manager**: [Phone] [Email] [Slack]
- **Security Lead**: [Phone] [Email] [Slack]
- **Customer Success**: [Phone] [Email] [Slack]

### Escalation Path
1. On-call Engineer (0-15 minutes)
2. Team Lead (15-30 minutes)
3. Engineering Manager (30-60 minutes)
4. CTO (60+ minutes or critical business impact)

## Documentation and Logs

### Required Documentation
- [ ] Rollback decision rationale
- [ ] Steps executed during rollback
- [ ] Validation results
- [ ] Timeline of events
- [ ] Impact assessment
- [ ] Lessons learned

### Log Preservation
- [ ] Application logs before/during/after rollback
- [ ] Database logs and query performance
- [ ] System metrics and performance data
- [ ] Network and infrastructure logs
- [ ] User activity and error reports

This rollback procedure document should be reviewed and updated regularly based on deployment experiences and system changes.