---
inclusion: fileMatch
fileMatchPattern: "**/docker*"
---

# Deployment and Operations Guidelines

## Container Strategy

### Docker Configuration
- Use multi-stage builds for optimized production images
- Separate containers for frontend, backend, database, and cache
- Use Docker Compose for orchestration in development and production
- Implement proper health checks for all services
- Use non-root users in containers for security

### Environment Management
- Maintain separate configurations for development, staging, and production
- Use environment-specific Docker Compose files
- Never include secrets in Docker images
- Use Docker secrets or external secret management

## Database Operations

### PostgreSQL Management
- Use connection pooling for better performance
- Implement proper backup and recovery procedures
- Use migrations for schema changes
- Monitor query performance and optimize slow queries
- Set up read replicas for high-availability scenarios

### Redis Configuration
- Configure appropriate memory limits and eviction policies
- Use Redis for session storage and application caching
- Implement proper key expiration strategies
- Monitor memory usage and connection counts

## Monitoring and Observability

### Logging Standards
- Use structured logging (JSON format) for all services
- Include correlation IDs for request tracing
- Log at appropriate levels (ERROR, WARN, INFO, DEBUG)
- Centralize logs for analysis and alerting
- Implement log rotation and retention policies

### Metrics Collection
- Use Prometheus for metrics collection
- Monitor application performance, database queries, and system resources
- Set up alerts for critical system conditions
- Track business metrics (prompt creation, enhancement usage, etc.)

### Health Checks
- Implement comprehensive health check endpoints
- Monitor database connectivity and external service availability
- Use health checks for container orchestration decisions
- Include dependency checks in health status

## Security Operations

### Access Control
- Implement principle of least privilege
- Use role-based access control (RBAC) for user permissions
- Regularly audit user access and permissions
- Implement proper session management and timeout policies

### Data Protection
- Encrypt sensitive data at rest using AES-256-GCM
- Use TLS 1.3 for all network communications
- Implement proper input validation and sanitization
- Regular security scanning of dependencies and containers

## Backup and Recovery

### Data Backup Strategy
- Automated daily backups of PostgreSQL databases
- Point-in-time recovery capability
- Regular backup restoration testing
- Offsite backup storage for disaster recovery

### Application Recovery
- Document recovery procedures for all services
- Implement graceful degradation for service failures
- Use circuit breakers for external service dependencies
- Maintain runbooks for common operational scenarios