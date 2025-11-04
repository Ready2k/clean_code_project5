/**
 * Database Performance Optimizer Service
 * 
 * Optimizes database queries with proper indexing, implements query performance monitoring,
 * adds database connection pooling optimization, and creates database maintenance and
 * cleanup procedures for the template system.
 */

import { getDatabaseService } from './database-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ErrorCode } from '../types/errors.js';

export interface DatabasePerformanceConfig {
  enableQueryMonitoring?: boolean;
  enableAutoIndexing?: boolean;
  enableConnectionPoolOptimization?: boolean;
  slowQueryThreshold?: number;
  indexAnalysisInterval?: number;
  maintenanceInterval?: number;
  connectionPoolSettings?: {
    minConnections?: number;
    maxConnections?: number;
    idleTimeoutMs?: number;
    connectionTimeoutMs?: number;
    statementTimeoutMs?: number;
  };
}

export interface QueryPerformanceMetrics {
  queryId: string;
  query: string;
  executionTime: number;
  rowsReturned: number;
  rowsExamined: number;
  indexesUsed: string[];
  timestamp: Date;
  parameters?: any[];
}

export interface IndexRecommendation {
  tableName: string;
  columns: string[];
  indexType: 'BTREE' | 'HASH' | 'GIN' | 'GIST';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedImpact: string;
  reason: string;
  createStatement: string;
}

export interface DatabaseHealthMetrics {
  connectionPool: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingConnections: number;
    connectionUtilization: number;
  };
  queryPerformance: {
    averageQueryTime: number;
    slowQueries: number;
    totalQueries: number;
    queriesPerSecond: number;
  };
  indexUsage: {
    totalIndexes: number;
    unusedIndexes: number;
    indexHitRate: number;
  };
  tableStatistics: {
    totalTables: number;
    largestTable: { name: string; size: string };
    fragmentationLevel: number;
  };
}

export interface MaintenanceReport {
  timestamp: Date;
  duration: number;
  tasksCompleted: string[];
  errors: string[];
  statistics: {
    vacuumedTables: number;
    reindexedTables: number;
    analyzedTables: number;
    reclaimedSpace: string;
  };
}

/**
 * Database Performance Optimizer Service
 */
export class DatabasePerformanceOptimizer {
  private db = getDatabaseService();
  private config: Required<DatabasePerformanceConfig>;
  private queryMetrics: Map<string, QueryPerformanceMetrics[]> = new Map();
  private monitoringTimer?: NodeJS.Timeout;
  private maintenanceTimer?: NodeJS.Timeout;
  private indexAnalysisTimer?: NodeJS.Timeout;

  constructor(config: DatabasePerformanceConfig = {}) {
    this.config = {
      enableQueryMonitoring: true,
      enableAutoIndexing: false, // Disabled by default for safety
      enableConnectionPoolOptimization: true,
      slowQueryThreshold: 1000, // 1 second
      indexAnalysisInterval: 3600000, // 1 hour
      maintenanceInterval: 86400000, // 24 hours
      connectionPoolSettings: {
        minConnections: 5,
        maxConnections: 20,
        idleTimeoutMs: 30000,
        connectionTimeoutMs: 5000,
        statementTimeoutMs: 30000,
        ...config.connectionPoolSettings
      },
      ...config
    };

    this.startPerformanceMonitoring();
  }

  // ============================================================================
  // Database Indexing Optimization
  // ============================================================================

  /**
   * Create optimized indexes for template system
   */
  async createOptimizedIndexes(): Promise<{ created: string[]; errors: string[] }> {
    logger.info('Creating optimized database indexes for template system');

    const created: string[] = [];
    const errors: string[] = [];

    const indexes = [
      // Primary template table indexes
      {
        name: 'idx_prompt_templates_category_key_active',
        table: 'prompt_templates',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_templates_category_key_active ON prompt_templates(category, key) WHERE is_active = true'
      },
      {
        name: 'idx_prompt_templates_active_updated',
        table: 'prompt_templates',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_templates_active_updated ON prompt_templates(is_active, updated_at DESC) WHERE is_active = true'
      },
      {
        name: 'idx_prompt_templates_category_active',
        table: 'prompt_templates',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_templates_category_active ON prompt_templates(category) WHERE is_active = true'
      },
      {
        name: 'idx_prompt_templates_search',
        table: 'prompt_templates',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_templates_search ON prompt_templates USING gin(to_tsvector(\'english\', name || \' \' || description || \' \' || content))'
      },

      // Template versions table indexes
      {
        name: 'idx_prompt_template_versions_template_version',
        table: 'prompt_template_versions',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_template_versions_template_version ON prompt_template_versions(template_id, version_number DESC)'
      },
      {
        name: 'idx_prompt_template_versions_created',
        table: 'prompt_template_versions',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_template_versions_created ON prompt_template_versions(template_id, created_at DESC)'
      },

      // Template usage table indexes
      {
        name: 'idx_prompt_template_usage_template_date',
        table: 'prompt_template_usage',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_template_usage_template_date ON prompt_template_usage(template_id, created_at DESC)'
      },
      {
        name: 'idx_prompt_template_usage_success_time',
        table: 'prompt_template_usage',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_template_usage_success_time ON prompt_template_usage(success, execution_time_ms) WHERE success = true'
      },
      {
        name: 'idx_prompt_template_usage_context_gin',
        table: 'prompt_template_usage',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_template_usage_context_gin ON prompt_template_usage USING gin(usage_context)'
      },
      {
        name: 'idx_prompt_template_usage_user_date',
        table: 'prompt_template_usage',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_template_usage_user_date ON prompt_template_usage((usage_context->>\'userId\'), created_at DESC)'
      },

      // Template metrics table indexes
      {
        name: 'idx_prompt_template_metrics_template_type_date',
        table: 'prompt_template_metrics',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_template_metrics_template_type_date ON prompt_template_metrics(template_id, metric_type, measurement_date DESC)'
      },

      // Composite indexes for common query patterns
      {
        name: 'idx_templates_category_active_updated',
        table: 'prompt_templates',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_category_active_updated ON prompt_templates(category, is_active, updated_at DESC) WHERE is_active = true'
      },
      {
        name: 'idx_usage_template_success_date',
        table: 'prompt_template_usage',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_template_success_date ON prompt_template_usage(template_id, success, created_at DESC)'
      }
    ];

    for (const index of indexes) {
      try {
        await this.db.query(index.definition);
        created.push(index.name);
        logger.info('Database index created successfully', { 
          indexName: index.name, 
          table: index.table 
        });
      } catch (error) {
        const errorMsg = `Failed to create index ${index.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.error('Failed to create database index', { 
          indexName: index.name, 
          table: index.table, 
          error 
        });
      }
    }

    logger.info('Database index creation completed', { 
      created: created.length, 
      errors: errors.length 
    });

    return { created, errors };
  }

  /**
   * Analyze query performance and recommend indexes
   */
  async analyzeAndRecommendIndexes(): Promise<IndexRecommendation[]> {
    try {
      logger.info('Analyzing query performance for index recommendations');

      const recommendations: IndexRecommendation[] = [];

      // Analyze slow queries
      const slowQueries = await this.getSlowQueries();
      
      for (const query of slowQueries) {
        const queryRecommendations = await this.analyzeQueryForIndexes(query);
        recommendations.push(...queryRecommendations);
      }

      // Analyze table usage patterns
      const usagePatterns = await this.analyzeTableUsagePatterns();
      
      for (const pattern of usagePatterns) {
        const patternRecommendations = await this.generateIndexRecommendationsFromPattern(pattern);
        recommendations.push(...patternRecommendations);
      }

      // Remove duplicates and sort by priority
      const uniqueRecommendations = this.deduplicateRecommendations(recommendations);
      
      logger.info('Index analysis completed', { 
        recommendations: uniqueRecommendations.length 
      });

      return uniqueRecommendations.sort((a, b) => {
        const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

    } catch (error) {
      logger.error('Failed to analyze and recommend indexes', error);
      throw new AppError('Failed to analyze database performance', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Get unused indexes that can be dropped
   */
  async getUnusedIndexes(): Promise<Array<{
    schemaName: string;
    tableName: string;
    indexName: string;
    size: string;
    reason: string;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as size,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE idx_scan < 10 
          AND schemaname = 'public'
          AND indexname NOT LIKE '%_pkey'
        ORDER BY pg_relation_size(indexrelid) DESC
      `);

      return result.rows.map(row => ({
        schemaName: row.schemaname,
        tableName: row.tablename,
        indexName: row.indexname,
        size: row.size,
        reason: `Low usage: ${row.idx_scan} scans, ${row.idx_tup_read} tuples read`
      }));

    } catch (error) {
      logger.error('Failed to get unused indexes', error);
      return [];
    }
  }

  // ============================================================================
  // Query Performance Monitoring
  // ============================================================================

  /**
   * Monitor query performance
   */
  async recordQueryPerformance(
    queryId: string,
    query: string,
    executionTime: number,
    rowsReturned: number,
    parameters?: any[]
  ): Promise<void> {
    if (!this.config.enableQueryMonitoring) {
      return;
    }

    try {
      const metrics: QueryPerformanceMetrics = {
        queryId,
        query: query.substring(0, 500), // Truncate long queries
        executionTime,
        rowsReturned,
        rowsExamined: rowsReturned, // Simplified
        indexesUsed: [], // Would need EXPLAIN ANALYZE to populate
        timestamp: new Date(),
        parameters
      };

      // Store metrics
      const queryMetrics = this.queryMetrics.get(queryId) || [];
      queryMetrics.push(metrics);
      
      // Keep only last 100 executions per query
      if (queryMetrics.length > 100) {
        queryMetrics.shift();
      }
      
      this.queryMetrics.set(queryId, queryMetrics);

      // Log slow queries
      if (executionTime > this.config.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          queryId,
          executionTime,
          query: query.substring(0, 200),
          rowsReturned
        });
      }

    } catch (error) {
      logger.debug('Failed to record query performance', { queryId, error });
    }
  }

  /**
   * Get query performance statistics
   */
  async getQueryPerformanceStats(): Promise<{
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    topSlowQueries: Array<{
      queryId: string;
      query: string;
      averageTime: number;
      executionCount: number;
    }>;
  }> {
    try {
      let totalQueries = 0;
      let totalExecutionTime = 0;
      let slowQueries = 0;
      const queryStats = new Map<string, { totalTime: number; count: number; query: string }>();

      // Aggregate metrics
      for (const [queryId, metrics] of this.queryMetrics) {
        totalQueries += metrics.length;
        
        let queryTotalTime = 0;
        for (const metric of metrics) {
          totalExecutionTime += metric.executionTime;
          queryTotalTime += metric.executionTime;
          
          if (metric.executionTime > this.config.slowQueryThreshold) {
            slowQueries++;
          }
        }

        queryStats.set(queryId, {
          totalTime: queryTotalTime,
          count: metrics.length,
          query: metrics[0]?.query || ''
        });
      }

      // Get top slow queries
      const topSlowQueries = Array.from(queryStats.entries())
        .map(([queryId, stats]) => ({
          queryId,
          query: stats.query,
          averageTime: stats.totalTime / stats.count,
          executionCount: stats.count
        }))
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 10);

      return {
        totalQueries,
        averageExecutionTime: totalQueries > 0 ? totalExecutionTime / totalQueries : 0,
        slowQueries,
        topSlowQueries
      };

    } catch (error) {
      logger.error('Failed to get query performance stats', error);
      throw new AppError('Failed to get query performance statistics', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  // ============================================================================
  // Connection Pool Optimization
  // ============================================================================

  /**
   * Optimize database connection pool settings
   */
  async optimizeConnectionPool(): Promise<{
    recommendations: string[];
    currentSettings: any;
    optimizedSettings: any;
  }> {
    try {
      logger.info('Analyzing connection pool performance');

      const recommendations: string[] = [];
      const currentStats = await this.db.getStats();
      
      // Analyze connection usage patterns
      const utilizationRate = currentStats.totalConnections > 0 
        ? (currentStats.totalConnections - currentStats.idleConnections) / currentStats.totalConnections 
        : 0;

      const currentSettings = {
        totalConnections: currentStats.totalConnections,
        idleConnections: currentStats.idleConnections,
        waitingConnections: currentStats.waitingCount,
        utilizationRate: utilizationRate
      };

      const optimizedSettings = { ...this.config.connectionPoolSettings };

      // Analyze and recommend optimizations
      if (utilizationRate > 0.9) {
        recommendations.push('High connection utilization detected - consider increasing max connections');
        optimizedSettings.maxConnections = Math.min(50, (optimizedSettings.maxConnections || 20) * 1.5);
      } else if (utilizationRate < 0.3) {
        recommendations.push('Low connection utilization - consider reducing max connections');
        optimizedSettings.maxConnections = Math.max(5, Math.floor((optimizedSettings.maxConnections || 20) * 0.8));
      }

      if (currentStats.waitingCount > 0) {
        recommendations.push('Connection queue detected - increase max connections or reduce connection timeout');
        optimizedSettings.maxConnections = (optimizedSettings.maxConnections || 20) + 5;
        optimizedSettings.connectionTimeoutMs = Math.max(2000, (optimizedSettings.connectionTimeoutMs || 5000) - 1000);
      }

      if (currentStats.idleConnections > currentStats.totalConnections * 0.5) {
        recommendations.push('High idle connection count - consider reducing idle timeout');
        optimizedSettings.idleTimeoutMs = Math.max(10000, (optimizedSettings.idleTimeoutMs || 30000) * 0.8);
      }

      logger.info('Connection pool analysis completed', {
        utilizationRate,
        recommendations: recommendations.length
      });

      return {
        recommendations,
        currentSettings,
        optimizedSettings
      };

    } catch (error) {
      logger.error('Failed to optimize connection pool', error);
      throw new AppError('Failed to optimize connection pool', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  // ============================================================================
  // Database Maintenance
  // ============================================================================

  /**
   * Perform comprehensive database maintenance
   */
  async performMaintenance(): Promise<MaintenanceReport> {
    const startTime = Date.now();
    logger.info('Starting database maintenance');

    const tasksCompleted: string[] = [];
    const errors: string[] = [];
    const statistics = {
      vacuumedTables: 0,
      reindexedTables: 0,
      analyzedTables: 0,
      reclaimedSpace: '0 MB'
    };

    try {
      // 1. Vacuum and analyze template tables
      const templateTables = [
        'prompt_templates',
        'prompt_template_versions',
        'prompt_template_usage',
        'prompt_template_metrics'
      ];

      for (const table of templateTables) {
        try {
          // Get table size before maintenance
          const sizeBefore = await this.getTableSize(table);
          
          // Vacuum and analyze
          await this.db.query(`VACUUM ANALYZE ${table}`);
          
          // Get table size after maintenance
          const sizeAfter = await this.getTableSize(table);
          
          statistics.vacuumedTables++;
          statistics.analyzedTables++;
          
          const reclaimedBytes = sizeBefore - sizeAfter;
          if (reclaimedBytes > 0) {
            statistics.reclaimedSpace = this.formatBytes(
              this.parseBytes(statistics.reclaimedSpace) + reclaimedBytes
            );
          }
          
          tasksCompleted.push(`Vacuumed and analyzed table: ${table}`);
          logger.debug('Table maintenance completed', { table, sizeBefore, sizeAfter });
          
        } catch (error) {
          const errorMsg = `Failed to maintain table ${table}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.error('Table maintenance failed', { table, error });
        }
      }

      // 2. Reindex critical indexes
      const criticalIndexes = [
        'idx_prompt_templates_category_key_active',
        'idx_prompt_template_usage_template_date',
        'idx_prompt_template_versions_template_version'
      ];

      for (const indexName of criticalIndexes) {
        try {
          await this.db.query(`REINDEX INDEX CONCURRENTLY ${indexName}`);
          statistics.reindexedTables++;
          tasksCompleted.push(`Reindexed: ${indexName}`);
          logger.debug('Index reindexed', { indexName });
        } catch (error) {
          const errorMsg = `Failed to reindex ${indexName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.error('Index reindexing failed', { indexName, error });
        }
      }

      // 3. Update table statistics
      try {
        await this.db.query('ANALYZE');
        tasksCompleted.push('Updated database statistics');
      } catch (error) {
        errors.push(`Failed to update statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // 4. Clean up old usage data (older than retention period)
      try {
        const retentionDays = 90; // Keep 90 days of usage data
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        
        const deleteResult = await this.db.query(`
          DELETE FROM prompt_template_usage 
          WHERE created_at < $1
        `, [cutoffDate]);
        
        tasksCompleted.push(`Cleaned up old usage data: ${deleteResult.rowCount || 0} records removed`);
      } catch (error) {
        errors.push(`Failed to clean up old data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // 5. Optimize template metrics aggregation
      try {
        await this.optimizeMetricsAggregation();
        tasksCompleted.push('Optimized metrics aggregation');
      } catch (error) {
        errors.push(`Failed to optimize metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      const errorMsg = `Database maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      logger.error('Database maintenance failed', error);
    }

    const duration = Date.now() - startTime;
    
    logger.info('Database maintenance completed', {
      duration,
      tasksCompleted: tasksCompleted.length,
      errors: errors.length,
      statistics
    });

    return {
      timestamp: new Date(),
      duration,
      tasksCompleted,
      errors,
      statistics
    };
  }

  /**
   * Get comprehensive database health metrics
   */
  async getDatabaseHealthMetrics(): Promise<DatabaseHealthMetrics> {
    try {
      // Connection pool metrics
      const poolStats = await this.db.getStats();
      const connectionUtilization = poolStats.totalConnections > 0 
        ? (poolStats.totalConnections - poolStats.idleConnections) / poolStats.totalConnections 
        : 0;

      // Query performance metrics
      const queryStats = await this.getQueryPerformanceStats();

      // Index usage metrics
      const indexStats = await this.getIndexUsageStats();

      // Table statistics
      const tableStats = await this.getTableStatistics();

      return {
        connectionPool: {
          totalConnections: poolStats.totalConnections,
          activeConnections: poolStats.totalConnections - poolStats.idleConnections,
          idleConnections: poolStats.idleConnections,
          waitingConnections: poolStats.waitingCount,
          connectionUtilization
        },
        queryPerformance: {
          averageQueryTime: queryStats.averageExecutionTime,
          slowQueries: queryStats.slowQueries,
          totalQueries: queryStats.totalQueries,
          queriesPerSecond: queryStats.totalQueries / 3600 // Approximate based on last hour
        },
        indexUsage: indexStats,
        tableStatistics: tableStats
      };

    } catch (error) {
      logger.error('Failed to get database health metrics', error);
      throw new AppError('Failed to get database health metrics', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get slow queries from monitoring data
   */
  private async getSlowQueries(): Promise<QueryPerformanceMetrics[]> {
    const slowQueries: QueryPerformanceMetrics[] = [];

    for (const metrics of this.queryMetrics.values()) {
      for (const metric of metrics) {
        if (metric.executionTime > this.config.slowQueryThreshold) {
          slowQueries.push(metric);
        }
      }
    }

    return slowQueries.sort((a, b) => b.executionTime - a.executionTime).slice(0, 20);
  }

  /**
   * Analyze query for index recommendations
   */
  private async analyzeQueryForIndexes(query: QueryPerformanceMetrics): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Simple pattern matching for common query patterns
    const queryText = query.query.toLowerCase();

    // WHERE clause analysis
    if (queryText.includes('where') && queryText.includes('template_id')) {
      if (!queryText.includes('created_at') && query.executionTime > 500) {
        recommendations.push({
          tableName: 'prompt_template_usage',
          columns: ['template_id', 'created_at'],
          indexType: 'BTREE',
          priority: 'HIGH',
          estimatedImpact: 'Reduce query time by 60-80%',
          reason: 'Frequent filtering by template_id with date range queries',
          createStatement: 'CREATE INDEX CONCURRENTLY idx_usage_template_date ON prompt_template_usage(template_id, created_at DESC)'
        });
      }
    }

    // JOIN analysis
    if (queryText.includes('join') && queryText.includes('prompt_templates')) {
      recommendations.push({
        tableName: 'prompt_templates',
        columns: ['category', 'is_active'],
        indexType: 'BTREE',
        priority: 'MEDIUM',
        estimatedImpact: 'Improve JOIN performance by 40-60%',
        reason: 'Frequent JOINs on category with active filter',
        createStatement: 'CREATE INDEX CONCURRENTLY idx_templates_category_active ON prompt_templates(category, is_active) WHERE is_active = true'
      });
    }

    // ORDER BY analysis
    if (queryText.includes('order by') && queryText.includes('updated_at')) {
      recommendations.push({
        tableName: 'prompt_templates',
        columns: ['updated_at'],
        indexType: 'BTREE',
        priority: 'MEDIUM',
        estimatedImpact: 'Eliminate sorting overhead',
        reason: 'Frequent sorting by updated_at',
        createStatement: 'CREATE INDEX CONCURRENTLY idx_templates_updated_desc ON prompt_templates(updated_at DESC)'
      });
    }

    return recommendations;
  }

  /**
   * Analyze table usage patterns
   */
  private async analyzeTableUsagePatterns(): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_tup_ins,
          n_tup_upd,
          n_tup_del
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
          AND tablename LIKE 'prompt_template%'
        ORDER BY seq_scan DESC
      `);

      return result.rows;

    } catch (error) {
      logger.error('Failed to analyze table usage patterns', error);
      return [];
    }
  }

  /**
   * Generate index recommendations from usage patterns
   */
  private async generateIndexRecommendationsFromPattern(pattern: any): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // High sequential scan ratio indicates missing indexes
    const totalScans = pattern.seq_scan + (pattern.idx_scan || 0);
    const seqScanRatio = totalScans > 0 ? pattern.seq_scan / totalScans : 0;

    if (seqScanRatio > 0.5 && pattern.seq_scan > 100) {
      recommendations.push({
        tableName: pattern.tablename,
        columns: ['created_at'], // Generic recommendation
        indexType: 'BTREE',
        priority: 'HIGH',
        estimatedImpact: 'Reduce sequential scans by 70-90%',
        reason: `High sequential scan ratio: ${(seqScanRatio * 100).toFixed(1)}%`,
        createStatement: `CREATE INDEX CONCURRENTLY idx_${pattern.tablename}_created ON ${pattern.tablename}(created_at DESC)`
      });
    }

    return recommendations;
  }

  /**
   * Deduplicate index recommendations
   */
  private deduplicateRecommendations(recommendations: IndexRecommendation[]): IndexRecommendation[] {
    const seen = new Set<string>();
    const unique: IndexRecommendation[] = [];

    for (const rec of recommendations) {
      const key = `${rec.tableName}:${rec.columns.join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rec);
      }
    }

    return unique;
  }

  /**
   * Get table size in bytes
   */
  private async getTableSize(tableName: string): Promise<number> {
    try {
      const result = await this.db.query(`
        SELECT pg_total_relation_size($1) as size
      `, [tableName]);

      return parseInt(result.rows[0]?.size || '0');

    } catch (error) {
      logger.debug('Failed to get table size', { tableName, error });
      return 0;
    }
  }

  /**
   * Get index usage statistics
   */
  private async getIndexUsageStats(): Promise<{
    totalIndexes: number;
    unusedIndexes: number;
    indexHitRate: number;
  }> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_indexes,
          COUNT(CASE WHEN idx_scan < 10 THEN 1 END) as unused_indexes,
          COALESCE(
            SUM(idx_blks_hit)::float / NULLIF(SUM(idx_blks_hit + idx_blks_read), 0),
            0
          ) as index_hit_rate
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
      `);

      const stats = result.rows[0];
      return {
        totalIndexes: parseInt(stats.total_indexes || '0'),
        unusedIndexes: parseInt(stats.unused_indexes || '0'),
        indexHitRate: parseFloat(stats.index_hit_rate || '0')
      };

    } catch (error) {
      logger.error('Failed to get index usage stats', error);
      return { totalIndexes: 0, unusedIndexes: 0, indexHitRate: 0 };
    }
  }

  /**
   * Get table statistics
   */
  private async getTableStatistics(): Promise<{
    totalTables: number;
    largestTable: { name: string; size: string };
    fragmentationLevel: number;
  }> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_tables,
          (SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
           ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 1) as largest_table_name,
          (SELECT pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
           FROM pg_tables WHERE schemaname = 'public' 
           ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 1) as largest_table_size
        FROM pg_tables 
        WHERE schemaname = 'public'
      `);

      const stats = result.rows[0];
      
      // Simplified fragmentation calculation
      const fragmentationLevel = 0.1; // Placeholder - would need more complex analysis

      return {
        totalTables: parseInt(stats.total_tables || '0'),
        largestTable: {
          name: stats.largest_table_name || 'unknown',
          size: stats.largest_table_size || '0 bytes'
        },
        fragmentationLevel
      };

    } catch (error) {
      logger.error('Failed to get table statistics', error);
      return {
        totalTables: 0,
        largestTable: { name: 'unknown', size: '0 bytes' },
        fragmentationLevel: 0
      };
    }
  }

  /**
   * Optimize metrics aggregation
   */
  private async optimizeMetricsAggregation(): Promise<void> {
    try {
      // Create or refresh materialized view for metrics aggregation
      await this.db.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS template_metrics_summary AS
        SELECT 
          template_id,
          DATE(created_at) as date,
          COUNT(*) as usage_count,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(DISTINCT usage_context->>'userId') as unique_users,
          SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
        FROM prompt_template_usage
        WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY template_id, DATE(created_at)
      `);

      // Refresh the materialized view
      await this.db.query('REFRESH MATERIALIZED VIEW template_metrics_summary');

      // Create index on the materialized view
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_template_metrics_summary_template_date 
        ON template_metrics_summary(template_id, date DESC)
      `);

    } catch (error) {
      logger.error('Failed to optimize metrics aggregation', error);
      throw error;
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 bytes';
    
    const k = 1024;
    const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Parse bytes from human readable string
   */
  private parseBytes(str: string): number {
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(bytes|KB|MB|GB|TB)$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers: Record<string, number> = {
      'BYTES': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };
    
    return value * (multipliers[unit] || 1);
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Start index analysis timer
    this.indexAnalysisTimer = setInterval(async () => {
      try {
        const recommendations = await this.analyzeAndRecommendIndexes();
        if (recommendations.length > 0) {
          logger.info('Index recommendations available', { count: recommendations.length });
        }
      } catch (error) {
        logger.error('Scheduled index analysis failed', error);
      }
    }, this.config.indexAnalysisInterval);

    // Start maintenance timer
    this.maintenanceTimer = setInterval(async () => {
      try {
        await this.performMaintenance();
      } catch (error) {
        logger.error('Scheduled database maintenance failed', error);
      }
    }, this.config.maintenanceInterval);
  }

  /**
   * Shutdown the performance optimizer
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Database Performance Optimizer');

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }

    if (this.indexAnalysisTimer) {
      clearInterval(this.indexAnalysisTimer);
    }

    logger.info('Database Performance Optimizer shut down successfully');
  }
}

// Singleton instance
let databasePerformanceOptimizerInstance: DatabasePerformanceOptimizer | null = null;

/**
 * Initialize the Database Performance Optimizer service
 */
export function initializeDatabasePerformanceOptimizer(config?: DatabasePerformanceConfig): DatabasePerformanceOptimizer {
  if (!databasePerformanceOptimizerInstance) {
    databasePerformanceOptimizerInstance = new DatabasePerformanceOptimizer(config);
    logger.info('Database Performance Optimizer initialized');
  }
  return databasePerformanceOptimizerInstance;
}

/**
 * Get the Database Performance Optimizer service instance
 */
export function getDatabasePerformanceOptimizer(): DatabasePerformanceOptimizer {
  if (!databasePerformanceOptimizerInstance) {
    throw new AppError(
      'Database Performance Optimizer not initialized',
      500,
      ErrorCode.SERVICE_UNAVAILABLE
    );
  }
  return databasePerformanceOptimizerInstance;
}