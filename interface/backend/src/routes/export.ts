import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as exportController from '../controllers/export.js';

const router = Router();

// Export formats and documentation
router.get('/formats', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.getExportFormats));
router.get('/documentation', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.getExportDocumentation));

// Single prompt export
router.post('/prompt/:id', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.exportPrompt));
router.post('/prompt/:id/preview', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.previewExport));

// Bulk export
router.post('/bulk', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.bulkExportPrompts));
router.post('/bulk/preview', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.previewBulkExport));

// Export templates and examples
router.get('/templates', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.getExportTemplates));
router.get('/examples/:format', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.getFormatExample));

// API documentation
router.get('/api-docs', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.getAPIDocumentation));
router.get('/openapi', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.getOpenAPISpec));

// Share functionality
router.post('/share', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.createShareLink));
router.get('/share', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.getShareLinks));
router.delete('/share/:linkId', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.deleteShareLink));

// Public shared prompt access (no authentication required)
router.post('/shared/:linkId', asyncHandler(exportController.getSharedPrompt));

// Export history
router.get('/history', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.getExportHistory));
router.delete('/history/:exportId', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.deleteExportHistory));
router.get('/history/:exportId/download', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(exportController.downloadFromHistory));

export { router as exportRoutes };