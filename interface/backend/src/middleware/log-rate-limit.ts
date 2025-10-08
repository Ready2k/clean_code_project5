import { Request, Response, NextFunction } from 'express';
import { getRedisService } from '../services/redis-service.js';
import { logger } from '../utils/logger.js';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  maxLogEntries?: number;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create a rate limiter for log endpoints
 */
export function createLogRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    maxLogEntries = 1000,
    keyGenerator = (req) => req.ip || 'unknown'
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redisService = getRedisService();
      if (!redisService) {
        // If Redis is not available, allow the request but log a warning
        logger.warn('Redis not available for rate limiting, allowing request');
        return next();
      }

      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Create Redis keys
      const requestCountKey = `rate_limit:logs:requests:${key}`;
      const logCountKey = `rate_limit:logs:entries:${key}`;

      // Get current counts
      const [requestCount, logCount] = await Promise.all([
        redisService.get(requestCountKey).then(val => parseInt(val || '0', 10)),
        redisService.get(logCountKey).then(val => parseInt(val || '0', 10))
      ]);

      // Calculate log entries in current request
      let currentLogEntries = 1;
      if (req.body && Array.isArray(req.body.logs)) {
        currentLogEntries = req.body.logs.length;
      }

      // Check request rate limit
      if (requestCount >= maxRequests) {
        logger.warn(`Rate limit exceeded for log requests from ${key}: ${requestCount}/${maxRequests}`);
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many log requests. Please try again later.',
            retryAfter: Math.ceil(windowMs / 1000)
          },
          timestamp: new Date().toISOString()
        });
      }

      // Check log entries rate limit
      if (logCount + currentLogEntries > maxLogEntries) {
        logger.warn(`Log entries rate limit exceeded from ${key}: ${logCount + currentLogEntries}/${maxLogEntries}`);
        return res.status(429).json({
          success: false,
          error: {
            code: 'LOG_ENTRIES_LIMIT_EXCEEDED',
            message: 'Too many log entries. Please reduce logging frequency.',
            retryAfter: Math.ceil(windowMs / 1000)
          },
          timestamp: new Date().toISOString()
        });
      }

      // Increment counters
      const pipeline = redisService.multi();
      pipeline.incr(requestCountKey);
      pipeline.expire(requestCountKey, Math.ceil(windowMs / 1000));
      pipeline.incrby(logCountKey, currentLogEntries);
      pipeline.expire(logCountKey, Math.ceil(windowMs / 1000));
      
      await pipeline.exec();

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit-Requests': maxRequests.toString(),
        'X-RateLimit-Remaining-Requests': Math.max(0, maxRequests - requestCount - 1).toString(),
        'X-RateLimit-Limit-LogEntries': maxLogEntries.toString(),
        'X-RateLimit-Remaining-LogEntries': Math.max(0, maxLogEntries - logCount - currentLogEntries).toString(),
        'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
      });

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // If rate limiting fails, allow the request but log the error
      next();
    }
  };
}

/**
 * Rate limiter for individual log entries
 */
export const rateLimitSingleLog = createLogRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,    // 100 requests per minute
  maxLogEntries: 200   // 200 log entries per minute
});

/**
 * Rate limiter for batch log entries (more restrictive)
 */
export const rateLimitBatchLogs = createLogRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,     // 20 batch requests per minute
  maxLogEntries: 500   // 500 log entries per minute total
});