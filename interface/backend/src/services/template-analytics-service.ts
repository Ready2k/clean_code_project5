/**
 * Template Analytics Service
 * 
 * Usage tracking and performance metrics collection, analytics data aggregation
 * and reporting, template performance monitoring, and A/B testing support for
 * template comparison.
 */

import { getDatabaseService } from './database-service.js';
import { getRedisService } from './redis-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ErrorCode } from '../types/errors.js';
import {
  TemplateCategory,
  UsageContext,
  PerformanceData,
  UsageStats,
  PerformanceMetrics,
  UsageReport,
  PerformanceReport,
  TemplateRanking,
  TimeRange
} from '../types/prompt-templates.js';

export interface TemplateAnalyticsConfig {
  enableRealTimeTracking?: boolean;
  enableABTesting?: boolean;
  batchSize?: number;
  flushInterval?: number;
  retentionDays?: number;
  aggregationInterval?: number;
}

export interface ABTestConfig {
  testId: string;
  templateA: string;
  templateB: string;
  trafficSplit: number; // 0.0 to 1.0
  startDate: Date;
  endDate: Date;
  metrics: string[];
}

export interface ABTestResult {
  testId: string;
  templateA: {
    id: string;
    usage: number;
    averageRenderTime: number;
    successRate: number;
    userSatisfaction?: number;
  };
  templateB: {
    id: string;
    usage: number;
    averageRenderTime: number;
    successRate: number;
    userSatisfaction?: number;
  };
  statisticalSignificance: number;
  winner?: 'A' | 'B' | 'inconclusive';
  confidence: number;
}

/**
 * Template Analytics Service
 */
export class TemplateAnalyticsService {
  private db = getDatabaseService();
  private redis = getRedisService();
  private config: Required<TemplateAnalyticsConfig>;
  private usageBatch: any[] = [];
  private performanceBatch: any[] = [];
  private flushTimer?: NodeJS.Timeout;
  private aggregationTimer?: NodeJS.Timeout;
  private abTests: Map<string, ABTestConfig> = new Map();

  constructor(config: TemplateAnalyticsConfig = {}) {
    this.config = {
      enableRealTimeTracking: true,
      enableABTesting: false,
      batchSize: 100,
      flushInterval: 30000, // 30 seconds
      retentionDays: 90,
      aggregationInterval: 300000, // 5 minutes
      ...config
    };

    this.startBatchProcessing();
    this.startAggregation();
  }

  // ============================================================================
  // Usage Tracking
  // ============================================================================

  /**
   * Record template usage
   */
  async recordUsage(templateId: string, context: UsageContext): Promise<void> {
    try {
      const usageRecord = {
        id: this.generateId('usage'),
        templateId,
        context,
        timestamp: new Date(),
        success: true // Default to true, can be updated later
      };

      if (this.config.enableRealTimeTracking) {
        // Add to batch for processing
        this.usageBatch.push(usageRecord);
        
        // Update real-time counters in Redis
        await this.updateRealTimeCounters(templateId, context);
      } else {
        // Direct database insert
        await this.insertUsageRecord(usageRecord);
      }

      logger.debug('Template usage recorded', { templateId, userId: context.userId });

    } catch (error) {
      logger.error('Failed to record template usage', { templateId, context, error });
      // Don't throw error to avoid disrupting main functionality
    }
  }

  /**
   * Record performance metrics
   */
  async recordPerformance(templateId: string, metrics: PerformanceData): Promise<void> {
    try {
      const performanceRecord = {
        id: this.generateId('perf'),
        templateId,
        ...metrics,
        timestamp: new Date()
      };

      if (this.config.enableRealTimeTracking) {
        // Add to batch for processing
        this.performanceBatch.push(performanceRecord);
        
        // Update real-time performance metrics in Redis
        await this.updateRealTimePerformance(templateId, metrics);
      } else {
        // Direct database insert
        await this.insertPerformanceRecord(performanceRecord);
      }

      logger.debug('Template performance recorded', { templateId, renderTime: metrics.renderTime });

    } catch (error) {
      logger.error('Failed to record template performance', { templateId, metrics, error });
      // Don't throw error to avoid disrupting main functionality
    }
  }

  /**
   * Update usage success status
   */
  async updateUsageSuccess(usageId: string, success: boolean, errorMessage?: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE prompt_template_usage 
        SET success = $1, error_message = $2, updated_at = NOW()
        WHERE id = $3
      `, [success, errorMessage, usageId]);

      logger.debug('Usage success status updated', { usageId, success });

    } catch (error) {
      logger.error('Failed to update usage success status', { usageId, success, error });
    }
  }

  // ============================================================================
  // Analytics Reporting
  // ============================================================================

  /**
   * Get usage report for template
   */
  async getUsageReport(templateId: string, timeRange: TimeRange): Promise<UsageReport> {
    try {
      // Get basic usage statistics
      const basicStats = await this.db.query(`
        SELECT 
          COUNT(*) as total_usage,
          COUNT(DISTINCT usage_context->>'userId') as unique_users
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
      `, [templateId, timeRange.start, timeRange.end]);

      const stats = basicStats.rows[0];

      // Get usage by day
      const dailyUsage = await this.db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [templateId, timeRange.start, timeRange.end]);

      // Get top users
      const topUsers = await this.db.query(`
        SELECT 
          usage_context->>'userId' as user_id,
          COUNT(*) as count
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
          AND usage_context->>'userId' IS NOT NULL
        GROUP BY usage_context->>'userId'
        ORDER BY count DESC
        LIMIT 10
      `, [templateId, timeRange.start, timeRange.end]);

      // Get usage by provider
      const providerUsage = await this.db.query(`
        SELECT 
          usage_context->>'provider' as provider,
          COUNT(*) as count
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
          AND usage_context->>'provider' IS NOT NULL
        GROUP BY usage_context->>'provider'
      `, [templateId, timeRange.start, timeRange.end]);

      // Get usage by task type
      const taskTypeUsage = await this.db.query(`
        SELECT 
          usage_context->>'taskType' as task_type,
          COUNT(*) as count
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
          AND usage_context->>'taskType' IS NOT NULL
        GROUP BY usage_context->>'taskType'
      `, [templateId, timeRange.start, timeRange.end]);

      // Build usage by provider map
      const usageByProvider: Record<string, number> = {};
      for (const row of providerUsage.rows) {
        usageByProvider[row.provider] = parseInt(row.count);
      }

      // Build usage by task type map
      const usageByTaskType: Record<string, number> = {};
      for (const row of taskTypeUsage.rows) {
        usageByTaskType[row.task_type] = parseInt(row.count);
      }

      return {
        templateId,
        timeRange,
        totalUsage: parseInt(stats.total_usage || '0'),
        uniqueUsers: parseInt(stats.unique_users || '0'),
        usageByDay: dailyUsage.rows.map(row => ({
          date: row.date,
          count: parseInt(row.count)
        })),
        topUsers: topUsers.rows.map(row => ({
          userId: row.user_id,
          count: parseInt(row.count)
        })),
        usageByProvider,
        usageByTaskType
      };

    } catch (error) {
      logger.error('Failed to get usage report', { templateId, timeRange, error });
      throw new AppError('Failed to get usage report', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Get performance report for template
   */
  async getPerformanceReport(templateId: string, timeRange: TimeRange): Promise<PerformanceReport> {
    try {
      // Get performance statistics
      const perfStats = await this.db.query(`
        SELECT 
          AVG(execution_time_ms) as avg_render_time,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms) as p50_render_time,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_render_time,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99_render_time,
          SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
      `, [templateId, timeRange.start, timeRange.end]);

      const stats = perfStats.rows[0];

      // Get cache hit rate (would need to track cache hits/misses)
      const cacheHitRate = await this.getCacheHitRate(templateId, timeRange);

      // Get performance by day
      const dailyPerformance = await this.db.query(`
        SELECT 
          DATE(created_at) as date,
          AVG(execution_time_ms) as avg_time,
          COUNT(*) as total_requests
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [templateId, timeRange.start, timeRange.end]);

      return {
        templateId,
        timeRange,
        averageRenderTime: parseFloat(stats.avg_render_time || '0'),
        p50RenderTime: parseFloat(stats.p50_render_time || '0'),
        p95RenderTime: parseFloat(stats.p95_render_time || '0'),
        p99RenderTime: parseFloat(stats.p99_render_time || '0'),
        cacheHitRate,
        errorRate: 1 - parseFloat(stats.success_rate || '1'),
        performanceByDay: dailyPerformance.rows.map(row => ({
          date: row.date,
          avgTime: parseFloat(row.avg_time || '0'),
          cacheHitRate: 0.85 // Placeholder - would calculate from actual cache data
        }))
      };

    } catch (error) {
      logger.error('Failed to get performance report', { templateId, timeRange, error });
      throw new AppError('Failed to get performance report', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Get template rankings
   */
  async getTemplateRankings(
    category?: TemplateCategory,
    limit: number = 10,
    timeRange?: TimeRange
  ): Promise<TemplateRanking[]> {
    try {
      const whereConditions: string[] = ['pt.is_active = true'];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (category) {
        whereConditions.push(`pt.category = $${paramIndex++}`);
        queryParams.push(category);
      }

      if (timeRange) {
        whereConditions.push(`ptu.created_at BETWEEN $${paramIndex++} AND $${paramIndex++}`);
        queryParams.push(timeRange.start, timeRange.end);
      }

      const whereClause = whereConditions.join(' AND ');

      const result = await this.db.query(`
        SELECT 
          pt.id,
          pt.name,
          pt.category,
          COUNT(ptu.id) as usage_count,
          AVG(ptu.execution_time_ms) as avg_render_time,
          SUM(CASE WHEN ptu.success THEN 1 ELSE 0 END)::float / COUNT(ptu.id) as success_rate,
          COUNT(DISTINCT ptu.usage_context->>'userId') as unique_users
        FROM prompt_templates pt
        LEFT JOIN prompt_template_usage ptu ON pt.id = ptu.template_id
        WHERE ${whereClause}
        GROUP BY pt.id, pt.name, pt.category
        HAVING COUNT(ptu.id) > 0
        ORDER BY usage_count DESC, success_rate DESC, avg_render_time ASC
        LIMIT $${paramIndex}
      `, [...queryParams, limit]);

      return result.rows.map(row => {
        const usageScore = Math.log(parseInt(row.usage_count) + 1) * 10;
        const performanceScore = Math.max(0, 100 - parseFloat(row.avg_render_time || '0') / 10);
        const successScore = parseFloat(row.success_rate || '0') * 100;
        
        const totalScore = (usageScore * 0.4) + (performanceScore * 0.3) + (successScore * 0.3);

        return {
          templateId: row.id,
          name: row.name,
          category: row.category,
          score: Math.round(totalScore * 100) / 100,
          metrics: {
            usage: parseInt(row.usage_count),
            performance: Math.round(performanceScore * 100) / 100,
            successRate: Math.round(successScore * 100) / 100
          }
        };
      });

    } catch (error) {
      logger.error('Failed to get template rankings', { category, limit, timeRange, error });
      throw new AppError('Failed to get template rankings', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  // ============================================================================
  // A/B Testing
  // ============================================================================

  /**
   * Create A/B test
   */
  async createABTest(config: ABTestConfig): Promise<void> {
    if (!this.config.enableABTesting) {
      throw new AppError('A/B testing is not enabled', 400, ErrorCode.VALIDATION_ERROR);
    }

    try {
      // Validate test configuration
      this.validateABTestConfig(config);

      // Store test configuration
      await this.db.query(`
        INSERT INTO prompt_template_ab_tests (
          id, template_a_id, template_b_id, traffic_split, start_date, end_date, 
          metrics, config, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        config.testId,
        config.templateA,
        config.templateB,
        config.trafficSplit,
        config.startDate,
        config.endDate,
        JSON.stringify(config.metrics),
        JSON.stringify(config)
      ]);

      // Cache test configuration for quick access
      this.abTests.set(config.testId, config);

      logger.info('A/B test created', { testId: config.testId });

    } catch (error) {
      logger.error('Failed to create A/B test', { config, error });
      throw error;
    }
  }

  /**
   * Get template for A/B test
   */
  async getABTestTemplate(testId: string, userId: string): Promise<string> {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new AppError(`A/B test not found: ${testId}`, 404, ErrorCode.NOT_FOUND);
    }

    const now = new Date();
    if (now < test.startDate || now > test.endDate) {
      throw new AppError(`A/B test not active: ${testId}`, 400, ErrorCode.VALIDATION_ERROR);
    }

    // Determine which template to use based on user hash and traffic split
    const userHash = this.hashUserId(userId);
    const useTemplateA = userHash < test.trafficSplit;

    // Record A/B test assignment
    await this.recordABTestAssignment(testId, userId, useTemplateA ? 'A' : 'B');

    return useTemplateA ? test.templateA : test.templateB;
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<ABTestResult> {
    try {
      const test = this.abTests.get(testId);
      if (!test) {
        throw new AppError(`A/B test not found: ${testId}`, 404, ErrorCode.NOT_FOUND);
      }

      // Get results for template A
      const templateAResults = await this.getABTestTemplateResults(testId, 'A', test.templateA);
      
      // Get results for template B
      const templateBResults = await this.getABTestTemplateResults(testId, 'B', test.templateB);

      // Calculate statistical significance
      const significance = this.calculateStatisticalSignificance(templateAResults, templateBResults);

      // Determine winner
      let winner: 'A' | 'B' | 'inconclusive' = 'inconclusive';
      if (significance.pValue < 0.05) {
        if (templateAResults.successRate > templateBResults.successRate) {
          winner = 'A';
        } else if (templateBResults.successRate > templateAResults.successRate) {
          winner = 'B';
        }
      }

      return {
        testId,
        templateA: templateAResults,
        templateB: templateBResults,
        statisticalSignificance: significance.pValue,
        winner,
        confidence: 1 - significance.pValue
      };

    } catch (error) {
      logger.error('Failed to get A/B test results', { testId, error });
      throw error;
    }
  }

  // ============================================================================
  // Data Aggregation
  // ============================================================================

  /**
   * Aggregate usage data
   */
  async aggregateUsageData(timeRange: TimeRange): Promise<void> {
    try {
      logger.info('Starting usage data aggregation', { timeRange });

      // Aggregate daily usage statistics
      await this.db.query(`
        INSERT INTO prompt_template_daily_stats (
          template_id, date, usage_count, unique_users, avg_render_time, success_rate
        )
        SELECT 
          template_id,
          DATE(created_at) as date,
          COUNT(*) as usage_count,
          COUNT(DISTINCT usage_context->>'userId') as unique_users,
          AVG(execution_time_ms) as avg_render_time,
          SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
        FROM prompt_template_usage
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY template_id, DATE(created_at)
        ON CONFLICT (template_id, date) DO UPDATE SET
          usage_count = EXCLUDED.usage_count,
          unique_users = EXCLUDED.unique_users,
          avg_render_time = EXCLUDED.avg_render_time,
          success_rate = EXCLUDED.success_rate,
          updated_at = NOW()
      `, [timeRange.start, timeRange.end]);

      logger.info('Usage data aggregation completed', { timeRange });

    } catch (error) {
      logger.error('Failed to aggregate usage data', { timeRange, error });
      throw error;
    }
  }

  /**
   * Clean old data based on retention policy
   */
  async cleanOldData(): Promise<{ deletedUsage: number; deletedPerformance: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      logger.info('Starting data cleanup', { cutoffDate, retentionDays: this.config.retentionDays });

      // Delete old usage records
      const usageResult = await this.db.query(`
        DELETE FROM prompt_template_usage 
        WHERE created_at < $1
      `, [cutoffDate]);

      // Delete old performance records (if separate table exists)
      // For now, performance is stored in usage table
      const performanceResult = { rowCount: 0 };

      logger.info('Data cleanup completed', {
        deletedUsage: usageResult.rowCount || 0,
        deletedPerformance: performanceResult.rowCount || 0
      });

      return {
        deletedUsage: usageResult.rowCount || 0,
        deletedPerformance: performanceResult.rowCount || 0
      };

    } catch (error) {
      logger.error('Failed to clean old data', error);
      throw new AppError('Failed to clean old data', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Start batch processing
   */
  private startBatchProcessing(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushBatches();
    }, this.config.flushInterval);
  }

  /**
   * Start data aggregation
   */
  private startAggregation(): void {
    this.aggregationTimer = setInterval(async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      try {
        await this.aggregateUsageData({ start: oneHourAgo, end: now });
      } catch (error) {
        logger.error('Scheduled aggregation failed', error);
      }
    }, this.config.aggregationInterval);
  }

  /**
   * Flush batched data to database
   */
  private async flushBatches(): Promise<void> {
    try {
      // Flush usage batch
      if (this.usageBatch.length > 0) {
        const batch = this.usageBatch.splice(0, this.config.batchSize);
        await this.insertUsageBatch(batch);
        logger.debug('Usage batch flushed', { count: batch.length });
      }

      // Flush performance batch
      if (this.performanceBatch.length > 0) {
        const batch = this.performanceBatch.splice(0, this.config.batchSize);
        await this.insertPerformanceBatch(batch);
        logger.debug('Performance batch flushed', { count: batch.length });
      }

    } catch (error) {
      logger.error('Failed to flush batches', error);
    }
  }

  /**
   * Insert usage batch to database
   */
  private async insertUsageBatch(batch: any[]): Promise<void> {
    if (batch.length === 0) return;

    const values = batch.map((record, index) => {
      const baseIndex = index * 6;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
    }).join(', ');

    const params = batch.flatMap(record => [
      record.id,
      record.templateId,
      JSON.stringify(record.context),
      0, // execution_time_ms - would be updated later
      record.success,
      record.timestamp
    ]);

    await this.db.query(`
      INSERT INTO prompt_template_usage (
        id, template_id, usage_context, execution_time_ms, success, created_at
      ) VALUES ${values}
    `, params);
  }

  /**
   * Insert performance batch to database
   */
  private async insertPerformanceBatch(batch: any[]): Promise<void> {
    // Performance data is currently stored in the usage table
    // This method would be used if we had a separate performance table
    logger.debug('Performance batch processed', { count: batch.length });
  }

  /**
   * Insert single usage record
   */
  private async insertUsageRecord(record: any): Promise<void> {
    await this.db.query(`
      INSERT INTO prompt_template_usage (
        id, template_id, usage_context, execution_time_ms, success, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      record.id,
      record.templateId,
      JSON.stringify(record.context),
      0, // execution_time_ms
      record.success,
      record.timestamp
    ]);
  }

  /**
   * Insert single performance record
   */
  private async insertPerformanceRecord(record: any): Promise<void> {
    // Update the corresponding usage record with performance data
    await this.db.query(`
      UPDATE prompt_template_usage 
      SET execution_time_ms = $1
      WHERE template_id = $2 
        AND created_at >= $3 
        AND execution_time_ms = 0
      ORDER BY created_at DESC
      LIMIT 1
    `, [record.renderTime, record.templateId, new Date(Date.now() - 60000)]); // Within last minute
  }

  /**
   * Update real-time counters in Redis
   */
  private async updateRealTimeCounters(templateId: string, context: UsageContext): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const hourKey = `${today}:${new Date().getHours()}`;

    // Increment daily counter
    await this.redis.client.incr(`template_usage:${templateId}:${today}`);
    
    // Increment hourly counter
    await this.redis.client.incr(`template_usage:${templateId}:${hourKey}`);
    
    // Track unique users
    if (context.userId) {
      await this.redis.client.sAdd(`template_users:${templateId}:${today}`, context.userId);
    }

    // Set expiration for counters (7 days)
    await this.redis.client.expire(`template_usage:${templateId}:${today}`, 7 * 24 * 60 * 60);
    await this.redis.client.expire(`template_usage:${templateId}:${hourKey}`, 7 * 24 * 60 * 60);
    await this.redis.client.expire(`template_users:${templateId}:${today}`, 7 * 24 * 60 * 60);
  }

  /**
   * Update real-time performance metrics in Redis
   */
  private async updateRealTimePerformance(templateId: string, metrics: PerformanceData): Promise<void> {
    const key = `template_perf:${templateId}`;
    
    // Update running average of render time
    await this.redis.client.lPush(`${key}:render_times`, metrics.renderTime.toString());
    await this.redis.client.lTrim(`${key}:render_times`, 0, 99); // Keep last 100 values
    
    // Update cache hit rate
    await this.redis.client.incr(`${key}:${metrics.cacheHit ? 'cache_hits' : 'cache_misses'}`);
    
    // Set expiration
    await this.redis.client.expire(`${key}:render_times`, 24 * 60 * 60); // 24 hours
    await this.redis.client.expire(`${key}:cache_hits`, 24 * 60 * 60);
    await this.redis.client.expire(`${key}:cache_misses`, 24 * 60 * 60);
  }

  /**
   * Get cache hit rate for template
   */
  private async getCacheHitRate(templateId: string, timeRange: TimeRange): Promise<number> {
    // This would be calculated from actual cache metrics
    // For now, return a placeholder value
    return 0.85; // 85% cache hit rate
  }

  /**
   * Validate A/B test configuration
   */
  private validateABTestConfig(config: ABTestConfig): void {
    if (!config.testId || !config.templateA || !config.templateB) {
      throw new AppError('Missing required A/B test configuration', 400, ErrorCode.VALIDATION_ERROR);
    }

    if (config.trafficSplit < 0 || config.trafficSplit > 1) {
      throw new AppError('Traffic split must be between 0 and 1', 400, ErrorCode.VALIDATION_ERROR);
    }

    if (config.startDate >= config.endDate) {
      throw new AppError('Start date must be before end date', 400, ErrorCode.VALIDATION_ERROR);
    }

    if (config.templateA === config.templateB) {
      throw new AppError('Template A and B must be different', 400, ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Hash user ID for consistent A/B test assignment
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }

  /**
   * Record A/B test assignment
   */
  private async recordABTestAssignment(testId: string, userId: string, variant: 'A' | 'B'): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO prompt_template_ab_assignments (
          id, test_id, user_id, variant, assigned_at
        ) VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (test_id, user_id) DO NOTHING
      `, [this.generateId('assignment'), testId, userId, variant]);
    } catch (error) {
      logger.error('Failed to record A/B test assignment', { testId, userId, variant, error });
    }
  }

  /**
   * Get A/B test template results
   */
  private async getABTestTemplateResults(testId: string, variant: 'A' | 'B', templateId: string): Promise<any> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as usage,
        AVG(ptu.execution_time_ms) as avg_render_time,
        SUM(CASE WHEN ptu.success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
      FROM prompt_template_ab_assignments pta
      JOIN prompt_template_usage ptu ON ptu.usage_context->>'userId' = pta.user_id
      WHERE pta.test_id = $1 
        AND pta.variant = $2 
        AND ptu.template_id = $3
    `, [testId, variant, templateId]);

    const stats = result.rows[0];

    return {
      id: templateId,
      usage: parseInt(stats.usage || '0'),
      averageRenderTime: parseFloat(stats.avg_render_time || '0'),
      successRate: parseFloat(stats.success_rate || '0')
    };
  }

  /**
   * Calculate statistical significance
   */
  private calculateStatisticalSignificance(templateA: any, templateB: any): { pValue: number } {
    // Simplified statistical significance calculation
    // In a real implementation, you would use proper statistical tests
    const totalA = templateA.usage;
    const totalB = templateB.usage;
    const successA = Math.round(totalA * templateA.successRate);
    const successB = Math.round(totalB * templateB.successRate);

    if (totalA < 30 || totalB < 30) {
      return { pValue: 1.0 }; // Not enough data
    }

    // Simplified z-test for proportions
    const p1 = successA / totalA;
    const p2 = successB / totalB;
    const pooledP = (successA + successB) / (totalA + totalB);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/totalA + 1/totalB));
    const z = Math.abs(p1 - p2) / se;
    
    // Approximate p-value (simplified)
    const pValue = Math.max(0.001, 2 * (1 - this.normalCDF(Math.abs(z))));
    
    return { pValue };
  }

  /**
   * Normal cumulative distribution function (approximation)
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // Dashboard and Comparison Methods
  // ============================================================================

  /**
   * Get dashboard data
   */
  async getDashboardData(timeRange: TimeRange, category?: TemplateCategory): Promise<any> {
    try {
      const whereConditions: string[] = ['pt.is_active = true'];
      const queryParams: any[] = [timeRange.start, timeRange.end];
      let paramIndex = 3;

      if (category) {
        whereConditions.push(`pt.category = ${paramIndex++}`);
        queryParams.push(category);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get overall statistics
      const overallStats = await this.db.query(`
        SELECT 
          COUNT(DISTINCT pt.id) as total_templates,
          COUNT(ptu.id) as total_usage,
          COUNT(DISTINCT ptu.usage_context->>'userId') as unique_users,
          AVG(ptu.execution_time_ms) as avg_render_time,
          SUM(CASE WHEN ptu.success THEN 1 ELSE 0 END)::float / COUNT(ptu.id) as success_rate
        FROM prompt_templates pt
        LEFT JOIN prompt_template_usage ptu ON pt.id = ptu.template_id 
          AND ptu.created_at BETWEEN $1 AND $2
        WHERE ${whereClause}
      `, queryParams);

      // Get usage trends by day
      const usageTrends = await this.db.query(`
        SELECT 
          DATE(ptu.created_at) as date,
          COUNT(*) as usage_count,
          COUNT(DISTINCT ptu.usage_context->>'userId') as unique_users
        FROM prompt_templates pt
        JOIN prompt_template_usage ptu ON pt.id = ptu.template_id
        WHERE ptu.created_at BETWEEN $1 AND $2 ${category ? `AND pt.category = $3` : ''}
        GROUP BY DATE(ptu.created_at)
        ORDER BY date
      `, category ? [timeRange.start, timeRange.end, category] : [timeRange.start, timeRange.end]);

      // Get top templates
      const topTemplates = await this.getTemplateRankings(category, 5, timeRange);

      // Get category breakdown
      const categoryBreakdown = await this.db.query(`
        SELECT 
          pt.category,
          COUNT(DISTINCT pt.id) as template_count,
          COUNT(ptu.id) as usage_count
        FROM prompt_templates pt
        LEFT JOIN prompt_template_usage ptu ON pt.id = ptu.template_id 
          AND ptu.created_at BETWEEN $1 AND $2
        WHERE pt.is_active = true
        GROUP BY pt.category
        ORDER BY usage_count DESC
      `, [timeRange.start, timeRange.end]);

      return {
        overview: overallStats.rows[0],
        usageTrends: usageTrends.rows,
        topTemplates,
        categoryBreakdown: categoryBreakdown.rows,
        timeRange
      };

    } catch (error) {
      logger.error('Failed to get dashboard data', { timeRange, category, error });
      throw new AppError('Failed to get dashboard data', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Compare templates
   */
  async compareTemplates(templateIds: string[], timeRange: TimeRange, metrics?: string[]): Promise<any> {
    try {
      const comparisons = await Promise.all(
        templateIds.map(async (templateId) => {
          const [usageStats, performanceMetrics] = await Promise.all([
            this.getUsageReport(templateId, timeRange),
            this.getPerformanceReport(templateId, timeRange)
          ]);

          // Get template info
          const templateResult = await this.db.query(`
            SELECT id, name, category, description FROM prompt_templates WHERE id = $1
          `, [templateId]);

          const template = templateResult.rows[0];

          return {
            template: {
              id: template.id,
              name: template.name,
              category: template.category,
              description: template.description
            },
            usage: {
              totalUsage: usageStats.totalUsage,
              uniqueUsers: usageStats.uniqueUsers,
              usageByProvider: usageStats.usageByProvider,
              usageByTaskType: usageStats.usageByTaskType
            },
            performance: {
              averageRenderTime: performanceMetrics.averageRenderTime,
              p95RenderTime: performanceMetrics.p95RenderTime,
              cacheHitRate: performanceMetrics.cacheHitRate,
              errorRate: performanceMetrics.errorRate
            }
          };
        })
      );

      return {
        templates: comparisons,
        timeRange,
        comparedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to compare templates', { templateIds, timeRange, error });
      throw new AppError('Failed to compare templates', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Get template ranking
   */
  async getTemplateRanking(category?: TemplateCategory, limit: number = 10, sortBy: string = 'score'): Promise<TemplateRanking[]> {
    try {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date()
      };

      return await this.getTemplateRankings(category, limit, timeRange);

    } catch (error) {
      logger.error('Failed to get template ranking', { category, limit, sortBy, error });
      throw new AppError('Failed to get template ranking', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Get realtime metrics
   */
  async getRealtimeMetrics(templateId: string): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const currentHour = new Date().getHours();

      // Get today's usage count
      const todayUsage = await this.redis.client.get(`template_usage:${templateId}:${today}`) || '0';

      // Get current hour usage
      const hourKey = `${today}:${currentHour}`;
      const hourUsage = await this.redis.client.get(`template_usage:${templateId}:${hourKey}`) || '0';

      // Get unique users today
      const uniqueUsers = await this.redis.client.sCard(`template_users:${templateId}:${today}`);

      // Get recent render times
      const renderTimes = await this.redis.client.lRange(`template_perf:${templateId}:render_times`, 0, 9);
      const avgRenderTime = renderTimes.length > 0 
        ? renderTimes.reduce((sum, time) => sum + parseFloat(time), 0) / renderTimes.length 
        : 0;

      // Get cache hit rate
      const cacheHits = await this.redis.client.get(`template_perf:${templateId}:cache_hits`) || '0';
      const cacheMisses = await this.redis.client.get(`template_perf:${templateId}:cache_misses`) || '0';
      const totalCacheRequests = parseInt(cacheHits) + parseInt(cacheMisses);
      const cacheHitRate = totalCacheRequests > 0 ? parseInt(cacheHits) / totalCacheRequests : 0;

      return {
        templateId,
        realtime: {
          todayUsage: parseInt(todayUsage),
          currentHourUsage: parseInt(hourUsage),
          uniqueUsersToday: uniqueUsers,
          averageRenderTime: Math.round(avgRenderTime * 100) / 100,
          cacheHitRate: Math.round(cacheHitRate * 100) / 100,
          lastUpdated: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Failed to get realtime metrics', { templateId, error });
      throw new AppError('Failed to get realtime metrics', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(timeRange: TimeRange, category?: TemplateCategory, format: string = 'csv'): Promise<any> {
    try {
      // Get all templates in category
      const whereConditions: string[] = ['is_active = true'];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (category) {
        whereConditions.push(`category = ${paramIndex++}`);
        queryParams.push(category);
      }

      const templates = await this.db.query(`
        SELECT id, name, category, key FROM prompt_templates 
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY name
      `, queryParams);

      // Get analytics data for each template
      const analyticsData = await Promise.all(
        templates.rows.map(async (template) => {
          const [usageStats, performanceMetrics] = await Promise.all([
            this.getUsageReport(template.id, timeRange),
            this.getPerformanceReport(template.id, timeRange)
          ]);

          return {
            templateId: template.id,
            templateName: template.name,
            category: template.category,
            key: template.key,
            totalUsage: usageStats.totalUsage,
            uniqueUsers: usageStats.uniqueUsers,
            averageRenderTime: performanceMetrics.averageRenderTime,
            p95RenderTime: performanceMetrics.p95RenderTime,
            cacheHitRate: performanceMetrics.cacheHitRate,
            errorRate: performanceMetrics.errorRate,
            ...usageStats.usageByProvider,
            ...usageStats.usageByTaskType
          };
        })
      );

      if (format === 'json') {
        return {
          data: analyticsData,
          timeRange,
          exportedAt: new Date().toISOString(),
          category
        };
      } else if (format === 'csv') {
        // Convert to CSV format
        const headers = [
          'Template ID', 'Template Name', 'Category', 'Key', 'Total Usage', 'Unique Users',
          'Avg Render Time', 'P95 Render Time', 'Cache Hit Rate', 'Error Rate'
        ];

        const csvRows = [
          headers.join(','),
          ...analyticsData.map(row => [
            row.templateId,
            `"${row.templateName}"`,
            row.category,
            row.key,
            row.totalUsage,
            row.uniqueUsers,
            row.averageRenderTime.toFixed(2),
            row.p95RenderTime.toFixed(2),
            (row.cacheHitRate * 100).toFixed(2) + '%',
            (row.errorRate * 100).toFixed(2) + '%'
          ].join(','))
        ];

        return csvRows.join('\n');
      } else {
        throw new AppError(`Unsupported export format: ${format}`, 400, ErrorCode.VALIDATION_ERROR);
      }

    } catch (error) {
      logger.error('Failed to export analytics', { timeRange, category, format, error });
      throw new AppError('Failed to export analytics', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Shutdown the analytics service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Template Analytics Service');

    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }

    // Flush remaining batches
    await this.flushBatches();

    logger.info('Template Analytics Service shut down successfully');
  }
}

// Singleton instance
let templateAnalyticsServiceInstance: TemplateAnalyticsService | null = null;

/**
 * Initialize the Template Analytics Service
 */
export function initializeTemplateAnalyticsService(config?: TemplateAnalyticsConfig): TemplateAnalyticsService {
  if (!templateAnalyticsServiceInstance) {
    templateAnalyticsServiceInstance = new TemplateAnalyticsService(config);
    logger.info('Template Analytics Service initialized');
  }
  return templateAnalyticsServiceInstance;
}

/**
 * Get the Template Analytics Service instance
 */
export function getTemplateAnalyticsService(): TemplateAnalyticsService {
  if (!templateAnalyticsServiceInstance) {
    throw new AppError(
      'Template Analytics Service not initialized',
      500,
      ErrorCode.SERVICE_UNAVAILABLE
    );
  }
  return templateAnalyticsServiceInstance;
}