/**
 * Prompt Template Management Routes
 * 
 * Defines REST API routes for customizable LLM prompt template management
 * including CRUD operations, testing, validation, analytics, and version control.
 * All routes require admin permissions.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as promptTemplateController from '../controllers/prompt-templates.js';

const router = Router();

// ============================================================================
// Template CRUD Operations (Admin Only)
// ============================================================================

router.post('/', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.createTemplate));
router.get('/', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.getTemplates));
router.get('/categories', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.getTemplateCategories));
router.get('/categories/:category', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.getTemplatesByCategory));
router.get('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.getTemplate));
router.put('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.updateTemplate));
router.delete('/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.deleteTemplate));

// ============================================================================
// Template Testing and Validation (Admin Only)
// ============================================================================

router.post('/validate', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.validateTemplate));
router.post('/preview', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.previewTemplateContent));
router.post('/test', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.testTemplate));
router.post('/test-provider', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.testProviderCompatibility));
router.post('/performance-test', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.performanceTest));
router.post('/bulk-delete', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.bulkDeleteTemplates));
router.post('/:id/test', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.testTemplate));
router.post('/:id/preview', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.previewTemplate));
router.post('/:id/test-compatibility', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.testProviderCompatibility));

// ============================================================================
// Template Version Management (Admin Only)
// ============================================================================

router.get('/:id/versions', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.getTemplateVersions));
router.post('/:id/revert/:version', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.revertTemplate));

// ============================================================================
// Template Import/Export (Admin Only)
// ============================================================================

router.get('/:id/export', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.exportTemplate));
router.post('/import', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.importTemplate));

// ============================================================================
// Template Analytics and Performance Metrics (Admin Only)
// ============================================================================

router.get('/analytics/dashboard', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.getAnalyticsDashboard));
router.get('/analytics/ranking', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.getTemplateRanking));
router.get('/analytics/export', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.exportAnalytics));
router.post('/analytics/compare', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.compareTemplates));
router.get('/:id/analytics/usage', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.getTemplateUsageStats));
router.get('/:id/analytics/performance', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.getTemplatePerformanceMetrics));
router.get('/:id/analytics/realtime', requirePermission(Permission.ADMIN_USERS), asyncHandler(promptTemplateController.getRealtimeMetrics));

export { router as promptTemplateRoutes };