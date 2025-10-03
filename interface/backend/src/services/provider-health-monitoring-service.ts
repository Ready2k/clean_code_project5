/**
 * Provider Health Monitoring Service
 * 
 * Comprehensive health monitoring system for dynamic providers including:
 * - Periodic health checks
 * - Performance metrics collection and storage
 * - Alerting for provider failures and degradation
 * - Historical health data tracking
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { getDynamicProviderService } from './dynamic-provider-service.js';
import { getProviderValidationService } from './provider-validation-service.js';
import { getDatabaseService } from './database-service.js';
import { 
  Provider, 
  ProviderHealth
} from '../types/dynamic-providers.js';

export interface HealthMonitoringConfig {
  healthCheckInterval: number; // milliseconds
  performanceMetricsInterval: number; // milliseconds
  alertThresholds: {
    responseTimeMs: number;
    errorRatePercent: number;
    uptimePercent: number;
  };
  retentionDays: number;
  enableAlerting: boolean;
  enableMetricsCollection: boolean;
}

export interface PerformanceMetrics {
  providerId: string;
  timestamp: Date;
  responseTime: number;
  success: boolean;
  error?: string;
  requestCount: number;
  errorCount: number;
  uptime: number;
  availability: number;
}

export interface HealthAlert {
  id: string;
  providerId: string;
  type: 'degraded' | 'down' | 'recovered';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface HealthSummary {
  providerId: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  availability: number;
  averageResponseTime: number;
  errorRate: number;
  lastCheck: Date;
  lastError?: string;
  alertCount: number;
  metricsCount: number;
}

/**
 * Provider Health Monitoring Service
 */
export class ProviderHealthMonitoringService extends EventEmitter {
  private config: HealthMonitoringConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private isRunning = false;
  private healthCache = new Map<string, ProviderHealth>();
  // Cache for future use
  // private metricsCache = new Map<string, PerformanceMetrics[]>();
  // private alertsCache = new Map<string, HealthAlert[]>();

  constructor(config?: Partial<HealthMonitoringConfig>) {
    super();
    
    this.config = {
      healthCheckInterval: 5 * 60 * 1000, // 5 minutes
      performanceMetricsInterval: 1 * 60 * 1000, // 1 minute
      alertThresholds: {
        responseTimeMs: 5000, // 5 seconds
        errorRatePercent: 10, // 10%
        uptimePercent: 95, // 95%
      },
      retentionDays: 30,
      enableAlerting: true,
      enableMetricsCollection: true,
      ...config
    };

    logger.info('Provider health monitoring service initialized', { config: this.config });
  }

  /**
   * Start health monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Health monitoring service is already running');
      return;
    }

    logger.info('Starting provider health monitoring service');
    this.isRunning = true;

    try {
      // Initialize database tables
      await this.initializeTables();

      // Load existing health data
      await this.loadHealthData();

      // Perform initial health check
      await this.performHealthChecks();

      // Start periodic health checks
      this.startHealthChecks();

      // Start performance metrics collection
      if (this.config.enableMetricsCollection) {
        this.startMetricsCollection();
      }

      // Clean up old data
      await this.cleanupOldData();

      this.emit('started');
      logger.info('Provider health monitoring service started successfully');

    } catch (error) {
      logger.error('Failed to start health monitoring service', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop health monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping provider health monitoring service');
    this.isRunning = false;

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      delete this.healthCheckInterval;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      delete this.metricsInterval;
    }

    // Save current state
    await this.saveHealthData();

    this.emit('stopped');
    logger.info('Provider health monitoring service stopped');
  }

  /**
   * Get health status for a specific provider
   */
  async getProviderHealth(providerId: string): Promise<ProviderHealth | null> {
    try {
      // Check cache first
      const cached = this.healthCache.get(providerId);
      if (cached && Date.now() - cached.lastCheck.getTime() < 60000) { // 1 minute cache
        return cached;
      }

      // Load from database
      const db = getDatabaseService();
      const result = await db.query(`
        SELECT * FROM provider_health 
        WHERE provider_id = $1 
        ORDER BY last_check DESC 
        LIMIT 1
      `, [providerId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const health: ProviderHealth = {
        providerId: row.provider_id,
        status: row.status,
        lastCheck: row.last_check,
        responseTime: row.response_time,
        error: row.error,
        uptime: row.uptime
      };

      // Update cache
      this.healthCache.set(providerId, health);
      return health;

    } catch (error) {
      logger.error('Failed to get provider health', { providerId, error });
      throw error;
    }
  }

  /**
   * Get health status for all providers
   */
  async getAllProviderHealth(): Promise<ProviderHealth[]> {
    try {
      const providerService = getDynamicProviderService();
      const result = await providerService.getProviders();
      const providers = result.providers;
      
      const healthPromises = providers.map((provider: any) => 
        this.getProviderHealth(provider.id)
      );
      
      const healthResults = await Promise.all(healthPromises);
      return healthResults.filter((health: any) => health !== null) as ProviderHealth[];

    } catch (error) {
      logger.error('Failed to get all provider health', error);
      throw error;
    }
  }

  /**
   * Get performance metrics for a provider
   */
  async getProviderMetrics(
    providerId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<PerformanceMetrics[]> {
    try {
      const db = getDatabaseService();
      const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const end = endDate || new Date();

      const result = await db.query(`
        SELECT * FROM provider_metrics 
        WHERE provider_id = $1 
        AND timestamp BETWEEN $2 AND $3 
        ORDER BY timestamp DESC
      `, [providerId, start, end]);

      return result.rows.map(row => ({
        providerId: row.provider_id,
        timestamp: row.timestamp,
        responseTime: row.response_time,
        success: row.success,
        error: row.error,
        requestCount: row.request_count,
        errorCount: row.error_count,
        uptime: row.uptime,
        availability: row.availability
      }));

    } catch (error) {
      logger.error('Failed to get provider metrics', { providerId, error });
      throw error;
    }
  }

  /**
   * Get health summary for a provider
   */
  async getHealthSummary(providerId: string): Promise<HealthSummary | null> {
    try {
      const db = getDatabaseService();
      
      // Get latest health status
      const healthResult = await db.query(`
        SELECT * FROM provider_health 
        WHERE provider_id = $1 
        ORDER BY last_check DESC 
        LIMIT 1
      `, [providerId]);

      if (healthResult.rows.length === 0) {
        return null;
      }

      const health = healthResult.rows[0];

      // Get metrics summary for last 24 hours
      const metricsResult = await db.query(`
        SELECT 
          AVG(response_time) as avg_response_time,
          AVG(availability) as avg_availability,
          SUM(error_count)::float / NULLIF(SUM(request_count), 0) * 100 as error_rate,
          COUNT(*) as metrics_count
        FROM provider_metrics 
        WHERE provider_id = $1 
        AND timestamp > NOW() - INTERVAL '24 hours'
      `, [providerId]);

      const metrics = metricsResult.rows[0];

      // Get alert count for last 24 hours
      const alertResult = await db.query(`
        SELECT COUNT(*) as alert_count
        FROM provider_alerts 
        WHERE provider_id = $1 
        AND timestamp > NOW() - INTERVAL '24 hours'
        AND NOT acknowledged
      `, [providerId]);

      const alertCount = parseInt(alertResult.rows[0].alert_count);

      return {
        providerId,
        status: health.status,
        uptime: health.uptime,
        availability: parseFloat(metrics.avg_availability) || 0,
        averageResponseTime: parseFloat(metrics.avg_response_time) || 0,
        errorRate: parseFloat(metrics.error_rate) || 0,
        lastCheck: health.last_check,
        lastError: health.error,
        alertCount,
        metricsCount: parseInt(metrics.metrics_count) || 0
      };

    } catch (error) {
      logger.error('Failed to get health summary', { providerId, error });
      throw error;
    }
  }

  /**
   * Get active alerts for a provider
   */
  async getProviderAlerts(providerId: string): Promise<HealthAlert[]> {
    try {
      const db = getDatabaseService();
      const result = await db.query(`
        SELECT * FROM provider_alerts 
        WHERE provider_id = $1 
        AND NOT acknowledged 
        ORDER BY timestamp DESC
      `, [providerId]);

      return result.rows.map(row => ({
        id: row.id,
        providerId: row.provider_id,
        type: row.type,
        severity: row.severity,
        message: row.message,
        timestamp: row.timestamp,
        acknowledged: row.acknowledged,
        resolvedAt: row.resolved_at
      }));

    } catch (error) {
      logger.error('Failed to get provider alerts', { providerId, error });
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      const db = getDatabaseService();
      await db.query(`
        UPDATE provider_alerts 
        SET acknowledged = true, acknowledged_at = NOW() 
        WHERE id = $1
      `, [alertId]);

      logger.info('Alert acknowledged', { alertId });

    } catch (error) {
      logger.error('Failed to acknowledge alert', { alertId, error });
      throw error;
    }
  }

  /**
   * Manually trigger health check for a provider
   */
  async checkProviderHealth(providerId: string): Promise<ProviderHealth> {
    try {
      logger.info('Manual health check requested', { providerId });
      
      const providerService = getDynamicProviderService();
      const provider = await providerService.getProvider(providerId);
      
      if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
      }

      const health = await this.performSingleHealthCheck(provider);
      
      // Save to database
      await this.saveProviderHealth(health);
      
      // Update cache
      this.healthCache.set(providerId, health);
      
      // Emit event
      this.emit('health_checked', { providerId, health });
      
      return health;

    } catch (error) {
      logger.error('Manual health check failed', { providerId, error });
      throw error;
    }
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<HealthMonitoringConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    logger.info('Health monitoring configuration updated', { 
      oldConfig, 
      newConfig: this.config 
    });

    // Restart intervals if they changed and service is running
    if (this.isRunning) {
      if (oldConfig.healthCheckInterval !== this.config.healthCheckInterval) {
        this.startHealthChecks();
      }

      if (oldConfig.performanceMetricsInterval !== this.config.performanceMetricsInterval) {
        this.startMetricsCollection();
      }
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isRunning: boolean;
    config: HealthMonitoringConfig;
    cacheSize: number;
    lastHealthCheck?: Date;
    lastMetricsCollection?: Date;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      cacheSize: this.healthCache.size,
      // Add timestamps when available
    };
  }

  /**
   * Initialize database tables for health monitoring
   */
  private async initializeTables(): Promise<void> {
    const db = getDatabaseService();

    // Provider health table
    await db.query(`
      CREATE TABLE IF NOT EXISTS provider_health (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        last_check TIMESTAMP WITH TIME ZONE NOT NULL,
        response_time INTEGER,
        error TEXT,
        uptime INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Provider metrics table
    await db.query(`
      CREATE TABLE IF NOT EXISTS provider_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        response_time INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        error TEXT,
        request_count INTEGER NOT NULL DEFAULT 1,
        error_count INTEGER NOT NULL DEFAULT 0,
        uptime INTEGER NOT NULL DEFAULT 0,
        availability DECIMAL(5,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Provider alerts table
    await db.query(`
      CREATE TABLE IF NOT EXISTS provider_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        acknowledged BOOLEAN DEFAULT false,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_provider_health_provider_id 
      ON provider_health(provider_id)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_provider_health_last_check 
      ON provider_health(last_check)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider_id_timestamp 
      ON provider_metrics(provider_id, timestamp)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_provider_alerts_provider_id_acknowledged 
      ON provider_alerts(provider_id, acknowledged)
    `);

    logger.info('Health monitoring database tables initialized');
  }

  /**
   * Load existing health data from database
   */
  private async loadHealthData(): Promise<void> {
    try {
      const db = getDatabaseService();
      
      // Load latest health status for each provider
      const result = await db.query(`
        SELECT DISTINCT ON (provider_id) 
          provider_id, status, last_check, response_time, error, uptime
        FROM provider_health 
        ORDER BY provider_id, last_check DESC
      `);

      for (const row of result.rows) {
        const health: ProviderHealth = {
          providerId: row.provider_id,
          status: row.status,
          lastCheck: row.last_check,
          responseTime: row.response_time,
          error: row.error,
          uptime: row.uptime
        };
        
        this.healthCache.set(row.provider_id, health);
      }

      logger.info('Health data loaded from database', { 
        providerCount: this.healthCache.size 
      });

    } catch (error) {
      logger.error('Failed to load health data', error);
      throw error;
    }
  }

  /**
   * Save health data to database
   */
  private async saveHealthData(): Promise<void> {
    try {
      const savePromises = Array.from(this.healthCache.values()).map(health =>
        this.saveProviderHealth(health)
      );
      
      await Promise.all(savePromises);
      
      logger.info('Health data saved to database');

    } catch (error) {
      logger.error('Failed to save health data', error);
      throw error;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        logger.error('Periodic health check failed', error);
      }
    }, this.config.healthCheckInterval);

    logger.debug('Health checks started', { 
      interval: this.config.healthCheckInterval 
    });
  }

  /**
   * Start performance metrics collection
   */
  private startMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectPerformanceMetrics();
      } catch (error) {
        logger.error('Performance metrics collection failed', error);
      }
    }, this.config.performanceMetricsInterval);

    logger.debug('Metrics collection started', { 
      interval: this.config.performanceMetricsInterval 
    });
  }

  /**
   * Perform health checks on all active providers
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const providerService = getDynamicProviderService();
      const result = await providerService.getProviders();
      const providers = result.providers;
      const activeProviders = providers.filter((p: any) => p.status === 'active');

      logger.debug('Performing health checks', { 
        providerCount: activeProviders.length 
      });

      const healthPromises = activeProviders.map((provider: any) =>
        this.performSingleHealthCheck(provider).catch(error => {
          logger.error('Health check failed for provider', { 
            providerId: provider.id, 
            error 
          });
          return null;
        })
      );

      const healthResults = await Promise.all(healthPromises);
      const validResults = healthResults.filter((result: any) => result !== null) as ProviderHealth[];

      // Save results to database
      const savePromises = validResults.map(health => this.saveProviderHealth(health));
      await Promise.all(savePromises);

      // Update cache
      validResults.forEach(health => {
        this.healthCache.set(health.providerId, health);
      });

      // Check for alerts
      if (this.config.enableAlerting) {
        await this.checkForAlerts(validResults);
      }

      logger.debug('Health checks completed', { 
        checkedCount: validResults.length 
      });

    } catch (error) {
      logger.error('Health checks failed', error);
      throw error;
    }
  }

  /**
   * Perform health check for a single provider
   */
  private async performSingleHealthCheck(provider: Provider): Promise<ProviderHealth> {
    const startTime = Date.now();
    
    try {
      const validationService = getProviderValidationService();
      const testResult = await validationService.testProviderConnectivity(provider);
      
      const responseTime = Date.now() - startTime;
      const previousHealth = this.healthCache.get(provider.id);
      
      // Calculate uptime (simplified - in production, this would be more sophisticated)
      const uptime = previousHealth ? previousHealth.uptime + 60 : 60; // Add 1 minute

      const health: ProviderHealth = {
        providerId: provider.id,
        status: testResult.success ? 'healthy' : 'down',
        lastCheck: new Date(),
        responseTime,
        error: testResult.error || '',
        uptime
      };

      // Check for degraded performance
      if (testResult.success && responseTime > this.config.alertThresholds.responseTimeMs) {
        health.status = 'degraded';
      }

      return health;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const previousHealth = this.healthCache.get(provider.id);
      
      return {
        providerId: provider.id,
        status: 'down',
        lastCheck: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        uptime: previousHealth ? previousHealth.uptime : 0
      };
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(): Promise<void> {
    try {
      // This would collect actual usage metrics from the system
      // For now, we'll use the health check data as a basis
      
      const healthData = Array.from(this.healthCache.values());
      
      for (const health of healthData) {
        const metrics: PerformanceMetrics = {
          providerId: health.providerId,
          timestamp: new Date(),
          responseTime: health.responseTime || 0,
          success: health.status === 'healthy',
          error: health.error || '',
          requestCount: 1, // This would be actual request count
          errorCount: health.status !== 'healthy' ? 1 : 0,
          uptime: health.uptime,
          availability: health.status === 'healthy' ? 100 : 0
        };

        await this.savePerformanceMetrics(metrics);
      }

      logger.debug('Performance metrics collected', { 
        metricsCount: healthData.length 
      });

    } catch (error) {
      logger.error('Failed to collect performance metrics', error);
      throw error;
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkForAlerts(healthResults: ProviderHealth[]): Promise<void> {
    for (const health of healthResults) {
      const previousHealth = this.healthCache.get(health.providerId);
      
      // Check for status changes
      if (previousHealth && previousHealth.status !== health.status) {
        await this.createAlert(health, previousHealth);
      }
      
      // Check for performance degradation
      if (health.status === 'degraded' && 
          health.responseTime && 
          health.responseTime > this.config.alertThresholds.responseTimeMs) {
        await this.createPerformanceAlert(health);
      }
    }
  }

  /**
   * Create a health alert
   */
  private async createAlert(
    currentHealth: ProviderHealth, 
    previousHealth: ProviderHealth
  ): Promise<void> {
    try {
      let type: 'degraded' | 'down' | 'recovered';
      let severity: 'low' | 'medium' | 'high' | 'critical';
      let message: string;

      if (currentHealth.status === 'healthy' && previousHealth.status !== 'healthy') {
        type = 'recovered';
        severity = 'low';
        message = `Provider ${currentHealth.providerId} has recovered and is now healthy`;
      } else if (currentHealth.status === 'degraded') {
        type = 'degraded';
        severity = 'medium';
        message = `Provider ${currentHealth.providerId} is experiencing performance issues`;
      } else if (currentHealth.status === 'down') {
        type = 'down';
        severity = 'critical';
        message = `Provider ${currentHealth.providerId} is down: ${currentHealth.error}`;
      } else {
        return; // No alert needed
      }

      const alert: HealthAlert = {
        id: '', // Will be generated by database
        providerId: currentHealth.providerId,
        type,
        severity,
        message,
        timestamp: new Date(),
        acknowledged: false
      };

      await this.saveAlert(alert);
      
      // Emit alert event
      this.emit('alert_created', alert);
      
      logger.warn('Health alert created', { 
        providerId: currentHealth.providerId, 
        type, 
        severity 
      });

    } catch (error) {
      logger.error('Failed to create alert', { 
        providerId: currentHealth.providerId, 
        error 
      });
    }
  }

  /**
   * Create a performance alert
   */
  private async createPerformanceAlert(health: ProviderHealth): Promise<void> {
    try {
      const alert: HealthAlert = {
        id: '',
        providerId: health.providerId,
        type: 'degraded',
        severity: 'medium',
        message: `Provider ${health.providerId} response time (${health.responseTime}ms) exceeds threshold (${this.config.alertThresholds.responseTimeMs}ms)`,
        timestamp: new Date(),
        acknowledged: false
      };

      await this.saveAlert(alert);
      this.emit('alert_created', alert);

    } catch (error) {
      logger.error('Failed to create performance alert', { 
        providerId: health.providerId, 
        error 
      });
    }
  }

  /**
   * Save provider health to database
   */
  private async saveProviderHealth(health: ProviderHealth): Promise<void> {
    try {
      const db = getDatabaseService();
      await db.query(`
        INSERT INTO provider_health 
        (provider_id, status, last_check, response_time, error, uptime)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        health.providerId,
        health.status,
        health.lastCheck,
        health.responseTime,
        health.error,
        health.uptime
      ]);

    } catch (error) {
      logger.error('Failed to save provider health', { 
        providerId: health.providerId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Save performance metrics to database
   */
  private async savePerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const db = getDatabaseService();
      await db.query(`
        INSERT INTO provider_metrics 
        (provider_id, timestamp, response_time, success, error, request_count, error_count, uptime, availability)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        metrics.providerId,
        metrics.timestamp,
        metrics.responseTime,
        metrics.success,
        metrics.error,
        metrics.requestCount,
        metrics.errorCount,
        metrics.uptime,
        metrics.availability
      ]);

    } catch (error) {
      logger.error('Failed to save performance metrics', { 
        providerId: metrics.providerId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Save alert to database
   */
  private async saveAlert(alert: HealthAlert): Promise<void> {
    try {
      const db = getDatabaseService();
      const result = await db.query(`
        INSERT INTO provider_alerts 
        (provider_id, type, severity, message, timestamp, acknowledged)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        alert.providerId,
        alert.type,
        alert.severity,
        alert.message,
        alert.timestamp,
        alert.acknowledged
      ]);

      alert.id = result.rows[0].id;

    } catch (error) {
      logger.error('Failed to save alert', { 
        providerId: alert.providerId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Clean up old data based on retention policy
   */
  private async cleanupOldData(): Promise<void> {
    try {
      const db = getDatabaseService();
      const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);

      // Clean up old health records (keep latest for each provider)
      await db.query(`
        DELETE FROM provider_health 
        WHERE created_at < $1 
        AND id NOT IN (
          SELECT DISTINCT ON (provider_id) id 
          FROM provider_health 
          ORDER BY provider_id, last_check DESC
        )
      `, [cutoffDate]);

      // Clean up old metrics
      await db.query(`
        DELETE FROM provider_metrics 
        WHERE created_at < $1
      `, [cutoffDate]);

      // Clean up resolved alerts
      await db.query(`
        DELETE FROM provider_alerts 
        WHERE created_at < $1 
        AND (acknowledged = true OR resolved_at IS NOT NULL)
      `, [cutoffDate]);

      logger.info('Old health monitoring data cleaned up', { 
        cutoffDate, 
        retentionDays: this.config.retentionDays 
      });

    } catch (error) {
      logger.error('Failed to clean up old data', error);
    }
  }
}

// Singleton instance
let healthMonitoringService: ProviderHealthMonitoringService | null = null;

/**
 * Get the singleton instance of the health monitoring service
 */
export function getProviderHealthMonitoringService(
  config?: Partial<HealthMonitoringConfig>
): ProviderHealthMonitoringService {
  if (!healthMonitoringService) {
    healthMonitoringService = new ProviderHealthMonitoringService(config);
  }
  return healthMonitoringService;
}

/**
 * Initialize and start the health monitoring service
 */
export async function initializeHealthMonitoring(
  config?: Partial<HealthMonitoringConfig>
): Promise<ProviderHealthMonitoringService> {
  const service = getProviderHealthMonitoringService(config);
  
  if (!service.getStatus().isRunning) {
    await service.start();
  }
  
  return service;
}