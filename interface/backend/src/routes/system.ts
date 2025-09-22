import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as systemController from '../controllers/system.js';

const router = Router();

// System status and health
router.get('/status', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(systemController.getSystemStatus));
router.get('/health', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(systemController.getSystemHealth));
router.get('/stats', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(systemController.getSystemStats));

// System configuration (admin only)
router.get('/config', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.getSystemConfig));
router.put('/config', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.updateSystemConfig));

// System maintenance (admin only)
router.post('/maintenance/backup', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.createBackup));
router.post('/maintenance/cleanup', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.cleanupSystem));
router.get('/maintenance/logs', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.getSystemLogs));

// System monitoring
router.get('/metrics', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(systemController.getSystemMetrics));
router.get('/events', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(systemController.getSystemEvents));

export { router as systemRoutes };