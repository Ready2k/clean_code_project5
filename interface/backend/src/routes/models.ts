/**
 * Model Management Routes
 * 
 * Defines REST API routes for model management including CRUD operations,
 * bulk operations, testing, and capability management. All routes require
 * admin permissions.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as modelController from '../controllers/models.js';

const router = Router();

// ============================================================================
// Model CRUD Operations (Admin Only)
// ============================================================================

// Global model operations
router.get('/', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.getAllModels));
router.get('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.getModel));
router.put('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.updateModel));
router.delete('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.deleteModel));

// ============================================================================
// Model Testing and Validation (Admin Only)
// ============================================================================

router.post('/:id/test', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.testModel));
router.post('/:id/validate-capabilities', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.validateModelCapabilities));

// ============================================================================
// Bulk Operations (Admin Only)
// ============================================================================

router.post('/bulk', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.bulkModelOperation));

// ============================================================================
// Model Status and Management (Admin Only)
// ============================================================================

router.put('/:id/status', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.updateModelStatus));
router.put('/:id/set-default', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.setModelAsDefault));
router.get('/:id/stats', requirePermission(Permission.ADMIN_USERS), asyncHandler(modelController.getModelStats));

export { router as modelRoutes };