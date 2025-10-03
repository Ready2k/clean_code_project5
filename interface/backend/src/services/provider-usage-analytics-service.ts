/**
 * Provider Usage Analytics Service
 * 
 * Comprehensive analytics system for tracking provider usage statistics,
 * performance metrics, and generating usage-based recommendations.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { getDatabaseService } from './database-service.js';
import { getDynamicProviderService } from './dynamic-provider-service.js';
// Removed unused imports

export interface UsageAnalyticsConfig {
  aggregationInterval: number; // milliseconds
  retentionDays: number;
  enableRecommendations: boolean;
  enableRealTimeTracking: boolean;
}

export interface ProviderUsageStats {
  providerId: string;
  providerName: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  errorRate: number;
  successRate: number;
  lastUsed: Date;
  popularModels: ModelUsageStats[];
  usageByTimeframe: TimeframeUsage[];
  usageByUser: UserUsage[];
}

export interface ModelUsageStats {
  modelId: string;
  modelName: string;
  requests: number;
  tokens: number;
  cost: number;
  averageLatency: number;
  errorRate: number;
  lastUsed: Date;
}

export interface TimeframeUsage {
  timestamp: Date;
  requests: number;
  tokens: number;
  cost: number;
  averageLatency: number;
  errors: number;
}

export interface UserUsage {
  userId: string;
  username: string;
  requests: number;
  tokens: number;
  cost: number;
  favoriteModels: string[];
}

export interface UsageRecommendation {
  type: 'cost_optimization' | 'performance_optimization' | 'model_suggestion' | 'usage_pattern';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestedAction: string;
  potentialSavings?: number;
  affectedProviders: string[];
  confidence: number;
}

export interface AnalyticsDashboardData {
  overview: {
    totalProviders: number;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    averageLatency: number;
    overallErrorRate: number;
  };
  topProviders: ProviderUsageStats[];
  topModels: ModelUsageStats[];
  usageTrends: TimeframeUsage[];
  recommendations: UsageRecommendation[];
  costBreakdown: {
    byProvider: Array<{ providerId: string; name: string; cost: number; percentage: number }>;
    byModel: Array<{ modelId: string; name: string; cost: number; percentage: number }>;
    byUser: Array<{ userId: string; username: string; cost: number; percentage: number }>;
  };
}

/**
 * Provider Usage Analytics Service
 */
export class ProviderUsageAnalyticsService extends EventEmitter {
  private config: UsageAnalyticsConfig;
  private aggregationInterval?: NodeJS.Timeout;
  private isRunning = false;
  private usageCache = new Map<string, ProviderUsageStats>();

  constructor(config?: Partial<UsageAnalyticsConfig>) {
    super();
    
    this.config = {
      aggregationInterval: 5 * 60 * 1000, // 5 minutes
      retentionDays: 90, // 90 days
      enableRecommendations: true,
      enableRealTimeTracking: true,
      ...config
    };

    logger.info('Provider usage analytics service initialized', { config: this.config });
  }

  /**
   * Start usage analytics tracking
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Usage analytics service is already running');
      return;
    }

    logger.info('Starting provider usage analytics service');
    this.isRunning = true;

    try {
      // Initialize database tables
      await this.initializeTables();

      // Load existing usage data
      await this.loadUsageData();

      // Start periodic aggregation
      this.startAggregation();

      // Clean up old data
      await this.cleanupOldData();

      this.emit('started');
      logger.info('Provider usage analytics service started successfully');

    } catch (error) {
      logger.error('Failed to start usage analytics service', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop usage analytics tracking
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping provider usage analytics service');
    this.isRunning = false;

    // Clear intervals
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      delete this.aggregationInterval;
    }

    // Save current state
    await this.saveUsageData();

    this.emit('stopped');
    logger.info('Provider usage analytics service stopped');
  }

  /**
   * Track a provider request
   */
  async trackRequest(data: {
    providerId: string;
    modelId: string;
    userId: string;
    tokens: number;
    latency: number;
    cost?: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      const db = getDatabaseService();
      
      await db.query(`
        INSERT INTO provider_usage_events 
        (provider_id, model_id, user_id, tokens, latency, cost, success, error, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        data.providerId,
        data.modelId,
        data.userId,
        data.tokens,
        data.latency,
        data.cost || 0,
        data.success,
        data.error
      ]);

      // Update real-time cache if enabled
      if (this.config.enableRealTimeTracking) {
        await this.updateRealTimeStats(data);
      }

      this.emit('request_tracked', data);

    } catch (error) {
      logger.error('Failed to track provider request', { data, error });
      throw error;
    }
  }

  /**
   * Get usage statistics for a provider
   */
  async getProviderUsageStats(
    providerId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<ProviderUsageStats | null> {
    try {
      const db = getDatabaseService();
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate || new Date();

      // Get provider info
      const providerService = getDynamicProviderService();
      const provider = await providerService.getProvider(providerId);
      
      if (!provider) {
        return null;
      }

      // Get aggregated stats
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(tokens) as total_tokens,
          SUM(cost) as total_cost,
          AVG(latency) as average_latency,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as error_rate,
          SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate,
          MAX(timestamp) as last_used
        FROM provider_usage_events 
        WHERE provider_id = $1 
        AND timestamp BETWEEN $2 AND $3
      `, [providerId, start, end]);

      const stats = statsResult.rows[0];

      // Get popular models
      const modelsResult = await db.query(`
        SELECT 
          e.model_id,
          m.name as model_name,
          COUNT(*) as requests,
          SUM(e.tokens) as tokens,
          SUM(e.cost) as cost,
          AVG(e.latency) as average_latency,
          SUM(CASE WHEN NOT e.success THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as error_rate,
          MAX(e.timestamp) as last_used
        FROM provider_usage_events e
        LEFT JOIN models m ON e.model_id = m.id
        WHERE e.provider_id = $1 
        AND e.timestamp BETWEEN $2 AND $3
        GROUP BY e.model_id, m.name
        ORDER BY requests DESC
        LIMIT 10
      `, [providerId, start, end]);

      const popularModels: ModelUsageStats[] = modelsResult.rows.map(row => ({
        modelId: row.model_id,
        modelName: row.model_name || 'Unknown Model',
        requests: parseInt(row.requests),
        tokens: parseInt(row.tokens) || 0,
        cost: parseFloat(row.cost) || 0,
        averageLatency: parseFloat(row.average_latency) || 0,
        errorRate: parseFloat(row.error_rate) || 0,
        lastUsed: row.last_used
      }));

      // Get usage by timeframe (daily aggregation)
      const timeframeResult = await db.query(`
        SELECT 
          DATE_TRUNC('day', timestamp) as day,
          COUNT(*) as requests,
          SUM(tokens) as tokens,
          SUM(cost) as cost,
          AVG(latency) as average_latency,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as errors
        FROM provider_usage_events 
        WHERE provider_id = $1 
        AND timestamp BETWEEN $2 AND $3
        GROUP BY DATE_TRUNC('day', timestamp)
        ORDER BY day
      `, [providerId, start, end]);

      const usageByTimeframe: TimeframeUsage[] = timeframeResult.rows.map(row => ({
        timestamp: row.day,
        requests: parseInt(row.requests),
        tokens: parseInt(row.tokens) || 0,
        cost: parseFloat(row.cost) || 0,
        averageLatency: parseFloat(row.average_latency) || 0,
        errors: parseInt(row.errors) || 0
      }));

      // Get usage by user
      const userResult = await db.query(`
        SELECT 
          e.user_id,
          u.username,
          COUNT(*) as requests,
          SUM(e.tokens) as tokens,
          SUM(e.cost) as cost,
          ARRAY_AGG(DISTINCT m.name) FILTER (WHERE m.name IS NOT NULL) as favorite_models
        FROM provider_usage_events e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN models m ON e.model_id = m.id
        WHERE e.provider_id = $1 
        AND e.timestamp BETWEEN $2 AND $3
        GROUP BY e.user_id, u.username
        ORDER BY requests DESC
        LIMIT 20
      `, [providerId, start, end]);

      const usageByUser: UserUsage[] = userResult.rows.map(row => ({
        userId: row.user_id,
        username: row.username || 'Unknown User',
        requests: parseInt(row.requests),
        tokens: parseInt(row.tokens) || 0,
        cost: parseFloat(row.cost) || 0,
        favoriteModels: row.favorite_models || []
      }));

      const providerStats: ProviderUsageStats = {
        providerId,
        providerName: provider.name,
        totalRequests: parseInt(stats.total_requests) || 0,
        totalTokens: parseInt(stats.total_tokens) || 0,
        totalCost: parseFloat(stats.total_cost) || 0,
        averageLatency: parseFloat(stats.average_latency) || 0,
        errorRate: parseFloat(stats.error_rate) || 0,
        successRate: parseFloat(stats.success_rate) || 0,
        lastUsed: stats.last_used || new Date(),
        popularModels,
        usageByTimeframe,
        usageByUser
      };

      // Update cache
      this.usageCache.set(providerId, providerStats);

      return providerStats;

    } catch (error) {
      logger.error('Failed to get provider usage stats', { providerId, error });
      throw error;
    }
  }

  /**
   * Get analytics dashboard data
   */
  async getDashboardData(startDate?: Date, endDate?: Date): Promise<AnalyticsDashboardData> {
    try {
      const db = getDatabaseService();
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate || new Date();

      // Get overview stats
      const overviewResult = await db.query(`
        SELECT 
          COUNT(DISTINCT provider_id) as total_providers,
          COUNT(*) as total_requests,
          SUM(tokens) as total_tokens,
          SUM(cost) as total_cost,
          AVG(latency) as average_latency,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as error_rate
        FROM provider_usage_events 
        WHERE timestamp BETWEEN $1 AND $2
      `, [start, end]);

      const overview = overviewResult.rows[0];

      // Get top providers
      const topProvidersResult = await db.query(`
        SELECT 
          e.provider_id,
          p.name as provider_name,
          COUNT(*) as total_requests,
          SUM(e.tokens) as total_tokens,
          SUM(e.cost) as total_cost,
          AVG(e.latency) as average_latency,
          SUM(CASE WHEN NOT e.success THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as error_rate,
          MAX(e.timestamp) as last_used
        FROM provider_usage_events e
        LEFT JOIN providers p ON e.provider_id = p.id
        WHERE e.timestamp BETWEEN $1 AND $2
        GROUP BY e.provider_id, p.name
        ORDER BY total_requests DESC
        LIMIT 10
      `, [start, end]);

      const topProviders: ProviderUsageStats[] = await Promise.all(
        topProvidersResult.rows.map(async (row) => {
          const fullStats = await this.getProviderUsageStats(row.provider_id, start, end);
          return fullStats || {
            providerId: row.provider_id,
            providerName: row.provider_name || 'Unknown Provider',
            totalRequests: parseInt(row.total_requests),
            totalTokens: parseInt(row.total_tokens) || 0,
            totalCost: parseFloat(row.total_cost) || 0,
            averageLatency: parseFloat(row.average_latency) || 0,
            errorRate: parseFloat(row.error_rate) || 0,
            successRate: 100 - (parseFloat(row.error_rate) || 0),
            lastUsed: row.last_used,
            popularModels: [],
            usageByTimeframe: [],
            usageByUser: []
          };
        })
      );

      // Get top models across all providers
      const topModelsResult = await db.query(`
        SELECT 
          e.model_id,
          m.name as model_name,
          COUNT(*) as requests,
          SUM(e.tokens) as tokens,
          SUM(e.cost) as cost,
          AVG(e.latency) as average_latency,
          SUM(CASE WHEN NOT e.success THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as error_rate,
          MAX(e.timestamp) as last_used
        FROM provider_usage_events e
        LEFT JOIN models m ON e.model_id = m.id
        WHERE e.timestamp BETWEEN $1 AND $2
        GROUP BY e.model_id, m.name
        ORDER BY requests DESC
        LIMIT 10
      `, [start, end]);

      const topModels: ModelUsageStats[] = topModelsResult.rows.map(row => ({
        modelId: row.model_id,
        modelName: row.model_name || 'Unknown Model',
        requests: parseInt(row.requests),
        tokens: parseInt(row.tokens) || 0,
        cost: parseFloat(row.cost) || 0,
        averageLatency: parseFloat(row.average_latency) || 0,
        errorRate: parseFloat(row.error_rate) || 0,
        lastUsed: row.last_used
      }));

      // Get usage trends (daily)
      const trendsResult = await db.query(`
        SELECT 
          DATE_TRUNC('day', timestamp) as day,
          COUNT(*) as requests,
          SUM(tokens) as tokens,
          SUM(cost) as cost,
          AVG(latency) as average_latency,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as errors
        FROM provider_usage_events 
        WHERE timestamp BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('day', timestamp)
        ORDER BY day
      `, [start, end]);

      const usageTrends: TimeframeUsage[] = trendsResult.rows.map(row => ({
        timestamp: row.day,
        requests: parseInt(row.requests),
        tokens: parseInt(row.tokens) || 0,
        cost: parseFloat(row.cost) || 0,
        averageLatency: parseFloat(row.average_latency) || 0,
        errors: parseInt(row.errors) || 0
      }));

      // Generate recommendations
      const recommendations = this.config.enableRecommendations 
        ? await this.generateRecommendations(topProviders, topModels, usageTrends)
        : [];

      // Get cost breakdown
      const totalCost = parseFloat(overview.total_cost) || 0;

      const costByProvider = topProviders.map(provider => ({
        providerId: provider.providerId,
        name: provider.providerName,
        cost: provider.totalCost,
        percentage: totalCost > 0 ? (provider.totalCost / totalCost) * 100 : 0
      }));

      const costByModel = topModels.map(model => ({
        modelId: model.modelId,
        name: model.modelName,
        cost: model.cost,
        percentage: totalCost > 0 ? (model.cost / totalCost) * 100 : 0
      }));

      // Get cost by user
      const userCostResult = await db.query(`
        SELECT 
          e.user_id,
          u.username,
          SUM(e.cost) as cost
        FROM provider_usage_events e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.timestamp BETWEEN $1 AND $2
        GROUP BY e.user_id, u.username
        ORDER BY cost DESC
        LIMIT 10
      `, [start, end]);

      const costByUser = userCostResult.rows.map(row => ({
        userId: row.user_id,
        username: row.username || 'Unknown User',
        cost: parseFloat(row.cost) || 0,
        percentage: totalCost > 0 ? (parseFloat(row.cost) / totalCost) * 100 : 0
      }));

      return {
        overview: {
          totalProviders: parseInt(overview.total_providers) || 0,
          totalRequests: parseInt(overview.total_requests) || 0,
          totalTokens: parseInt(overview.total_tokens) || 0,
          totalCost: totalCost,
          averageLatency: parseFloat(overview.average_latency) || 0,
          overallErrorRate: parseFloat(overview.error_rate) || 0
        },
        topProviders,
        topModels,
        usageTrends,
        recommendations,
        costBreakdown: {
          byProvider: costByProvider,
          byModel: costByModel,
          byUser: costByUser
        }
      };

    } catch (error) {
      logger.error('Failed to get dashboard data', error);
      throw error;
    }
  }

  /**
   * Generate usage-based recommendations
   */
  async generateRecommendations(
    topProviders: ProviderUsageStats[],
    topModels: ModelUsageStats[],
    usageTrends: TimeframeUsage[]
  ): Promise<UsageRecommendation[]> {
    const recommendations: UsageRecommendation[] = [];

    try {
      // Cost optimization recommendations
      const highCostProviders = topProviders.filter(p => p.totalCost > 100);
      if (highCostProviders.length > 0) {
        recommendations.push({
          type: 'cost_optimization',
          priority: 'high',
          title: 'High Cost Providers Detected',
          description: `${highCostProviders.length} providers have high usage costs. Consider optimizing usage or exploring alternatives.`,
          suggestedAction: 'Review usage patterns and consider cost-effective alternatives',
          potentialSavings: highCostProviders.reduce((sum, p) => sum + p.totalCost, 0) * 0.2,
          affectedProviders: highCostProviders.map(p => p.providerId),
          confidence: 0.8
        });
      }

      // Performance optimization recommendations
      const slowProviders = topProviders.filter(p => p.averageLatency > 2000);
      if (slowProviders.length > 0) {
        recommendations.push({
          type: 'performance_optimization',
          priority: 'medium',
          title: 'Slow Response Times Detected',
          description: `${slowProviders.length} providers have high average latency (>2s). Consider optimizing or switching providers.`,
          suggestedAction: 'Investigate performance issues or consider faster alternatives',
          affectedProviders: slowProviders.map(p => p.providerId),
          confidence: 0.9
        });
      }

      // Error rate recommendations
      const errorProneProviders = topProviders.filter(p => p.errorRate > 5);
      if (errorProneProviders.length > 0) {
        recommendations.push({
          type: 'performance_optimization',
          priority: 'high',
          title: 'High Error Rates Detected',
          description: `${errorProneProviders.length} providers have error rates >5%. This may impact user experience.`,
          suggestedAction: 'Investigate error causes and implement retry mechanisms',
          affectedProviders: errorProneProviders.map(p => p.providerId),
          confidence: 0.95
        });
      }

      // Usage pattern recommendations
      if (usageTrends.length > 7) {
        const recentTrend = usageTrends.slice(-7);
        const avgRecentRequests = recentTrend.reduce((sum, t) => sum + t.requests, 0) / 7;
        const olderTrend = usageTrends.slice(-14, -7);
        const avgOlderRequests = olderTrend.reduce((sum, t) => sum + t.requests, 0) / 7;
        
        if (avgRecentRequests > avgOlderRequests * 1.5) {
          recommendations.push({
            type: 'usage_pattern',
            priority: 'medium',
            title: 'Usage Spike Detected',
            description: 'Recent usage has increased significantly. Consider scaling or optimizing to handle increased load.',
            suggestedAction: 'Monitor capacity and consider implementing rate limiting',
            affectedProviders: topProviders.slice(0, 3).map(p => p.providerId),
            confidence: 0.7
          });
        }
      }

      // Model suggestion recommendations
      const underutilizedModels = topModels.filter(m => m.requests < 10);
      if (underutilizedModels.length > 0 && topModels.length > 3) {
        recommendations.push({
          type: 'model_suggestion',
          priority: 'low',
          title: 'Underutilized Models Found',
          description: `${underutilizedModels.length} models have low usage. Consider removing unused models to reduce complexity.`,
          suggestedAction: 'Review model necessity and remove unused models',
          affectedProviders: [],
          confidence: 0.6
        });
      }

    } catch (error) {
      logger.error('Failed to generate recommendations', error);
    }

    return recommendations;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<UsageAnalyticsConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    logger.info('Usage analytics configuration updated', { 
      oldConfig, 
      newConfig: this.config 
    });

    // Restart aggregation if interval changed and service is running
    if (this.isRunning && oldConfig.aggregationInterval !== this.config.aggregationInterval) {
      this.startAggregation();
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    config: UsageAnalyticsConfig;
    cacheSize: number;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      cacheSize: this.usageCache.size
    };
  }

  /**
   * Initialize database tables
   */
  private async initializeTables(): Promise<void> {
    const db = getDatabaseService();

    // Provider usage events table
    await db.query(`
      CREATE TABLE IF NOT EXISTS provider_usage_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tokens INTEGER NOT NULL DEFAULT 0,
        latency INTEGER NOT NULL DEFAULT 0,
        cost DECIMAL(10,4) NOT NULL DEFAULT 0,
        success BOOLEAN NOT NULL DEFAULT true,
        error TEXT,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_usage_events_provider_timestamp 
      ON provider_usage_events(provider_id, timestamp)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_usage_events_model_timestamp 
      ON provider_usage_events(model_id, timestamp)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_usage_events_user_timestamp 
      ON provider_usage_events(user_id, timestamp)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp 
      ON provider_usage_events(timestamp)
    `);

    logger.info('Usage analytics database tables initialized');
  }

  /**
   * Load existing usage data
   */
  private async loadUsageData(): Promise<void> {
    try {
      // Load recent usage stats for caching
      const providerService = getDynamicProviderService();
      const result = await providerService.getProviders();
      const providers = result.providers;
      
      const loadPromises = providers.slice(0, 10).map(async (provider: any) => {
        try {
          const stats = await this.getProviderUsageStats(provider.id);
          if (stats) {
            this.usageCache.set(provider.id, stats);
          }
        } catch (error) {
          logger.debug('Failed to load usage data for provider', { 
            providerId: provider.id, 
            error 
          });
        }
      });

      await Promise.all(loadPromises);

      logger.info('Usage analytics data loaded', { 
        cachedProviders: this.usageCache.size 
      });

    } catch (error) {
      logger.error('Failed to load usage analytics data', error);
    }
  }

  /**
   * Save usage data
   */
  private async saveUsageData(): Promise<void> {
    // Usage data is already persisted in database, no additional saving needed
    logger.info('Usage analytics data saved');
  }

  /**
   * Start periodic aggregation
   */
  private startAggregation(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }

    this.aggregationInterval = setInterval(async () => {
      try {
        await this.performAggregation();
      } catch (error) {
        logger.error('Periodic aggregation failed', error);
      }
    }, this.config.aggregationInterval);

    logger.debug('Usage analytics aggregation started', { 
      interval: this.config.aggregationInterval 
    });
  }

  /**
   * Perform data aggregation
   */
  private async performAggregation(): Promise<void> {
    try {
      // Refresh cache for active providers
      const activeProviders = Array.from(this.usageCache.keys()).slice(0, 5);
      
      for (const providerId of activeProviders) {
        await this.getProviderUsageStats(providerId);
      }

      logger.debug('Usage analytics aggregation completed');

    } catch (error) {
      logger.error('Aggregation failed', error);
    }
  }

  /**
   * Update real-time statistics
   */
  private async updateRealTimeStats(data: {
    providerId: string;
    modelId: string;
    userId: string;
    tokens: number;
    latency: number;
    cost?: number;
    success: boolean;
  }): Promise<void> {
    try {
      // Update cached stats if available
      const cachedStats = this.usageCache.get(data.providerId);
      if (cachedStats) {
        cachedStats.totalRequests += 1;
        cachedStats.totalTokens += data.tokens;
        cachedStats.totalCost += data.cost || 0;
        
        // Update average latency (simple moving average approximation)
        cachedStats.averageLatency = 
          (cachedStats.averageLatency * (cachedStats.totalRequests - 1) + data.latency) / 
          cachedStats.totalRequests;
        
        if (!data.success) {
          cachedStats.errorRate = 
            (cachedStats.errorRate * (cachedStats.totalRequests - 1) + 100) / 
            cachedStats.totalRequests;
        } else {
          cachedStats.errorRate = 
            (cachedStats.errorRate * (cachedStats.totalRequests - 1)) / 
            cachedStats.totalRequests;
        }
        
        cachedStats.successRate = 100 - cachedStats.errorRate;
        cachedStats.lastUsed = new Date();
      }

    } catch (error) {
      logger.error('Failed to update real-time stats', { data, error });
    }
  }

  /**
   * Clean up old data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      const db = getDatabaseService();
      const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);

      const result = await db.query(`
        DELETE FROM provider_usage_events 
        WHERE timestamp < $1
      `, [cutoffDate]);

      logger.info('Old usage analytics data cleaned up', { 
        deletedRows: result.rowCount,
        cutoffDate, 
        retentionDays: this.config.retentionDays 
      });

    } catch (error) {
      logger.error('Failed to clean up old usage data', error);
    }
  }
}

// Singleton instance
let usageAnalyticsService: ProviderUsageAnalyticsService | null = null;

/**
 * Get the singleton instance of the usage analytics service
 */
export function getProviderUsageAnalyticsService(
  config?: Partial<UsageAnalyticsConfig>
): ProviderUsageAnalyticsService {
  if (!usageAnalyticsService) {
    usageAnalyticsService = new ProviderUsageAnalyticsService(config);
  }
  return usageAnalyticsService;
}

/**
 * Initialize and start the usage analytics service
 */
export async function initializeUsageAnalytics(
  config?: Partial<UsageAnalyticsConfig>
): Promise<ProviderUsageAnalyticsService> {
  const service = getProviderUsageAnalyticsService(config);
  
  if (!service.getStatus().isRunning) {
    await service.start();
  }
  
  return service;
}