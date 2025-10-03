/**
 * Migration Routes
 * 
 * Defines REST API routes for system migration operations including
 * provider migration, status checking, backup/restore, and recommendations.
 * All routes require admin permissions.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as migrationController from '../controllers/migration.js';

const router = Router();

// ============================================================================
// Migration Status and Information
// ============================================================================

router.get('/status', requirePermission(Permission.ADMIN_USERS), asyncHandler(migrationController.getMigrationStatus));
router.get('/history', requirePermission(Permission.ADMIN_USERS), asyncHandler(migrationController.getMigrationHistory));
router.get('/recommendations', requirePermission(Permission.ADMIN_USERS), asyncHandler(migrationController.getMigrationRecommendations));

// ============================================================================
// Migration Operations
// ============================================================================

router.post('/validate', requirePermission(Permission.ADMIN_USERS), asyncHandler(migrationController.validateMigration));
router.post('/dry-run', requirePermission(Permission.ADMIN_USERS), asyncHandler(migrationController.performDryRun));
router.post('/migrate', requirePermission(Permission.ADMIN_USERS), asyncHandler(migrationController.migrateSystemProviders));

// ============================================================================
// Backup and Restore Operations
// ============================================================================

router.post('/backup', requirePermission(Permission.ADMIN_USERS), asyncHandler(migrationController.createMigrationBackup));
router.get('/backups', requirePermission(Permission.ADMIN_USERS), asyncHandler(migrationController.listMigrationBackups));
router.post('/restore/:backupId', requirePermission(Permission.ADMIN_USERS), asyncHandler(migrationController.restoreFromBackup));

export { router as migrationRoutes };