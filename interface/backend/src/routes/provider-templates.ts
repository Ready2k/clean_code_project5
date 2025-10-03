/**
 * Provider Template Routes
 * 
 * Defines REST API routes for provider template management including
 * listing templates, applying templates, and template validation.
 * All routes require admin permissions.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as templateController from '../controllers/provider-templates.js';

const router = Router();

// ============================================================================
// Template Operations (Admin Only)
// ============================================================================

// Template categories and metadata (MUST come before parameterized routes)
router.get('/categories', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.getTemplateCategories));

// Template application and preview
router.post('/apply', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.applyTemplate));
router.post('/preview', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.previewTemplate));

// Template CRUD operations
router.get('/', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.getTemplates));
router.get('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(templateController.getTemplate));

export { router as providerTemplateRoutes };