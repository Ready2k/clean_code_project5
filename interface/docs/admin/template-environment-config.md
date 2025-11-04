# Template System Environment Configuration

This document describes all environment variables used to configure the template management system.

## Core Template System Variables

### TEMPLATE_CACHE_TTL
- **Description**: Time-to-live for template cache entries in seconds
- **Default**: `3600` (1 hour)
- **Valid Values**: `60` to `86400` (1 minute to 24 hours)
- **Example**: `TEMPLATE_CACHE_TTL=7200`

Controls how long templates are cached in memory before being refreshed from the database.

### TEMPLATE_CACHE_SIZE
- **Description**: Maximum number of templates to keep in cache
- **Default**: `1000`
- **Valid Values**: `100` to `10000`
- **Example**: `TEMPLATE_CACHE_SIZE=2000`

Limits memory usage by controlling cache size. Increase for systems with many templates.

### TEMPLATE_CACHE_ENABLED
- **Description**: Enable or disable template caching
- **Default**: `true`
- **Valid Values**: `true`, `false`
- **Example**: `TEMPLATE_CACHE_ENABLED=false`

Disable caching for development or debugging. Keep enabled in production for performance.

### TEMPLATE_ANALYTICS_ENABLED
- **Description**: Enable template usage analytics collection
- **Default**: `true`
- **Valid Values**: `true`, `false`
- **Example**: `TEMPLATE_ANALYTICS_ENABLED=true`

Controls whether the system collects usage statistics and performance metrics.

### TEMPLATE_FALLBACK_ENABLED
- **Description**: Enable fallback to hardcoded prompts if template system fails
- **Default**: `true`
- **Valid Values**: `true`, `false`
- **Example**: `TEMPLATE_FALLBACK_ENABLED=false`

Provides system resilience by falling back to hardcoded prompts during template system failures.

## Template Validation Configuration

### TEMPLATE_VALIDATION_STRICT
- **Description**: Enable strict template validation
- **Default**: `true`
- **Valid Values**: `true`, `false`
- **Example**: `TEMPLATE_VALIDATION_STRICT=false`

When enabled, templates must pass all validation checks before being saved or activated.

### TEMPLATE_MAX_CONTENT_LENGTH
- **Description**: Maximum template content length in characters
- **Default**: `50000`
- **Valid Values**: `1000` to `100000`
- **Example**: `TEMPLATE_MAX_CONTENT_LENGTH=75000`

Prevents extremely large templates that could impact performance.

### TEMPLATE_MAX_VARIABLES
- **Description**: Maximum number of variables per template
- **Default**: `50`
- **Valid Values**: `10` to `200`
- **Example**: `TEMPLATE_MAX_VARIABLES=100`

Limits template complexity by restricting variable count.

### TEMPLATE_MAX_VERSIONS
- **Description**: Maximum number of versions to keep per template
- **Default**: `100`
- **Valid Values**: `10` to `1000`
- **Example**: `TEMPLATE_MAX_VERSIONS=200`

Controls storage usage by limiting version history.

## Performance Configuration

### TEMPLATE_RENDER_TIMEOUT
- **Description**: Template rendering timeout in milliseconds
- **Default**: `5000` (5 seconds)
- **Valid Values**: `1000` to `30000`
- **Example**: `TEMPLATE_RENDER_TIMEOUT=10000`

Prevents hanging requests by timing out slow template rendering operations.

### TEMPLATE_CONCURRENT_RENDERS
- **Description**: Maximum concurrent template rendering operations
- **Default**: `100`
- **Valid Values**: `10` to `1000`
- **Example**: `TEMPLATE_CONCURRENT_RENDERS=200`

Controls system load by limiting concurrent template processing.

### TEMPLATE_BATCH_SIZE
- **Description**: Batch size for bulk template operations
- **Default**: `50`
- **Valid Values**: `10` to `500`
- **Example**: `TEMPLATE_BATCH_SIZE=100`

Optimizes bulk operations like import/export by processing templates in batches.

## Database Configuration

### TEMPLATE_DB_POOL_SIZE
- **Description**: Database connection pool size for template operations
- **Default**: `10`
- **Valid Values**: `5` to `50`
- **Example**: `TEMPLATE_DB_POOL_SIZE=20`

Controls database connection usage for template-related queries.

### TEMPLATE_DB_TIMEOUT
- **Description**: Database query timeout for template operations in milliseconds
- **Default**: `10000` (10 seconds)
- **Valid Values**: `5000` to `60000`
- **Example**: `TEMPLATE_DB_TIMEOUT=15000`

Prevents hanging database queries during template operations.

## Security Configuration

### TEMPLATE_SECURITY_SCAN_ENABLED
- **Description**: Enable security scanning of template content
- **Default**: `true`
- **Valid Values**: `true`, `false`
- **Example**: `TEMPLATE_SECURITY_SCAN_ENABLED=true`

Scans template content for potential security vulnerabilities.

### TEMPLATE_CONTENT_SANITIZATION
- **Description**: Enable content sanitization for template input
- **Default**: `true`
- **Valid Values**: `true`, `false`
- **Example**: `TEMPLATE_CONTENT_SANITIZATION=false`

Sanitizes template content to prevent injection attacks.

### TEMPLATE_AUDIT_LOGGING
- **Description**: Enable detailed audit logging for template operations
- **Default**: `true`
- **Valid Values**: `true`, `false`
- **Example**: `TEMPLATE_AUDIT_LOGGING=true`

Logs all template changes for security and compliance purposes.

## Development and Testing

### TEMPLATE_MOCK_ENABLED
- **Description**: Enable mock template responses for testing
- **Default**: `false`
- **Valid Values**: `true`, `false`
- **Example**: `TEMPLATE_MOCK_ENABLED=true`

Enables mock templates in development and testing environments only.

### TEMPLATE_DEBUG_LOGGING
- **Description**: Enable debug logging for template operations
- **Default**: `false`
- **Valid Values**: `true`, `false`
- **Example**: `TEMPLATE_DEBUG_LOGGING=true`

Provides detailed logging for troubleshooting template issues.

### TEMPLATE_METRICS_ENABLED
- **Description**: Enable detailed performance metrics collection
- **Default**: `true`
- **Valid Values**: `true`, `false`
- **Example**: `TEMPLATE_METRICS_ENABLED=false`

Collects detailed performance metrics for monitoring and optimization.

## Environment-Specific Configurations

### Development Environment
```bash
# Development settings for faster iteration
TEMPLATE_CACHE_TTL=300
TEMPLATE_CACHE_SIZE=100
TEMPLATE_VALIDATION_STRICT=false
TEMPLATE_DEBUG_LOGGING=true
TEMPLATE_MOCK_ENABLED=true
TEMPLATE_FALLBACK_ENABLED=true
```

### Staging Environment
```bash
# Staging settings similar to production but with more logging
TEMPLATE_CACHE_TTL=1800
TEMPLATE_CACHE_SIZE=500
TEMPLATE_VALIDATION_STRICT=true
TEMPLATE_DEBUG_LOGGING=true
TEMPLATE_MOCK_ENABLED=false
TEMPLATE_FALLBACK_ENABLED=true
TEMPLATE_AUDIT_LOGGING=true
```

### Production Environment
```bash
# Production settings optimized for performance and security
TEMPLATE_CACHE_TTL=3600
TEMPLATE_CACHE_SIZE=2000
TEMPLATE_VALIDATION_STRICT=true
TEMPLATE_DEBUG_LOGGING=false
TEMPLATE_MOCK_ENABLED=false
TEMPLATE_FALLBACK_ENABLED=true
TEMPLATE_AUDIT_LOGGING=true
TEMPLATE_SECURITY_SCAN_ENABLED=true
TEMPLATE_CONTENT_SANITIZATION=true
TEMPLATE_METRICS_ENABLED=true
```

## Configuration Validation

The system validates all environment variables on startup:

### Required Variables
These variables must be set for the template system to function:
- `DATABASE_URL` (inherited from main system)
- `REDIS_URL` (inherited from main system)

### Optional Variables
All template-specific variables have sensible defaults and are optional.

### Invalid Configuration Handling
- **Invalid Values**: System logs warning and uses default value
- **Missing Required**: System fails to start with clear error message
- **Type Errors**: System attempts type conversion, falls back to default

## Configuration Examples

### Docker Compose
```yaml
services:
  backend:
    environment:
      # Template System Configuration
      - TEMPLATE_CACHE_TTL=3600
      - TEMPLATE_CACHE_SIZE=1000
      - TEMPLATE_ANALYTICS_ENABLED=true
      - TEMPLATE_VALIDATION_STRICT=true
```

### Kubernetes ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: template-config
data:
  TEMPLATE_CACHE_TTL: "3600"
  TEMPLATE_CACHE_SIZE: "1000"
  TEMPLATE_ANALYTICS_ENABLED: "true"
  TEMPLATE_VALIDATION_STRICT: "true"
```

### Environment File (.env)
```bash
# Template System Configuration
TEMPLATE_CACHE_TTL=3600
TEMPLATE_CACHE_SIZE=1000
TEMPLATE_CACHE_ENABLED=true
TEMPLATE_ANALYTICS_ENABLED=true
TEMPLATE_FALLBACK_ENABLED=true
TEMPLATE_VALIDATION_STRICT=true
```

## Monitoring Configuration

### Health Check Variables
```bash
# Health check configuration
TEMPLATE_HEALTH_CHECK_ENABLED=true
TEMPLATE_HEALTH_CHECK_INTERVAL=30000
TEMPLATE_HEALTH_CHECK_TIMEOUT=5000
```

### Metrics Collection
```bash
# Metrics configuration
TEMPLATE_METRICS_ENABLED=true
TEMPLATE_METRICS_INTERVAL=60000
TEMPLATE_METRICS_RETENTION=86400
```

## Troubleshooting Configuration Issues

### Common Problems

1. **Templates Not Caching**
   - Check `TEMPLATE_CACHE_ENABLED=true`
   - Verify Redis connection
   - Check cache size limits

2. **Slow Template Rendering**
   - Increase `TEMPLATE_RENDER_TIMEOUT`
   - Optimize `TEMPLATE_CONCURRENT_RENDERS`
   - Check database performance

3. **Validation Errors**
   - Review `TEMPLATE_VALIDATION_STRICT` setting
   - Check template content limits
   - Verify variable constraints

### Configuration Testing
```bash
# Test configuration with curl
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:8000/api/system/config/templates

# Check system health
curl http://localhost:8000/api/system/health
```

## Security Considerations

### Sensitive Variables
These variables may contain sensitive information:
- Database connection strings (inherited)
- Encryption keys (inherited)
- API tokens (if used for external integrations)

### Best Practices
1. **Use Environment Variables**: Never hardcode sensitive values
2. **Rotate Secrets**: Regularly update encryption keys and tokens
3. **Limit Access**: Restrict who can modify configuration
4. **Audit Changes**: Log all configuration modifications
5. **Validate Input**: Ensure all configuration values are validated

### Production Security
```bash
# Secure production settings
TEMPLATE_SECURITY_SCAN_ENABLED=true
TEMPLATE_CONTENT_SANITIZATION=true
TEMPLATE_AUDIT_LOGGING=true
TEMPLATE_DEBUG_LOGGING=false
```

This configuration guide ensures proper setup and operation of the template management system across all environments.