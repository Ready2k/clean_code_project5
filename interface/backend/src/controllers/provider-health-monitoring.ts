/**
 * Provider Health Monitoring Controller
 * 
 * REST API endpoints for provider health monitoring, performance metrics,
 * and alerting functionality.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { getProviderHealthMonitoringService } from '../services/provider-health-monitoring-service.js';
import { validateAdminAccess } from '../middleware/auth.js';

/**
 * Get health status for all providers
 */
export async function getAllProviderHealth(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const healthService = getProviderHealthMonitoringService();
    const healthData = await healthService.getAllProviderHealth();
    
    res.json({
      success: true,
      data: healthData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get all provider health', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider health data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get health status for a specific provider
 */
export async function getProviderHealth(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const providerId = req.params['providerId'];
    if (!providerId) {
      res.status(400).json({
        success: false,
        error: 'Provider ID is required'
      });
      return;
    }

    const healthService = getProviderHealthMonitoringService();
    const health = await healthService.getProviderHealth(providerId);
    
    if (!health) {
      res.status(404).json({
        success: false,
        error: 'Provider health data not found'
      });
      return;
    }

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    logger.error('Failed to get provider health', { providerId: req.params['providerId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider health data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get health summary for a provider
 */
export async function getProviderHealthSummary(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const providerId = req.params['providerId'];
    if (!providerId) {
      res.status(400).json({
        success: false,
        error: 'Provider ID is required'
      });
      return;
    }

    const healthService = getProviderHealthMonitoringService();
    const summary = await healthService.getHealthSummary(providerId);
    
    if (!summary) {
      res.status(404).json({
        success: false,
        error: 'Provider health summary not found'
      });
      return;
    }

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Failed to get provider health summary', { providerId: req.params['providerId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider health summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get performance metrics for a provider
 */
export async function getProviderMetrics(req: Request, res: Response): Promise<void> {
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

    const healthService = getProviderHealthMonitoringService();
    const metrics = await healthService.getProviderMetrics(providerId, start, end);
    
    res.json({
      success: true,
      data: metrics,
      count: metrics.length
    });

  } catch (error) {
    logger.error('Failed to get provider metrics', { providerId: req.params['providerId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get alerts for a provider
 */
export async function getProviderAlerts(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const providerId = req.params['providerId'];
    if (!providerId) {
      res.status(400).json({
        success: false,
        error: 'Provider ID is required'
      });
      return;
    }

    const healthService = getProviderHealthMonitoringService();
    const alerts = await healthService.getProviderAlerts(providerId);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });

  } catch (error) {
    logger.error('Failed to get provider alerts', { providerId: req.params['providerId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const alertId = req.params['alertId'];
    if (!alertId) {
      res.status(400).json({
        success: false,
        error: 'Alert ID is required'
      });
      return;
    }

    const healthService = getProviderHealthMonitoringService();
    await healthService.acknowledgeAlert(alertId);
    
    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });

  } catch (error) {
    logger.error('Failed to acknowledge alert', { alertId: req.params['alertId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Manually trigger health check for a provider
 */
export async function triggerHealthCheck(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const providerId = req.params['providerId'];
    if (!providerId) {
      res.status(400).json({
        success: false,
        error: 'Provider ID is required'
      });
      return;
    }

    const healthService = getProviderHealthMonitoringService();
    const health = await healthService.checkProviderHealth(providerId);
    
    res.json({
      success: true,
      data: health,
      message: 'Health check completed successfully'
    });

  } catch (error) {
    logger.error('Failed to trigger health check', { providerId: req.params['providerId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to trigger health check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get health monitoring service status
 */
export async function getMonitoringStatus(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const healthService = getProviderHealthMonitoringService();
    const status = healthService.getStatus();
    
    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Failed to get monitoring status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve monitoring status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Update health monitoring configuration
 */
export async function updateMonitoringConfig(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const config = req.body;
    
    // Validate configuration
    if (config.healthCheckInterval && (config.healthCheckInterval < 60000 || config.healthCheckInterval > 3600000)) {
      res.status(400).json({
        success: false,
        error: 'Health check interval must be between 1 minute and 1 hour'
      });
      return;
    }

    if (config.performanceMetricsInterval && (config.performanceMetricsInterval < 30000 || config.performanceMetricsInterval > 1800000)) {
      res.status(400).json({
        success: false,
        error: 'Performance metrics interval must be between 30 seconds and 30 minutes'
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

    const healthService = getProviderHealthMonitoringService();
    healthService.updateConfig(config);
    
    const updatedStatus = healthService.getStatus();
    
    res.json({
      success: true,
      data: updatedStatus,
      message: 'Monitoring configuration updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update monitoring config', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update monitoring configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get aggregated health statistics
 */
export async function getHealthStatistics(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const healthService = getProviderHealthMonitoringService();
    const allHealth = await healthService.getAllProviderHealth();
    
    // Calculate statistics
    const total = allHealth.length;
    const healthy = allHealth.filter(h => h.status === 'healthy').length;
    const degraded = allHealth.filter(h => h.status === 'degraded').length;
    const down = allHealth.filter(h => h.status === 'down').length;
    
    const averageResponseTime = allHealth
      .filter(h => h.responseTime)
      .reduce((sum, h) => sum + (h.responseTime || 0), 0) / 
      (allHealth.filter(h => h.responseTime).length || 1);

    const averageUptime = allHealth
      .reduce((sum, h) => sum + h.uptime, 0) / (total || 1);

    const statistics = {
      total,
      healthy,
      degraded,
      down,
      healthyPercentage: total > 0 ? (healthy / total) * 100 : 0,
      degradedPercentage: total > 0 ? (degraded / total) * 100 : 0,
      downPercentage: total > 0 ? (down / total) * 100 : 0,
      averageResponseTime,
      averageUptime,
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: statistics
    });

  } catch (error) {
    logger.error('Failed to get health statistics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Export health monitoring data
 */
export async function exportHealthData(req: Request, res: Response): Promise<void> {
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

    const healthService = getProviderHealthMonitoringService();
    
    let exportData: any = {};

    if (providerId) {
      // Export data for specific provider
      const health = await healthService.getProviderHealth(providerId as string);
      const metrics = await healthService.getProviderMetrics(providerId as string, start, end);
      const alerts = await healthService.getProviderAlerts(providerId as string);
      const summary = await healthService.getHealthSummary(providerId as string);

      exportData = {
        providerId,
        health,
        metrics,
        alerts,
        summary,
        exportedAt: new Date().toISOString()
      };
    } else {
      // Export data for all providers
      const allHealth = await healthService.getAllProviderHealth();
      
      exportData = {
        health: allHealth,
        exportedAt: new Date().toISOString(),
        totalProviders: allHealth.length
      };
    }

    // Set appropriate headers for download
    const filename = `health-monitoring-${providerId || 'all'}-${new Date().toISOString().split('T')[0]}.${format}`;
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
    logger.error('Failed to export health data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export health monitoring data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}