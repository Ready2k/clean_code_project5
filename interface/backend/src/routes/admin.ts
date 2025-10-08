import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as adminController from '../controllers/admin.js';

const router = Router();

// User management (admin only)
router.get('/users', requirePermission(Permission.ADMIN_USERS), asyncHandler(adminController.getUsers));
router.post('/users', requirePermission(Permission.ADMIN_USERS), asyncHandler(adminController.createUser));
router.get('/users/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(adminController.getUser));
router.put('/users/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(adminController.updateUser));
router.delete('/users/:id', requirePermission(Permission.ADMIN_USERS), asyncHandler(adminController.deleteUser));

// User role and permission management
router.put('/users/:id/role', requirePermission(Permission.ADMIN_USERS), asyncHandler(adminController.updateUserRole));
router.put('/users/:id/status', requirePermission(Permission.ADMIN_USERS), asyncHandler(adminController.updateUserStatus));
router.post('/users/:id/reset-password', requirePermission(Permission.ADMIN_USERS), asyncHandler(adminController.resetUserPassword));

// System administration
// Removed unused monitoring endpoints - add back if needed:
// - /audit-logs, /system/usage, /system/errors

export { router as adminRoutes };