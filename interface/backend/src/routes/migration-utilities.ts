/**
 * Provider Migration Utilities Routes
 * 
 * API routes for provider migration utilities, including
 * migration planning, execution, and rollback functionality.
 */

import { Router } from 'express';
import {
  createMigrationPlan,
  executeMigrationPlan,
  getMigrationProgress,
  rollbackMigration,
  validateConnectionCompatibility,
  getMigrationConfig,
  updateMigrationConfig,
  getMigrationStatistics,
  dryRunMigration,
  exportMigrationReport
} from '../controllers/provider-migration-utilities.js';

const router = Router();

// Migration planning endpoints
router.post('/plans', createMigrationPlan);
router.post('/plans/:planId/execute', executeMigrationPlan);
router.post('/plans/:planId/dry-run', dryRunMigration);
router.get('/plans/:planId/progress', getMigrationProgress);
router.post('/plans/:planId/rollback', rollbackMigration);

// Validation endpoints
router.get('/connections/:connectionId/compatibility', validateConnectionCompatibility);

// Configuration endpoints
router.get('/config', getMigrationConfig);
router.put('/config', updateMigrationConfig);

// Statistics and reporting endpoints
router.get('/statistics', getMigrationStatistics);
router.get('/plans/:planId/report', exportMigrationReport);

export default router;