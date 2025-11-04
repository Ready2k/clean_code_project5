import { PoolClient } from 'pg';
import { getDatabaseService } from '../services/database-service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../types/errors.js';
import {
  UsageContext,
  PerformanceData,
  UsageStats,
  PerformanceMetrics,
  TimeRange,
  UsageReport,
  PerformanceReport,
  TemplateRanking
} from '../types/prompt-templates.js';

/**
 * Repository for analytics data operations
 * Implements usage statistics collection, performance metrics aggregation,
 * time-series data handling, and data retention policies
 */
export class AnalyticsDataRepository {
  private db = getDatabaseService();

  /**
   * Record template usage
   */
  async recordUsage(
    templateId: string,
    context: UsageContext,
    executionTimeMs?: number,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    const query = `
      INSERT INTO prompt_template_usage (
        template_id, usage_context, execution_time_ms, success, error_message, 
        provider, user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      templateId,
      JSON.stringify(context),
      executionTimeMs,
      success,
      errorMessage,
      context.provider,
      context.userId
    ];

    try {
      await this.db.query(query, values);
      
      logger.debug('Template usage recorded', {
        templateId,
        provider: context.provider,
        success,
        executionTimeMs
      });
    } catch (error) {
      logger.error('Failed to record template usage', {
        templateId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - usage recording should not break the main flow
    }
  }

  /**
   * Record performance metrics
   */
  async recordPerformanceMetrics(
    templateId: string,
    metrics: PerformanceData
  ): Promise<void> {
    return this.db.transaction(async (client) => {
      const today = new Date().toISOString().split('T')[0];

      // Update or insert daily metrics
      const metricsToUpdate = [
        { type: 'avg_execution_time', value: metrics.renderTime },
        { type: 'cache_hit_rate', value: metrics.cacheHit ? 1 : 0 },
        { type: 'variable_count', value: metrics.variableCount },
        { type: 'content_length', value: metrics.contentLength }
      ];

      for (const metric of metricsToUpdate) {
        await this.upsertDailyMetric(
          client,
          templateId,
          metric.type,
          metric.value,
          today
        );
      }

      logger.debug('Performance metrics recorded', {
        templateId,
        renderTime: metrics.renderTime,
        cacheHit: metrics.cacheHit
      });
    });
  }

  /**
   * Get usage statistics for a template
   */
  async getUsageStats(
    templateId: string,
    timeRange: TimeRange
  ): Promise<UsageStats> {
    const query = `
      SELECT 
        COUNT(*) as total_usage,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(execution_time_ms) as avg_render_time,
        (COUNT(*) FILTER (WHERE success = true)::float / COUNT(*)) * 100 as success_rate,
        provider,
        usage_context->>'taskType' as task_type
      FROM prompt_template_usage
      WHERE template_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
      GROUP BY provider, usage_context->>'taskType'
    `;

    const result = await this.db.query(query, [
      templateId,
      timeRange.start,
      timeRange.end
    ]);

    // Aggregate results
    let totalUsage = 0;
    let uniqueUsers = 0;
    let avgRenderTime = 0;
    let successRate = 0;
    const usageByProvider: Record<string, number> = {};
    const usageByTaskType: Record<string, number> = {};

    for (const row of result.rows) {
      totalUsage += parseInt(row.total_usage);
      uniqueUsers = Math.max(uniqueUsers, parseInt(row.unique_users));
      avgRenderTime = Math.max(avgRenderTime, parseFloat(row.avg_render_time || '0'));
      successRate = Math.max(successRate, parseFloat(row.success_rate || '0'));

      if (row.provider) {
        usageByProvider[row.provider] = (usageByProvider[row.provider] || 0) + parseInt(row.total_usage);
      }

      if (row.task_type) {
        usageByTaskType[row.task_type] = (usageByTaskType[row.task_type] || 0) + parseInt(row.total_usage);
      }
    }

    return {
      templateId,
      totalUsage,
      uniqueUsers,
      averageRenderTime: avgRenderTime,
      successRate,
      timeRange,
      usageByProvider,
      usageByTaskType
    };
  }

  /**
   * Get performance metrics for a template
   */
  async getPerformanceMetrics(
    templateId: string,
    timeRange: TimeRange
  ): Promise<PerformanceMetrics> {
    const query = `
      SELECT 
        metric_type,
        AVG(metric_value) as avg_value,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value) as p95_value
      FROM prompt_template_metrics
      WHERE template_id = $1 
        AND measurement_date >= $2::date 
        AND measurement_date <= $3::date
        AND metric_type IN ('avg_execution_time', 'cache_hit_rate')
      GROUP BY metric_type
    `;

    const result = await this.db.query(query, [
      templateId,
      timeRange.start.toISOString().split('T')[0],
      timeRange.end.toISOString().split('T')[0]
    ]);

    const metrics = result.rows.reduce((acc, row) => {
      acc[row.metric_type] = {
        avg: parseFloat(row.avg_value),
        p95: parseFloat(row.p95_value)
      };
      return acc;
    }, {} as Record<string, { avg: number; p95: number }>);

    // Get error rate from usage data
    const errorQuery = `
      SELECT 
        (COUNT(*) FILTER (WHERE success = false)::float / COUNT(*)) * 100 as error_rate
      FROM prompt_template_usage
      WHERE template_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
    `;

    const errorResult = await this.db.query(errorQuery, [
      templateId,
      timeRange.start,
      timeRange.end
    ]);

    const errorRate = parseFloat(errorResult.rows[0]?.error_rate || '0');

    return {
      templateId,
      averageRenderTime: metrics.avg_execution_time?.avg || 0,
      p95RenderTime: metrics.avg_execution_time?.p95 || 0,
      cacheHitRate: metrics.cache_hit_rate?.avg || 0,
      errorRate,
      timeRange
    };
  }

  /**
   * Generate detailed usage report
   */
  async generateUsageReport(
    templateId: string,
    timeRange: TimeRange
  ): Promise<UsageReport> {
    // Get basic stats
    const stats = await this.getUsageStats(templateId, timeRange);

    // Get daily usage breakdown
    const dailyQuery = `
      SELECT 
        DATE(created_at) as usage_date,
        COUNT(*) as daily_count
      FROM prompt_template_usage
      WHERE template_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
      GROUP BY DATE(created_at)
      ORDER BY usage_date
    `;

    const dailyResult = await this.db.query(dailyQuery, [
      templateId,
      timeRange.start,
      timeRange.end
    ]);

    const usageByDay = dailyResult.rows.map(row => ({
      date: row.usage_date,
      count: parseInt(row.daily_count)
    }));

    // Get top users
    const topUsersQuery = `
      SELECT 
        user_id,
        COUNT(*) as usage_count
      FROM prompt_template_usage
      WHERE template_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY usage_count DESC
      LIMIT 10
    `;

    const topUsersResult = await this.db.query(topUsersQuery, [
      templateId,
      timeRange.start,
      timeRange.end
    ]);

    const topUsers = topUsersResult.rows.map(row => ({
      userId: row.user_id,
      count: parseInt(row.usage_count)
    }));

    return {
      templateId,
      timeRange,
      totalUsage: stats.totalUsage,
      uniqueUsers: stats.uniqueUsers,
      usageByDay,
      topUsers,
      usageByProvider: stats.usageByProvider,
      usageByTaskType: stats.usageByTaskType
    };
  }

  /**
   * Generate detailed performance report
   */
  async generatePerformanceReport(
    templateId: string,
    timeRange: TimeRange
  ): Promise<PerformanceReport> {
    // Get percentile data from usage table
    const percentileQuery = `
      SELECT 
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms) as p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99,
        AVG(execution_time_ms) as avg_time
      FROM prompt_template_usage
      WHERE template_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND execution_time_ms IS NOT NULL
    `;

    const percentileResult = await this.db.query(percentileQuery, [
      templateId,
      timeRange.start,
      timeRange.end
    ]);

    const percentiles = percentileResult.rows[0] || {};

    // Get daily performance breakdown
    const dailyPerfQuery = `
      SELECT 
        measurement_date,
        AVG(CASE WHEN metric_type = 'avg_execution_time' THEN metric_value END) as avg_time,
        AVG(CASE WHEN metric_type = 'cache_hit_rate' THEN metric_value END) as cache_hit_rate
      FROM prompt_template_metrics
      WHERE template_id = $1 
        AND measurement_date >= $2::date 
        AND measurement_date <= $3::date
      GROUP BY measurement_date
      ORDER BY measurement_date
    `;

    const dailyPerfResult = await this.db.query(dailyPerfQuery, [
      templateId,
      timeRange.start.toISOString().split('T')[0],
      timeRange.end.toISOString().split('T')[0]
    ]);

    const performanceByDay = dailyPerfResult.rows.map(row => ({
      date: row.measurement_date,
      avgTime: parseFloat(row.avg_time || '0'),
      cacheHitRate: parseFloat(row.cache_hit_rate || '0')
    }));

    // Get error rate
    const errorQuery = `
      SELECT 
        (COUNT(*) FILTER (WHERE success = false)::float / COUNT(*)) * 100 as error_rate
      FROM prompt_template_usage
      WHERE template_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
    `;

    const errorResult = await this.db.query(errorQuery, [
      templateId,
      timeRange.start,
      timeRange.end
    ]);

    const errorRate = parseFloat(errorResult.rows[0]?.error_rate || '0');

    // Get cache hit rate
    const cacheQuery = `
      SELECT AVG(metric_value) as cache_hit_rate
      FROM prompt_template_metrics
      WHERE template_id = $1 
        AND measurement_date >= $2::date 
        AND measurement_date <= $3::date
        AND metric_type = 'cache_hit_rate'
    `;

    const cacheResult = await this.db.query(cacheQuery, [
      templateId,
      timeRange.start.toISOString().split('T')[0],
      timeRange.end.toISOString().split('T')[0]
    ]);

    const cacheHitRate = parseFloat(cacheResult.rows[0]?.cache_hit_rate || '0');

    return {
      templateId,
      timeRange,
      averageRenderTime: parseFloat(percentiles.avg_time || '0'),
      p50RenderTime: parseFloat(percentiles.p50 || '0'),
      p95RenderTime: parseFloat(percentiles.p95 || '0'),
      p99RenderTime: parseFloat(percentiles.p99 || '0'),
      cacheHitRate,
      errorRate,
      performanceByDay
    };
  }

  /**
   * Get top performing templates by category
   */
  async getTopPerformingTemplates(
    category?: string,
    limit: number = 10,
    timeRange?: TimeRange
  ): Promise<TemplateRanking[]> {
    const timeCondition = timeRange 
      ? 'AND u.created_at >= $3 AND u.created_at <= $4'
      : '';
    
    const categoryCondition = category 
      ? 'AND t.category = $2'
      : '';

    const query = `
      SELECT 
        t.id,
        t.name,
        t.category,
        COUNT(u.id) as usage_count,
        AVG(u.execution_time_ms) as avg_performance,
        (COUNT(u.id) FILTER (WHERE u.success = true)::float / COUNT(u.id)) * 100 as success_rate,
        -- Calculate composite score (usage * success_rate / avg_time)
        (COUNT(u.id) * (COUNT(u.id) FILTER (WHERE u.success = true)::float / COUNT(u.id)) * 100) / 
        GREATEST(AVG(u.execution_time_ms), 1) as composite_score
      FROM prompt_templates t
      LEFT JOIN prompt_template_usage u ON t.id = u.template_id
      WHERE t.is_active = true
        ${categoryCondition}
        ${timeCondition}
      GROUP BY t.id, t.name, t.category
      HAVING COUNT(u.id) > 0
      ORDER BY composite_score DESC
      LIMIT $${category ? (timeRange ? '5' : '3') : (timeRange ? '4' : '2')}
    `;

    const params: any[] = [limit];
    if (category) params.push(category);
    if (timeRange) {
      params.push(timeRange.start, timeRange.end);
    }

    const result = await this.db.query(query, params);

    return result.rows.map(row => ({
      templateId: row.id,
      name: row.name,
      category: row.category,
      score: parseFloat(row.composite_score),
      metrics: {
        usage: parseInt(row.usage_count),
        performance: parseFloat(row.avg_performance || '0'),
        successRate: parseFloat(row.success_rate)
      }
    }));
  }

  /**
   * Clean up old analytics data based on retention policy
   */
  async cleanupOldData(retentionDays: number = 365): Promise<{
    usageRecordsDeleted: number;
    metricsRecordsDeleted: number;
  }> {
    return this.db.transaction(async (client) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete old usage records
      const usageDeleteQuery = `
        DELETE FROM prompt_template_usage
        WHERE created_at < $1
        RETURNING id
      `;

      const usageResult = await client.query(usageDeleteQuery, [cutoffDate]);
      const usageRecordsDeleted = usageResult.rows.length;

      // Delete old metrics records
      const metricsDeleteQuery = `
        DELETE FROM prompt_template_metrics
        WHERE measurement_date < $1::date
        RETURNING id
      `;

      const metricsResult = await client.query(metricsDeleteQuery, [cutoffDate]);
      const metricsRecordsDeleted = metricsResult.rows.length;

      logger.info('Analytics data cleanup completed', {
        retentionDays,
        usageRecordsDeleted,
        metricsRecordsDeleted,
        cutoffDate
      });

      return {
        usageRecordsDeleted,
        metricsRecordsDeleted
      };
    });
  }

  /**
   * Archive old data to separate tables for long-term storage
   */
  async archiveOldData(archiveAfterDays: number = 90): Promise<{
    usageRecordsArchived: number;
    metricsRecordsArchived: number;
  }> {
    return this.db.transaction(async (client) => {
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() - archiveAfterDays);

      // Create archive tables if they don't exist
      await this.createArchiveTables(client);

      // Archive usage records
      const archiveUsageQuery = `
        WITH archived AS (
          DELETE FROM prompt_template_usage
          WHERE created_at < $1
          RETURNING *
        )
        INSERT INTO prompt_template_usage_archive
        SELECT * FROM archived
        RETURNING id
      `;

      const usageResult = await client.query(archiveUsageQuery, [archiveDate]);
      const usageRecordsArchived = usageResult.rows.length;

      // Archive metrics records
      const archiveMetricsQuery = `
        WITH archived AS (
          DELETE FROM prompt_template_metrics
          WHERE measurement_date < $1::date
          RETURNING *
        )
        INSERT INTO prompt_template_metrics_archive
        SELECT * FROM archived
        RETURNING id
      `;

      const metricsResult = await client.query(archiveMetricsQuery, [archiveDate]);
      const metricsRecordsArchived = metricsResult.rows.length;

      logger.info('Analytics data archival completed', {
        archiveAfterDays,
        usageRecordsArchived,
        metricsRecordsArchived,
        archiveDate
      });

      return {
        usageRecordsArchived,
        metricsRecordsArchived
      };
    });
  }

  /**
   * Upsert daily metric value
   */
  private async upsertDailyMetric(
    client: PoolClient,
    templateId: string,
    metricType: string,
    value: number,
    date: string
  ): Promise<void> {
    const query = `
      INSERT INTO prompt_template_metrics (template_id, metric_type, metric_value, measurement_date)
      VALUES ($1, $2, $3, $4::date)
      ON CONFLICT (template_id, metric_type, measurement_date)
      DO UPDATE SET 
        metric_value = (prompt_template_metrics.metric_value + EXCLUDED.metric_value) / 2,
        metadata = prompt_template_metrics.metadata || '{"updated_count": 1}'::jsonb
    `;

    await client.query(query, [templateId, metricType, value, date]);
  }

  /**
   * Create archive tables for long-term data storage
   */
  private async createArchiveTables(client: PoolClient): Promise<void> {
    const createUsageArchiveQuery = `
      CREATE TABLE IF NOT EXISTS prompt_template_usage_archive (
        LIKE prompt_template_usage INCLUDING ALL
      )
    `;

    const createMetricsArchiveQuery = `
      CREATE TABLE IF NOT EXISTS prompt_template_metrics_archive (
        LIKE prompt_template_metrics INCLUDING ALL
      )
    `;

    await client.query(createUsageArchiveQuery);
    await client.query(createMetricsArchiveQuery);
  }
}