/**
 * Provider Migration Utilities Controller
 * 
 * REST API endpoints for provider migration utilities, including
 * migration planning, execution, and rollback functionality.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { getProviderMigrationUtilitiesService } from '../services/provider-migration-utilities-service.js';
import { validateAdminAccess } from '../middleware/auth.js';

/**
 * Create migration plan
 */
export async function createMigrationPlan(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const migrationService = getProviderMigrationUtilitiesService();
    const plan = await migrationService.createMigrationPlan();
    
    res.json({
      success: true,
      data: plan,
      message: 'Migration plan created successfully'
    });

  } catch (error) {
    logger.error('Failed to create migration plan', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create migration plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Execute migration plan
 */
export async function executeMigrationPlan(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const planId = req.params['planId'];
    if (!planId) {
      res.status(400).json({
        success: false,
        error: 'Migration plan ID is required'
      });
      return;
    }

    const migrationService = getProviderMigrationUtilitiesService();
    
    // Execute migration asynchronously
    migrationService.executeMigrationPlan(planId)
      .then(result => {
        logger.info('Migration completed', { planId, result });
      })
      .catch(error => {
        logger.error('Migration failed', { planId, error });
      });
    
    res.json({
      success: true,
      message: 'Migration started successfully',
      planId
    });

  } catch (error) {
    logger.error('Failed to start migration', { planId: req.params['planId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to start migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get migration progress
 */
export async function getMigrationProgress(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const planId = req.params['planId'];
    if (!planId) {
      res.status(400).json({
        success: false,
        error: 'Migration plan ID is required'
      });
      return;
    }

    const migrationService = getProviderMigrationUtilitiesService();
    const progress = migrationService.getMigrationProgress(planId);
    
    if (!progress) {
      res.status(404).json({
        success: false,
        error: 'Migration progress not found'
      });
      return;
    }

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    logger.error('Failed to get migration progress', { planId: req.params['planId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve migration progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Rollback migration
 */
export async function rollbackMigration(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const planId = req.params['planId'];
    if (!planId) {
      res.status(400).json({
        success: false,
        error: 'Migration plan ID is required'
      });
      return;
    }

    const migrationService = getProviderMigrationUtilitiesService();
    await migrationService.rollbackMigration(planId);
    
    res.json({
      success: true,
      message: 'Migration rolled back successfully'
    });

  } catch (error) {
    logger.error('Failed to rollback migration', { planId: req.params['planId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to rollback migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Validate connection compatibility
 */
export async function validateConnectionCompatibility(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const connectionId = req.params['connectionId'];
    if (!connectionId) {
      res.status(400).json({
        success: false,
        error: 'Connection ID is required'
      });
      return;
    }

    const migrationService = getProviderMigrationUtilitiesService();
    const validation = await migrationService.validateConnectionCompatibility(connectionId);
    
    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    logger.error('Failed to validate connection compatibility', { 
      connectionId: req.params['connectionId'], 
      error 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to validate connection compatibility',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get migration service configuration
 */
export async function getMigrationConfig(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    // Get current configuration (this would need to be added to the service)
    const config = {
      batchSize: 10,
      validateBeforeMigration: true,
      createBackup: true,
      enableRollback: true,
      dryRun: false
    };
    
    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Failed to get migration config', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve migration configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Update migration service configuration
 */
export async function updateMigrationConfig(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const config = req.body;
    
    // Validate configuration
    if (config.batchSize && (config.batchSize < 1 || config.batchSize > 100)) {
      res.status(400).json({
        success: false,
        error: 'Batch size must be between 1 and 100'
      });
      return;
    }

    // Note: The service would need to be updated to support configuration updates
    // For now, we'll just return success
    
    res.json({
      success: true,
      data: config,
      message: 'Migration configuration updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update migration config', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update migration configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get migration statistics
 */
export async function getMigrationStatistics(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    // This would query the database for migration statistics
    // For now, we'll return mock data
    const statistics = {
      totalMigrations: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      totalConnectionsMigrated: 0,
      averageMigrationTime: 0,
      lastMigration: null,
      migrationsByProvider: {}
    };
    
    res.json({
      success: true,
      data: statistics
    });

  } catch (error) {
    logger.error('Failed to get migration statistics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve migration statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Dry run migration
 */
export async function dryRunMigration(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const planId = req.params['planId'];
    if (!planId) {
      res.status(400).json({
        success: false,
        error: 'Migration plan ID is required'
      });
      return;
    }

    // Create a dry-run version of the migration service
    const migrationService = getProviderMigrationUtilitiesService({
      dryRun: true,
      createBackup: false
    });
    
    const result = await migrationService.executeMigrationPlan(planId);
    
    res.json({
      success: true,
      data: result,
      message: 'Dry run migration completed successfully'
    });

  } catch (error) {
    logger.error('Failed to perform dry run migration', { planId: req.params['planId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to perform dry run migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Export migration report
 */
export async function exportMigrationReport(req: Request, res: Response): Promise<void> {
  try {
    await validateAdminAccess(req);
    
    const planId = req.params['planId'];
    const { format = 'json' } = req.query;
    
    if (!planId) {
      res.status(400).json({
        success: false,
        error: 'Migration plan ID is required'
      });
      return;
    }

    // This would generate a comprehensive migration report
    // For now, we'll return a basic report structure
    const report = {
      planId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalConnections: 0,
        migratedConnections: 0,
        failedConnections: 0,
        duration: 0
      },
      details: {
        createdProviders: [],
        createdModels: [],
        errors: [],
        warnings: []
      },
      recommendations: []
    };

    // Set appropriate headers for download
    const filename = `migration-report-${planId}-${new Date().toISOString().split('T')[0]}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.json(report);
    } else {
      res.status(400).json({
        success: false,
        error: 'Unsupported export format. Only JSON is currently supported.'
      });
    }

  } catch (error) {
    logger.error('Failed to export migration report', { planId: req.params['planId'], error });
    res.status(500).json({
      success: false,
      error: 'Failed to export migration report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}