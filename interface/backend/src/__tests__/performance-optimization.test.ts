/**
 * Performance Optimization Integration Tests
 * 
 * Tests for the performance monitoring and optimization services
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TemplateCachePerformanceMonitor } from '../services/template-cache-performance-monitor.js';
import { DatabasePerformanceOptimizer } from '../services/database-performance-optimizer.js';

// Mock dependencies
vi.mock('../services/redis-service.js', () => ({
  getRedisService: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    setex: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    ping: vi.fn().mockResolvedValue('PONG'),
    client: {
      incr: vi.fn().mockResolvedValue(1),
      sAdd: vi.fn().mockResolvedValue(1),
      sCard: vi.fn().mockResolvedValue(5),
      lPush: vi.fn().mockResolvedValue(1),
      lTrim: vi.fn().mockResolvedValue('OK'),
      lRange: vi.fn().mockResolvedValue(['10', '15', '20']),
      get: vi.fn().mockResolvedValue('100'),
      expire: vi.fn().mockResolvedValue(1)
    }
  })
}));

vi.mock('../services/database-service.js', () => ({
  getDatabaseService: () => ({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    getStats: vi.fn().mockResolvedValue({
      totalConnections: 10,
      idleConnections: 5,
      waitingCount: 0
    })
  })
}));

describe('Performance Optimization Services', () => {
  let cacheMonitor: TemplateCachePerformanceMonitor;
  let dbOptimizer: DatabasePerformanceOptimizer;

  beforeEach(() => {
    // Initialize services with test configuration
    cacheMonitor = new TemplateCachePerformanceMonitor({
      enableAdvancedMetrics: true,
      enablePredictiveWarming: false, // Disable for testing
      enableAdaptiveEviction: false, // Disable for testing
      optimizationInterval: 60000
    });

    dbOptimizer = new DatabasePerformanceOptimizer({
      enableQueryMonitoring: true,
      enableAutoIndexing: false, // Disabled for safety
      enableConnectionPoolOptimization: true,
      slowQueryThreshold: 1000
    });
  });

  afterEach(async () => {
    // Cleanup services
    if (cacheMonitor) {
      await cacheMonitor.shutdown();
    }
    if (dbOptimizer) {
      await dbOptimizer.shutdown();
    }
  });

  describe('TemplateCachePerformanceMonitor', () => {
    it('should initialize with default configuration', () => {
      expect(cacheMonitor).toBeDefined();
    });

    it('should get performance metrics', async () => {
      const metrics = await cacheMonitor.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('hitRate');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('hotKeys');
      expect(metrics).toHaveProperty('coldKeys');
      
      expect(typeof metrics.hitRate).toBe('number');
      expect(typeof metrics.averageResponseTime).toBe('number');
      expect(Array.isArray(metrics.hotKeys)).toBe(true);
      expect(Array.isArray(metrics.coldKeys)).toBe(true);
    });

    it('should check cache health', async () => {
      const health = await cacheMonitor.checkCacheHealth();
      
      expect(health).toBeDefined();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('issues');
      expect(health).toHaveProperty('metrics');
      
      expect(['HEALTHY', 'WARNING', 'CRITICAL', 'DEGRADED']).toContain(health.status);
      expect(Array.isArray(health.issues)).toBe(true);
    });

    it('should generate optimization recommendations', async () => {
      const recommendations = await cacheMonitor.getOptimizationRecommendations();
      
      expect(Array.isArray(recommendations)).toBe(true);
      
      // Each recommendation should have required properties
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('expectedImpact');
        expect(rec).toHaveProperty('implementation');
        
        expect(['INCREASE_TTL', 'DECREASE_TTL', 'PRELOAD_KEY', 'EVICT_KEY', 'INCREASE_MEMORY', 'OPTIMIZE_QUERY']).toContain(rec.type);
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(rec.priority);
      });
    });
  });

  describe('DatabasePerformanceOptimizer', () => {
    it('should initialize with default configuration', () => {
      expect(dbOptimizer).toBeDefined();
    });

    it('should create optimized indexes', async () => {
      const result = await dbOptimizer.createOptimizedIndexes();
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('errors');
      
      expect(Array.isArray(result.created)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should analyze and recommend indexes', async () => {
      const recommendations = await dbOptimizer.analyzeAndRecommendIndexes();
      
      expect(Array.isArray(recommendations)).toBe(true);
      
      // Each recommendation should have required properties
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('tableName');
        expect(rec).toHaveProperty('columns');
        expect(rec).toHaveProperty('indexType');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('estimatedImpact');
        expect(rec).toHaveProperty('reason');
        expect(rec).toHaveProperty('createStatement');
        
        expect(['BTREE', 'HASH', 'GIN', 'GIST']).toContain(rec.indexType);
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(rec.priority);
        expect(Array.isArray(rec.columns)).toBe(true);
      });
    });

    it('should optimize connection pool', async () => {
      const result = await dbOptimizer.optimizeConnectionPool();
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('currentSettings');
      expect(result).toHaveProperty('optimizedSettings');
      
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(typeof result.currentSettings).toBe('object');
      expect(typeof result.optimizedSettings).toBe('object');
    });

    it('should get database health metrics', async () => {
      const metrics = await dbOptimizer.getDatabaseHealthMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('connectionPool');
      expect(metrics).toHaveProperty('queryPerformance');
      expect(metrics).toHaveProperty('indexUsage');
      expect(metrics).toHaveProperty('tableStatistics');
      
      expect(typeof metrics.connectionPool.totalConnections).toBe('number');
      expect(typeof metrics.queryPerformance.averageQueryTime).toBe('number');
      expect(typeof metrics.indexUsage.totalIndexes).toBe('number');
    });

    it('should record query performance', async () => {
      // This should not throw an error
      await expect(
        dbOptimizer.recordQueryPerformance(
          'test_query_1',
          'SELECT * FROM prompt_templates WHERE category = $1',
          150,
          10,
          ['enhancement']
        )
      ).resolves.toBeUndefined();
    });

    it('should get query performance stats', async () => {
      // Record some test queries first
      await dbOptimizer.recordQueryPerformance('query1', 'SELECT 1', 100, 1);
      await dbOptimizer.recordQueryPerformance('query2', 'SELECT 2', 200, 1);
      await dbOptimizer.recordQueryPerformance('query3', 'SELECT 3', 1500, 1); // Slow query
      
      const stats = await dbOptimizer.getQueryPerformanceStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(stats).toHaveProperty('slowQueries');
      expect(stats).toHaveProperty('topSlowQueries');
      
      expect(typeof stats.totalQueries).toBe('number');
      expect(typeof stats.averageExecutionTime).toBe('number');
      expect(typeof stats.slowQueries).toBe('number');
      expect(Array.isArray(stats.topSlowQueries)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should provide comprehensive performance insights', async () => {
      // Record some performance data
      await dbOptimizer.recordQueryPerformance('test_query', 'SELECT * FROM test', 500, 100);
      
      // Get comprehensive metrics
      const cacheHealth = await cacheMonitor.checkCacheHealth();
      const cacheRecommendations = await cacheMonitor.getOptimizationRecommendations();
      const dbRecommendations = await dbOptimizer.analyzeAndRecommendIndexes();
      
      // Verify we have actionable insights
      expect(cacheHealth.status).toBeDefined();
      expect(Array.isArray(cacheRecommendations)).toBe(true);
      expect(Array.isArray(dbRecommendations)).toBe(true);
    });
  });
});