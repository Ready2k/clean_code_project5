# Disaster Recovery Plan

## Overview

This document outlines the disaster recovery procedures for the Prompt Library system. It covers various failure scenarios and provides step-by-step recovery instructions.

## Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)

- **RTO**: 4 hours (maximum acceptable downtime)
- **RPO**: 1 hour (maximum acceptable data loss)
- **Backup Frequency**: Every 6 hours
- **Backup Retention**: 30 days

## Backup Strategy

### Automated Backups

Backups are automatically created every 6 hours and include:

1. **Database Backup**: PostgreSQL database with all user data, prompts, and configurations
2. **File System Backup**: Prompt data files, configuration files, and logs
3. **SSL Certificates**: Let's Encrypt certificates and keys
4. **Application State**: Redis cache snapshots (if applicable)

### Backup Locations

- **Primary**: Local backup storage (`/backups`)
- **Secondary**: Cloud storage (AWS S3/Google Cloud Storage)
- **Tertiary**: Off-site backup location

### Backup Verification

- Automated integrity checks using SHA256 checksums
- Monthly restore tests to verify backup completeness
- Backup monitoring and alerting

## Disaster Scenarios and Recovery Procedures

### Scenario 1: Application Service Failure

**Symptoms**: Application not responding, HTTP 5xx errors

**Recovery Steps**:

1. **Immediate Response** (0-15 minutes):
   ```bash
   # Check service status
   docker-compose -f docker-compose.prod.yml ps
   
   # Check logs
   docker-compose -f docker-compose.prod.yml logs backend frontend
   
   # Restart services
   docker-compose -f docker-compose.prod.yml restart backend frontend
   ```

2. **If restart fails**:
   ```bash
   # Full service restart
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **If container issues persist**:
   ```bash
   # Rebuild and restart
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml build --no-cache
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Scenario 2: Database Failure

**Symptoms**: Database connection errors, data corruption

**Recovery Steps**:

1. **Immediate Assessment** (0-30 minutes):
   ```bash
   # Check database status
   docker-compose -f docker-compose.prod.yml exec postgres pg_isready
   
   # Check database logs
   docker-compose -f docker-compose.prod.yml logs postgres
   
   # Check disk space
   df -h
   ```

2. **Database Recovery**:
   ```bash
   # Stop application services
   docker-compose -f docker-compose.prod.yml stop backend frontend
   
   # Create database backup (if possible)
   ./scripts/backup.sh
   
   # Restore from latest backup
   ./scripts/restore.sh --force latest-backup.tar.gz
   ```

3. **If database is corrupted**:
   ```bash
   # Stop all services
   docker-compose -f docker-compose.prod.yml down
   
   # Remove corrupted database volume
   docker volume rm interface_postgres_data
   
   # Restore from backup
   docker-compose -f docker-compose.prod.yml up -d postgres
   ./scripts/restore.sh --force --no-data --no-config latest-backup.tar.gz
   ```

### Scenario 3: Complete System Failure

**Symptoms**: Server hardware failure, complete data center outage

**Recovery Steps**:

1. **Prepare New Environment** (0-60 minutes):
   ```bash
   # On new server, clone repository
   git clone <repository-url>
   cd prompt-library
   
   # Install Docker and Docker Compose
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Install docker-compose
   curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   chmod +x /usr/local/bin/docker-compose
   ```

2. **Restore System** (60-180 minutes):
   ```bash
   # Download latest backup from cloud storage
   aws s3 cp s3://backup-bucket/latest-backup.tar.gz ./
   
   # Set up environment variables
   cp .env.example .env
   # Edit .env with production values
   
   # Restore complete system
   ./scripts/restore.sh --force --restore-ssl latest-backup.tar.gz
   
   # Start services
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Update DNS and SSL** (180-240 minutes):
   ```bash
   # Update DNS records to point to new server
   # Verify SSL certificates are working
   # Update monitoring and alerting endpoints
   ```

### Scenario 4: Data Corruption

**Symptoms**: Inconsistent data, application errors, user reports

**Recovery Steps**:

1. **Immediate Isolation** (0-15 minutes):
   ```bash
   # Stop write operations
   docker-compose -f docker-compose.prod.yml stop backend
   
   # Keep frontend running in read-only mode
   # Display maintenance message to users
   ```

2. **Assess Corruption** (15-60 minutes):
   ```bash
   # Check database integrity
   docker-compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT * FROM pg_stat_activity;"
   
   # Check file system integrity
   find /app/data -name "*.json" -exec jq empty {} \; 2>&1 | grep -v "parse error" || echo "JSON files corrupted"
   
   # Identify corruption scope and timeline
   ```

3. **Selective Recovery**:
   ```bash
   # For database corruption
   ./scripts/restore.sh --force --no-data --no-config backup-before-corruption.tar.gz
   
   # For file corruption
   ./scripts/restore.sh --force --no-database --no-config backup-before-corruption.tar.gz
   
   # Restart services
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Scenario 5: Security Breach

**Symptoms**: Unauthorized access, suspicious activity, data breach

**Recovery Steps**:

1. **Immediate Containment** (0-30 minutes):
   ```bash
   # Isolate system
   docker-compose -f docker-compose.prod.yml down
   
   # Block suspicious IPs at firewall level
   iptables -A INPUT -s <suspicious-ip> -j DROP
   
   # Preserve evidence
   cp -r /app/logs /forensics/logs-$(date +%s)
   ```

2. **Security Assessment** (30-120 minutes):
   ```bash
   # Analyze logs for breach timeline
   grep -r "suspicious-pattern" /app/logs/
   
   # Check for unauthorized changes
   find /app -type f -newer /tmp/last-known-good -ls
   
   # Verify backup integrity
   ./scripts/restore.sh --verify-only latest-clean-backup.tar.gz
   ```

3. **Clean Recovery**:
   ```bash
   # Restore from clean backup (before breach)
   ./scripts/restore.sh --force clean-backup.tar.gz
   
   # Reset all passwords and API keys
   # Regenerate JWT secrets
   # Update SSL certificates
   
   # Implement additional security measures
   # Update firewall rules
   # Enable additional monitoring
   ```

## Recovery Validation

After any recovery procedure, perform these validation steps:

### 1. Service Health Check
```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# Verify health endpoints
curl -f http://localhost/health
curl -f http://localhost/api/system/health
```

### 2. Database Connectivity
```bash
# Test database connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT version();"

# Verify data integrity
docker-compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT COUNT(*) FROM prompts;"
```

### 3. Application Functionality
```bash
# Test API endpoints
curl -X GET http://localhost/api/prompts
curl -X POST http://localhost/api/auth/login -d '{"username":"test","password":"test"}'

# Test file operations
ls -la /app/data/prompts/
```

### 4. Monitoring and Alerting
```bash
# Verify monitoring is working
curl http://localhost:9090/metrics

# Check Grafana dashboards
curl http://monitoring.domain.com/api/health

# Test alerting
# Trigger test alert and verify notifications
```

## Communication Plan

### Internal Communication

1. **Incident Commander**: Lead technical person responsible for recovery
2. **Technical Team**: Engineers executing recovery procedures
3. **Management**: Stakeholders requiring status updates
4. **Support Team**: Customer-facing team handling user communications

### External Communication

1. **Status Page**: Update system status and estimated recovery time
2. **User Notifications**: Email/SMS to affected users
3. **Social Media**: Public updates on major incidents
4. **Customer Support**: Prepared responses for user inquiries

### Communication Templates

#### Initial Incident Notification
```
Subject: [INCIDENT] Prompt Library Service Disruption

We are currently experiencing issues with the Prompt Library service. 
Our team is investigating and working to resolve the issue.

Estimated Resolution: [TIME]
Next Update: [TIME]

Status Page: https://status.promptlibrary.com
```

#### Recovery Complete Notification
```
Subject: [RESOLVED] Prompt Library Service Restored

The Prompt Library service has been fully restored. All functionality 
is now available.

Incident Duration: [DURATION]
Root Cause: [BRIEF DESCRIPTION]

We apologize for any inconvenience caused.
```

## Post-Incident Review

After each incident, conduct a post-incident review:

1. **Timeline Documentation**: Record exact timeline of events
2. **Root Cause Analysis**: Identify underlying causes
3. **Response Evaluation**: Assess effectiveness of response procedures
4. **Improvement Actions**: Identify and implement improvements
5. **Documentation Updates**: Update procedures based on lessons learned

## Contact Information

### Emergency Contacts

- **Primary On-Call**: [PHONE] [EMAIL]
- **Secondary On-Call**: [PHONE] [EMAIL]
- **Management Escalation**: [PHONE] [EMAIL]

### Vendor Contacts

- **Cloud Provider Support**: [PHONE] [ACCOUNT-ID]
- **Database Support**: [PHONE] [CONTRACT-ID]
- **Monitoring Service**: [PHONE] [ACCOUNT-ID]

## Testing and Maintenance

### Regular Testing Schedule

- **Monthly**: Backup restore test
- **Quarterly**: Full disaster recovery drill
- **Annually**: Complete DR plan review and update

### Maintenance Windows

- **Scheduled Maintenance**: First Sunday of each month, 2:00-6:00 AM UTC
- **Emergency Maintenance**: As needed with 2-hour notice when possible

## Appendix

### Required Tools and Access

- Docker and Docker Compose
- Database client tools (psql, pg_dump, pg_restore)
- Cloud CLI tools (aws, gcloud, az)
- Monitoring access (Grafana, Prometheus)
- DNS management access
- SSL certificate management access

### Environment Variables Reference

```bash
# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=promptlib
POSTGRES_USER=promptlib_user
POSTGRES_PASSWORD=secure_password

# Application
NODE_ENV=production
JWT_SECRET=jwt_secret_key
ENCRYPTION_KEY=encryption_key

# Backup
BACKUP_DIR=/backups
RETENTION_DAYS=30
BACKUP_WEBHOOK_URL=https://monitoring.com/webhook
```

### Useful Commands Reference

```bash
# Service management
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
docker-compose -f docker-compose.prod.yml restart [service]

# Backup and restore
./scripts/backup.sh
./scripts/restore.sh backup-file.tar.gz

# Database operations
pg_dump -h host -U user -d database > backup.sql
psql -h host -U user -d database < backup.sql

# System monitoring
df -h
free -h
top
netstat -tulpn
```