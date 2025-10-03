/**
 * Provider Health Monitoring Routes
 * 
 * API routes for provider health monitoring, performance metrics,
 * and alerting functionality.
 */

import { Router } from 'express';
import {
  getAllProviderHealth,
  getProviderHealth,
  getProviderHealthSummary,
  getProviderMetrics,
  getProviderAlerts,
  acknowledgeAlert,
  triggerHealthCheck,
  getMonitoringStatus,
  updateMonitoringConfig,
  getHealthStatistics,
  exportHealthData
} from '../controllers/provider-health-monitoring.js';

const router = Router();

// Health status endpoints
router.get('/health', getAllProviderHealth);
router.get('/health/statistics', getHealthStatistics);
router.get('/health/:providerId', getProviderHealth);
router.get('/health/:providerId/summary', getProviderHealthSummary);
router.post('/health/:providerId/check', triggerHealthCheck);

// Performance metrics endpoints
router.get('/metrics/:providerId', getProviderMetrics);

// Alerts endpoints
router.get('/alerts/:providerId', getProviderAlerts);
router.post('/alerts/:alertId/acknowledge', acknowledgeAlert);

// Monitoring service endpoints
router.get('/status', getMonitoringStatus);
router.put('/config', updateMonitoringConfig);

// Export endpoints
router.get('/export', exportHealthData);

export default router;