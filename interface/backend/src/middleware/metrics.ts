import { Request, Response, NextFunction } from 'express';
import { getSystemMonitoringService } from '../services/system-monitoring-service.js';
import { logger, performanceLogger, securityLogger } from '../utils/logger.js';
import promClient from 'prom-client';

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'prompt-library-backend',
  version: process.env.APP_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ 
  register,
  timeout: 10000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

// HTTP Metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'user_id'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register]
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register]
});

// Application Metrics
const promptOperations = new promClient.Counter({
  name: 'prompt_operations_total',
  help: 'Total number of prompt operations',
  labelNames: ['operation', 'status'],
  registers: [register]
});

const enhancementOperations = new promClient.Counter({
  name: 'enhancement_operations_total',
  help: 'Total number of enhancement operations',
  labelNames: ['provider', 'status'],
  registers: [register]
});

const authenticationAttempts = new promClient.Counter({
  name: 'authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status', 'method'],
  registers: [register]
});

const errorRate = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity'],
  registers: [register]
});

// Endpoint to expose metrics
export const metricsEndpoint = async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
};

/**
 * Middleware to record request metrics for system monitoring
 */
export function recordMetrics(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const startHrTime = process.hrtime();
  
  // Increment active connections
  activeConnections.inc();
  
  // Override res.end to capture response time and status
  const originalEnd = res.end;
  
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    const hrDuration = process.hrtime(startHrTime);
    const durationSeconds = hrDuration[0] + hrDuration[1] / 1e9;
    const success = res.statusCode < 400;
    
    try {
      const systemMonitoringService = getSystemMonitoringService();
      systemMonitoringService.recordRequest(responseTime, success);
      
      const route = req.route?.path || req.path;
      const userId = (req as any).user?.id || 'anonymous';
      
      // Record Prometheus metrics
      httpRequestsTotal.inc({
        method: req.method,
        route,
        status_code: res.statusCode.toString(),
        user_id: userId
      });
      
      httpRequestDuration.observe(
        {
          method: req.method,
          route,
          status_code: res.statusCode.toString()
        },
        durationSeconds
      );
      
      // Track errors in Prometheus
      if (!success) {
        const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
        const severity = res.statusCode >= 500 ? 'error' : 'warning';
        errorRate.inc({ type: errorType, severity });
      }
      
      // Log slow requests
      if (responseTime > 1000) {
        performanceLogger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          responseTime,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          requestId: (req as any).requestId
        });
        
        systemMonitoringService.addSystemEvent(
          'warning',
          'performance',
          `Slow request: ${req.method} ${req.path}`,
          {
            responseTime,
            statusCode: res.statusCode,
            method: req.method,
            path: req.path
          }
        );
      }
      
      // Log error responses
      if (!success) {
        logger.warn('Error response', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          requestId: (req as any).requestId
        });
        
        if (res.statusCode >= 500) {
          systemMonitoringService.addSystemEvent(
            'error',
            'system',
            `Server error: ${req.method} ${req.path}`,
            {
              statusCode: res.statusCode,
              responseTime,
              method: req.method,
              path: req.path
            }
          );
        }
      }
    } catch (error) {
      // Don't let metrics recording break the response
      logger.error('Failed to record request metrics:', error);
    }
    
    // Decrement active connections
    activeConnections.dec();
    
    // Call the original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

/**
 * Middleware to track API usage and generate events for monitoring
 */
export function trackAPIUsage(req: Request, res: Response, next: NextFunction): void {
  try {
    const systemMonitoringService = getSystemMonitoringService();
    
    // Track specific API endpoints (order matters - more specific first)
    if (req.path.includes('/enhance') && req.method === 'POST') {
      enhancementOperations.inc({ provider: 'unknown', status: 'initiated' });
      systemMonitoringService.addSystemEvent(
        'info',
        'service',
        'Prompt enhancement initiated',
        {
          method: req.method,
          path: req.path,
          userId: (req as any).user?.userId
        }
      );
    } else if (req.path.startsWith('/api/prompts') && req.method === 'POST') {
      promptOperations.inc({ operation: 'create', status: 'initiated' });
      systemMonitoringService.addSystemEvent(
        'info',
        'service',
        'Prompt created via API',
        {
          method: req.method,
          path: req.path,
          userId: (req as any).user?.userId
        }
      );
    } else if (req.path.startsWith('/api/connections') && req.method === 'POST') {
      systemMonitoringService.addSystemEvent(
        'info',
        'service',
        'LLM connection created',
        {
          method: req.method,
          path: req.path,
          userId: (req as any).user?.userId
        }
      );
    }
  } catch (error) {
    // Don't let tracking break the request
    logger.error('Failed to track API usage:', error);
  }
  
  next();
}

/**
 * Middleware to handle security events
 */
export function trackSecurityEvents(req: Request, res: Response, next: NextFunction): void {
  try {
    const systemMonitoringService = getSystemMonitoringService();
    
    // Track authentication attempts
    if (req.path === '/api/auth/login') {
      const status = res.statusCode === 200 ? 'success' : 'failure';
      authenticationAttempts.inc({ status, method: 'password' });
      
      if (res.statusCode === 401) {
        securityLogger.warn('Failed login attempt', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId
        });
        
        systemMonitoringService.addSystemEvent(
          'warning',
          'security',
          'Failed login attempt',
          {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          }
        );
      }
    }
    
    // Track unauthorized access attempts
    if (res.statusCode === 403) {
      securityLogger.warn('Unauthorized access attempt', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.userId,
        requestId: (req as any).requestId
      });
      
      systemMonitoringService.addSystemEvent(
        'warning',
        'security',
        'Unauthorized access attempt',
        {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: (req as any).user?.userId
        }
      );
    }
    
    // Track rate limit violations
    if (res.statusCode === 429) {
      securityLogger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        requestId: (req as any).requestId
      });
      
      systemMonitoringService.addSystemEvent(
        'warning',
        'security',
        'Rate limit exceeded',
        {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        }
      );
    }
  } catch (error) {
    // Don't let security tracking break the request
    logger.error('Failed to track security events:', error);
  }
  
  next();
}

// Export metrics for use in other modules
export const metrics = {
  httpRequestsTotal,
  httpRequestDuration,
  activeConnections,
  promptOperations,
  enhancementOperations,
  authenticationAttempts,
  errorRate
};

export { register };