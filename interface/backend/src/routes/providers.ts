/**
 * Provider Management Routes
 * 
 * Defines REST API routes for dynamic provider management including
 * CRUD operations, testing, validation, and status management.
 * All routes require admin permissions.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as providerController from '../controllers/providers.js';
import * as modelController from '../controllers/models.js';
// Removed unused template controller import
import * as importExportController from '../controllers/provider-import-export.js';

const router = Router();

// ============================================================================
// Provider CRUD Operations (Admin Only)
// ============================================================================

// System-wide statistics and health (MUST come before parameterized routes)
router.get('/system-stats', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.getSystemStats));
router.get('/health', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.getAllProviderHealth));

// Provider testing and validation (specific routes before parameterized)
router.post('/validate', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.validateProvider));
router.get('/check-identifier/:identifier', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.checkIdentifierAvailability));

// Provider management
router.post('/', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.createProvider));
router.get('/', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.getProviders));
router.get('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.getProvider));
router.put('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.updateProvider));
router.delete('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.deleteProvider));

// Provider testing and validation (parameterized routes)
router.post('/:id/test', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.testProvider));

// Provider status management
router.put('/:id/status', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.updateProviderStatus));
router.get('/:id/health', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.getProviderHealth));
router.get('/:id/stats', requirePermission(Permission.ADMIN_USERS), asyncHandler(providerController.getProviderStats));

// ============================================================================
// Model Management (Admin Only)
// ============================================================================

// Model CRUD operations
router.post('/:providerId/models', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.createModel));
router.get('/:providerId/models', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.getProviderModels));
router.post('/:providerId/models/import', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.importModelsFromProvider));

// ============================================================================
// Import/Export Operations (Admin Only)
// ============================================================================

// Provider export
router.get('/export', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.exportProviders));
router.get('/:id/export', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.exportProvider));

// Provider import
router.post('/import', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.importProviders));
router.post('/validate-import', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.validateImport));

// Backup and restore
router.post('/backup', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.createBackup));
router.get('/backups', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.listBackups));
router.get('/backups/:id/download', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.downloadBackup));
router.post('/restore', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.restoreFromBackup));
router.delete('/backups/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.deleteBackup));

export { router as providerRoutes };