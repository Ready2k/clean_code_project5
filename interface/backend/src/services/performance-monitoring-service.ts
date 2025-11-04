/**
 * Performance Monitoring Service
 * 
 * Centralized service that integrates cache performance monitoring and database
 * performance optimization to provide comprehensive system performance insights
 * and automated optimization recommendations.
 */

import { getTemplateCachePerformanceMonitor, TemplateCachePerformanceMonitor } from './template-cache-performance-monitor.js';
import { getDatabasePerformanceOptimizer, DatabasePerformanceOptimizer } from './database-performance-optimizer.js';
import { logger } from '../utils/logger.js';
import { AppError, ErrorCode } from '../types/errors.js';

export interface PerformanceMonitoringConfig {
  enableAutomaticOptimization?: boolean;
  enableAlerts?: boolean;
  monitoringInterval?: number;
  alertThresholds?: {
    cacheHitRate?: number;
    queryResponseTime?: number;
    connectionUtilization?: number;
    errorRate?: number;
  };
  optimizationSchedule?: {
    cacheOptimization?: string; // Cron expression
    databaseMaintenance?: string; // Cron expression
  };
}

export interface SystemPerformanceMetrics {
  timestamp: Date;
  cache: {
    hitRate: number;
    averageResponseTime: number;
    memoryUsage: number;
    throughput: number;
    errorRate: number;
  };
  database: {
    connectionUtilization: number;
    averageQueryTime: number;
    slowQueries: number;
    indexHitRate: number;
  };
  overall: {
    healthScore: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'DEGRADED';
    recommendations: string[];
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'CACHE' | 'DATABASE' | 'SYSTEM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  timestamp: Date;
  metrics: any;
  recommendations: string[];
  acknowledged: boolean;
}

export interface OptimizationReport {
  timestamp: Date;
  duration: number;
  cacheOptimization: {
    warmed: number;
    evicted: number;
    errors: string[];
  };
  databaseOptimization: {
    indexesCreated: string[];
    maintenanceCompleted: string[];
    errors: string[];
  };
  performanceImpact: {
    cacheHitRateImprovement: number;
    queryTimeImprovement: number;
    overallHealthImprovement: number;
  };
}

/**
 * Performance Monitoring Service
 */
export class PerformanceMonitoringService {
  private cacheMonitor: TemplateCachePerformanceMonitor;
  private dbOptimizer: DatabasePerformanceOptimizer;
  private config: Required<PerformanceMonitoringConfig>;
  private monitoringTimer?: NodeJS.Timeout;
  private alerts: Map<string, PerformanceAlert> = new Map();
  private metricsHistory: SystemPerformanceMetrics[] = [];

  constructor(config: PerformanceMonitoringConfig = {}) {
    this.config = {
      enableAutomaticOptimization: false, // Disabled by default for safety
      enableAlerts: true,
      monitoringInterval: 60000, // 1 minute
      alertThresholds: {
        cacheHitRate: 0.7,
        queryResponseTime: 1000,
        connectionUtilization: 0.8,
        errorRate: 0.05,
        ...config.alertThresholds
      },
      optimizationSchedule: {
        cacheOptimization: '0 */15 * * * *', // Every 15 minutes
        databaseMaintenance: '0 0 2 * * *', // Daily at 2 AM
        ...config.optimizationSchedule
      },
      ...config
    };

    this.cacheMonitor = getTemplateCachePerformanceMonitor();
    this.dbOptimizer = getDatabasePerformanceOptimizer();

    this.startPerformanceMonitoring();
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  /**
   * Get comprehensive system performance metrics
   */
  async getSystemPerformanceMetrics(): Promise<SystemPerformanceMetrics> {
    try {
      // Get cache performance metrics
      const cacheMetrics = await this.cacheMonitor.getPerformanceMetrics();
      
      // Get database health metrics
      const dbMetrics = await this.dbOptimizer.getDatabaseHealthMetrics();

      // Calculate overall health score
      const healthScore = this.calculateHealthScore(cacheMetrics, dbMetrics);
      
      // Determine system status
      const status = this.determineSystemStatus(healthScore, cacheMetrics, dbMetrics);
      
      // Generate recommendations
      const recommendations = await this.generateSystemRecommendations(cacheMetrics, dbMetrics);

      const systemMetrics: SystemPerformanceMetrics = {
        timestamp: new Date(),
        cache: {
          hitRate: cacheMetrics.hitRate,
          averageResponseTime: cacheMetrics.averageResponseTime,
          memoryUsage: cacheMetrics.memoryUsage,
          throughput: cacheMetrics.throughput,
          errorRate: cacheMetrics.errorRate
        },
        database: {
          connectionUtilization: dbMetrics.connectionPool.connectionUtilization,
          averageQueryTime: dbMetrics.queryPerformance.averageQueryTime,
          slowQueries: dbMetrics.queryPerformance.slowQueries,
          indexHitRate: dbMetrics.indexUsage.indexHitRate
        },
        overall: {
          healthScore,
          status,
          recommendations
        }
      };

      // Store in history
      this.metricsHistory.push(systemMetrics);
      
      // Keep only last 1440 entries (24 hours at 1-minute intervals)
      if (this.metricsHistory.length > 1440) {
        this.metricsHistory.shift();
      }

      return systemMetrics;

    } catch (error) {
      logger.error('Failed to get system performance metrics', error);
      throw new AppError('Failed to get system performance metrics', 500, ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(hours: number = 24): Promise<{
    timeRange: { start: Date; end: Date };
    trends: {
      cacheHitRate: Array<{ timestamp: Date; value: number }>;
      queryResponseTime: Array<{ timestamp: Date; value: number }>;
      healthScore: Array<{ timestamp: Date; value: number }>;
    };
    summary: {
      averageHealthScore: number;
      healthScoreChange: number;
      cacheHitRateChange: number;
      queryTimeChange: number;
    };
  }> {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
      
      // Filter metrics within time range
      const relevantMetrics = this.metricsHistory.filter(
        metric => metric.timestamp >= startTime && metric.timestamp <= now
      );

      if (relevantMetrics.length === 0) {
        throw new AppError('No performance data available for the specified time range', 404, ErrorCode.NOT_FOUND);
      }

      // Extract trends
      const cacheHitRate = relevantMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.cache.hitRate
      }));

      const queryResponseTime = relevantMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.database.averageQueryTime
      }));

      const healthScore = relevantMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.overall.healthScore
      }));

      // Calculate summary statistics
      const averageHealthScore = healthScore.reduce((sum, item) => sum + item.value, 0) / healthScore.length;
      
      const firstMetric = relevantMetrics[0];
      const lastMetric = relevantMetrics[relevantMetrics.length - 1];
      
      const healthScoreChange = lastMetric.overall.healthScore - firstMetric.overall.healthScore;
      const cacheHitRateChange = lastMetric.cache.hitRate - firstMetric.cache.hitRate;
      const queryTimeChange = lastMetric.database.averageQueryTime - firstMetric.database.averageQueryTime;

      return {
        timeRange: { start: startTime, end: now },
        trends: {
          cacheHitRate,
          queryResponseTime,
          healthScore
        },
        summary: {
          averageHealthScore,
          healthScoreChange,
          cacheHitRateChange,
          queryTimeChange
        }
      };

    } catch (error) {
      logger.error('Failed to get performance trends', error);
      throw new AppError('Failed to get performance trends', 500, ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  // ============================================================================
  // Alert Management
  // ============================================================================

  /**
   * Check for performance issues and generate alerts
   */
  async checkPerformanceAlerts(): Promise<PerformanceAlert[]> {
    if (!this.config.enableAlerts) {
      return [];
    }

    try {
      const metrics = await this.getSystemPerformanceMetrics();
      const newAlerts: PerformanceAlert[] = [];

      // Check cache hit rate
      if (metrics.cache.hitRate < this.config.alertThresholds.cacheHitRate!) {
        const alert = this.createAlert(
          'CACHE',
          metrics.cache.hitRate < 0.5 ? 'CRITICAL' : 'HIGH',
          'Low Cache Hit Rate',
          `Cache hit rate is ${(metrics.cache.hitRate * 100).toFixed(1)}%, below threshold of ${(this.config.alertThresholds.cacheHitRate! * 100).toFixed(1)}%`,
          { hitRate: metrics.cache.hitRate },
          [
            'Consider increasing cache size',
            'Review cache warming strategy',
            'Analyze cache key patterns'
          ]
        );
        newAlerts.push(alert);
      }

      // Check query response time
      if (metrics.database.averageQueryTime > this.config.alertThresholds.queryResponseTime!) {
        const alert = this.createAlert(
          'DATABASE',
          metrics.database.averageQueryTime > 2000 ? 'CRITICAL' : 'HIGH',
          'High Query Response Time',
          `Average query time is ${metrics.database.averageQueryTime.toFixed(1)}ms, above threshold of ${this.config.alertThresholds.queryResponseTime}ms`,
          { averageQueryTime: metrics.database.averageQueryTime },
          [
            'Review slow queries',
            'Consider adding database indexes',
            'Optimize query patterns'
          ]
        );
        newAlerts.push(alert);
      }

      // Check connection utilization
      if (metrics.database.connectionUtilization > this.config.alertThresholds.connectionUtilization!) {
        const alert = this.createAlert(
          'DATABASE',
          metrics.database.connectionUtilization > 0.95 ? 'CRITICAL' : 'MEDIUM',
          'High Connection Utilization',
          `Database connection utilization is ${(metrics.database.connectionUtilization * 100).toFixed(1)}%, above threshold of ${(this.config.alertThresholds.connectionUtilization! * 100).toFixed(1)}%`,
          { connectionUtilization: metrics.database.connectionUtilization },
          [
            'Increase connection pool size',
            'Optimize connection usage patterns',
            'Review long-running queries'
          ]
        );
        newAlerts.push(alert);
      }

      // Check error rate
      if (metrics.cache.errorRate > this.config.alertThresholds.errorRate!) {
        const alert = this.createAlert(
          'SYSTEM',
          metrics.cache.errorRate > 0.1 ? 'CRITICAL' : 'HIGH',
          'High Error Rate',
          `System error rate is ${(metrics.cache.errorRate * 100).toFixed(1)}%, above threshold of ${(this.config.alertThresholds.errorRate! * 100).toFixed(1)}%`,
          { errorRate: metrics.cache.errorRate },
          [
            'Check system logs for errors',
            'Verify service connectivity',
            'Review error handling patterns'
          ]
        );
        newAlerts.push(alert);
      }

      // Store new alerts
      for (const alert of newAlerts) {
        this.alerts.set(alert.id, alert);
      }

      logger.info('Performance alerts checked', { 
        newAlerts: newAlerts.length, 
        totalAlerts: this.alerts.size 
      });

      return newAlerts;

    } catch (error) {
      logger.error('Failed to check performance alerts', error);
      return [];
    }
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => {
        const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      logger.info('Alert acknowledged', { alertId, type: alert.type, severity: alert.severity });
      return true;
    }
    return false;
  }

  // ============================================================================
  // Automated Optimization
  // ============================================================================

  /**
   * Perform automated system optimization
   */
  async performAutomatedOptimization(): Promise<OptimizationReport> {
    if (!this.config.enableAutomaticOptimization) {
      throw new AppError('Automated optimization is disabled', 400, ErrorCode.VALIDATION_ERROR);
    }

    const startTime = Date.now();
    logger.info('Starting automated system optimization');

    try {
      // Get baseline metrics
      const baselineMetrics = await this.getSystemPerformanceMetrics();

      // Perform cache optimization
      const cacheOptimization = await this.optimizeCache();

      // Perform database optimization
      const databaseOptimization = await this.optimizeDatabase();

      // Wait a moment for changes to take effect
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get post-optimization metrics
      const postOptimizationMetrics = await this.getSystemPerformanceMetrics();

      // Calculate performance impact
      const performanceImpact = {
        cacheHitRateImprovement: postOptimizationMetrics.cache.hitRate - baselineMetrics.cache.hitRate,
        queryTimeImprovement: baselineMetrics.database.averageQueryTime - postOptimizationMetrics.database.averageQueryTime,
        overallHealthImprovement: postOptimizationMetrics.overall.healthScore - baselineMetrics.overall.healthScore
      };

      const duration = Date.now() - startTime;

      const report: OptimizationReport = {
        timestamp: new Date(),
        duration,
        cacheOptimization,
        databaseOptimization,
        performanceImpact
      };

      logger.info('Automated optimization completed', {
        duration,
        cacheWarmed: cacheOptimization.warmed,
        cacheEvicted: cacheOptimization.evicted,
        indexesCreated: databaseOptimization.indexesCreated.length,
        healthImprovement: performanceImpact.overallHealthImprovement
      });

      return report;

    } catch (error) {
      logger.error('Automated optimization failed', error);
      throw new AppError('Automated optimization failed', 500, ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Calculate overall system health score (0-100)
   */
  private calculateHealthScore(cacheMetrics: any, dbMetrics: any): number {
    // Cache health (0-40 points)
    const cacheScore = Math.min(40, 
      (cacheMetrics.hitRate * 20) + 
      (Math.max(0, 1 - cacheMetrics.averageResponseTime / 100) * 10) +
      (Math.max(0, 1 - cacheMetrics.errorRate) * 10)
    );

    // Database health (0-40 points)
    const dbScore = Math.min(40,
      (Math.max(0, 1 - dbMetrics.connectionPool.connectionUtilization) * 15) +
      (Math.max(0, 1 - dbMetrics.queryPerformance.averageQueryTime / 1000) * 15) +
      (dbMetrics.indexUsage.indexHitRate * 10)
    );

    // System stability (0-20 points)
    const stabilityScore = Math.min(20,
      (Math.max(0, 1 - cacheMetrics.errorRate) * 10) +
      (Math.max(0, 1 - dbMetrics.queryPerformance.slowQueries / 100) * 10)
    );

    return Math.round(cacheScore + dbScore + stabilityScore);
  }

  /**
   * Determine system status based on health score and metrics
   */
  private determineSystemStatus(
    healthScore: number, 
    cacheMetrics: any, 
    dbMetrics: any
  ): 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'DEGRADED' {
    if (healthScore >= 80) {
      return 'HEALTHY';
    } else if (healthScore >= 60) {
      return 'WARNING';
    } else if (healthScore >= 40) {
      return 'DEGRADED';
    } else {
      return 'CRITICAL';
    }
  }

  /**
   * Generate system-wide recommendations
   */
  private async generateSystemRecommendations(cacheMetrics: any, dbMetrics: any): Promise<string[]> {
    const recommendations: string[] = [];

    // Cache recommendations
    if (cacheMetrics.hitRate < 0.7) {
      recommendations.push('Improve cache hit rate through better warming strategies');
    }
    if (cacheMetrics.averageResponseTime > 50) {
      recommendations.push('Optimize cache response times');
    }

    // Database recommendations
    if (dbMetrics.connectionPool.connectionUtilization > 0.8) {
      recommendations.push('Increase database connection pool size');
    }
    if (dbMetrics.queryPerformance.averageQueryTime > 500) {
      recommendations.push('Optimize slow database queries');
    }
    if (dbMetrics.indexUsage.indexHitRate < 0.9) {
      recommendations.push('Review and optimize database indexes');
    }

    // Get specific recommendations from subsystems
    try {
      const cacheRecommendations = await this.cacheMonitor.getOptimizationRecommendations();
      const dbRecommendations = await this.dbOptimizer.analyzeAndRecommendIndexes();

      // Add top recommendations from each subsystem
      cacheRecommendations.slice(0, 2).forEach(rec => {
        recommendations.push(`Cache: ${rec.description}`);
      });

      dbRecommendations.slice(0, 2).forEach(rec => {
        recommendations.push(`Database: ${rec.reason}`);
      });

    } catch (error) {
      logger.debug('Failed to get detailed recommendations', error);
    }

    return recommendations.slice(0, 8); // Limit to top 8 recommendations
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: 'CACHE' | 'DATABASE' | 'SYSTEM',
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    title: string,
    message: string,
    metrics: any,
    recommendations: string[]
  ): PerformanceAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      message,
      timestamp: new Date(),
      metrics,
      recommendations,
      acknowledged: false
    };
  }

  /**
   * Optimize cache performance
   */
  private async optimizeCache(): Promise<{
    warmed: number;
    evicted: number;
    errors: string[];
  }> {
    try {
      const [warmingResult, evictionResult] = await Promise.all([
        this.cacheMonitor.performPredictiveWarming(),
        this.cacheMonitor.performAdaptiveEviction()
      ]);

      return {
        warmed: warmingResult.warmed,
        evicted: evictionResult.evicted,
        errors: [...warmingResult.errors, ...evictionResult.errors]
      };

    } catch (error) {
      logger.error('Cache optimization failed', error);
      return {
        warmed: 0,
        evicted: 0,
        errors: [`Cache optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Optimize database performance
   */
  private async optimizeDatabase(): Promise<{
    indexesCreated: string[];
    maintenanceCompleted: string[];
    errors: string[];
  }> {
    try {
      const [indexResult, maintenanceResult] = await Promise.all([
        this.dbOptimizer.createOptimizedIndexes(),
        this.dbOptimizer.performMaintenance()
      ]);

      return {
        indexesCreated: indexResult.created,
        maintenanceCompleted: maintenanceResult.tasksCompleted,
        errors: [...indexResult.errors, ...maintenanceResult.errors]
      };

    } catch (error) {
      logger.error('Database optimization failed', error);
      return {
        indexesCreated: [],
        maintenanceCompleted: [],
        errors: [`Database optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      try {
        // Collect metrics
        await this.getSystemPerformanceMetrics();
        
        // Check for alerts
        if (this.config.enableAlerts) {
          await this.checkPerformanceAlerts();
        }

      } catch (error) {
        logger.error('Performance monitoring cycle failed', error);
      }
    }, this.config.monitoringInterval);

    logger.info('Performance monitoring started', {
      interval: this.config.monitoringInterval,
      alertsEnabled: this.config.enableAlerts,
      autoOptimizationEnabled: this.config.enableAutomaticOptimization
    });
  }

  /**
   * Shutdown the performance monitoring service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Performance Monitoring Service');

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    // Shutdown subsystems
    await Promise.all([
      this.cacheMonitor.shutdown(),
      this.dbOptimizer.shutdown()
    ]);

    logger.info('Performance Monitoring Service shut down successfully');
  }
}

// Singleton instance
let performanceMonitoringServiceInstance: PerformanceMonitoringService | null = null;

/**
 * Initialize the Performance Monitoring Service
 */
export function initializePerformanceMonitoringService(config?: PerformanceMonitoringConfig): PerformanceMonitoringService {
  if (!performanceMonitoringServiceInstance) {
    performanceMonitoringServiceInstance = new PerformanceMonitoringService(config);
    logger.info('Performance Monitoring Service initialized');
  }
  return performanceMonitoringServiceInstance;
}

/**
 * Get the Performance Monitoring Service instance
 */
export function getPerformanceMonitoringService(): PerformanceMonitoringService {
  if (!performanceMonitoringServiceInstance) {
    throw new AppError(
      'Performance Monitoring Service not initialized',
      500,
      ErrorCode.SERVICE_UNAVAILABLE
    );
  }
  return performanceMonitoringServiceInstance;
}