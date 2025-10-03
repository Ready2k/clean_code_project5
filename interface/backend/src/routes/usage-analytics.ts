/**
 * Provider Usage Analytics Routes
 * 
 * API routes for provider usage analytics, performance metrics,
 * and usage-based recommendations.
 */

import { Router } from 'express';
import {
  getAnalyticsDashboard,
  getProviderUsageStats,
  trackProviderRequest,
  getAnalyticsStatus,
  updateAnalyticsConfig,
  exportAnalyticsData,
  getUsageRecommendations,
  getCostBreakdown
} from '../controllers/provider-usage-analytics.js';

const router = Router();

// Dashboard and overview endpoints
router.get('/dashboard', getAnalyticsDashboard);
router.get('/recommendations', getUsageRecommendations);
router.get('/cost-breakdown', getCostBreakdown);

// Provider-specific analytics endpoints
router.get('/providers/:providerId/stats', getProviderUsageStats);

// Request tracking endpoints
router.post('/track', trackProviderRequest);

// Service management endpoints
router.get('/status', getAnalyticsStatus);
router.put('/config', updateAnalyticsConfig);

// Export endpoints
router.get('/export', exportAnalyticsData);

export default router;