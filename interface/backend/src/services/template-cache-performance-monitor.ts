/**
 * Template Cache Performance Monitor Service
 * 
 * Advanced cache performance monitoring and optimization with multi-level caching strategy,
 * cache performance monitoring and metrics, cache hit rate optimization, and cache warming
 * and preloading strategies.
 */

import { getRedisService } from './redis-service.js';
import { getDatabaseService } from './database-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ErrorCode } from '../types/errors.js';
import { TemplateCategory } from '../types/prompt-templates.js';

export interface CachePerformanceConfig {
  enableAdvancedMetrics?: boolean;
  enablePredictiveWarming?: boolean;
  enableAdaptiveEviction?: boolean;
  performanceThresholds?: {
    hitRateWarning: number;
    hitRateCritical: number;
    responseTimeWarning: number;
    responseTimeCritical: number;
    memoryUsageWarning: number;
    memoryUsageCritical: number;
  };
  optimizationInterval?: number;
  metricsRetentionDays?: number;
}

export interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  memoryUsage: number;
  evictionRate: number;
  throughput: number;
  errorRate: number;
  hotKeys: Array<{ key: string; accessCount: number; hitRate: number }>;
  coldKeys: Array<{ key: string; lastAccessed: Date; accessCount: number }>;
}

export interface CacheOptimizationRecommendation {
  type: 'INCREASE_TTL' | 'DECREASE_TTL' | 'PRELOAD_KEY' | 'EVICT_KEY' | 'INCREASE_MEMORY' | 'OPTIMIZE_QUERY';
  key?: string;
  category?: TemplateCategory;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  expectedImpact: string;
  implementation: string;
}

export interface CacheHealthStatus {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'DEGRADED';
  issues: Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    recommendation?: string;
  }>;
  metrics: CachePerformanceMetrics;
  lastChecked: Date;
}

/**
 * Template Cache Performance Monitor Service
 */
export class TemplateCachePerformanceMonitor {
  private redis = getRedisService();
  private db = getDatabaseService();
  private config: Required<CachePerformanceConfig>;
  private metricsHistory: Map<string, number[]> = new Map();
  private optimizationTimer?: NodeJS.Timeout;
  private metricsCollectionTimer?: NodeJS.Timeout;

  constructor(config: CachePerformanceConfig = {}) {
    this.config = {
      enableAdvancedMetrics: true,
      enablePredictiveWarming: true,
      enableAdaptiveEviction: true,
      performanceThresholds: {
        hitRateWarning: 0.7,
        hitRateCritical: 0.5,
        responseTimeWarning: 50,
        responseTimeCritical: 100,
        memoryUsageWarning: 0.8,
        memoryUsageCritical: 0.95
      },
      optimizationInterval: 300000, // 5 minutes
      metricsRetentionDays: 7,
      ...config
    };

    this.startPerformanceMonitoring();
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  /**
   * Get comprehensive cache performance metrics
   */
  async getPerformanceMetrics(): Promise<CachePerformanceMetrics> {
    try {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);

      // Get basic cache statistics
      const basicStats = await this.getBasicCacheStats();

      // Get response time metrics
      const responseTimeMetrics = await this.getResponseTimeMetrics(oneHourAgo, now);

      // Get hot and cold keys
      const [hotKeys, coldKeys] = await Promise.all([
        this.getHotKeys(10),
        this.getColdKeys(10)
      ]);

      // Calculate throughput
      const throughput = await this.calculateThroughput(oneHourAgo, now);

      // Get error rate
      const errorRate = await this.getErrorRate(oneHourAgo, now);

      return {
        hitRate: basicStats.hitRate,
        missRate: basicStats.missRate,
        averageResponseTime: responseTimeMetrics.average,
        p95ResponseTime: responseTimeMetrics.p95,
        p99ResponseTime: responseTimeMetrics.p99,
        memoryUsage: basicStats.memoryUsage,
        evictionRate: basicStats.evictionRate,
        throughput,
        errorRate,
        hotKeys,
        coldKeys
      };

    } catch (error) {
      logger.error('Failed to get cache performance metrics', error);
      throw new AppError('Failed to get cache performance metrics', 500, ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Monitor cache health and detect issues
   */
  async checkCacheHealth(): Promise<CacheHealthStatus> {
    try {
      const metrics = await this.getPerformanceMetrics();
      const issues: CacheHealthStatus['issues'] = [];
      let overallStatus: CacheHealthStatus['status'] = 'HEALTHY';

      // Check hit rate
      if (metrics.hitRate < this.config.performanceThresholds.hitRateCritical) {
        issues.push({
          type: 'LOW_HIT_RATE',
          severity: 'CRITICAL',
          message: `Cache hit rate is critically low: ${(metrics.hitRate * 100).toFixed(1)}%`,
          recommendation: 'Consider increasing cache size or optimizing cache keys'
        });
        overallStatus = 'CRITICAL';
      } else if (metrics.hitRate < this.config.performanceThresholds.hitRateWarning) {
        issues.push({
          type: 'LOW_HIT_RATE',
          severity: 'HIGH',
          message: `Cache hit rate is below optimal: ${(metrics.hitRate * 100).toFixed(1)}%`,
          recommendation: 'Review cache warming strategy and key patterns'
        });
        if (overallStatus === 'HEALTHY') overallStatus = 'WARNING';
      }

      // Check response time
      if (metrics.averageResponseTime > this.config.performanceThresholds.responseTimeCritical) {
        issues.push({
          type: 'HIGH_RESPONSE_TIME',
          severity: 'CRITICAL',
          message: `Average response time is too high: ${metrics.averageResponseTime.toFixed(1)}ms`,
          recommendation: 'Optimize cache implementation or increase Redis resources'
        });
        overallStatus = 'CRITICAL';
      } else if (metrics.averageResponseTime > this.config.performanceThresholds.responseTimeWarning) {
        issues.push({
          type: 'HIGH_RESPONSE_TIME',
          severity: 'MEDIUM',
          message: `Average response time is elevated: ${metrics.averageResponseTime.toFixed(1)}ms`,
          recommendation: 'Monitor cache performance and consider optimization'
        });
        if (overallStatus === 'HEALTHY') overallStatus = 'WARNING';
      }

      // Check memory usage
      if (metrics.memoryUsage > this.config.performanceThresholds.memoryUsageCritical) {
        issues.push({
          type: 'HIGH_MEMORY_USAGE',
          severity: 'CRITICAL',
          message: `Memory usage is critically high: ${(metrics.memoryUsage * 100).toFixed(1)}%`,
          recommendation: 'Increase cache memory or implement more aggressive eviction'
        });
        overallStatus = 'CRITICAL';
      } else if (metrics.memoryUsage > this.config.performanceThresholds.memoryUsageWarning) {
        issues.push({
          type: 'HIGH_MEMORY_USAGE',
          severity: 'HIGH',
          message: `Memory usage is high: ${(metrics.memoryUsage * 100).toFixed(1)}%`,
          recommendation: 'Monitor memory usage and consider cache optimization'
        });
        if (overallStatus === 'HEALTHY') overallStatus = 'WARNING';
      }

      // Check eviction rate
      if (metrics.evictionRate > 0.1) {
        issues.push({
          type: 'HIGH_EVICTION_RATE',
          severity: 'HIGH',
          message: `High cache eviction rate: ${(metrics.evictionRate * 100).toFixed(1)}%`,
          recommendation: 'Increase cache size or optimize TTL settings'
        });
        if (overallStatus === 'HEALTHY') overallStatus = 'WARNING';
      }

      // Check error rate
      if (metrics.errorRate > 0.05) {
        issues.push({
          type: 'HIGH_ERROR_RATE',
          severity: 'HIGH',
          message: `High cache error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
          recommendation: 'Investigate cache connectivity and Redis health'
        });
        if (overallStatus === 'HEALTHY') overallStatus = 'DEGRADED';
      }

      return {
        status: overallStatus,
        issues,
        metrics,
        lastChecked: new Date()
      };

    } catch (error) {
      logger.error('Failed to check cache health', error);
      return {
        status: 'CRITICAL',
        issues: [{
          type: 'HEALTH_CHECK_FAILED',
          severity: 'CRITICAL',
          message: 'Unable to perform cache health check',
          recommendation: 'Check Redis connectivity and service status'
        }],
        metrics: {} as CachePerformanceMetrics,
        lastChecked: new Date()
      };
    }
  }

  /**
   * Generate cache optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<CacheOptimizationRecommendation[]> {
    try {
      const metrics = await this.getPerformanceMetrics();
      const recommendations: CacheOptimizationRecommendation[] = [];

      // Analyze hot keys for optimization opportunities
      for (const hotKey of metrics.hotKeys) {
        if (hotKey.hitRate < 0.8) {
          recommendations.push({
            type: 'INCREASE_TTL',
            key: hotKey.key,
            priority: 'HIGH',
            description: `Hot key "${hotKey.key}" has low hit rate despite high access count`,
            expectedImpact: 'Increase hit rate by 10-15%',
            implementation: 'Increase TTL from current value to 2x current value'
          });
        }
      }

      // Analyze cold keys for eviction
      for (const coldKey of metrics.coldKeys) {
        const daysSinceAccess = (Date.now() - coldKey.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceAccess > 1 && coldKey.accessCount < 5) {
          recommendations.push({
            type: 'EVICT_KEY',
            key: coldKey.key,
            priority: 'MEDIUM',
            description: `Cold key "${coldKey.key}" hasn't been accessed for ${daysSinceAccess.toFixed(1)} days`,
            expectedImpact: 'Free up cache memory for more active keys',
            implementation: 'Remove key from cache or reduce TTL significantly'
          });
        }
      }

      // Memory usage recommendations
      if (metrics.memoryUsage > 0.8) {
        recommendations.push({
          type: 'INCREASE_MEMORY',
          priority: 'HIGH',
          description: 'Cache memory usage is high, affecting performance',
          expectedImpact: 'Reduce eviction rate and improve hit rate',
          implementation: 'Increase Redis memory allocation or implement tiered caching'
        });
      }

      // Hit rate optimization
      if (metrics.hitRate < 0.7) {
        recommendations.push({
          type: 'PRELOAD_KEY',
          priority: 'HIGH',
          description: 'Low overall hit rate indicates need for better cache warming',
          expectedImpact: 'Improve hit rate by 15-25%',
          implementation: 'Implement predictive cache warming based on usage patterns'
        });
      }

      // Response time optimization
      if (metrics.averageResponseTime > 20) {
        recommendations.push({
          type: 'OPTIMIZE_QUERY',
          priority: 'MEDIUM',
          description: 'High response times indicate potential optimization opportunities',
          expectedImpact: 'Reduce average response time by 30-50%',
          implementation: 'Optimize cache key structure and implement connection pooling'
        });
      }

      return recommendations.sort((a, b) => {
        const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

    } catch (error) {
      logger.error('Failed to generate optimization recommendations', error);
      throw new AppError('Failed to generate optimization recommendations', 500, ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  // ============================================================================
  // Cache Warming and Preloading
  // ============================================================================

  /**
   * Implement predictive cache warming based on usage patterns
   */
  async performPredictiveWarming(): Promise<{ warmed: number; errors: string[] }> {
    if (!this.config.enablePredictiveWarming) {
      return { warmed: 0, errors: ['Predictive warming is disabled'] };
    }

    try {
      logger.info('Starting predictive cache warming');
      
      const errors: string[] = [];
      let warmedCount = 0;

      // Get usage patterns from the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const usagePatterns = await this.getUsagePatterns(sevenDaysAgo, new Date());

      // Identify templates likely to be accessed soon
      const candidatesForWarming = await this.identifyWarmingCandidates(usagePatterns);

      // Warm high-priority templates
      for (const candidate of candidatesForWarming) {
        try {
          await this.warmTemplate(candidate.templateId, candidate.category, candidate.key);
          warmedCount++;
          logger.debug('Template warmed predictively', { 
            templateId: candidate.templateId, 
            priority: candidate.priority 
          });
        } catch (error) {
          const errorMsg = `Failed to warm template ${candidate.templateId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.warn('Predictive warming failed for template', { 
            templateId: candidate.templateId, 
            error 
          });
        }
      }

      logger.info('Predictive cache warming completed', { warmedCount, errorCount: errors.length });
      return { warmed: warmedCount, errors };

    } catch (error) {
      logger.error('Predictive cache warming failed', error);
      return { warmed: 0, errors: [`Predictive warming failed: ${error instanceof Error ? error.message : 'Unknown error'}`] };
    }
  }

  /**
   * Warm specific template in cache
   */
  private async warmTemplate(templateId: string, category: TemplateCategory, key: string): Promise<void> {
    try {
      // Load template from database
      const result = await this.db.query(`
        SELECT * FROM prompt_templates 
        WHERE id = $1 AND is_active = true
      `, [templateId]);

      if (result.rows.length === 0) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const template = result.rows[0];
      const cacheKey = `template_cache:${category}:${key}`;
      
      // Store in cache with appropriate TTL
      const ttl = await this.calculateOptimalTTL(templateId);
      await this.redis.setex(cacheKey, ttl, JSON.stringify(template));

      // Record warming event
      await this.recordWarmingEvent(templateId, 'PREDICTIVE');

    } catch (error) {
      logger.error('Failed to warm template', { templateId, category, key, error });
      throw error;
    }
  }

  /**
   * Calculate optimal TTL for template based on usage patterns
   */
  private async calculateOptimalTTL(templateId: string): Promise<number> {
    try {
      // Get usage frequency from last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const usageResult = await this.db.query(`
        SELECT COUNT(*) as usage_count
        FROM prompt_template_usage 
        WHERE template_id = $1 AND created_at >= $2
      `, [templateId, thirtyDaysAgo]);

      const usageCount = parseInt(usageResult.rows[0]?.usage_count || '0');
      
      // Calculate TTL based on usage frequency
      if (usageCount > 1000) {
        return 7200; // 2 hours for very active templates
      } else if (usageCount > 100) {
        return 3600; // 1 hour for active templates
      } else if (usageCount > 10) {
        return 1800; // 30 minutes for moderately active templates
      } else {
        return 900; // 15 minutes for low-activity templates
      }

    } catch (error) {
      logger.error('Failed to calculate optimal TTL', { templateId, error });
      return 3600; // Default to 1 hour
    }
  }

  // ============================================================================
  // Adaptive Cache Management
  // ============================================================================

  /**
   * Implement adaptive eviction based on usage patterns
   */
  async performAdaptiveEviction(): Promise<{ evicted: number; errors: string[] }> {
    if (!this.config.enableAdaptiveEviction) {
      return { evicted: 0, errors: ['Adaptive eviction is disabled'] };
    }

    try {
      logger.info('Starting adaptive cache eviction');
      
      const errors: string[] = [];
      let evictedCount = 0;

      // Get current cache usage
      const cacheKeys = await this.redis.keys('template_cache:*');
      const cacheAnalysis = await this.analyzeCacheUsage(cacheKeys);

      // Identify candidates for eviction
      const evictionCandidates = cacheAnalysis.filter(item => 
        item.score < 0.3 && // Low utility score
        item.lastAccessed < Date.now() - (24 * 60 * 60 * 1000) // Not accessed in 24 hours
      );

      // Sort by lowest score first
      evictionCandidates.sort((a, b) => a.score - b.score);

      // Evict low-value cache entries
      for (const candidate of evictionCandidates.slice(0, 50)) { // Limit to 50 evictions per run
        try {
          await this.redis.del(candidate.key);
          evictedCount++;
          
          // Record eviction event
          await this.recordEvictionEvent(candidate.key, 'ADAPTIVE', candidate.score);
          
          logger.debug('Cache entry evicted adaptively', { 
            key: candidate.key, 
            score: candidate.score 
          });
        } catch (error) {
          const errorMsg = `Failed to evict cache key ${candidate.key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
        }
      }

      logger.info('Adaptive cache eviction completed', { evictedCount, errorCount: errors.length });
      return { evicted: evictedCount, errors };

    } catch (error) {
      logger.error('Adaptive cache eviction failed', error);
      return { evicted: 0, errors: [`Adaptive eviction failed: ${error instanceof Error ? error.message : 'Unknown error'}`] };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get basic cache statistics
   */
  private async getBasicCacheStats(): Promise<{
    hitRate: number;
    missRate: number;
    memoryUsage: number;
    evictionRate: number;
  }> {
    try {
      // Get hit/miss counts from Redis
      const hits = parseInt(await this.redis.get('cache_stats:hits') || '0');
      const misses = parseInt(await this.redis.get('cache_stats:misses') || '0');
      const evictions = parseInt(await this.redis.get('cache_stats:evictions') || '0');
      
      const totalRequests = hits + misses;
      const hitRate = totalRequests > 0 ? hits / totalRequests : 0;
      const missRate = totalRequests > 0 ? misses / totalRequests : 0;
      const evictionRate = totalRequests > 0 ? evictions / totalRequests : 0;

      // Get memory usage (simplified - would use Redis INFO in production)
      const memoryUsage = 0.6; // Placeholder

      return { hitRate, missRate, memoryUsage, evictionRate };

    } catch (error) {
      logger.error('Failed to get basic cache stats', error);
      return { hitRate: 0, missRate: 0, memoryUsage: 0, evictionRate: 0 };
    }
  }

  /**
   * Get response time metrics
   */
  private async getResponseTimeMetrics(startTime: number, endTime: number): Promise<{
    average: number;
    p95: number;
    p99: number;
  }> {
    try {
      // Get response times from metrics history
      const responseTimes = this.metricsHistory.get('response_times') || [];
      
      if (responseTimes.length === 0) {
        return { average: 0, p95: 0, p99: 0 };
      }

      const sortedTimes = [...responseTimes].sort((a, b) => a - b);
      const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p99Index = Math.floor(sortedTimes.length * 0.99);

      return {
        average,
        p95: sortedTimes[p95Index] || 0,
        p99: sortedTimes[p99Index] || 0
      };

    } catch (error) {
      logger.error('Failed to get response time metrics', error);
      return { average: 0, p95: 0, p99: 0 };
    }
  }

  /**
   * Get hot keys (most frequently accessed)
   */
  private async getHotKeys(limit: number): Promise<Array<{ key: string; accessCount: number; hitRate: number }>> {
    try {
      const keys = await this.redis.keys('template_cache:*');
      const keyStats: Array<{ key: string; accessCount: number; hitRate: number }> = [];

      for (const key of keys.slice(0, 100)) { // Limit analysis to prevent performance issues
        try {
          const accessCount = parseInt(await this.redis.get(`${key}:access_count`) || '0');
          const hits = parseInt(await this.redis.get(`${key}:hits`) || '0');
          const requests = parseInt(await this.redis.get(`${key}:requests`) || '1');
          const hitRate = hits / requests;

          if (accessCount > 0) {
            keyStats.push({ key, accessCount, hitRate });
          }
        } catch (error) {
          // Skip keys with errors
        }
      }

      return keyStats
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, limit);

    } catch (error) {
      logger.error('Failed to get hot keys', error);
      return [];
    }
  }

  /**
   * Get cold keys (least recently accessed)
   */
  private async getColdKeys(limit: number): Promise<Array<{ key: string; lastAccessed: Date; accessCount: number }>> {
    try {
      const keys = await this.redis.keys('template_cache:*');
      const keyStats: Array<{ key: string; lastAccessed: Date; accessCount: number }> = [];

      for (const key of keys.slice(0, 100)) {
        try {
          const lastAccessedStr = await this.redis.get(`${key}:last_accessed`);
          const accessCount = parseInt(await this.redis.get(`${key}:access_count`) || '0');
          
          if (lastAccessedStr) {
            const lastAccessed = new Date(parseInt(lastAccessedStr));
            keyStats.push({ key, lastAccessed, accessCount });
          }
        } catch (error) {
          // Skip keys with errors
        }
      }

      return keyStats
        .sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime())
        .slice(0, limit);

    } catch (error) {
      logger.error('Failed to get cold keys', error);
      return [];
    }
  }

  /**
   * Calculate throughput (requests per second)
   */
  private async calculateThroughput(startTime: number, endTime: number): Promise<number> {
    try {
      const hits = parseInt(await this.redis.get('cache_stats:hits') || '0');
      const misses = parseInt(await this.redis.get('cache_stats:misses') || '0');
      const totalRequests = hits + misses;
      const timeWindowSeconds = (endTime - startTime) / 1000;
      
      return timeWindowSeconds > 0 ? totalRequests / timeWindowSeconds : 0;

    } catch (error) {
      logger.error('Failed to calculate throughput', error);
      return 0;
    }
  }

  /**
   * Get error rate
   */
  private async getErrorRate(startTime: number, endTime: number): Promise<number> {
    try {
      const errors = parseInt(await this.redis.get('cache_stats:errors') || '0');
      const hits = parseInt(await this.redis.get('cache_stats:hits') || '0');
      const misses = parseInt(await this.redis.get('cache_stats:misses') || '0');
      const totalRequests = hits + misses + errors;
      
      return totalRequests > 0 ? errors / totalRequests : 0;

    } catch (error) {
      logger.error('Failed to get error rate', error);
      return 0;
    }
  }

  /**
   * Get usage patterns for predictive warming
   */
  private async getUsagePatterns(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT 
          template_id,
          COUNT(*) as usage_count,
          AVG(EXTRACT(HOUR FROM created_at)) as avg_hour,
          AVG(EXTRACT(DOW FROM created_at)) as avg_day_of_week,
          MAX(created_at) as last_used
        FROM prompt_template_usage 
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY template_id
        HAVING COUNT(*) > 5
        ORDER BY usage_count DESC
      `, [startDate, endDate]);

      return result.rows;

    } catch (error) {
      logger.error('Failed to get usage patterns', error);
      return [];
    }
  }

  /**
   * Identify candidates for cache warming
   */
  private async identifyWarmingCandidates(usagePatterns: any[]): Promise<Array<{
    templateId: string;
    category: TemplateCategory;
    key: string;
    priority: number;
  }>> {
    const candidates: Array<{
      templateId: string;
      category: TemplateCategory;
      key: string;
      priority: number;
    }> = [];

    for (const pattern of usagePatterns) {
      try {
        // Get template details
        const templateResult = await this.db.query(`
          SELECT category, key FROM prompt_templates WHERE id = $1
        `, [pattern.template_id]);

        if (templateResult.rows.length > 0) {
          const template = templateResult.rows[0];
          
          // Calculate priority based on usage patterns
          const currentHour = new Date().getHours();
          const currentDayOfWeek = new Date().getDay();
          
          const hourDiff = Math.abs(currentHour - pattern.avg_hour);
          const dayDiff = Math.abs(currentDayOfWeek - pattern.avg_day_of_week);
          
          // Higher priority for templates likely to be used soon
          const timePriority = Math.max(0, 10 - hourDiff - dayDiff);
          const usagePriority = Math.min(10, Math.log(pattern.usage_count + 1) * 2);
          const recencyPriority = Math.max(0, 10 - ((Date.now() - new Date(pattern.last_used).getTime()) / (1000 * 60 * 60 * 24)));
          
          const priority = (timePriority + usagePriority + recencyPriority) / 3;

          if (priority > 5) { // Only warm high-priority templates
            candidates.push({
              templateId: pattern.template_id,
              category: template.category,
              key: template.key,
              priority
            });
          }
        }
      } catch (error) {
        logger.debug('Failed to analyze template for warming', { templateId: pattern.template_id, error });
      }
    }

    return candidates.sort((a, b) => b.priority - a.priority).slice(0, 20); // Top 20 candidates
  }

  /**
   * Analyze cache usage for adaptive eviction
   */
  private async analyzeCacheUsage(cacheKeys: string[]): Promise<Array<{
    key: string;
    score: number;
    lastAccessed: number;
    accessCount: number;
  }>> {
    const analysis: Array<{
      key: string;
      score: number;
      lastAccessed: number;
      accessCount: number;
    }> = [];

    for (const key of cacheKeys) {
      try {
        const lastAccessedStr = await this.redis.get(`${key}:last_accessed`);
        const accessCount = parseInt(await this.redis.get(`${key}:access_count`) || '0');
        const hits = parseInt(await this.redis.get(`${key}:hits`) || '0');
        const requests = parseInt(await this.redis.get(`${key}:requests`) || '1');
        
        const lastAccessed = lastAccessedStr ? parseInt(lastAccessedStr) : Date.now();
        const hitRate = hits / requests;
        const ageHours = (Date.now() - lastAccessed) / (1000 * 60 * 60);
        
        // Calculate utility score (0-1, higher is better)
        const accessScore = Math.min(1, accessCount / 100);
        const hitRateScore = hitRate;
        const recencyScore = Math.max(0, 1 - (ageHours / 168)); // Decay over 1 week
        
        const score = (accessScore * 0.4) + (hitRateScore * 0.3) + (recencyScore * 0.3);

        analysis.push({
          key,
          score,
          lastAccessed,
          accessCount
        });

      } catch (error) {
        // Skip keys with errors
      }
    }

    return analysis;
  }

  /**
   * Record cache warming event
   */
  private async recordWarmingEvent(templateId: string, type: string): Promise<void> {
    try {
      await this.redis.client.lPush('cache_warming_events', JSON.stringify({
        templateId,
        type,
        timestamp: Date.now()
      }));
      
      // Keep only last 1000 events
      await this.redis.client.lTrim('cache_warming_events', 0, 999);
    } catch (error) {
      logger.debug('Failed to record warming event', { templateId, type, error });
    }
  }

  /**
   * Record cache eviction event
   */
  private async recordEvictionEvent(key: string, type: string, score: number): Promise<void> {
    try {
      await this.redis.client.lPush('cache_eviction_events', JSON.stringify({
        key,
        type,
        score,
        timestamp: Date.now()
      }));
      
      // Keep only last 1000 events
      await this.redis.client.lTrim('cache_eviction_events', 0, 999);
    } catch (error) {
      logger.debug('Failed to record eviction event', { key, type, score, error });
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Start optimization timer
    this.optimizationTimer = setInterval(async () => {
      try {
        if (this.config.enablePredictiveWarming) {
          await this.performPredictiveWarming();
        }
        
        if (this.config.enableAdaptiveEviction) {
          await this.performAdaptiveEviction();
        }
      } catch (error) {
        logger.error('Scheduled cache optimization failed', error);
      }
    }, this.config.optimizationInterval);

    // Start metrics collection timer
    this.metricsCollectionTimer = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error('Metrics collection failed', error);
      }
    }, 60000); // Collect metrics every minute
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics();
      
      // Store metrics in history
      const responseTimes = this.metricsHistory.get('response_times') || [];
      responseTimes.push(metrics.averageResponseTime);
      
      // Keep only last 1000 measurements
      if (responseTimes.length > 1000) {
        responseTimes.shift();
      }
      
      this.metricsHistory.set('response_times', responseTimes);

      // Store other metrics
      const hitRates = this.metricsHistory.get('hit_rates') || [];
      hitRates.push(metrics.hitRate);
      if (hitRates.length > 1000) {
        hitRates.shift();
      }
      this.metricsHistory.set('hit_rates', hitRates);

    } catch (error) {
      logger.debug('Failed to collect metrics', error);
    }
  }

  /**
   * Shutdown the performance monitor
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Template Cache Performance Monitor');

    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }

    if (this.metricsCollectionTimer) {
      clearInterval(this.metricsCollectionTimer);
    }

    logger.info('Template Cache Performance Monitor shut down successfully');
  }
}

// Singleton instance
let templateCachePerformanceMonitorInstance: TemplateCachePerformanceMonitor | null = null;

/**
 * Initialize the Template Cache Performance Monitor service
 */
export function initializeTemplateCachePerformanceMonitor(config?: CachePerformanceConfig): TemplateCachePerformanceMonitor {
  if (!templateCachePerformanceMonitorInstance) {
    templateCachePerformanceMonitorInstance = new TemplateCachePerformanceMonitor(config);
    logger.info('Template Cache Performance Monitor initialized');
  }
  return templateCachePerformanceMonitorInstance;
}

/**
 * Get the Template Cache Performance Monitor service instance
 */
export function getTemplateCachePerformanceMonitor(): TemplateCachePerformanceMonitor {
  if (!templateCachePerformanceMonitorInstance) {
    throw new AppError(
      'Template Cache Performance Monitor not initialized',
      500,
      ErrorCode.SERVICE_UNAVAILABLE
    );
  }
  return templateCachePerformanceMonitorInstance;
}