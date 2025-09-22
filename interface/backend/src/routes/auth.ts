import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { authenticateToken } from '../middleware/auth.js';
import * as authController from '../controllers/auth.js';

const router = Router();

// Public routes
router.post('/login', asyncHandler(authController.login));
router.post('/register', asyncHandler(authController.register));
router.post('/refresh', asyncHandler(authController.refreshToken));

// Protected routes
router.post('/logout', authenticateToken, asyncHandler(authController.logout));
router.get('/me', authenticateToken, asyncHandler(authController.getCurrentUser));
router.put('/me', authenticateToken, asyncHandler(authController.updateProfile));
router.put('/me/password', authenticateToken, asyncHandler(authController.changePassword));

export { router as authRoutes };