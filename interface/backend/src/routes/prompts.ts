import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as promptController from '../controllers/prompts.js';

const router = Router();

// Prompt search and filtering (must come before /:id routes)
router.get('/search', requirePermission(Permission.READ_PROMPTS), asyncHandler(promptController.searchPrompts));
router.get('/tags', requirePermission(Permission.READ_PROMPTS), asyncHandler(promptController.getAvailableTags));
router.get('/providers', requirePermission(Permission.READ_PROMPTS), asyncHandler(promptController.getAvailableProviders));

// Export operations (must come before /:id routes)
router.get('/export/formats', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(promptController.getExportFormats));
router.post('/export/bulk', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(promptController.bulkExportPrompts));

// Prompt CRUD operations
router.get('/', requirePermission(Permission.READ_PROMPTS), asyncHandler(promptController.getPrompts));
router.post('/', requirePermission(Permission.WRITE_PROMPTS), asyncHandler(promptController.createPrompt));
router.get('/:id', requirePermission(Permission.READ_PROMPTS), asyncHandler(promptController.getPrompt));
router.put('/:id', requirePermission(Permission.WRITE_PROMPTS), asyncHandler(promptController.updatePrompt));
router.delete('/:id', requirePermission(Permission.DELETE_PROMPTS), asyncHandler(promptController.deletePrompt));

// Prompt enhancement
router.post('/:id/enhance', requirePermission(Permission.ENHANCE_PROMPTS), asyncHandler(promptController.enhancePrompt));
router.get('/:id/enhance/status', requirePermission(Permission.ENHANCE_PROMPTS), asyncHandler(promptController.getEnhancementStatus));
router.post('/:id/enhance/questionnaire', requirePermission(Permission.ENHANCE_PROMPTS), asyncHandler(promptController.submitQuestionnaireResponse));

// Prompt rendering
router.post('/:id/render/:provider', requirePermission(Permission.READ_PROMPTS), asyncHandler(promptController.renderPrompt));
router.post('/:id/compare', requirePermission(Permission.READ_PROMPTS), asyncHandler(promptController.compareProviders));

// Prompt variants
router.post('/:id/variants', requirePermission(Permission.WRITE_PROMPTS), asyncHandler(promptController.saveVariant));

// Prompt versioning
router.get('/:id/history', requirePermission(Permission.READ_PROMPTS), asyncHandler(promptController.getPromptHistory));
router.get('/:id/versions/:version', requirePermission(Permission.READ_PROMPTS), asyncHandler(promptController.getPromptVersion));

// Prompt rating endpoints moved to /api/ratings/prompts/:id/* for better organization

// Prompt export
router.post('/:id/export', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(promptController.exportPrompt));
router.post('/:id/export/preview', requirePermission(Permission.EXPORT_PROMPTS), asyncHandler(promptController.previewExport));

export { router as promptRoutes };