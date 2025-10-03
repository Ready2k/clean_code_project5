import { Request, Response } from 'express';
import { getSystemMonitoringService } from '../services/system-monitoring-service.js';
import { getProviderRegistryService } from '../services/provider-registry-service.js';
import { getRegistryMonitoringService } from '../services/registry-monitoring-service.js';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../types/errors.js';

/**
 * Get system status and health information
 */
export const getSystemStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const monitoringService = getSystemMonitoringService();
    const status = await monitoringService.getSystemStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get system status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_STATUS_ERROR',
        message: 'Failed to retrieve system status'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get detailed system health check
 */
export const getSystemHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    const monitoringService = getSystemMonitoringService();
    const status = await monitoringService.getSystemStatus();
    
    // Return detailed health information
    const healthInfo = {
      healthy: status.status === 'healthy',
      status: status.status,
      services: status.services,
      uptime: status.uptime,
      version: status.version,
      timestamp: status.timestamp,
      checks: {
        api: status.services.api.status === 'up',
        database: status.services.database.status === 'up',
        storage: status.services.storage.status === 'up',
        llm: status.services.llm.status === 'up',
        redis: status.services.redis.status === 'up'
      }
    };
    
    // Set appropriate HTTP status based on health
    const httpStatus = status.status === 'healthy' ? 200 : 
                      status.status === 'degraded' ? 200 : 503;
    
    res.status(httpStatus).json(healthInfo);
  } catch (error) {
    logger.error('Failed to get system health:', error);
    res.status(503).json({
      healthy: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Failed to perform health check'
      }
    });
  }
};

/**
 * Get comprehensive system statistics
 */
export const getSystemStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const monitoringService = getSystemMonitoringService();
    const stats = await monitoringService.getSystemStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get system stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_STATS_ERROR',
        message: 'Failed to retrieve system statistics'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get system configuration
 */
export const getSystemConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    const monitoringService = getSystemMonitoringService();
    const config = monitoringService.getSystemConfig();
    
    res.json(config);
  } catch (error) {
    logger.error('Failed to get system config:', error);
    res.status(500).json({
      error: {
        code: 'SYSTEM_CONFIG_ERROR',
        message: 'Failed to retrieve system configuration'
      }
    });
  }
};

/**
 * Update system configuration
 */
export const updateSystemConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = req.body;
    
    // Validate the updates
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new ValidationError('Invalid configuration data');
    }
    
    const monitoringService = getSystemMonitoringService();
    const updatedConfig = await monitoringService.updateSystemConfig(updates);
    
    logger.info('System configuration updated', { 
      updatedFields: Object.keys(updates),
      userId: (req as any).user?.userId 
    });
    
    res.json({
      message: 'System configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    logger.error('Failed to update system config:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    } else {
      res.status(500).json({
        error: {
          code: 'SYSTEM_CONFIG_UPDATE_ERROR',
          message: 'Failed to update system configuration'
        }
      });
    }
  }
};

/**
 * Create system backup
 */
export const createBackup = async (_req: Request, res: Response): Promise<void> => {
  try {
    const monitoringService = getSystemMonitoringService();
    const backup = await monitoringService.createBackup();
    
    logger.info('System backup created', backup);
    
    res.json({
      message: 'System backup created successfully',
      backup: {
        id: backup.backupId,
        path: backup.path,
        size: backup.size,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to create system backup:', error);
    res.status(500).json({
      error: {
        code: 'BACKUP_ERROR',
        message: 'Failed to create system backup'
      }
    });
  }
};

/**
 * Cleanup system resources
 */
export const cleanupSystem = async (_req: Request, res: Response): Promise<void> => {
  try {
    const monitoringService = getSystemMonitoringService();
    const results = await monitoringService.cleanupSystem();
    
    logger.info('System cleanup completed', results);
    
    res.json({
      message: 'System cleanup completed successfully',
      results
    });
  } catch (error) {
    logger.error('Failed to cleanup system:', error);
    res.status(500).json({
      error: {
        code: 'CLEANUP_ERROR',
        message: 'Failed to cleanup system'
      }
    });
  }
};

/**
 * Get system logs
 */
export const getSystemLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { level, limit = '100', offset = '0' } = req.query;
    
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      throw new ValidationError('Limit must be between 1 and 1000');
    }
    
    if (isNaN(offsetNum) || offsetNum < 0) {
      throw new ValidationError('Offset must be non-negative');
    }
    
    const monitoringService = getSystemMonitoringService();
    const logs = await monitoringService.getSystemLogs(
      level as string,
      limitNum,
      offsetNum
    );
    
    res.json(logs);
  } catch (error) {
    logger.error('Failed to get system logs:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    } else {
      res.status(500).json({
        error: {
          code: 'SYSTEM_LOGS_ERROR',
          message: 'Failed to retrieve system logs'
        }
      });
    }
  }
};

/**
 * Get system metrics
 */
export const getSystemMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = '100' } = req.query;
    
    const limitNum = parseInt(limit as string, 10);
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      throw new ValidationError('Limit must be between 1 and 1000');
    }
    
    const monitoringService = getSystemMonitoringService();
    const metrics = monitoringService.getSystemMetrics(limitNum);
    
    res.json({
      metrics,
      count: metrics.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get system metrics:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    } else {
      res.status(500).json({
        error: {
          code: 'SYSTEM_METRICS_ERROR',
          message: 'Failed to retrieve system metrics'
        }
      });
    }
  }
};

/**
 * Get system events
 */
export const getSystemEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, category, limit = '100' } = req.query;
    
    const limitNum = parseInt(limit as string, 10);
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      throw new ValidationError('Limit must be between 1 and 1000');
    }
    
    // Validate type if provided
    if (type && !['info', 'warning', 'error', 'critical'].includes(type as string)) {
      throw new ValidationError('Invalid event type. Must be one of: info, warning, error, critical');
    }
    
    // Validate category if provided
    if (category && !['system', 'service', 'security', 'performance'].includes(category as string)) {
      throw new ValidationError('Invalid event category. Must be one of: system, service, security, performance');
    }
    
    const monitoringService = getSystemMonitoringService();
    const events = monitoringService.getSystemEvents(
      limitNum,
      type as any,
      category as any
    );
    
    res.json({
      events,
      count: events.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get system events:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    } else {
      res.status(500).json({
        error: {
          code: 'SYSTEM_EVENTS_ERROR',
          message: 'Failed to retrieve system events'
        }
      });
    }
  }
};
/**

 * Get provider registry status and diagnostics
 */
export const getRegistryStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const registryService = getProviderRegistryService();
    const status = await registryService.getRegistryStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get registry status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRY_STATUS_ERROR',
        message: 'Failed to retrieve registry status'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get provider health status
 */
export const getProviderHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    const registryService = getProviderRegistryService();
    const healthStatuses = registryService.getProviderHealth();
    
    res.json({
      success: true,
      data: {
        providers: healthStatuses,
        summary: {
          total: healthStatuses.length,
          healthy: healthStatuses.filter(h => h.status === 'healthy').length,
          degraded: healthStatuses.filter(h => h.status === 'degraded').length,
          down: healthStatuses.filter(h => h.status === 'down').length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get provider health:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROVIDER_HEALTH_ERROR',
        message: 'Failed to retrieve provider health status'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Refresh provider registry
 */
export const refreshRegistry = async (_req: Request, res: Response): Promise<void> => {
  try {
    const registryService = getProviderRegistryService();
    await registryService.refreshRegistry();
    
    logger.info('Provider registry refreshed manually');
    
    res.json({
      success: true,
      message: 'Provider registry refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to refresh registry:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRY_REFRESH_ERROR',
        message: 'Failed to refresh provider registry'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get registry monitoring status
 */
export const getRegistryMonitoringStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const monitoringService = getRegistryMonitoringService();
    const status = monitoringService.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get registry monitoring status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRY_MONITORING_ERROR',
        message: 'Failed to retrieve registry monitoring status'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Update registry monitoring configuration
 */
export const updateRegistryMonitoringConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = req.body;
    
    // Validate configuration
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Invalid configuration data');
    }
    
    const monitoringService = getRegistryMonitoringService();
    monitoringService.updateConfig(config);
    
    logger.info('Registry monitoring configuration updated', { 
      config,
      userId: (req as any).user?.userId 
    });
    
    res.json({
      success: true,
      message: 'Registry monitoring configuration updated successfully',
      data: monitoringService.getStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update registry monitoring config:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'REGISTRY_MONITORING_CONFIG_ERROR',
          message: 'Failed to update registry monitoring configuration'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
};

/**
 * Trigger manual health check for all providers
 */
export const triggerHealthCheck = async (_req: Request, res: Response): Promise<void> => {
  try {
    const monitoringService = getRegistryMonitoringService();
    const healthStatuses = await monitoringService.checkProviderHealth();
    
    logger.info('Manual health check completed', { 
      providerCount: healthStatuses.length 
    });
    
    res.json({
      success: true,
      message: 'Health check completed successfully',
      data: {
        providers: healthStatuses,
        summary: {
          total: healthStatuses.length,
          healthy: healthStatuses.filter(h => h.status === 'healthy').length,
          degraded: healthStatuses.filter(h => h.status === 'degraded').length,
          down: healthStatuses.filter(h => h.status === 'down').length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to trigger health check:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Failed to perform health check'
      },
      timestamp: new Date().toISOString()
    });
  }
};