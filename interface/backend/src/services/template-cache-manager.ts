/**
 * Template Cache Manager Service
 * 
 * Redis-based caching layer with LRU eviction, cache warming for critical templates,
 * intelligent cache invalidation on template updates, and cache performance monitoring.
 */

import { getRedisService } from './redis-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ServiceUnavailableError, ErrorCode } from '../types/errors.js';
import { TemplateCategory, TemplateInfo, CacheStats } from '../types/prompt-templates.js';

export interface TemplateCacheConfig {
  keyPrefix?: string;
  defaultTtl?: number;
  maxCacheSize?: number;
  enableMetrics?: boolean;
  warmupTemplates?: Array<{ category: TemplateCategory; key: string }>;
  evictionPolicy?: 'lru' | 'ttl' | 'lfu';
}

export interface CacheEntry {
  template: TemplateInfo;
  cachedAt: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  averageResponseTime: number;
  memoryUsage: number;
}

/**
 * Template Cache Manager Service
 */
export class TemplateCacheManager {
  private redis = getRedisService();
  private config: Required<TemplateCacheConfig>;
  private metrics: CacheMetrics;
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: TemplateCacheConfig = {}) {
    this.config = {
      keyPrefix: 'template_cache:',
      defaultTtl: 3600, // 1 hour
      maxCacheSize: 1000, // Maximum number of cached templates
      enableMetrics: true,
      warmupTemplates: [],
      evictionPolicy: 'lru',
      ...config
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      memoryUsage: 0
    };

    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  // ============================================================================
  // Cache Operations
  // ============================================================================

  /**
   * Get template from cache
   */
  async get(key: string): Promise<TemplateInfo | null> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const cacheKey = this.getCacheKey(key);
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);
        
        // Check if entry has expired
        if (this.isExpired(entry)) {
          await this.invalidate(key);
          this.recordMiss(startTime);
          return null;
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        await this.redis.setex(cacheKey, entry.ttl, JSON.stringify(entry));

        this.recordHit(startTime);
        logger.debug('Cache hit', { key, accessCount: entry.accessCount });
        return entry.template;
      }

      this.recordMiss(startTime);
      return null;

    } catch (error) {
      logger.error('Cache get operation failed', { key, error });
      this.recordMiss(startTime);
      return null; // Fail gracefully
    }
  }

  /**
   * Set template in cache
   */
  async set(key: string, template: TemplateInfo, ttl?: number): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      const cacheTtl = ttl || this.config.defaultTtl;
      
      const entry: CacheEntry = {
        template,
        cachedAt: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
        ttl: cacheTtl
      };

      // Check cache size and evict if necessary
      await this.enforceMaxSize();

      await this.redis.setex(cacheKey, cacheTtl, JSON.stringify(entry));
      
      // Update cache metadata
      await this.updateCacheMetadata(key, entry);

      logger.debug('Template cached', { key, ttl: cacheTtl });

    } catch (error) {
      logger.error('Cache set operation failed', { key, error });
      throw new ServiceUnavailableError('Cache operation failed');
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      const result = await this.redis.del(cacheKey);
      
      if (result > 0) {
        await this.removeCacheMetadata(key);
        logger.debug('Cache entry invalidated', { key });
      }

    } catch (error) {
      logger.error('Cache invalidation failed', { key, error });
      throw new ServiceUnavailableError('Cache operation failed');
    }
  }

  /**
   * Invalidate cache entries by category
   */
  async invalidateCategory(category: TemplateCategory): Promise<void> {
    try {
      const pattern = this.getCacheKey(`${category}:*`);
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.redis.del(key)));
        
        // Remove metadata for invalidated keys
        for (const key of keys) {
          const originalKey = this.extractOriginalKey(key);
          await this.removeCacheMetadata(originalKey);
        }
        
        logger.info('Cache category invalidated', { category, count: keys.length });
      }

    } catch (error) {
      logger.error('Cache category invalidation failed', { category, error });
      throw new ServiceUnavailableError('Cache operation failed');
    }
  }

  /**
   * Invalidate all cache entries
   */
  async invalidateAll(): Promise<void> {
    try {
      const pattern = this.getCacheKey('*');
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.redis.del(key)));
        await this.clearCacheMetadata();
        
        this.metrics.evictions += keys.length;
        logger.info('All cache entries invalidated', { count: keys.length });
      }

    } catch (error) {
      logger.error('Cache invalidation failed', error);
      throw new ServiceUnavailableError('Cache operation failed');
    }
  }

  // ============================================================================
  // Cache Warming
  // ============================================================================

  /**
   * Warm cache with critical templates
   */
  async warmCache(templates: TemplateInfo[]): Promise<void> {
    logger.info('Starting cache warming', { count: templates.length });

    const warmupPromises = templates.map(async (template) => {
      try {
        const key = `${template.category}:${template.key}`;
        await this.set(key, template);
        logger.debug('Template warmed', { key });
      } catch (error) {
        logger.warn('Failed to warm template', { 
          key: `${template.category}:${template.key}`, 
          error 
        });
      }
    });

    await Promise.allSettled(warmupPromises);
    logger.info('Cache warming completed', { count: templates.length });
  }

  /**
   * Warm cache with predefined critical templates
   */
  async warmCriticalTemplates(templateLoader: (category: TemplateCategory, key: string) => Promise<TemplateInfo>): Promise<void> {
    if (this.config.warmupTemplates.length === 0) {
      logger.debug('No critical templates configured for warming');
      return;
    }

    logger.info('Warming critical templates', { count: this.config.warmupTemplates.length });

    const warmupPromises = this.config.warmupTemplates.map(async ({ category, key }) => {
      try {
        const template = await templateLoader(category, key);
        const cacheKey = `${category}:${key}`;
        await this.set(cacheKey, template);
        logger.debug('Critical template warmed', { category, key });
      } catch (error) {
        logger.warn('Failed to warm critical template', { category, key, error });
      }
    });

    await Promise.allSettled(warmupPromises);
    logger.info('Critical template warming completed');
  }

  // ============================================================================
  // Cache Size Management
  // ============================================================================

  /**
   * Enforce maximum cache size using configured eviction policy
   */
  private async enforceMaxSize(): Promise<void> {
    try {
      const currentSize = await this.getCacheSize();
      
      if (currentSize >= this.config.maxCacheSize) {
        const evictCount = Math.ceil(this.config.maxCacheSize * 0.1); // Evict 10%
        await this.evictEntries(evictCount);
        
        this.metrics.evictions += evictCount;
        logger.info('Cache entries evicted', { count: evictCount, policy: this.config.evictionPolicy });
      }

    } catch (error) {
      logger.error('Failed to enforce cache size limit', error);
    }
  }

  /**
   * Evict cache entries based on eviction policy
   */
  private async evictEntries(count: number): Promise<void> {
    const pattern = this.getCacheKey('*');
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return;
    }

    let keysToEvict: string[] = [];

    switch (this.config.evictionPolicy) {
      case 'lru':
        keysToEvict = await this.getLRUKeys(keys, count);
        break;
      case 'lfu':
        keysToEvict = await this.getLFUKeys(keys, count);
        break;
      case 'ttl':
        keysToEvict = await this.getTTLKeys(keys, count);
        break;
      default:
        keysToEvict = keys.slice(0, count); // Random eviction
    }

    // Evict selected keys
    await Promise.all(keysToEvict.map(key => this.redis.del(key)));
    
    // Remove metadata for evicted keys
    for (const key of keysToEvict) {
      const originalKey = this.extractOriginalKey(key);
      await this.removeCacheMetadata(originalKey);
    }
  }

  /**
   * Get least recently used keys
   */
  private async getLRUKeys(keys: string[], count: number): Promise<string[]> {
    const keyData: Array<{ key: string; lastAccessed: number }> = [];

    for (const key of keys) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          keyData.push({ key, lastAccessed: entry.lastAccessed });
        }
      } catch (error) {
        // Skip invalid entries
        keyData.push({ key, lastAccessed: 0 });
      }
    }

    return keyData
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .slice(0, count)
      .map(item => item.key);
  }

  /**
   * Get least frequently used keys
   */
  private async getLFUKeys(keys: string[], count: number): Promise<string[]> {
    const keyData: Array<{ key: string; accessCount: number }> = [];

    for (const key of keys) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          keyData.push({ key, accessCount: entry.accessCount });
        }
      } catch (error) {
        // Skip invalid entries
        keyData.push({ key, accessCount: 0 });
      }
    }

    return keyData
      .sort((a, b) => a.accessCount - b.accessCount)
      .slice(0, count)
      .map(item => item.key);
  }

  /**
   * Get keys with shortest TTL
   */
  private async getTTLKeys(keys: string[], count: number): Promise<string[]> {
    const keyData: Array<{ key: string; ttl: number }> = [];

    for (const key of keys) {
      try {
        const ttl = await this.redis.ttl(key);
        keyData.push({ key, ttl });
      } catch (error) {
        // Skip invalid entries
        keyData.push({ key, ttl: -1 });
      }
    }

    return keyData
      .sort((a, b) => a.ttl - b.ttl)
      .slice(0, count)
      .map(item => item.key);
  }

  // ============================================================================
  // Cache Statistics and Monitoring
  // ============================================================================

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const hitRate = this.metrics.totalRequests > 0 
      ? this.metrics.hits / this.metrics.totalRequests 
      : 0;
    
    const missRate = this.metrics.totalRequests > 0 
      ? this.metrics.misses / this.metrics.totalRequests 
      : 0;

    return {
      hitRate,
      missRate,
      totalRequests: this.metrics.totalRequests,
      cacheSize: 0, // Would need to calculate current size
      memoryUsage: this.metrics.memoryUsage,
      evictions: this.metrics.evictions
    };
  }

  /**
   * Get detailed cache metrics
   */
  async getDetailedMetrics(): Promise<{
    stats: CacheStats;
    topTemplates: Array<{ key: string; accessCount: number; hitRate: number }>;
    performanceMetrics: { averageResponseTime: number; p95ResponseTime: number };
  }> {
    const stats = this.getCacheStats();
    
    // Get top accessed templates
    const topTemplates = await this.getTopAccessedTemplates(10);
    
    // Performance metrics would be calculated from stored data
    const performanceMetrics = {
      averageResponseTime: this.metrics.averageResponseTime,
      p95ResponseTime: 0 // Would need to calculate from stored response times
    };

    return {
      stats,
      topTemplates,
      performanceMetrics
    };
  }

  /**
   * Get top accessed templates
   */
  private async getTopAccessedTemplates(limit: number): Promise<Array<{ key: string; accessCount: number; hitRate: number }>> {
    try {
      const pattern = this.getCacheKey('*');
      const keys = await this.redis.keys(pattern);
      
      const templateData: Array<{ key: string; accessCount: number; hitRate: number }> = [];

      for (const key of keys) {
        try {
          const cached = await this.redis.get(key);
          if (cached) {
            const entry: CacheEntry = JSON.parse(cached);
            const originalKey = this.extractOriginalKey(key);
            
            templateData.push({
              key: originalKey,
              accessCount: entry.accessCount,
              hitRate: 1.0 // Simplified - would need more detailed tracking
            });
          }
        } catch (error) {
          // Skip invalid entries
        }
      }

      return templateData
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, limit);

    } catch (error) {
      logger.error('Failed to get top accessed templates', error);
      return [];
    }
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      memoryUsage: 0
    };
    
    logger.info('Cache metrics reset');
  }

  // ============================================================================
  // Cache Health and Maintenance
  // ============================================================================

  /**
   * Check cache health
   */
  async checkHealth(): Promise<{
    isHealthy: boolean;
    issues: string[];
    metrics: CacheStats;
  }> {
    const issues: string[] = [];
    let isHealthy = true;

    try {
      // Check Redis connectivity
      await this.redis.ping();
    } catch (error) {
      issues.push('Redis connection failed');
      isHealthy = false;
    }

    // Check cache hit rate
    const stats = this.getCacheStats();
    if (stats.hitRate < 0.5 && stats.totalRequests > 100) {
      issues.push('Low cache hit rate (< 50%)');
    }

    // Check memory usage
    if (stats.memoryUsage > 0.9) {
      issues.push('High memory usage (> 90%)');
    }

    // Check eviction rate
    const evictionRate = stats.totalRequests > 0 ? stats.evictions / stats.totalRequests : 0;
    if (evictionRate > 0.1) {
      issues.push('High eviction rate (> 10%)');
    }

    return {
      isHealthy,
      issues,
      metrics: stats
    };
  }

  /**
   * Perform cache maintenance
   */
  async performMaintenance(): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    logger.info('Starting cache maintenance');
    
    const errors: string[] = [];
    let cleaned = 0;

    try {
      // Remove expired entries
      const expiredCount = await this.removeExpiredEntries();
      cleaned += expiredCount;

      // Compact cache if needed
      const currentSize = await this.getCacheSize();
      if (currentSize > this.config.maxCacheSize * 0.8) {
        const compactCount = Math.ceil(currentSize * 0.1);
        await this.evictEntries(compactCount);
        cleaned += compactCount;
      }

      logger.info('Cache maintenance completed', { cleaned, errors: errors.length });

    } catch (error) {
      const errorMsg = `Cache maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      logger.error('Cache maintenance failed', error);
    }

    return { cleaned, errors };
  }

  /**
   * Remove expired cache entries
   */
  private async removeExpiredEntries(): Promise<number> {
    const pattern = this.getCacheKey('*');
    const keys = await this.redis.keys(pattern);
    let removedCount = 0;

    for (const key of keys) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          if (this.isExpired(entry)) {
            await this.redis.del(key);
            const originalKey = this.extractOriginalKey(key);
            await this.removeCacheMetadata(originalKey);
            removedCount++;
          }
        }
      } catch (error) {
        // Remove invalid entries
        await this.redis.del(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get cache key with prefix
   */
  private getCacheKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Extract original key from cache key
   */
  private extractOriginalKey(cacheKey: string): string {
    return cacheKey.replace(this.config.keyPrefix, '');
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    const expirationTime = entry.cachedAt + (entry.ttl * 1000);
    return now > expirationTime;
  }

  /**
   * Get current cache size
   */
  private async getCacheSize(): Promise<number> {
    const pattern = this.getCacheKey('*');
    const keys = await this.redis.keys(pattern);
    return keys.length;
  }

  /**
   * Record cache hit
   */
  private recordHit(startTime: number): void {
    this.metrics.hits++;
    this.updateAverageResponseTime(startTime);
  }

  /**
   * Record cache miss
   */
  private recordMiss(startTime: number): void {
    this.metrics.misses++;
    this.updateAverageResponseTime(startTime);
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(startTime: number): void {
    const responseTime = Date.now() - startTime;
    const totalRequests = this.metrics.hits + this.metrics.misses;
    
    if (totalRequests === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    }
  }

  /**
   * Update cache metadata
   */
  private async updateCacheMetadata(key: string, entry: CacheEntry): Promise<void> {
    try {
      const metadataKey = `${this.config.keyPrefix}metadata:${key}`;
      const metadata = {
        cachedAt: entry.cachedAt,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
        ttl: entry.ttl
      };
      
      await this.redis.setex(metadataKey, entry.ttl, JSON.stringify(metadata));
    } catch (error) {
      logger.debug('Failed to update cache metadata', { key, error });
    }
  }

  /**
   * Remove cache metadata
   */
  private async removeCacheMetadata(key: string): Promise<void> {
    try {
      const metadataKey = `${this.config.keyPrefix}metadata:${key}`;
      await this.redis.del(metadataKey);
    } catch (error) {
      logger.debug('Failed to remove cache metadata', { key, error });
    }
  }

  /**
   * Clear all cache metadata
   */
  private async clearCacheMetadata(): Promise<void> {
    try {
      const pattern = `${this.config.keyPrefix}metadata:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.redis.del(key)));
      }
    } catch (error) {
      logger.debug('Failed to clear cache metadata', error);
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        // Update memory usage metrics
        const pattern = this.getCacheKey('*');
        const keys = await this.redis.keys(pattern);
        this.metrics.memoryUsage = keys.length / this.config.maxCacheSize;
        
        logger.debug('Cache metrics updated', this.metrics);
      } catch (error) {
        logger.debug('Failed to update cache metrics', error);
      }
    }, 60000); // Update every minute
  }

  /**
   * Stop metrics collection
   */
  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  /**
   * Shutdown the cache manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Template Cache Manager');
    
    this.stopMetricsCollection();
    
    // Optionally persist metrics or perform cleanup
    logger.info('Template Cache Manager shut down successfully');
  }
}

// Singleton instance
let templateCacheManagerInstance: TemplateCacheManager | null = null;

/**
 * Initialize the Template Cache Manager service
 */
export function initializeTemplateCacheManager(config?: TemplateCacheConfig): TemplateCacheManager {
  if (!templateCacheManagerInstance) {
    templateCacheManagerInstance = new TemplateCacheManager(config);
    logger.info('Template Cache Manager initialized');
  }
  return templateCacheManagerInstance;
}

/**
 * Get the Template Cache Manager service instance
 */
export function getTemplateCacheManager(): TemplateCacheManager {
  if (!templateCacheManagerInstance) {
    throw new AppError(
      'Template Cache Manager not initialized',
      500,
      ErrorCode.SERVICE_UNAVAILABLE
    );
  }
  return templateCacheManagerInstance;
}