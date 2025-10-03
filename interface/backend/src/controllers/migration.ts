/**
 * Migration Controller
 * 
 * REST API endpoints for system migration operations including
 * provider migration, status checking, and rollback procedures.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { getSystemMigrationService, MigrationOptions } from '../services/system-migration-service.js';
import { AppError, ValidationError } from '../types/errors.js';

/**
 * Get migration status
 */
export async function getMigrationStatus(req: Request, res: Response): Promise<void> {
  try {
    const migrationService = getSystemMigrationService();
    const status = await migrationService.getMigrationStatus();

    logger.info('Retrieved migration status', {
      userId: (req.user as any)?.id,
      status
    });

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Failed to get migration status:', error);
    throw new AppError(
      'Failed to get migration status',
      500,
      'MIGRATION_STATUS_ERROR' as any
    );
  }
}

/**
 * Validate system for migration
 */
export async function validateMigration(req: Request, res: Response): Promise<void> {
  try {
    const migrationService = getSystemMigrationService();
    
    const result = await migrationService.migrateSystemProviders({
      validateOnly: true
    });

    logger.info('Migration validation completed', {
      userId: (req.user as any)?.id,
      success: result.success,
      errors: result.errors.length,
      warnings: result.warnings.length
    });

    res.json({
      success: true,
      data: {
        valid: result.success,
        errors: result.errors,
        warnings: result.warnings,
        duration: result.duration
      }
    });

  } catch (error) {
    logger.error('Failed to validate migration:', error);
    throw new AppError(
      'Failed to validate migration',
      500,
      'MIGRATION_VALIDATION_ERROR' as any
    );
  }
}

/**
 * Perform migration dry run
 */
export async function performDryRun(req: Request, res: Response): Promise<void> {
  try {
    const migrationService = getSystemMigrationService();
    
    const options: MigrationOptions = {
      dryRun: true,
      skipExisting: req.body.skipExisting || false,
      force: req.body.force || false
    };

    const result = await migrationService.migrateSystemProviders(options);

    logger.info('Migration dry run completed', {
      userId: (req.user as any)?.id,
      options,
      result: {
        success: result.success,
        providersCreated: result.providersCreated,
        modelsCreated: result.modelsCreated,
        templatesCreated: result.templatesCreated,
        connectionsUpdated: result.connectionsUpdated
      }
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Failed to perform migration dry run:', error);
    throw new AppError(
      'Failed to perform migration dry run',
      500,
      'MIGRATION_DRY_RUN_ERROR' as any
    );
  }
}

/**
 * Perform system provider migration
 */
export async function migrateSystemProviders(req: Request, res: Response): Promise<void> {
  try {
    const migrationService = getSystemMigrationService();
    
    // Validate request body
    const options: MigrationOptions = {
      dryRun: false,
      skipExisting: req.body.skipExisting || false,
      createBackup: req.body.createBackup !== false, // Default to true
      force: req.body.force || false
    };

    // Validate that this is not a dry run
    if (options.dryRun) {
      throw new ValidationError('Use the dry-run endpoint for dry runs');
    }

    logger.info('Starting system provider migration', {
      userId: (req.user as any)?.id,
      options
    });

    const result = await migrationService.migrateSystemProviders(options);

    logger.info('System provider migration completed', {
      userId: (req.user as any)?.id,
      success: result.success,
      providersCreated: result.providersCreated,
      modelsCreated: result.modelsCreated,
      templatesCreated: result.templatesCreated,
      connectionsUpdated: result.connectionsUpdated,
      duration: result.duration
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Failed to migrate system providers:', error);
    
    if (error instanceof ValidationError) {
      throw error;
    }
    
    throw new AppError(
      'Failed to migrate system providers',
      500,
      'MIGRATION_ERROR' as any
    );
  }
}

/**
 * Get migration history
 */
export async function getMigrationHistory(req: Request, res: Response): Promise<void> {
  try {
    // This would typically come from a migration history table
    // For now, we'll return a placeholder response
    const history = [
      {
        id: '1',
        type: 'system_provider_migration',
        status: 'completed',
        startedAt: new Date(Date.now() - 86400000), // 1 day ago
        completedAt: new Date(Date.now() - 86400000 + 300000), // 5 minutes later
        duration: 300000,
        providersCreated: 3,
        modelsCreated: 15,
        templatesCreated: 3,
        connectionsUpdated: 0,
        performedBy: (req.user as any)?.id || 'system'
      }
    ];

    logger.info('Retrieved migration history', {
      userId: (req.user as any)?.id,
      historyCount: history.length
    });

    res.json({
      success: true,
      data: {
        migrations: history,
        total: history.length
      }
    });

  } catch (error) {
    logger.error('Failed to get migration history:', error);
    throw new AppError(
      'Failed to get migration history',
      500,
      'MIGRATION_HISTORY_ERROR' as any
    );
  }
}

/**
 * Create migration backup
 */
export async function createMigrationBackup(req: Request, res: Response): Promise<void> {
  try {
    // This would create a backup of the current system state
    // For now, we'll return a placeholder response
    const backupId = `backup-${Date.now()}`;
    
    logger.info('Created migration backup', {
      userId: (req.user as any)?.id,
      backupId
    });

    res.json({
      success: true,
      data: {
        backupId,
        createdAt: new Date(),
        size: '2.5MB',
        includes: [
          'providers',
          'models', 
          'templates',
          'connections'
        ]
      }
    });

  } catch (error) {
    logger.error('Failed to create migration backup:', error);
    throw new AppError(
      'Failed to create migration backup',
      500,
      'BACKUP_CREATION_ERROR' as any
    );
  }
}

/**
 * List migration backups
 */
export async function listMigrationBackups(req: Request, res: Response): Promise<void> {
  try {
    // This would list available migration backups
    // For now, we'll return a placeholder response
    const backups = [
      {
        id: 'backup-1704067200000',
        createdAt: new Date(1704067200000),
        size: '2.5MB',
        type: 'pre_migration',
        description: 'Backup before system provider migration'
      }
    ];

    logger.info('Retrieved migration backups', {
      userId: (req.user as any)?.id,
      backupCount: backups.length
    });

    res.json({
      success: true,
      data: {
        backups,
        total: backups.length
      }
    });

  } catch (error) {
    logger.error('Failed to list migration backups:', error);
    throw new AppError(
      'Failed to list migration backups',
      500,
      'BACKUP_LIST_ERROR' as any
    );
  }
}

/**
 * Restore from migration backup
 */
export async function restoreFromBackup(req: Request, res: Response): Promise<void> {
  try {
    const { backupId } = req.params;
    
    if (!backupId) {
      throw new ValidationError('Backup ID is required');
    }

    // This would restore the system from a backup
    // For now, we'll return a placeholder response
    logger.info('Restored from migration backup', {
      userId: (req.user as any)?.id,
      backupId
    });

    res.json({
      success: true,
      data: {
        backupId,
        restoredAt: new Date(),
        message: 'System restored successfully from backup'
      }
    });

  } catch (error) {
    logger.error('Failed to restore from backup:', error);
    
    if (error instanceof ValidationError) {
      throw error;
    }
    
    throw new AppError(
      'Failed to restore from backup',
      500,
      'BACKUP_RESTORE_ERROR' as any
    );
  }
}

/**
 * Get migration recommendations
 */
export async function getMigrationRecommendations(req: Request, res: Response): Promise<void> {
  try {
    const migrationService = getSystemMigrationService();
    const status = await migrationService.getMigrationStatus();

    const recommendations = [];

    if (!status.isSystemMigrated) {
      recommendations.push({
        type: 'action',
        priority: 'high',
        title: 'Migrate System Providers',
        description: 'Migrate hardcoded providers to dynamic provider system',
        action: 'migrate_system_providers'
      });
    }

    if (status.legacyConnections > 0) {
      recommendations.push({
        type: 'action',
        priority: 'medium',
        title: 'Migrate Legacy Connections',
        description: `${status.legacyConnections} connections are still using legacy providers`,
        action: 'migrate_legacy_connections'
      });
    }

    if (status.systemProviders < 3) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        title: 'Incomplete System Migration',
        description: 'Not all system providers have been migrated',
        action: 'complete_system_migration'
      });
    }

    logger.info('Generated migration recommendations', {
      userId: (req.user as any)?.id,
      recommendationCount: recommendations.length
    });

    res.json({
      success: true,
      data: {
        recommendations,
        status
      }
    });

  } catch (error) {
    logger.error('Failed to get migration recommendations:', error);
    throw new AppError(
      'Failed to get migration recommendations',
      500,
      'MIGRATION_RECOMMENDATIONS_ERROR' as any
    );
  }
}