import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as connectionController from '../controllers/connections.js';

const router = Router();

// Connection CRUD operations
router.get('/', requirePermission(Permission.MANAGE_CONNECTIONS), asyncHandler(connectionController.getConnections));
router.post('/', requirePermission(Permission.MANAGE_CONNECTIONS), asyncHandler(connectionController.createConnection));
router.get('/:connectionId', requirePermission(Permission.MANAGE_CONNECTIONS), asyncHandler(connectionController.getConnection));
router.put('/:connectionId', requirePermission(Permission.MANAGE_CONNECTIONS), asyncHandler(connectionController.updateConnection));
router.delete('/:connectionId', requirePermission(Permission.MANAGE_CONNECTIONS), asyncHandler(connectionController.deleteConnection));

// Connection testing and validation
router.post('/:connectionId/test', requirePermission(Permission.MANAGE_CONNECTIONS), asyncHandler(connectionController.testConnection));
router.post('/test/all', requirePermission(Permission.MANAGE_CONNECTIONS), asyncHandler(connectionController.testAllConnections));

// Available models for providers (no specific connection needed)
router.get('/models/:provider', asyncHandler(connectionController.getAvailableModels));

// Connection status and health
router.get('/:connectionId/status', requirePermission(Permission.MANAGE_CONNECTIONS), asyncHandler(connectionController.getConnectionStatus));
router.get('/health/all', requirePermission(Permission.MANAGE_CONNECTIONS), asyncHandler(connectionController.getAllConnectionsHealth));

export { router as connectionRoutes };