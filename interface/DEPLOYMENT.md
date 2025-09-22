# Production Deployment Guide

This guide covers the complete production deployment and monitoring setup for the Prompt Library system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [Monitoring](#monitoring)
6. [Backup and Recovery](#backup-and-recovery)
7. [Maintenance](#maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04+ or CentOS 8+
- **CPU**: 4+ cores
- **Memory**: 8GB+ RAM
- **Storage**: 100GB+ SSD
- **Network**: Static IP address, domain name configured

### Software Requirements

- Docker 24.0+
- Docker Compose 2.20+
- Git
- curl
- openssl

### Domain and SSL

- Domain name pointing to your server
- DNS A record configured
- Firewall ports 80, 443, 22 open

## Initial Setup

### 1. Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 2. Clone Repository

```bash
git clone <repository-url>
cd prompt-library/interface
```

### 3. Create Directory Structure

```bash
# Create required directories
sudo mkdir -p /app/data /app/logs /backups /etc/letsencrypt
sudo chown -R $USER:$USER /app /backups

# Create Docker network
docker network create web
```

## Configuration

### 1. Environment Configuration

```bash
# Copy production environment template
cp .env.production .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**

```bash
# Domain Configuration
DOMAIN=your-domain.com

# Security (Generate secure values)
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 16)
REDIS_PASSWORD=$(openssl rand -base64 16)
GRAFANA_PASSWORD=$(openssl rand -base64 16)

# Notification URLs
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### 2. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com -d monitoring.your-domain.com

# Verify certificate
sudo certbot certificates
```

#### Option B: Custom Certificate

```bash
# Place your certificates in /etc/letsencrypt/live/your-domain.com/
sudo mkdir -p /etc/letsencrypt/live/your-domain.com/
sudo cp your-cert.pem /etc/letsencrypt/live/your-domain.com/fullchain.pem
sudo cp your-key.pem /etc/letsencrypt/live/your-domain.com/privkey.pem
```

### 3. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## Deployment

### 1. Initial Deployment

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run initial deployment
./scripts/deploy.sh deploy
```

### 2. Verify Deployment

```bash
# Check service status
./scripts/deploy.sh status

# Run health checks
./scripts/health-check.sh --verbose

# Check logs
./scripts/deploy.sh logs
```

### 3. Access Applications

- **Main Application**: https://your-domain.com
- **Monitoring Dashboard**: https://monitoring.your-domain.com
- **API Health**: https://your-domain.com/api/system/health

## Monitoring

### 1. Grafana Setup

1. Access Grafana at `https://monitoring.your-domain.com`
2. Login with admin / `$GRAFANA_PASSWORD`
3. Dashboards are automatically provisioned:
   - System Overview
   - Application Metrics
   - Infrastructure Monitoring

### 2. Alerting Configuration

Alerts are configured for:
- Service downtime
- High error rates
- Performance degradation
- Resource exhaustion
- Security events

### 3. Log Monitoring

Logs are collected by Promtail and stored in Loki:
- Application logs: `/app/logs/`
- System logs: `/var/log/`
- Container logs: Docker daemon

## Backup and Recovery

### 1. Automated Backups

Backups run every 6 hours and include:
- PostgreSQL database
- Application data files
- Configuration files
- SSL certificates

```bash
# Manual backup
./scripts/backup.sh

# List backups
ls -la /backups/

# Verify backup
./scripts/restore.sh --verify-only backup-file.tar.gz
```

### 2. Disaster Recovery

```bash
# Full system restore
./scripts/restore.sh --force backup-file.tar.gz

# Database only restore
./scripts/restore.sh --no-data --no-config backup-file.tar.gz

# Follow disaster recovery plan
cat scripts/disaster-recovery.md
```

### 3. Backup Monitoring

- Backup success/failure notifications via Slack/email
- Backup integrity checks with SHA256 checksums
- Automated cleanup of old backups (30-day retention)

## Maintenance

### 1. Regular Updates

```bash
# Update application
git pull origin main
./scripts/deploy.sh update

# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
```

### 2. SSL Certificate Renewal

```bash
# Renew Let's Encrypt certificates
sudo certbot renew --dry-run
sudo certbot renew

# Restart nginx after renewal
docker-compose -f docker-compose.prod.yml restart nginx
```

### 3. Log Rotation

```bash
# Configure logrotate for application logs
sudo tee /etc/logrotate.d/prompt-library << EOF
/app/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 1001 1001
    postrotate
        docker-compose -f /path/to/docker-compose.prod.yml restart backend
    endscript
}
EOF
```

### 4. Database Maintenance

```bash
# Database vacuum and analyze
docker-compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "VACUUM ANALYZE;"

# Check database size
docker-compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT pg_size_pretty(pg_database_size('$POSTGRES_DB'));"
```

## Troubleshooting

### 1. Common Issues

#### Service Won't Start

```bash
# Check service logs
docker-compose -f docker-compose.prod.yml logs backend

# Check system resources
df -h
free -h
docker system df

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

#### Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Reset database connection
docker-compose -f docker-compose.prod.yml restart postgres backend
```

#### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout

# Test SSL connection
openssl s_client -connect your-domain.com:443

# Renew certificate
sudo certbot renew --force-renewal
```

### 2. Performance Issues

#### High Memory Usage

```bash
# Check container memory usage
docker stats

# Check system memory
free -h
cat /proc/meminfo

# Restart memory-intensive services
docker-compose -f docker-compose.prod.yml restart backend
```

#### High CPU Usage

```bash
# Check process CPU usage
top -p $(pgrep -d',' -f docker)

# Check container CPU usage
docker stats --no-stream

# Scale services if needed
docker-compose -f docker-compose.prod.yml up -d --scale backend=2
```

#### Disk Space Issues

```bash
# Check disk usage
df -h
du -sh /app/* /backups/*

# Clean up Docker resources
docker system prune -f
docker volume prune -f

# Clean up old backups
find /backups -name "*.tar.gz" -mtime +30 -delete
```

### 3. Security Issues

#### Suspicious Activity

```bash
# Check security logs
grep -i "failed\|unauthorized\|suspicious" /app/logs/security.log

# Check authentication logs
docker-compose -f docker-compose.prod.yml logs backend | grep -i auth

# Block suspicious IPs
sudo ufw deny from <suspicious-ip>
```

#### SSL/TLS Issues

```bash
# Test SSL configuration
curl -I https://your-domain.com

# Check SSL certificate chain
curl -I https://your-domain.com --verbose

# Verify SSL security
nmap --script ssl-enum-ciphers -p 443 your-domain.com
```

### 4. Monitoring and Alerting Issues

#### Grafana Not Accessible

```bash
# Check Grafana service
docker-compose -f docker-compose.prod.yml logs grafana

# Reset Grafana admin password
docker-compose -f docker-compose.prod.yml exec grafana grafana-cli admin reset-admin-password newpassword
```

#### Prometheus Not Collecting Metrics

```bash
# Check Prometheus configuration
docker-compose -f docker-compose.prod.yml exec prometheus cat /etc/prometheus/prometheus.yml

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Restart Prometheus
docker-compose -f docker-compose.prod.yml restart prometheus
```

### 5. Emergency Procedures

#### Complete System Failure

1. **Assess the situation**
   ```bash
   ./scripts/health-check.sh --verbose
   ```

2. **Check system resources**
   ```bash
   df -h && free -h && uptime
   ```

3. **Attempt service restart**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **If restart fails, restore from backup**
   ```bash
   ./scripts/restore.sh --force latest-backup.tar.gz
   ```

5. **Follow disaster recovery plan**
   ```bash
   cat scripts/disaster-recovery.md
   ```

## Support and Contacts

### Emergency Contacts

- **Primary On-Call**: [Your contact information]
- **Secondary On-Call**: [Backup contact]
- **Management Escalation**: [Management contact]

### Useful Commands Reference

```bash
# Service management
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f [service]
docker-compose -f docker-compose.prod.yml restart [service]

# Health checks
./scripts/health-check.sh
curl -f https://your-domain.com/api/system/health

# Backup and restore
./scripts/backup.sh
./scripts/restore.sh backup-file.tar.gz

# Deployment
./scripts/deploy.sh deploy
./scripts/deploy.sh status
./scripts/deploy.sh rollback

# Monitoring
curl http://localhost:9090/metrics
curl http://localhost:3000/api/health
```

### Log Locations

- **Application Logs**: `/app/logs/`
- **Container Logs**: `docker-compose logs`
- **System Logs**: `/var/log/`
- **Nginx Logs**: `/var/log/nginx/`
- **Backup Logs**: `/backups/backup.log`

This deployment guide provides comprehensive instructions for setting up, maintaining, and troubleshooting the Prompt Library system in production. Follow the procedures carefully and maintain regular backups for optimal system reliability.