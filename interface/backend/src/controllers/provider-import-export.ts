/**
 * Provider Import/Export API Controller
 * 
 * Handles REST endpoints for provider configuration export, bulk import
 * with validation and conflict resolution, and backup/restore functionality
 * for provider configurations.
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { getTemplateManagementService } from '../services/template-management-service.js';
import { ValidationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import {
  ImportOptions,
  ExportOptions,
  BackupOptions,
  RestoreOptions
} from '../types/dynamic-providers.js';

// ============================================================================
// Validation Schemas
// ============================================================================

const exportOptionsSchema = Joi.object({
  format: Joi.string().valid('json', 'yaml').optional().default('json'),
  includeModels: Joi.boolean().optional().default(true),
  includeTemplates: Joi.boolean().optional().default(false),
  includeSystemProviders: Joi.boolean().optional().default(false),
  excludeCredentials: Joi.boolean().optional().default(true),
  providerIds: Joi.array().items(Joi.string()).optional(),
  templateIds: Joi.array().items(Joi.string()).optional()
});

const importOptionsSchema = Joi.object({
  format: Joi.string().valid('json', 'yaml').optional().default('json'),
  overwriteExisting: Joi.boolean().optional().default(false),
  skipValidation: Joi.boolean().optional().default(false),
  dryRun: Joi.boolean().optional().default(false),
  conflictResolution: Joi.string().valid('skip', 'overwrite', 'merge', 'rename').optional().default('skip'),
  importModels: Joi.boolean().optional().default(true),
  importTemplates: Joi.boolean().optional().default(true)
});

const backupOptionsSchema = Joi.object({
  includeSystemProviders: Joi.boolean().optional().default(false),
  includeCredentials: Joi.boolean().optional().default(false),
  compression: Joi.boolean().optional().default(true),
  encryption: Joi.boolean().optional().default(false),
  encryptionKey: Joi.string().optional()
});

const restoreOptionsSchema = Joi.object({
  overwriteExisting: Joi.boolean().optional().default(false),
  validateBeforeRestore: Joi.boolean().optional().default(true),
  restoreCredentials: Joi.boolean().optional().default(false),
  decryptionKey: Joi.string().optional()
});

const bulkImportSchema = Joi.object({
  data: Joi.alternatives().try(
    Joi.string(), // YAML/JSON string
    Joi.object(), // Parsed object
    Joi.array().items(Joi.object()) // Array of provider configs
  ).required(),
  options: importOptionsSchema.optional()
});

// ============================================================================
// Export Operations
// ============================================================================

/**
 * Export provider configurations
 * GET /api/admin/providers/export
 */
export const exportProviders = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = exportOptionsSchema.validate(req.query);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const options: ExportOptions = value;

  logger.info('Exporting provider configurations', {
    format: options.format,
    includeModels: options.includeModels,
    includeTemplates: options.includeTemplates,
    providerCount: options.providerIds?.length || 'all',
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const exportData = await dynamicProviderService.exportProviders(options);

    // Set appropriate headers for download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `providers-export-${timestamp}.${options.format}`;
    const contentType = options.format === 'yaml' ? 'application/x-yaml' : 'application/json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (options.format === 'yaml') {
      res.send(exportData);
    } else {
      res.json(exportData);
    }

    logger.info('Provider configurations exported successfully', {
      format: options.format,
      exportSize: typeof exportData === 'string' ? exportData.length : JSON.stringify(exportData).length,
      userId: req.user?.userId,
      ip: req.ip
    });
  } catch (error) {
    logger.error('Failed to export provider configurations:', error);
    throw error;
  }
};

/**
 * Export specific provider configuration
 * GET /api/admin/providers/:id/export
 */
export const exportProvider = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { error, value } = exportOptionsSchema.validate(req.query);

  if (!id) {
    throw new ValidationError('Provider ID is required');
  }

  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const options: ExportOptions = { ...value, providerIds: [id] };

  logger.info('Exporting single provider configuration', {
    providerId: id,
    format: options.format,
    includeModels: options.includeModels,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const exportData = await dynamicProviderService.exportProvider(id, options);

    // Get provider for filename
    const provider = await dynamicProviderService.getProvider(id);
    const filename = `provider-${provider.identifier}-export.${options.format}`;
    const contentType = options.format === 'yaml' ? 'application/x-yaml' : 'application/json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (options.format === 'yaml') {
      res.send(exportData);
    } else {
      res.json(exportData);
    }

    logger.info('Provider configuration exported successfully', {
      providerId: id,
      providerIdentifier: provider.identifier,
      format: options.format,
      userId: req.user?.userId,
      ip: req.ip
    });
  } catch (error) {
    logger.error('Failed to export provider configuration:', error);
    throw error;
  }
};

/**
 * Export provider templates
 * GET /api/admin/provider-templates/export
 */
export const exportTemplates = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = exportOptionsSchema.validate(req.query);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const options: ExportOptions = value;

  logger.info('Exporting provider templates', {
    format: options.format,
    templateCount: options.templateIds?.length || 'all',
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const templateService = getTemplateManagementService();
    const exportData = await templateService.exportTemplates(options);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `templates-export-${timestamp}.${options.format}`;
    const contentType = options.format === 'yaml' ? 'application/x-yaml' : 'application/json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (options.format === 'yaml') {
      res.send(exportData);
    } else {
      res.json(exportData);
    }

    logger.info('Provider templates exported successfully', {
      format: options.format,
      userId: req.user?.userId,
      ip: req.ip
    });
  } catch (error) {
    logger.error('Failed to export provider templates:', error);
    throw error;
  }
};

// ============================================================================
// Import Operations
// ============================================================================

/**
 * Import provider configurations (bulk)
 * POST /api/admin/providers/import
 */
export const importProviders = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = bulkImportSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const { data, options = {} } = value;
  const importOptions: ImportOptions = options;
  const createdBy = req.user?.userId;

  logger.info('Importing provider configurations', {
    format: importOptions.format,
    dryRun: importOptions.dryRun,
    overwriteExisting: importOptions.overwriteExisting,
    conflictResolution: importOptions.conflictResolution,
    createdBy,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const importResult = await dynamicProviderService.importProviders(data, {
      ...importOptions,
      createdBy
    });

    logger.info('Provider configurations import completed', {
      imported: importResult.imported.length,
      skipped: importResult.skipped.length,
      errors: importResult.errors.length,
      dryRun: importOptions.dryRun,
      createdBy,
      ip: req.ip
    });

    const statusCode = importOptions.dryRun ? 200 : 201;

    res.status(statusCode).json({
      success: true,
      data: {
        import: importResult,
        summary: {
          total: importResult.imported.length + importResult.skipped.length + importResult.errors.length,
          imported: importResult.imported.length,
          skipped: importResult.skipped.length,
          failed: importResult.errors.length,
          dryRun: importOptions.dryRun
        }
      },
      message: importOptions.dryRun ? 'Import validation completed' : 'Import completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to import provider configurations:', error);
    throw error;
  }
};

/**
 * Import provider templates
 * POST /api/admin/provider-templates/import
 */
export const importTemplates = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = bulkImportSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const { data, options = {} } = value;
  const importOptions: ImportOptions = options;
  const createdBy = req.user?.userId;

  logger.info('Importing provider templates', {
    format: importOptions.format,
    dryRun: importOptions.dryRun,
    overwriteExisting: importOptions.overwriteExisting,
    createdBy,
    ip: req.ip
  });

  try {
    const templateService = getTemplateManagementService();
    const importResult = await templateService.importTemplates(data, {
      ...importOptions,
      createdBy
    });

    logger.info('Provider templates import completed', {
      imported: importResult.imported.length,
      skipped: importResult.skipped.length,
      errors: importResult.errors.length,
      dryRun: importOptions.dryRun,
      createdBy,
      ip: req.ip
    });

    const statusCode = importOptions.dryRun ? 200 : 201;

    res.status(statusCode).json({
      success: true,
      data: {
        import: importResult,
        summary: {
          total: importResult.imported.length + importResult.skipped.length + importResult.errors.length,
          imported: importResult.imported.length,
          skipped: importResult.skipped.length,
          failed: importResult.errors.length,
          dryRun: importOptions.dryRun
        }
      },
      message: importOptions.dryRun ? 'Import validation completed' : 'Import completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to import provider templates:', error);
    throw error;
  }
};

/**
 * Validate import data without importing
 * POST /api/admin/providers/validate-import
 */
export const validateImport = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = bulkImportSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const { data, options = {} } = value;
  const importOptions: ImportOptions = { ...options, dryRun: true };

  logger.info('Validating import data', {
    format: importOptions.format,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const validationResult = await dynamicProviderService.validateImportData(data, importOptions);

    res.json({
      success: true,
      data: {
        validation: validationResult,
        summary: {
          valid: validationResult.valid.length,
          invalid: validationResult.invalid.length,
          warnings: validationResult.warnings.length,
          conflicts: validationResult.conflicts.length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to validate import data:', error);
    throw error;
  }
};

// ============================================================================
// Backup and Restore Operations
// ============================================================================

/**
 * Create system backup of all provider configurations
 * POST /api/admin/providers/backup
 */
export const createBackup = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = backupOptionsSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const options: BackupOptions = value;

  logger.info('Creating provider configuration backup', {
    includeSystemProviders: options.includeSystemProviders,
    includeCredentials: options.includeCredentials,
    compression: options.compression,
    encryption: options.encryption,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const backup = await dynamicProviderService.createBackup(options);

    logger.info('Provider configuration backup created successfully', {
      backupId: backup.id,
      size: backup.size,
      providerCount: backup.providerCount,
      modelCount: backup.modelCount,
      templateCount: backup.templateCount,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: {
        backup: {
          id: backup.id,
          filename: backup.filename,
          size: backup.size,
          providerCount: backup.providerCount,
          modelCount: backup.modelCount,
          templateCount: backup.templateCount,
          createdAt: backup.createdAt,
          compressed: backup.compressed,
          encrypted: backup.encrypted
        }
      },
      message: 'Backup created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to create backup:', error);
    throw error;
  }
};

/**
 * List available backups
 * GET /api/admin/providers/backups
 */
export const listBackups = async (req: Request, res: Response): Promise<void> => {
  const { limit = '50', offset = '0' } = req.query;

  const limitNum = parseInt(limit as string, 10);
  const offsetNum = parseInt(offset as string, 10);

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ValidationError('Limit must be between 1 and 100');
  }

  if (isNaN(offsetNum) || offsetNum < 0) {
    throw new ValidationError('Offset must be non-negative');
  }

  try {
    const dynamicProviderService = getDynamicProviderService();
    const backups = await dynamicProviderService.listBackups({ limit: limitNum, offset: offsetNum });

    res.json({
      success: true,
      data: {
        backups: backups.items,
        total: backups.total,
        limit: limitNum,
        offset: offsetNum
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to list backups:', error);
    throw error;
  }
};

/**
 * Download backup file
 * GET /api/admin/providers/backups/:id/download
 */
export const downloadBackup = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Backup ID is required');
  }

  logger.info('Downloading backup', {
    backupId: id,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const backupStream = await dynamicProviderService.downloadBackup(id);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="backup-${id}.zip"`);

    backupStream.pipe(res);

    logger.info('Backup download started', {
      backupId: id,
      userId: req.user?.userId,
      ip: req.ip
    });
  } catch (error) {
    logger.error('Failed to download backup:', error);
    throw error;
  }
};

/**
 * Restore from backup
 * POST /api/admin/providers/restore
 */
export const restoreFromBackup = async (req: Request, res: Response): Promise<void> => {
  const { backupId, options = {} } = req.body;

  if (!backupId) {
    throw new ValidationError('Backup ID is required');
  }

  const { error, value } = restoreOptionsSchema.validate(options);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const restoreOptions: RestoreOptions = value;

  logger.info('Restoring from backup', {
    backupId,
    overwriteExisting: restoreOptions.overwriteExisting,
    validateBeforeRestore: restoreOptions.validateBeforeRestore,
    restoreCredentials: restoreOptions.restoreCredentials,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const restoreResult = await dynamicProviderService.restoreFromBackup(backupId, restoreOptions);

    logger.info('Restore from backup completed', {
      backupId,
      restored: restoreResult.restored.length,
      skipped: restoreResult.skipped.length,
      errors: restoreResult.errors.length,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        restore: restoreResult,
        summary: {
          total: restoreResult.restored.length + restoreResult.skipped.length + restoreResult.errors.length,
          restored: restoreResult.restored.length,
          skipped: restoreResult.skipped.length,
          failed: restoreResult.errors.length
        }
      },
      message: 'Restore completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to restore from backup:', error);
    throw error;
  }
};

/**
 * Delete backup
 * DELETE /api/admin/providers/backups/:id
 */
export const deleteBackup = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Backup ID is required');
  }

  logger.info('Deleting backup', {
    backupId: id,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    await dynamicProviderService.deleteBackup(id);

    logger.info('Backup deleted successfully', {
      backupId: id,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Backup deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to delete backup:', error);
    throw error;
  }
};