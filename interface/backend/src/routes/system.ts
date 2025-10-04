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

// Enhanced log management
router.get('/logs/files', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.getLogFiles));
router.get('/logs/files/:filename', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.getLogFileContent));
router.get('/logs/search', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.searchLogs));
router.get('/logs/stats', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.getLogStats));
router.get('/logs/errors', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.getRecentErrors));

// System monitoring
router.get('/metrics', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(systemController.getSystemMetrics));
router.get('/events', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(systemController.getSystemEvents));

// Provider registry management
router.get('/registry/status', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(systemController.getRegistryStatus));
router.get('/registry/health', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(systemController.getProviderHealth));
router.post('/registry/refresh', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.refreshRegistry));
router.post('/registry/health-check', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.triggerHealthCheck));

// Registry monitoring
router.get('/registry/monitoring', requirePermission(Permission.VIEW_SYSTEM), asyncHandler(systemController.getRegistryMonitoringStatus));
router.put('/registry/monitoring/config', requirePermission(Permission.SYSTEM_CONFIG), asyncHandler(systemController.updateRegistryMonitoringConfig));

export { router as systemRoutes };