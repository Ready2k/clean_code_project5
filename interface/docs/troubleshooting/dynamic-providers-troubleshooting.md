# Dynamic Provider Management Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting information for the Dynamic Provider Management system, including common issues, diagnostic steps, and solutions.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Authentication Issues](#authentication-issues)
3. [Provider Configuration Problems](#provider-configuration-problems)
4. [Model Management Issues](#model-management-issues)
5. [Template Problems](#template-problems)
6. [Registry Issues](#registry-issues)
7. [Performance Problems](#performance-problems)
8. [Database Issues](#database-issues)
9. [Network and Connectivity](#network-and-connectivity)
10. [Error Code Reference](#error-code-reference)

## Quick Diagnostics

### System Health Check

First, verify the overall system health:

```bash
# Check system status
curl http://localhost:8000/api/system/health

# Check registry status (requires admin auth)
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/admin/providers/registry-status
```

### Common Diagnostic Commands

```bash
# List all providers with status
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8000/api/admin/providers"

# Check specific provider details
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8000/api/admin/providers/{provider-id}"

# Test provider connectivity
curl -X POST -H "Authorization: Bearer <token>" \
     "http://localhost:8000/api/admin/providers/{provider-id}/test"

# Check database connectivity
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8000/api/system/status"
```

## Authentication Issues

### Issue: 401 Unauthorized Error

**Symptoms:**
- All API requests return 401 status
- Error message: "Invalid or expired JWT token"

**Diagnostic Steps:**
1. Check token expiration:
   ```bash
   # Decode JWT token (replace with your token)
   echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." | base64 -d
   ```

2. Verify token format:
   ```bash
   # Should start with "Bearer "
   echo $AUTH_HEADER
   ```

3. Test with fresh login:
   ```bash
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "password"}'
   ```

**Solutions:**
- **Expired Token**: Use refresh token or login again
- **Invalid Format**: Ensure header is `Authorization: Bearer <token>`
- **Wrong Token**: Verify you're using the correct token for the environment

### Issue: 403 Forbidden Error

**Symptoms:**
- API returns 403 status
- Error message: "Admin role required for provider management"

**Diagnostic Steps:**
1. Check user role:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/auth/me
   ```

2. Verify admin permissions in database:
   ```sql
   SELECT id, username, role FROM users WHERE username = 'your-username';
   ```

**Solutions:**
- **Non-admin User**: Contact system administrator to grant admin role
- **Role Not Set**: Update user role in database or user management interface

## Provider Configuration Problems

### Issue: Provider Creation Fails

**Symptoms:**
- 400 Bad Request when creating provider
- Validation errors in response

**Common Validation Errors:**

#### Invalid Identifier Format
```json
{
  "error": {
    "code": "INVALID_IDENTIFIER",
    "message": "Provider identifier must be lowercase alphanumeric with hyphens only",
    "field": "identifier"
  }
}
```

**Solution:** Use format like `my-provider-name` (lowercase, alphanumeric, hyphens only)

#### Missing Authentication Configuration
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "validationErrors": [
      {
        "field": "authConfig.fields.apiKey",
        "message": "API key is required for api_key authentication"
      }
    ]
  }
}
```

**Solution:** Provide complete authentication configuration:
```json
{
  "authConfig": {
    "type": "api_key",
    "fields": {
      "apiKey": "your-api-key-here"
    },
    "headers": {
      "Authorization": "Bearer {{apiKey}}"
    }
  }
}
```

#### Invalid API Endpoint
```json
{
  "error": {
    "code": "INVALID_ENDPOINT",
    "message": "API endpoint must be a valid URL"
  }
}
```

**Solution:** Ensure endpoint is a complete, valid URL:
- ✅ `https://api.openai.com/v1`
- ❌ `api.openai.com`
- ❌ `openai.com/v1`

### Issue: Provider Test Failures

**Symptoms:**
- Provider test returns `success: false`
- Connection errors or authentication failures

**Diagnostic Steps:**

1. **Check Network Connectivity:**
   ```bash
   # Test basic connectivity
   curl -I https://api.openai.com/v1
   
   # Test with authentication
   curl -H "Authorization: Bearer sk-your-key" \
        https://api.openai.com/v1/models
   ```

2. **Verify Authentication:**
   ```bash
   # Test API key directly with provider
   curl -H "Authorization: Bearer your-api-key" \
        https://api.provider.com/v1/models
   ```

3. **Check Provider Status:**
   - Visit provider's status page
   - Check for service outages
   - Verify API key permissions

**Common Solutions:**

#### Invalid API Key
- Verify API key is correct and active
- Check key permissions and usage limits
- Regenerate key if necessary

#### Network Issues
- Check firewall rules
- Verify DNS resolution
- Test from different network if possible

#### Rate Limiting
- Check provider's rate limits
- Implement exponential backoff
- Consider upgrading API plan

### Issue: Provider Updates Not Reflected

**Symptoms:**
- Provider changes don't appear in connections
- Old configuration still being used

**Diagnostic Steps:**
1. Check registry status:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/admin/providers/registry-status
   ```

2. Check provider status:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        "http://localhost:8000/api/admin/providers/{provider-id}"
   ```

**Solutions:**
1. **Manual Registry Refresh:**
   ```bash
   curl -X POST -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/admin/providers/refresh-registry
   ```

2. **Restart Application** if registry is corrupted

3. **Check Database Consistency:**
   ```sql
   SELECT id, identifier, status, updated_at FROM providers;
   ```

## Model Management Issues

### Issue: Model Not Available

**Symptoms:**
- Model doesn't appear in provider's model list
- Model test fails with "not found" error

**Diagnostic Steps:**
1. Check model configuration:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        "http://localhost:8000/api/admin/models/{model-id}"
   ```

2. Test model directly with provider:
   ```bash
   curl -H "Authorization: Bearer your-api-key" \
        "https://api.provider.com/v1/models"
   ```

3. Check model status:
   ```sql
   SELECT id, identifier, status, provider_id FROM models WHERE identifier = 'model-name';
   ```

**Solutions:**
- **Incorrect Identifier**: Verify model identifier matches provider's API
- **Model Deprecated**: Update to newer model version
- **Status Inactive**: Change model status to 'active'
- **Provider Issue**: Check provider configuration

### Issue: Model Capabilities Mismatch

**Symptoms:**
- Model behaves differently than configured
- Features not working as expected

**Diagnostic Steps:**
1. Test model capabilities:
   ```bash
   curl -X POST -H "Authorization: Bearer <token>" \
        "http://localhost:8000/api/admin/models/{model-id}/test"
   ```

2. Compare with provider documentation
3. Check actual API responses

**Solutions:**
- Update model capabilities to match actual provider capabilities
- Test with provider's API directly to verify features
- Contact provider support for capability clarification

## Template Problems

### Issue: Template Application Fails

**Symptoms:**
- Template application returns validation errors
- Created provider doesn't work correctly

**Diagnostic Steps:**
1. Check template configuration:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        "http://localhost:8000/api/admin/provider-templates/{template-id}"
   ```

2. Validate customization parameters:
   ```json
   {
     "identifier": "my-provider",
     "name": "My Provider",
     "customizations": {
       "apiKey": "required-if-template-uses-it",
       "endpoint": "custom-endpoint-if-needed"
     }
   }
   ```

**Solutions:**
- **Missing Customizations**: Provide all required customization parameters
- **Invalid Template**: Check template configuration for errors
- **Conflicting Identifier**: Use unique provider identifier

### Issue: Template Not Found

**Symptoms:**
- Template doesn't appear in list
- 404 error when accessing template

**Diagnostic Steps:**
1. List all templates:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/admin/provider-templates
   ```

2. Check database:
   ```sql
   SELECT id, name, is_system FROM provider_templates;
   ```

**Solutions:**
- **Template Deleted**: Restore from backup or recreate
- **Database Issue**: Check database connectivity and integrity
- **Permission Issue**: Verify admin access

## Registry Issues

### Issue: Registry Out of Sync

**Symptoms:**
- Providers not appearing in connections
- Old provider configurations being used
- Registry status shows errors

**Diagnostic Steps:**
1. Check registry status:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/admin/providers/registry-status
   ```

2. Check application logs for registry errors
3. Verify database connectivity

**Solutions:**
1. **Manual Refresh:**
   ```bash
   curl -X POST -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/admin/providers/refresh-registry
   ```

2. **Clear Cache** (if using Redis):
   ```bash
   redis-cli FLUSHDB
   ```

3. **Restart Application** to reinitialize registry

### Issue: Registry Performance Problems

**Symptoms:**
- Slow provider loading
- Timeouts when accessing providers
- High memory usage

**Diagnostic Steps:**
1. Check registry performance metrics
2. Monitor database query performance
3. Check memory usage

**Solutions:**
- **Database Optimization**: Add indexes, optimize queries
- **Caching**: Implement or tune caching strategy
- **Resource Scaling**: Increase memory or CPU resources

## Performance Problems

### Issue: Slow API Responses

**Symptoms:**
- API requests taking longer than expected
- Timeouts on provider operations

**Diagnostic Steps:**
1. Check system resources:
   ```bash
   # CPU and memory usage
   top
   
   # Database connections
   ps aux | grep postgres
   ```

2. Monitor API response times:
   ```bash
   curl -w "@curl-format.txt" -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/admin/providers
   ```

3. Check database performance:
   ```sql
   SELECT query, mean_time, calls FROM pg_stat_statements 
   ORDER BY mean_time DESC LIMIT 10;
   ```

**Solutions:**
- **Database Optimization**: Add indexes, optimize queries
- **Connection Pooling**: Tune database connection pool settings
- **Caching**: Implement response caching
- **Resource Scaling**: Increase server resources

### Issue: High Memory Usage

**Symptoms:**
- Application consuming excessive memory
- Out of memory errors
- System slowdown

**Diagnostic Steps:**
1. Monitor memory usage:
   ```bash
   # Process memory usage
   ps aux --sort=-%mem | head
   
   # System memory
   free -h
   ```

2. Check for memory leaks in application logs
3. Monitor garbage collection (Node.js)

**Solutions:**
- **Memory Leaks**: Fix application memory leaks
- **Garbage Collection**: Tune GC settings
- **Resource Limits**: Set appropriate memory limits
- **Scaling**: Add more memory or scale horizontally

## Database Issues

### Issue: Database Connection Failures

**Symptoms:**
- 500 Internal Server Error
- Database connection timeout errors
- "Connection refused" errors

**Diagnostic Steps:**
1. Check database status:
   ```bash
   # PostgreSQL status
   systemctl status postgresql
   
   # Connection test
   psql -h localhost -U username -d database_name -c "SELECT 1;"
   ```

2. Check connection configuration:
   ```bash
   # Environment variables
   echo $DATABASE_URL
   echo $DB_HOST $DB_PORT $DB_NAME
   ```

3. Monitor connection pool:
   ```sql
   SELECT * FROM pg_stat_activity WHERE datname = 'your_database';
   ```

**Solutions:**
- **Database Down**: Start database service
- **Connection Limits**: Increase max_connections in PostgreSQL
- **Network Issues**: Check network connectivity
- **Credentials**: Verify database credentials

### Issue: Migration Failures

**Symptoms:**
- Database schema out of date
- Missing tables or columns
- Migration script errors

**Diagnostic Steps:**
1. Check migration status:
   ```bash
   # Check if tables exist
   psql -d database_name -c "\dt"
   
   # Check specific table structure
   psql -d database_name -c "\d providers"
   ```

2. Review migration logs
3. Check migration files for syntax errors

**Solutions:**
1. **Run Migrations Manually:**
   ```bash
   # Run specific migration
   psql -d database_name -f interface/backend/src/migrations/20250210120000_create_dynamic_providers.sql
   ```

2. **Reset Database** (development only):
   ```bash
   # Drop and recreate database
   dropdb database_name
   createdb database_name
   # Run all migrations
   ```

3. **Fix Migration Scripts**: Correct syntax errors in migration files

## Network and Connectivity

### Issue: Provider API Unreachable

**Symptoms:**
- Connection timeout errors
- DNS resolution failures
- SSL/TLS errors

**Diagnostic Steps:**
1. Test basic connectivity:
   ```bash
   # DNS resolution
   nslookup api.openai.com
   
   # Basic connectivity
   telnet api.openai.com 443
   
   # HTTPS connectivity
   curl -I https://api.openai.com
   ```

2. Check SSL certificates:
   ```bash
   openssl s_client -connect api.openai.com:443 -servername api.openai.com
   ```

3. Test from different networks

**Solutions:**
- **DNS Issues**: Configure proper DNS servers
- **Firewall**: Open required ports (80, 443)
- **Proxy**: Configure proxy settings if required
- **SSL Issues**: Update CA certificates

### Issue: Rate Limiting

**Symptoms:**
- 429 Too Many Requests errors
- Temporary API failures
- Degraded performance

**Diagnostic Steps:**
1. Check rate limit headers:
   ```bash
   curl -I -H "Authorization: Bearer <token>" \
        https://api.provider.com/v1/models
   ```

2. Monitor request frequency
3. Check provider's rate limit documentation

**Solutions:**
- **Implement Backoff**: Use exponential backoff for retries
- **Request Batching**: Batch multiple operations
- **Upgrade Plan**: Consider higher-tier API plan
- **Caching**: Cache responses to reduce API calls

## Error Code Reference

### HTTP Status Codes

| Code | Meaning | Common Causes | Solutions |
|------|---------|---------------|-----------|
| 400 | Bad Request | Invalid input data, validation errors | Check request format and required fields |
| 401 | Unauthorized | Missing/invalid JWT token | Login again or refresh token |
| 403 | Forbidden | Insufficient permissions | Verify admin role |
| 404 | Not Found | Resource doesn't exist | Check resource ID and existence |
| 409 | Conflict | Resource already exists | Use different identifier or update existing |
| 422 | Unprocessable Entity | Validation errors | Fix validation errors in request |
| 429 | Too Many Requests | Rate limiting | Implement backoff and retry logic |
| 500 | Internal Server Error | Server-side error | Check logs, contact support |
| 503 | Service Unavailable | Service temporarily down | Wait and retry, check service status |

### Application Error Codes

| Code | Description | Solutions |
|------|-------------|-----------|
| `INVALID_IDENTIFIER` | Provider/model identifier format invalid | Use lowercase alphanumeric with hyphens |
| `PROVIDER_NOT_FOUND` | Provider doesn't exist | Check provider ID and existence |
| `MODEL_NOT_FOUND` | Model doesn't exist | Check model ID and provider |
| `TEMPLATE_NOT_FOUND` | Template doesn't exist | Check template ID |
| `VALIDATION_ERROR` | Input validation failed | Fix validation errors |
| `AUTH_CONFIG_INVALID` | Authentication configuration invalid | Provide complete auth config |
| `CONNECTIVITY_ERROR` | Cannot connect to provider | Check network and credentials |
| `REGISTRY_ERROR` | Provider registry error | Refresh registry or restart |
| `DATABASE_ERROR` | Database operation failed | Check database connectivity |
| `IMPORT_ERROR` | Import operation failed | Validate import data format |

## Getting Help

### Log Analysis

Enable debug logging for detailed information:

```bash
# Environment variable
export DEBUG=dynamic-providers:*

# Application logs
tail -f /var/log/prompt-library/application.log

# Database logs
tail -f /var/log/postgresql/postgresql.log
```

### Support Information

When contacting support, include:

1. **Error Details**: Full error message and stack trace
2. **Request ID**: From error response headers
3. **Environment**: Development, staging, or production
4. **Steps to Reproduce**: Exact steps that caused the issue
5. **Configuration**: Relevant configuration (without sensitive data)
6. **Logs**: Application and database logs around the time of error

### Useful Commands for Support

```bash
# System information
uname -a
node --version
npm --version

# Application status
curl http://localhost:8000/api/system/health
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/admin/providers/registry-status

# Database status
psql -c "SELECT version();"
psql -c "SELECT count(*) FROM providers;"

# Network connectivity
curl -I https://api.openai.com
curl -I https://api.anthropic.com
```

This troubleshooting guide should help resolve most common issues with the Dynamic Provider Management system. For issues not covered here, please contact support with detailed information about the problem.