# Template System Monitoring and Alerting Guide

## Overview

This guide provides comprehensive monitoring and alerting strategies for the Template System, ensuring optimal performance, security, and reliability in production environments.

## Monitoring Architecture

### Monitoring Stack Components

1. **Application Metrics**: Prometheus + Grafana
2. **Log Aggregation**: ELK Stack (Elasticsearch, Logstash, Kibana)
3. **APM**: Application Performance Monitoring
4. **Uptime Monitoring**: External monitoring service
5. **Security Monitoring**: Custom security event tracking

### Data Flow
```
Template System → Metrics Endpoint → Prometheus → Grafana Dashboards
                ↓
              Application Logs → Logstash → Elasticsearch → Kibana
                ↓
              Security Events → Security Monitor → Alert Manager
```

## Key Performance Indicators (KPIs)

### System Health Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Application Uptime | 99.9% | < 99.5% | < 99% |
| Response Time (P95) | < 200ms | > 500ms | > 1000ms |
| Error Rate | < 0.1% | > 1% | > 5% |
| Memory Usage | < 80% | > 85% | > 95% |
| CPU Usage | < 70% | > 80% | > 90% |
| Database Connections | < 80% | > 90% | > 95% |

### Template-Specific Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Template Load Time | < 50ms | > 100ms | > 200ms |
| Cache Hit Rate | > 90% | < 80% | < 70% |
| Template Validation Success | > 99% | < 95% | < 90% |
| Security Violations | 0/hour | > 5/hour | > 20/hour |
| Template Usage Growth | > 10%/week | < 5%/week | Negative |

## Monitoring Configuration

### 1. Application Metrics Collection

**Prometheus Configuration** (`prometheus.yml`):
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "template_system_rules.yml"

scrape_configs:
  - job_name: 'template-system'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
    scrape_interval: 10s
    
  - job_name: 'template-cache'
    static_configs:
      - targets: ['localhost:6379']
    metrics_path: '/metrics'
    
  - job_name: 'template-database'
    static_configs:
      - targets: ['localhost:5432']
```

**Custom Metrics Endpoint** (`/metrics`):
```typescript
// Template-specific metrics
template_requests_total{method="GET|POST|PUT|DELETE", status="success|error"}
template_request_duration_seconds{operation="create|read|update|delete|validate|render"}
template_cache_hits_total
template_cache_misses_total
template_validation_errors_total{type="syntax|security|variable"}
template_security_violations_total{type="injection|xss|malicious"}
template_active_count{category="enhancement|question|custom"}
template_usage_count{template_id, category}
```

### 2. Grafana Dashboards

**Template System Overview Dashboard**:
```json
{
  "dashboard": {
    "title": "Template System Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(template_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(template_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Cache Performance",
        "type": "stat",
        "targets": [
          {
            "expr": "template_cache_hits_total / (template_cache_hits_total + template_cache_misses_total) * 100",
            "legendFormat": "Cache Hit Rate %"
          }
        ]
      },
      {
        "title": "Security Violations",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(template_security_violations_total[1h])",
            "legendFormat": "{{type}}"
          }
        ]
      }
    ]
  }
}
```

**Template Performance Dashboard**:
```json
{
  "dashboard": {
    "title": "Template Performance",
    "panels": [
      {
        "title": "Template Load Times",
        "type": "heatmap",
        "targets": [
          {
            "expr": "rate(template_request_duration_seconds_bucket{operation=\"read\"}[5m])",
            "legendFormat": "Load Time Distribution"
          }
        ]
      },
      {
        "title": "Most Used Templates",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, rate(template_usage_count[1h]))",
            "legendFormat": "{{template_id}}"
          }
        ]
      },
      {
        "title": "Template Errors by Type",
        "type": "pie",
        "targets": [
          {
            "expr": "sum by (type) (rate(template_validation_errors_total[1h]))",
            "legendFormat": "{{type}}"
          }
        ]
      }
    ]
  }
}
```

### 3. Log Monitoring Configuration

**Logstash Configuration** (`logstash.conf`):
```ruby
input {
  file {
    path => "/var/log/prompt-library/application.log"
    start_position => "beginning"
    codec => json
  }
  
  file {
    path => "/var/log/prompt-library/template-audit.log"
    start_position => "beginning"
    codec => json
    tags => ["template-audit"]
  }
  
  file {
    path => "/var/log/prompt-library/security.log"
    start_position => "beginning"
    codec => json
    tags => ["security"]
  }
}

filter {
  if "template" in [service] {
    mutate {
      add_tag => ["template-system"]
    }
  }
  
  if [level] == "ERROR" {
    mutate {
      add_tag => ["error"]
    }
  }
  
  if "security" in [tags] {
    mutate {
      add_tag => ["security-event"]
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "template-system-%{+YYYY.MM.dd}"
  }
}
```

**Kibana Dashboards**:

1. **Template System Logs Dashboard**
   - Log volume over time
   - Error rate trends
   - Top error messages
   - User activity patterns

2. **Security Events Dashboard**
   - Security violations by type
   - Suspicious user activity
   - Failed authentication attempts
   - Template injection attempts

3. **Performance Logs Dashboard**
   - Slow query analysis
   - Cache performance logs
   - Database connection issues
   - Memory usage patterns

## Alerting Rules

### 1. Prometheus Alerting Rules

**Template System Alerts** (`template_system_rules.yml`):
```yaml
groups:
  - name: template_system_alerts
    rules:
      # High Error Rate
      - alert: TemplateHighErrorRate
        expr: rate(template_requests_total{status="error"}[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in template system"
          description: "Template system error rate is {{ $value }} errors per second"
      
      # Critical Error Rate
      - alert: TemplateCriticalErrorRate
        expr: rate(template_requests_total{status="error"}[5m]) > 0.1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Critical error rate in template system"
          description: "Template system error rate is {{ $value }} errors per second"
      
      # Slow Response Time
      - alert: TemplateSlowResponse
        expr: histogram_quantile(0.95, rate(template_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow template response times"
          description: "95th percentile response time is {{ $value }} seconds"
      
      # Cache Performance
      - alert: TemplateLowCacheHitRate
        expr: template_cache_hits_total / (template_cache_hits_total + template_cache_misses_total) < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low template cache hit rate"
          description: "Cache hit rate is {{ $value }}%"
      
      # Security Violations
      - alert: TemplateSecurityViolations
        expr: rate(template_security_violations_total[1h]) > 5
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "High rate of template security violations"
          description: "{{ $value }} security violations per hour"
      
      # Database Connection Issues
      - alert: TemplateDatabaseConnections
        expr: template_database_connections_active / template_database_connections_max > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connection usage"
          description: "Database connection usage is {{ $value }}%"
      
      # Memory Usage
      - alert: TemplateHighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 / 1024 > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage in template system"
          description: "Memory usage is {{ $value }}GB"
```

### 2. Log-Based Alerts

**ELK Stack Watcher Alerts**:
```json
{
  "trigger": {
    "schedule": {
      "interval": "1m"
    }
  },
  "input": {
    "search": {
      "request": {
        "search_type": "query_then_fetch",
        "indices": ["template-system-*"],
        "body": {
          "query": {
            "bool": {
              "must": [
                {
                  "range": {
                    "@timestamp": {
                      "gte": "now-5m"
                    }
                  }
                },
                {
                  "term": {
                    "level": "ERROR"
                  }
                }
              ]
            }
          }
        }
      }
    }
  },
  "condition": {
    "compare": {
      "ctx.payload.hits.total": {
        "gt": 10
      }
    }
  },
  "actions": {
    "send_email": {
      "email": {
        "to": ["devops@company.com"],
        "subject": "High Error Rate in Template System",
        "body": "More than 10 errors detected in the last 5 minutes"
      }
    }
  }
}
```

### 3. Custom Security Alerts

**Security Event Monitor**:
```typescript
// Security alert thresholds
const SECURITY_THRESHOLDS = {
  INJECTION_ATTEMPTS: 5, // per hour
  FAILED_AUTH: 10, // per 15 minutes
  SUSPICIOUS_PATTERNS: 3, // per hour
  RATE_LIMIT_VIOLATIONS: 20 // per hour
};

// Security alert handler
export class SecurityAlertHandler {
  async checkSecurityThresholds(): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Check injection attempts
    const injectionAttempts = await this.getSecurityEvents(
      'TEMPLATE_INJECTION_ATTEMPT',
      oneHourAgo,
      now
    );
    
    if (injectionAttempts.length > SECURITY_THRESHOLDS.INJECTION_ATTEMPTS) {
      await this.sendSecurityAlert({
        type: 'HIGH_INJECTION_ATTEMPTS',
        count: injectionAttempts.length,
        threshold: SECURITY_THRESHOLDS.INJECTION_ATTEMPTS,
        timeframe: '1 hour'
      });
    }
    
    // Check failed authentication
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const failedAuth = await this.getSecurityEvents(
      'FAILED_AUTHENTICATION',
      fifteenMinutesAgo,
      now
    );
    
    if (failedAuth.length > SECURITY_THRESHOLDS.FAILED_AUTH) {
      await this.sendSecurityAlert({
        type: 'HIGH_FAILED_AUTH',
        count: failedAuth.length,
        threshold: SECURITY_THRESHOLDS.FAILED_AUTH,
        timeframe: '15 minutes'
      });
    }
  }
}
```

## Health Checks

### 1. Application Health Endpoints

**Basic Health Check** (`/health`):
```typescript
export async function healthCheck(): Promise<HealthStatus> {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkTemplateServices(),
    checkSecurityServices()
  ]);
  
  const status = checks.every(check => 
    check.status === 'fulfilled' && check.value.healthy
  ) ? 'healthy' : 'unhealthy';
  
  return {
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: checks[0].status === 'fulfilled' ? checks[0].value : { healthy: false },
      redis: checks[1].status === 'fulfilled' ? checks[1].value : { healthy: false },
      templates: checks[2].status === 'fulfilled' ? checks[2].value : { healthy: false },
      security: checks[3].status === 'fulfilled' ? checks[3].value : { healthy: false }
    }
  };
}
```

**Detailed Health Check** (`/health/detailed`):
```typescript
export async function detailedHealthCheck(): Promise<DetailedHealthStatus> {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      templateManager: await checkTemplateManagerHealth(),
      cacheManager: await checkCacheManagerHealth(),
      validationService: await checkValidationServiceHealth(),
      analyticsService: await checkAnalyticsServiceHealth(),
      securityService: await checkSecurityServiceHealth()
    },
    metrics: {
      activeTemplates: await getActiveTemplateCount(),
      cacheHitRate: await getCacheHitRate(),
      averageResponseTime: await getAverageResponseTime(),
      errorRate: await getErrorRate()
    }
  };
}
```

### 2. External Health Monitoring

**Uptime Monitoring Configuration**:
```yaml
# Pingdom/StatusCake configuration
monitors:
  - name: "Template System API"
    url: "https://api.company.com/health"
    method: "GET"
    expected_status: 200
    check_interval: 60 # seconds
    timeout: 30 # seconds
    
  - name: "Template Admin Interface"
    url: "https://admin.company.com/templates"
    method: "GET"
    expected_status: 200
    check_interval: 300 # seconds
    
  - name: "Template API Performance"
    url: "https://api.company.com/api/admin/templates"
    method: "GET"
    headers:
      Authorization: "Bearer ${HEALTH_CHECK_TOKEN}"
    expected_status: 200
    response_time_threshold: 2000 # ms
    check_interval: 120 # seconds
```

## Monitoring Automation

### 1. Automated Monitoring Scripts

**System Health Monitor** (`monitor-system.sh`):
```bash
#!/bin/bash

# System health monitoring script
LOG_FILE="/var/log/template-monitoring.log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=85
ALERT_THRESHOLD_DISK=90

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOG_FILE
}

check_system_resources() {
    # Check CPU usage
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    if (( $(echo "$CPU_USAGE > $ALERT_THRESHOLD_CPU" | bc -l) )); then
        log_message "WARNING: High CPU usage: ${CPU_USAGE}%"
        send_alert "High CPU usage: ${CPU_USAGE}%"
    fi
    
    # Check memory usage
    MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f", ($3/$2) * 100.0)}')
    if (( $(echo "$MEMORY_USAGE > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
        log_message "WARNING: High memory usage: ${MEMORY_USAGE}%"
        send_alert "High memory usage: ${MEMORY_USAGE}%"
    fi
    
    # Check disk usage
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt "$ALERT_THRESHOLD_DISK" ]; then
        log_message "WARNING: High disk usage: ${DISK_USAGE}%"
        send_alert "High disk usage: ${DISK_USAGE}%"
    fi
}

check_template_services() {
    # Check template API
    if ! curl -f -s http://localhost:8000/health > /dev/null; then
        log_message "ERROR: Template API health check failed"
        send_alert "Template API is not responding"
    fi
    
    # Check database connectivity
    if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        log_message "ERROR: Database connectivity check failed"
        send_alert "Database is not accessible"
    fi
    
    # Check Redis connectivity
    if ! redis-cli ping > /dev/null 2>&1; then
        log_message "ERROR: Redis connectivity check failed"
        send_alert "Redis is not accessible"
    fi
}

send_alert() {
    local message="$1"
    # Send to Slack/Teams/Email
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"Template System Alert: $message\"}" \
        "$SLACK_WEBHOOK_URL"
}

# Run checks
check_system_resources
check_template_services

log_message "Health check completed"
```

### 2. Performance Monitoring Automation

**Performance Baseline Script** (`performance-baseline.sh`):
```bash
#!/bin/bash

# Performance baseline monitoring
BASELINE_FILE="/var/log/template-performance-baseline.json"
CURRENT_METRICS_FILE="/tmp/current-metrics.json"

collect_metrics() {
    # Collect current performance metrics
    curl -s http://localhost:8000/metrics | grep template_ > $CURRENT_METRICS_FILE
    
    # Calculate averages
    RESPONSE_TIME=$(curl -s http://localhost:8000/api/admin/templates/metrics/response-time)
    CACHE_HIT_RATE=$(curl -s http://localhost:8000/api/admin/templates/metrics/cache-hit-rate)
    ERROR_RATE=$(curl -s http://localhost:8000/api/admin/templates/metrics/error-rate)
    
    # Create metrics JSON
    cat > $CURRENT_METRICS_FILE << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "response_time": $RESPONSE_TIME,
    "cache_hit_rate": $CACHE_HIT_RATE,
    "error_rate": $ERROR_RATE
}
EOF
}

compare_with_baseline() {
    if [ ! -f "$BASELINE_FILE" ]; then
        # Create initial baseline
        cp $CURRENT_METRICS_FILE $BASELINE_FILE
        echo "Baseline created"
        return
    fi
    
    # Compare with baseline
    BASELINE_RESPONSE_TIME=$(jq -r '.response_time' $BASELINE_FILE)
    CURRENT_RESPONSE_TIME=$(jq -r '.response_time' $CURRENT_METRICS_FILE)
    
    # Check for performance degradation (>20% slower)
    if (( $(echo "$CURRENT_RESPONSE_TIME > $BASELINE_RESPONSE_TIME * 1.2" | bc -l) )); then
        send_performance_alert "Response time degraded: ${CURRENT_RESPONSE_TIME}ms vs baseline ${BASELINE_RESPONSE_TIME}ms"
    fi
}

send_performance_alert() {
    local message="$1"
    echo "$(date) - PERFORMANCE ALERT: $message" >> /var/log/template-performance-alerts.log
    # Send alert via preferred method
}

# Execute monitoring
collect_metrics
compare_with_baseline
```

## Troubleshooting Runbooks

### 1. High Error Rate Runbook

**Symptoms**: Error rate > 5%

**Investigation Steps**:
1. Check application logs for error patterns
2. Verify database connectivity and performance
3. Check Redis connectivity and memory usage
4. Review recent deployments or configuration changes
5. Analyze error types and affected endpoints

**Resolution Steps**:
1. If database issues: Scale database or optimize queries
2. If cache issues: Restart Redis or clear cache
3. If application issues: Restart application or rollback deployment
4. If external dependency issues: Implement circuit breaker

### 2. Performance Degradation Runbook

**Symptoms**: Response time > 1000ms

**Investigation Steps**:
1. Check system resource usage (CPU, memory, disk)
2. Analyze database query performance
3. Review cache hit rates
4. Check for memory leaks
5. Analyze traffic patterns

**Resolution Steps**:
1. Scale application horizontally if needed
2. Optimize database queries
3. Increase cache TTL or memory allocation
4. Restart application to clear memory leaks
5. Implement rate limiting if traffic spike

### 3. Security Alert Runbook

**Symptoms**: Security violations > 20/hour

**Investigation Steps**:
1. Analyze security violation types and patterns
2. Identify source IPs and user accounts
3. Review template content for malicious patterns
4. Check for automated attack patterns
5. Verify security controls are functioning

**Resolution Steps**:
1. Block malicious IP addresses
2. Disable compromised user accounts
3. Increase security validation strictness
4. Implement additional rate limiting
5. Review and update security rules

## Monitoring Best Practices

### 1. Metric Collection
- Collect metrics at appropriate intervals (10-60 seconds)
- Use consistent naming conventions
- Include relevant labels and dimensions
- Avoid high-cardinality metrics
- Implement metric retention policies

### 2. Alerting Strategy
- Define clear severity levels (info, warning, critical)
- Avoid alert fatigue with appropriate thresholds
- Implement alert escalation procedures
- Use runbooks for common issues
- Test alerting mechanisms regularly

### 3. Dashboard Design
- Focus on key business and technical metrics
- Use appropriate visualization types
- Implement drill-down capabilities
- Include contextual information
- Design for different audiences (ops, dev, business)

### 4. Log Management
- Use structured logging (JSON format)
- Include correlation IDs for request tracking
- Implement log rotation and retention
- Use appropriate log levels
- Sanitize sensitive information

This monitoring guide should be reviewed and updated regularly to ensure it remains effective as the system evolves.