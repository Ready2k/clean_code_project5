# Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with the Prompt Library Professional Interface.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Authentication Issues](#authentication-issues)
3. [Connection Problems](#connection-problems)
4. [Prompt Management Issues](#prompt-management-issues)
5. [Performance Problems](#performance-problems)
6. [UI and Display Issues](#ui-and-display-issues)
7. [API and Integration Issues](#api-and-integration-issues)
8. [System Administration Issues](#system-administration-issues)
9. [Database and Storage Issues](#database-and-storage-issues)
10. [Monitoring and Logging](#monitoring-and-logging)

## Quick Diagnostics

### System Health Check

Before diving into specific issues, perform these quick checks:

#### 1. Service Status Check
```bash
# For Docker deployment
docker-compose ps

# For Kubernetes deployment
kubectl get pods -n prompt-library

# Check service logs
docker-compose logs --tail=50 backend
docker-compose logs --tail=50 frontend
```

#### 2. Network Connectivity
```bash
# Test API endpoint
curl -k https://your-domain.com/api/system/health

# Test WebSocket connection
wscat -c wss://your-domain.com/socket.io/

# Check DNS resolution
nslookup your-domain.com
```

#### 3. Resource Usage
```bash
# Check system resources
free -h
df -h
top

# Check Docker resource usage
docker stats
```

#### 4. Browser Console Check
1. Open browser developer tools (F12)
2. Check Console tab for JavaScript errors
3. Check Network tab for failed requests
4. Check Application tab for storage issues

## Authentication Issues

### Issue: Cannot Log In

#### Symptoms
- Login form shows "Invalid credentials" error
- User gets redirected back to login page
- Authentication requests fail with 401 status

#### Diagnosis Steps
1. **Verify credentials**:
   ```bash
   # Check if user exists in database
   docker-compose exec postgres psql -U promptlib -d promptlib -c "SELECT username, email, role FROM users WHERE username='your-username';"
   ```

2. **Check backend logs**:
   ```bash
   docker-compose logs backend | grep -i auth
   ```

3. **Verify JWT configuration**:
   ```bash
   # Check if JWT_SECRET is set
   docker-compose exec backend printenv | grep JWT
   ```

#### Solutions

**Solution 1: Reset User Password**
```bash
# Connect to backend container
docker-compose exec backend npm run reset-password -- --username your-username --password new-password
```

**Solution 2: Check JWT Secret**
```bash
# Ensure JWT_SECRET is properly set in .env
echo "JWT_SECRET=your-super-secure-jwt-secret-key-here" >> .env
docker-compose restart backend
```

**Solution 3: Clear Browser Storage**
1. Open browser developer tools
2. Go to Application tab
3. Clear Local Storage and Session Storage
4. Clear cookies for the domain
5. Refresh page and try again

### Issue: Session Expires Too Quickly

#### Symptoms
- User gets logged out frequently
- "Session expired" messages appear often
- Token refresh fails

#### Solutions

**Solution 1: Adjust Token Expiration**
```bash
# Edit .env file
JWT_EXPIRES_IN=24h  # Increase from default
REFRESH_TOKEN_EXPIRES_IN=7d  # Increase refresh token lifetime

# Restart services
docker-compose restart backend
```

**Solution 2: Check System Clock**
```bash
# Ensure system time is correct
timedatectl status
sudo ntpdate -s time.nist.gov  # Sync time if needed
```

### Issue: Permission Denied Errors

#### Symptoms
- "Insufficient permissions" errors
- Cannot access admin features
- API returns 403 status codes

#### Solutions

**Solution 1: Check User Role**
```bash
# Verify user role in database
docker-compose exec postgres psql -U promptlib -d promptlib -c "SELECT username, role FROM users WHERE username='your-username';"

# Update user role if needed
docker-compose exec postgres psql -U promptlib -d promptlib -c "UPDATE users SET role='admin' WHERE username='your-username';"
```

**Solution 2: Clear and Re-login**
1. Log out completely
2. Clear browser cache and cookies
3. Log back in to refresh permissions

## Connection Problems

### Issue: Cannot Connect to LLM Providers

#### Symptoms
- Connection test fails
- "Provider unavailable" errors
- Enhancement and rendering features don't work

#### Diagnosis Steps
1. **Test network connectivity**:
   ```bash
   # Test OpenAI connectivity
   curl -H "Authorization: Bearer your-api-key" https://api.openai.com/v1/models
   
   # Test AWS Bedrock connectivity (requires AWS CLI configured)
   aws bedrock list-foundation-models --region us-east-1
   ```

2. **Check connection configuration**:
   ```bash
   # View connection logs
   docker-compose logs backend | grep -i connection
   ```

#### Solutions

**Solution 1: Verify API Keys**
1. Go to Connections page
2. Edit the failing connection
3. Re-enter API credentials
4. Test connection again

**Solution 2: Check Network Firewall**
```bash
# Ensure outbound HTTPS is allowed
sudo ufw status
# Add rules if needed
sudo ufw allow out 443/tcp
```

**Solution 3: Update Provider Configuration**
```bash
# Check if provider endpoints have changed
# Update base URLs in connection configuration
```

### Issue: Slow Connection Response Times

#### Symptoms
- Long delays when testing connections
- Timeouts during enhancement or rendering
- Intermittent connection failures

#### Solutions

**Solution 1: Increase Timeout Values**
```bash
# Edit backend configuration
# In .env file:
CONNECTION_TIMEOUT=30000  # 30 seconds
REQUEST_TIMEOUT=60000     # 60 seconds

docker-compose restart backend
```

**Solution 2: Check Network Latency**
```bash
# Test latency to provider endpoints
ping api.openai.com
traceroute api.openai.com
```

## Prompt Management Issues

### Issue: Prompts Not Saving

#### Symptoms
- Save button doesn't work
- Changes are lost after refresh
- "Save failed" error messages

#### Diagnosis Steps
1. **Check browser console**:
   - Look for JavaScript errors
   - Check network requests for failures

2. **Verify backend connectivity**:
   ```bash
   # Test API endpoint
   curl -X POST https://your-domain.com/api/prompts \
     -H "Authorization: Bearer your-token" \
     -H "Content-Type: application/json" \
     -d '{"metadata":{"title":"Test"},"humanPrompt":{"goal":"Test"}}'
   ```

#### Solutions

**Solution 1: Check Form Validation**
1. Ensure all required fields are filled
2. Check for invalid characters in input
3. Verify field length limits

**Solution 2: Clear Browser Cache**
1. Hard refresh (Ctrl+F5 or Cmd+Shift+R)
2. Clear browser cache and cookies
3. Try in incognito/private mode

**Solution 3: Check Storage Space**
```bash
# Check available disk space
df -h

# Check if storage directory is writable
ls -la /path/to/storage/directory
```

### Issue: Search Not Working

#### Symptoms
- Search returns no results
- Filters don't apply correctly
- Search is very slow

#### Solutions

**Solution 1: Rebuild Search Index**
```bash
# Rebuild search index
docker-compose exec backend npm run rebuild-index
```

**Solution 2: Check Search Syntax**
- Use simple keywords instead of complex queries
- Try searching by tags instead of content
- Check for typos in search terms

### Issue: Version History Missing

#### Symptoms
- No version history shown
- Cannot compare versions
- Restore function not working

#### Solutions

**Solution 1: Check Database Integrity**
```bash
# Check version history table
docker-compose exec postgres psql -U promptlib -d promptlib -c "SELECT COUNT(*) FROM prompt_versions;"
```

**Solution 2: Enable Version Tracking**
```bash
# Ensure version tracking is enabled in configuration
ENABLE_VERSION_HISTORY=true
docker-compose restart backend
```

## Performance Problems

### Issue: Slow Page Loading

#### Symptoms
- Pages take long time to load
- Spinning loading indicators
- Browser becomes unresponsive

#### Diagnosis Steps
1. **Check browser performance**:
   - Open developer tools
   - Go to Performance tab
   - Record page load and analyze

2. **Check network requests**:
   - Look for slow API calls
   - Check for failed requests
   - Verify resource loading times

#### Solutions

**Solution 1: Optimize Database Queries**
```bash
# Check slow query log
docker-compose exec postgres psql -U promptlib -d promptlib -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

**Solution 2: Increase Resource Limits**
```yaml
# In docker-compose.yml, add resource limits
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
```

**Solution 3: Enable Caching**
```bash
# Ensure Redis is running and configured
docker-compose ps redis
docker-compose exec redis redis-cli ping
```

### Issue: High Memory Usage

#### Symptoms
- System becomes slow
- Out of memory errors
- Services crash unexpectedly

#### Solutions

**Solution 1: Monitor Memory Usage**
```bash
# Check container memory usage
docker stats

# Check system memory
free -h
```

**Solution 2: Optimize Application Settings**
```bash
# Reduce cache size in .env
CACHE_MAX_SIZE=100MB
MAX_CONCURRENT_REQUESTS=10

docker-compose restart
```

## UI and Display Issues

### Issue: Interface Not Responsive

#### Symptoms
- Layout breaks on mobile devices
- Elements overlap or are cut off
- Scrolling doesn't work properly

#### Solutions

**Solution 1: Clear Browser Cache**
1. Clear browser cache and cookies
2. Hard refresh the page
3. Try different browser

**Solution 2: Check CSS Loading**
1. Open developer tools
2. Check if CSS files are loading
3. Look for 404 errors in Network tab

### Issue: Dark/Light Mode Not Working

#### Symptoms
- Theme toggle doesn't work
- Stuck in one theme mode
- Theme resets after refresh

#### Solutions

**Solution 1: Clear Local Storage**
```javascript
// In browser console
localStorage.removeItem('theme');
location.reload();
```

**Solution 2: Check Theme Configuration**
1. Go to user settings
2. Reset theme preference
3. Save and refresh page

### Issue: Real-time Updates Not Working

#### Symptoms
- Changes don't appear immediately
- No live notifications
- Collaborative features not working

#### Solutions

**Solution 1: Check WebSocket Connection**
```javascript
// In browser console
console.log(window.io?.connected);
```

**Solution 2: Verify WebSocket Configuration**
```bash
# Check if WebSocket port is accessible
telnet your-domain.com 443
```

## API and Integration Issues

### Issue: API Rate Limiting

#### Symptoms
- "Too many requests" errors
- 429 HTTP status codes
- API calls being rejected

#### Solutions

**Solution 1: Adjust Rate Limits**
```bash
# In .env file
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=200  # Increase limit

docker-compose restart backend
```

**Solution 2: Implement Request Queuing**
- Use exponential backoff in client code
- Implement request queuing for bulk operations
- Spread requests over time

### Issue: CORS Errors

#### Symptoms
- "CORS policy" errors in browser console
- API calls fail from frontend
- Cross-origin request blocked

#### Solutions

**Solution 1: Configure CORS Origins**
```bash
# In .env file
CORS_ORIGIN=https://your-frontend-domain.com,http://localhost:3000

docker-compose restart backend
```

**Solution 2: Check Request Headers**
- Ensure proper Content-Type headers
- Verify Authorization header format
- Check for custom headers causing issues

## System Administration Issues

### Issue: Cannot Access Admin Panel

#### Symptoms
- Admin menu not visible
- 403 errors when accessing admin routes
- Admin features not working

#### Solutions

**Solution 1: Verify Admin Role**
```bash
# Check user role
docker-compose exec postgres psql -U promptlib -d promptlib -c "SELECT username, role FROM users WHERE username='your-username';"

# Grant admin role
docker-compose exec postgres psql -U promptlib -d promptlib -c "UPDATE users SET role='admin' WHERE username='your-username';"
```

**Solution 2: Clear Session and Re-login**
1. Log out completely
2. Clear browser storage
3. Log back in with admin account

### Issue: System Monitoring Not Working

#### Symptoms
- No metrics displayed
- Grafana dashboards empty
- Prometheus not collecting data

#### Solutions

**Solution 1: Check Monitoring Services**
```bash
# Verify monitoring stack is running
docker-compose ps prometheus grafana

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets
```

**Solution 2: Verify Metrics Endpoints**
```bash
# Test metrics endpoint
curl http://localhost:8000/metrics
```

## Database and Storage Issues

### Issue: Database Connection Failed

#### Symptoms
- "Database connection error" messages
- 500 errors on API calls
- Application won't start

#### Solutions

**Solution 1: Check Database Status**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test database connection
docker-compose exec postgres psql -U promptlib -d promptlib -c "SELECT 1;"
```

**Solution 2: Reset Database Connection**
```bash
# Restart database service
docker-compose restart postgres

# Wait for database to be ready
sleep 10

# Restart backend
docker-compose restart backend
```

### Issue: Storage Space Full

#### Symptoms
- Cannot save new prompts
- File upload failures
- "No space left on device" errors

#### Solutions

**Solution 1: Clean Up Storage**
```bash
# Check disk usage
df -h

# Clean up old backups
find /backups -name "*.sql" -mtime +30 -delete

# Clean up logs
find /var/log -name "*.log" -mtime +7 -delete
```

**Solution 2: Increase Storage**
- Add more disk space to server
- Move data to larger volume
- Configure log rotation

## Monitoring and Logging

### Enabling Debug Logging

```bash
# Enable debug logging in .env
LOG_LEVEL=debug

# Restart services
docker-compose restart

# View debug logs
docker-compose logs -f backend | grep DEBUG
```

### Collecting Diagnostic Information

```bash
#!/bin/bash
# Create diagnostic report
echo "=== System Information ===" > diagnostic.txt
uname -a >> diagnostic.txt
docker --version >> diagnostic.txt
docker-compose --version >> diagnostic.txt

echo "=== Service Status ===" >> diagnostic.txt
docker-compose ps >> diagnostic.txt

echo "=== Resource Usage ===" >> diagnostic.txt
free -h >> diagnostic.txt
df -h >> diagnostic.txt

echo "=== Recent Logs ===" >> diagnostic.txt
docker-compose logs --tail=100 >> diagnostic.txt

echo "Diagnostic report saved to diagnostic.txt"
```

### Log Analysis Commands

```bash
# Find error patterns
docker-compose logs backend | grep -i error | tail -20

# Monitor real-time logs
docker-compose logs -f backend frontend

# Search for specific issues
docker-compose logs | grep -i "connection\|timeout\|failed"

# Check authentication issues
docker-compose logs backend | grep -i "auth\|login\|token"
```

## Getting Additional Help

### Before Contacting Support

1. **Gather information**:
   - Error messages and screenshots
   - Browser and version
   - Steps to reproduce the issue
   - System configuration details

2. **Try basic troubleshooting**:
   - Restart services
   - Clear browser cache
   - Check system resources
   - Review recent changes

3. **Check documentation**:
   - Review relevant user guides
   - Check API documentation
   - Look for similar issues in troubleshooting guide

### Support Channels

- **Documentation**: Check user guides and admin documentation
- **System Administrator**: Contact your local system administrator
- **Technical Support**: For bugs and technical issues
- **Community Forums**: For general questions and discussions

### Providing Diagnostic Information

When reporting issues, include:

```bash
# System information
uname -a
docker --version
docker-compose --version

# Service status
docker-compose ps

# Recent logs (sanitize sensitive information)
docker-compose logs --tail=50 backend

# Configuration (remove sensitive data)
cat .env | grep -v SECRET | grep -v PASSWORD | grep -v KEY
```

---

*This troubleshooting guide is regularly updated based on common issues and user feedback. If you encounter an issue not covered here, please report it so we can improve this documentation.*