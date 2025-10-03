/**
 * Provider Usage Analytics Controller
 * 
 * REST API endpoints for provider usage analytics, performance metrics,
 * and usage-based recommendations.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { getProviderUsageAnalyticsService } from '../services/provider-usage-analytics-service.js';
import { validateAdminAccess } from '../middleware/auth.js';

/**
 * Get analytics dashboard data
 */
export async function getAnalyticsDashboard(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const { startDate, endDate } = req.query;
    
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate as string);
      if (isNaN(start.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid start date format'
        });
        return;
      }
    }

    if (endDate) {
      end = new Date(endDate as string);
      if (isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid end date format'
        });
        return;
      }
    }

    const analyticsService = getProviderUsageAnalyticsService();
    const dashboardData = await analyticsService.getDashboardData(start, end);
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get analytics dashboard', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get usage statistics for a specific provider
 */
export async function getProviderUsageStats(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const providerId = req.params['providerId'];
    const { startDate, endDate } = req.query;
    
    if (!providerId) {
      res.status(400).json({
        success: false,
        error: 'Provider ID is required'
      });
      return;
    }

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate as string);
      if (isNaN(start.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid start date format'
        });
        return;
      }
    }

    if (endDate) {
      end = new Date(endDate as string);
      if (isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid end date format'
        });
        return;
      }
    }

    const analyticsService = getProviderUsageAnalyticsService();
    const stats = await analyticsService.getProviderUsageStats(providerId, start, end);
    
    if (!stats) {
      res.status(404).json({
        success: false,
        error: 'Provider usage statistics not found'
      });
      return;
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Failed to get provider usage stats', { 
      providerId: req.params['providerId'], 
      error 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider usage statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Track a provider request (for manual tracking)
 */
export async function trackProviderRequest(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const {
      providerId,
      modelId,
      userId,
      tokens,
      latency,
      cost,
      success,
      error
    } = req.body;

    // Validate required fields
    if (!providerId || !modelId || !userId || tokens === undefined || latency === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: providerId, modelId, userId, tokens, latency'
      });
      return;
    }

    if (typeof tokens !== 'number' || tokens < 0) {
      res.status(400).json({
        success: false,
        error: 'Tokens must be a non-negative number'
      });
      return;
    }

    if (typeof latency !== 'number' || latency < 0) {
      res.status(400).json({
        success: false,
        error: 'Latency must be a non-negative number'
      });
      return;
    }

    const analyticsService = getProviderUsageAnalyticsService();
    await analyticsService.trackRequest({
      providerId,
      modelId,
      userId,
      tokens,
      latency,
      cost: cost || 0,
      success: success !== false, // Default to true if not specified
      error: error || undefined
    });
    
    res.json({
      success: true,
      message: 'Provider request tracked successfully'
    });

  } catch (error) {
    logger.error('Failed to track provider request', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track provider request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get usage analytics service status
 */
export async function getAnalyticsStatus(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const analyticsService = getProviderUsageAnalyticsService();
    const status = analyticsService.getStatus();
    
    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Failed to get analytics status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Update usage analytics configuration
 */
export async function updateAnalyticsConfig(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const config = req.body;
    
    // Validate configuration
    if (config.aggregationInterval && (config.aggregationInterval < 60000 || config.aggregationInterval > 3600000)) {
      res.status(400).json({
        success: false,
        error: 'Aggregation interval must be between 1 minute and 1 hour'
      });
      return;
    }

    if (config.retentionDays && (config.retentionDays < 1 || config.retentionDays > 365)) {
      res.status(400).json({
        success: false,
        error: 'Retention days must be between 1 and 365'
      });
      return;
    }

    const analyticsService = getProviderUsageAnalyticsService();
    analyticsService.updateConfig(config);
    
    const updatedStatus = analyticsService.getStatus();
    
    res.json({
      success: true,
      data: updatedStatus,
      message: 'Analytics configuration updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update analytics config', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update analytics configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Export usage analytics data
 */
export async function exportAnalyticsData(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const { providerId, startDate, endDate, format = 'json' } = req.query;
    
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate as string);
      if (isNaN(start.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid start date format'
        });
        return;
      }
    }

    if (endDate) {
      end = new Date(endDate as string);
      if (isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid end date format'
        });
        return;
      }
    }

    const analyticsService = getProviderUsageAnalyticsService();
    
    let exportData: any = {};

    if (providerId) {
      // Export data for specific provider
      const stats = await analyticsService.getProviderUsageStats(providerId as string, start, end);
      
      if (!stats) {
        res.status(404).json({
          success: false,
          error: 'Provider usage statistics not found'
        });
        return;
      }

      exportData = {
        providerId,
        stats,
        exportedAt: new Date().toISOString()
      };
    } else {
      // Export dashboard data
      const dashboardData = await analyticsService.getDashboardData(start, end);
      
      exportData = {
        dashboard: dashboardData,
        exportedAt: new Date().toISOString()
      };
    }

    // Set appropriate headers for download
    const filename = `usage-analytics-${providerId || 'dashboard'}-${new Date().toISOString().split('T')[0]}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.json(exportData);
    } else {
      res.status(400).json({
        success: false,
        error: 'Unsupported export format. Only JSON is currently supported.'
      });
    }

  } catch (error) {
    logger.error('Failed to export analytics data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export usage analytics data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get usage recommendations
 */
export async function getUsageRecommendations(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const { startDate, endDate } = req.query;
    
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate as string);
      if (isNaN(start.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid start date format'
        });
        return;
      }
    }

    if (endDate) {
      end = new Date(endDate as string);
      if (isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid end date format'
        });
        return;
      }
    }

    const analyticsService = getProviderUsageAnalyticsService();
    const dashboardData = await analyticsService.getDashboardData(start, end);
    
    res.json({
      success: true,
      data: {
        recommendations: dashboardData.recommendations,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get usage recommendations', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get cost breakdown analysis
 */
export async function getCostBreakdown(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const { startDate, endDate, groupBy = 'provider' } = req.query;
    
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate as string);
      if (isNaN(start.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid start date format'
        });
        return;
      }
    }

    if (endDate) {
      end = new Date(endDate as string);
      if (isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid end date format'
        });
        return;
      }
    }

    if (!['provider', 'model', 'user'].includes(groupBy as string)) {
      res.status(400).json({
        success: false,
        error: 'Invalid groupBy parameter. Must be one of: provider, model, user'
      });
      return;
    }

    const analyticsService = getProviderUsageAnalyticsService();
    const dashboardData = await analyticsService.getDashboardData(start, end);
    
    let breakdown: any;
    switch (groupBy) {
      case 'provider':
        breakdown = dashboardData.costBreakdown.byProvider;
        break;
      case 'model':
        breakdown = dashboardData.costBreakdown.byModel;
        break;
      case 'user':
        breakdown = dashboardData.costBreakdown.byUser;
        break;
    }
    
    res.json({
      success: true,
      data: {
        groupBy,
        breakdown,
        totalCost: dashboardData.overview.totalCost,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get cost breakdown', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cost breakdown',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}