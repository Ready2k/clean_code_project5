import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as ratingController from '../controllers/ratings.js';

const router = Router();

// System-wide rating statistics and analytics
router.get('/system/stats', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(ratingController.getSystemRatingStats));
router.get('/system/trends', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(ratingController.getRatingTrends));
router.get('/system/top-rated', requirePermission(Permission.READ_PROMPTS), asyncHandler(ratingController.getTopRatedPrompts));

// Prompt filtering by rating criteria
router.get('/prompts/filter', requirePermission(Permission.READ_PROMPTS), asyncHandler(ratingController.filterPromptsByRating));

// Individual rating management
router.put('/:ratingId', requirePermission(Permission.RATE_PROMPTS), asyncHandler(ratingController.updateRating));
router.delete('/:ratingId', requirePermission(Permission.RATE_PROMPTS), asyncHandler(ratingController.deleteRating));

// Prompt-specific rating endpoints
router.post('/prompts/:promptId/rate', requirePermission(Permission.RATE_PROMPTS), asyncHandler(ratingController.ratePrompt));
router.get('/prompts/:promptId/ratings', requirePermission(Permission.READ_PROMPTS), asyncHandler(ratingController.getPromptRatings));
router.get('/prompts/:promptId/analytics', requirePermission(Permission.READ_PROMPTS), asyncHandler(ratingController.getPromptRatingAnalytics));
router.get('/prompts/:promptId/user-rating', requirePermission(Permission.RATE_PROMPTS), asyncHandler(ratingController.getUserRating));
router.get('/prompts/:promptId/trends', requirePermission(Permission.READ_PROMPTS), asyncHandler(ratingController.getRatingTrends));

// Run logging and analytics
router.post('/prompts/:promptId/runs', requirePermission(Permission.READ_PROMPTS), asyncHandler(ratingController.logRun));
router.get('/prompts/:promptId/runs', requirePermission(Permission.READ_PROMPTS), asyncHandler(ratingController.getRunHistory));
router.get('/prompts/:promptId/full-analytics', requirePermission(Permission.READ_PROMPTS), asyncHandler(ratingController.getPromptAnalytics));

export { router as ratingRoutes };