/**
 * Template Management Routes
 * 
 * Defines REST API routes for provider template management including
 * CRUD operations, template application, preview, and customization.
 * All routes require admin permissions.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as templateController from '../controllers/templates.js';
import * as importExportController from '../controllers/provider-import-export.js';

const router = Router();

// ============================================================================
// Template CRUD Operations (Admin Only)
// ============================================================================

router.post('/', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.createTemplate));
router.get('/', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.getTemplates));
router.get('/system', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.getSystemTemplates));
router.get('/categories', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.getTemplateCategories));
router.get('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.getTemplate));
router.put('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.updateTemplate));
router.delete('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.deleteTemplate));

// ============================================================================
// Template Application and Preview (Admin Only)
// ============================================================================

router.post('/:id/apply', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.applyTemplate));
router.post('/:id/preview', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.previewTemplate));
router.get('/:id/customization-options', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.getTemplateCustomizationOptions));

// ============================================================================
// Template Management Operations (Admin Only)
// ============================================================================

router.post('/:id/clone', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.cloneTemplate));
router.get('/:id/export', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.exportTemplate));
router.post('/import', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.importTemplate));

// ============================================================================
// Template Import/Export (Admin Only)
// ============================================================================

router.get('/export', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.exportTemplates));
router.post('/import', requirePermission(Permission.ADMIN_USERS), asyncHandler(importExportController.importTemplates));

export { router as templateRoutes };