import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { systemRoutes } from '../routes/system.js';
import { errorHandler } from '../middleware/error-handler.js';
import { SystemMonitoringService } from '../services/system-monitoring-service.js';

// Mock the system monitoring service
const mockSystemMonitoringService = {
  getSystemStatus: vi.fn(),
  getSystemStats: vi.fn(),
  getSystemConfig: vi.fn(),
  updateSystemConfig: vi.fn(),
  createBackup: vi.fn(),
  cleanupSystem: vi.fn(),
  getSystemLogs: vi.fn(),
  getSystemMetrics: vi.fn(),
  getSystemEvents: vi.fn()
};

vi.mock('../services/system-monitoring-service.js', () => ({
  getSystemMonitoringService: () => mockSystemMonitoringService
}));

// Mock auth middleware to simulate authenticated requests
vi.mock('../middleware/auth.js', () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    req.user = { userId: 'test-user', role: 'admin' };
    next();
  },
  asyncHandler: (fn: any) => fn
}));

describe('System Controller', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/system', systemRoutes);
    app.use(errorHandler);

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('GET /api/system/status', () => {
    it('should return system status', async () => {
      const mockStatus = {
        status: 'healthy',
        services: {
          api: { status: 'up', responseTime: 10, lastChecked: '2023-01-01T00:00:00Z' },
          database: { status: 'up', responseTime: 5, lastChecked: '2023-01-01T00:00:00Z' },
          storage: { status: 'up', responseTime: 15, lastChecked: '2023-01-01T00:00:00Z' },
          llm: { status: 'up', responseTime: 20, lastChecked: '2023-01-01T00:00:00Z' },
          redis: { status: 'up', responseTime: 3, lastChecked: '2023-01-01T00:00:00Z' }
        },
        uptime: 3600,
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z'
      };

      mockSystemMonitoringService.getSystemStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/system/status')
        .expect(200);

      expect(response.body).toEqual(mockStatus);
      expect(mockSystemMonitoringService.getSystemStatus).toHaveBeenCalledOnce();
    });

    it('should handle system status errors', async () => {
      mockSystemMonitoringService.getSystemStatus.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/api/system/status')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('SYSTEM_STATUS_ERROR');
    });
  });

  describe('GET /api/system/health', () => {
    it('should return healthy status when system is healthy', async () => {
      const mockStatus = {
        status: 'healthy',
        services: {
          api: { status: 'up', responseTime: 10, lastChecked: '2023-01-01T00:00:00Z' },
          database: { status: 'up', responseTime: 5, lastChecked: '2023-01-01T00:00:00Z' },
          storage: { status: 'up', responseTime: 15, lastChecked: '2023-01-01T00:00:00Z' },
          llm: { status: 'up', responseTime: 20, lastChecked: '2023-01-01T00:00:00Z' },
          redis: { status: 'up', responseTime: 3, lastChecked: '2023-01-01T00:00:00Z' }
        },
        uptime: 3600,
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z'
      };

      mockSystemMonitoringService.getSystemStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/system/health')
        .expect(200);

      expect(response.body.healthy).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.checks).toHaveProperty('api', true);
      expect(response.body.checks).toHaveProperty('database', true);
    });

    it('should return unhealthy status when system is down', async () => {
      const mockStatus = {
        status: 'down',
        services: {
          api: { status: 'up', responseTime: 10, lastChecked: '2023-01-01T00:00:00Z' },
          database: { status: 'down', error: 'Connection failed', lastChecked: '2023-01-01T00:00:00Z' },
          storage: { status: 'up', responseTime: 15, lastChecked: '2023-01-01T00:00:00Z' },
          llm: { status: 'up', responseTime: 20, lastChecked: '2023-01-01T00:00:00Z' },
          redis: { status: 'up', responseTime: 3, lastChecked: '2023-01-01T00:00:00Z' }
        },
        uptime: 3600,
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z'
      };

      mockSystemMonitoringService.getSystemStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/system/health')
        .expect(503);

      expect(response.body.healthy).toBe(false);
      expect(response.body.status).toBe('down');
    });

    it('should handle health check errors', async () => {
      mockSystemMonitoringService.getSystemStatus.mockRejectedValue(new Error('Health check failed'));

      const response = await request(app)
        .get('/api/system/health')
        .expect(503);

      expect(response.body.healthy).toBe(false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/system/stats', () => {
    it('should return system statistics', async () => {
      const mockStats = {
        system: {
          uptime: 3600,
          memory: { total: 8000000000, used: 4000000000, free: 4000000000, usage: 50 },
          cpu: { usage: 25, loadAverage: [1.5, 1.2, 1.0] },
          disk: { total: 100000000000, used: 50000000000, free: 50000000000, usage: 50 }
        },
        application: {
          version: '1.0.0',
          environment: 'test',
          nodeVersion: 'v18.0.0',
          processId: 12345,
          startTime: '2023-01-01T00:00:00Z'
        },
        services: {
          prompts: { total: 100, totalRatings: 250 },
          connections: { total: 5, active: 3, inactive: 1, error: 1, byProvider: { openai: 3, bedrock: 2 } },
          redis: { connected: true }
        },
        performance: {
          requestsPerMinute: 50,
          averageResponseTime: 150,
          errorRate: 2.5
        }
      };

      mockSystemMonitoringService.getSystemStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/system/stats')
        .expect(200);

      expect(response.body).toEqual(mockStats);
      expect(mockSystemMonitoringService.getSystemStats).toHaveBeenCalledOnce();
    });

    it('should handle stats retrieval errors', async () => {
      mockSystemMonitoringService.getSystemStats.mockRejectedValue(new Error('Stats unavailable'));

      const response = await request(app)
        .get('/api/system/stats')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('SYSTEM_STATS_ERROR');
    });
  });

  describe('GET /api/system/config', () => {
    it('should return system configuration', async () => {
      const mockConfig = {
        logging: { level: 'info', enableFileLogging: true, maxLogFiles: 5, maxLogSize: '5MB' },
        performance: { requestTimeout: 30000, maxConcurrentRequests: 100, rateLimitWindow: 900000, rateLimitMax: 100 },
        storage: { dataDirectory: './data', backupDirectory: './backups', maxBackups: 10, autoBackupInterval: 86400000 },
        security: { jwtExpiresIn: '1h', refreshTokenExpiresIn: '7d', passwordMinLength: 8, maxLoginAttempts: 5, lockoutDuration: 900000 },
        features: { enableEnhancement: true, enableRating: true, enableExport: true, enableMetrics: true }
      };

      mockSystemMonitoringService.getSystemConfig.mockReturnValue(mockConfig);

      const response = await request(app)
        .get('/api/system/config')
        .expect(200);

      expect(response.body).toEqual(mockConfig);
      expect(mockSystemMonitoringService.getSystemConfig).toHaveBeenCalledOnce();
    });

    it('should handle config retrieval errors', async () => {
      mockSystemMonitoringService.getSystemConfig.mockImplementation(() => {
        throw new Error('Config unavailable');
      });

      const response = await request(app)
        .get('/api/system/config')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('SYSTEM_CONFIG_ERROR');
    });
  });

  describe('PUT /api/system/config', () => {
    it('should update system configuration', async () => {
      const updates = {
        logging: { level: 'debug' },
        performance: { requestTimeout: 60000 }
      };

      const updatedConfig = {
        logging: { level: 'debug', enableFileLogging: true, maxLogFiles: 5, maxLogSize: '5MB' },
        performance: { requestTimeout: 60000, maxConcurrentRequests: 100, rateLimitWindow: 900000, rateLimitMax: 100 },
        storage: { dataDirectory: './data', backupDirectory: './backups', maxBackups: 10, autoBackupInterval: 86400000 },
        security: { jwtExpiresIn: '1h', refreshTokenExpiresIn: '7d', passwordMinLength: 8, maxLoginAttempts: 5, lockoutDuration: 900000 },
        features: { enableEnhancement: true, enableRating: true, enableExport: true, enableMetrics: true }
      };

      mockSystemMonitoringService.updateSystemConfig.mockResolvedValue(updatedConfig);

      const response = await request(app)
        .put('/api/system/config')
        .send(updates)
        .expect(200);

      expect(response.body.message).toBe('System configuration updated successfully');
      expect(response.body.config).toEqual(updatedConfig);
      expect(mockSystemMonitoringService.updateSystemConfig).toHaveBeenCalledWith(updates);
    });

    it('should validate configuration updates', async () => {
      // Test with empty object - should still work
      const response = await request(app)
        .put('/api/system/config')
        .send({})
        .expect(200);

      expect(response.body.message).toBe('System configuration updated successfully');
    });

    it('should handle config update errors', async () => {
      const updates = { logging: { level: 'debug' } };
      mockSystemMonitoringService.updateSystemConfig.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put('/api/system/config')
        .send(updates)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('SYSTEM_CONFIG_UPDATE_ERROR');
    });
  });

  describe('POST /api/system/maintenance/backup', () => {
    it('should create system backup', async () => {
      const mockBackup = {
        backupId: 'backup-1234567890',
        path: '/backups/backup-1234567890',
        size: 1024000
      };

      mockSystemMonitoringService.createBackup.mockResolvedValue(mockBackup);

      const response = await request(app)
        .post('/api/system/maintenance/backup')
        .expect(200);

      expect(response.body.message).toBe('System backup created successfully');
      expect(response.body.backup.id).toBe(mockBackup.backupId);
      expect(response.body.backup.size).toBe(mockBackup.size);
      expect(mockSystemMonitoringService.createBackup).toHaveBeenCalledOnce();
    });

    it('should handle backup creation errors', async () => {
      mockSystemMonitoringService.createBackup.mockRejectedValue(new Error('Backup failed'));

      const response = await request(app)
        .post('/api/system/maintenance/backup')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('BACKUP_ERROR');
    });
  });

  describe('POST /api/system/maintenance/cleanup', () => {
    it('should cleanup system resources', async () => {
      const mockResults = {
        logsCleared: 10,
        tempFilesRemoved: 5,
        oldMetricsRemoved: 100,
        oldEventsRemoved: 50
      };

      mockSystemMonitoringService.cleanupSystem.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/system/maintenance/cleanup')
        .expect(200);

      expect(response.body.message).toBe('System cleanup completed successfully');
      expect(response.body.results).toEqual(mockResults);
      expect(mockSystemMonitoringService.cleanupSystem).toHaveBeenCalledOnce();
    });

    it('should handle cleanup errors', async () => {
      mockSystemMonitoringService.cleanupSystem.mockRejectedValue(new Error('Cleanup failed'));

      const response = await request(app)
        .post('/api/system/maintenance/cleanup')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('CLEANUP_ERROR');
    });
  });

  describe('GET /api/system/maintenance/logs', () => {
    it('should return system logs', async () => {
      const mockLogs = {
        logs: [
          { timestamp: '2023-01-01T00:00:00Z', level: 'info', message: 'System started', category: 'system', source: 'system' },
          { timestamp: '2023-01-01T00:01:00Z', level: 'error', message: 'Connection failed', category: 'service', source: 'database' }
        ],
        total: 2
      };

      mockSystemMonitoringService.getSystemLogs.mockResolvedValue(mockLogs);

      const response = await request(app)
        .get('/api/system/maintenance/logs')
        .expect(200);

      expect(response.body).toEqual(mockLogs);
      expect(mockSystemMonitoringService.getSystemLogs).toHaveBeenCalledWith(undefined, 100, 0);
    });

    it('should handle query parameters', async () => {
      const mockLogs = { logs: [], total: 0 };
      mockSystemMonitoringService.getSystemLogs.mockResolvedValue(mockLogs);

      await request(app)
        .get('/api/system/maintenance/logs?level=error&limit=50&offset=10')
        .expect(200);

      expect(mockSystemMonitoringService.getSystemLogs).toHaveBeenCalledWith('error', 50, 10);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/system/maintenance/logs?limit=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/system/metrics', () => {
    it('should return system metrics', async () => {
      const mockMetrics = [
        {
          timestamp: '2023-01-01T00:00:00Z',
          cpu: { usage: 25, loadAverage: [1.5, 1.2, 1.0] },
          memory: { total: 8000000000, used: 4000000000, free: 4000000000, usage: 50 },
          requests: { total: 1000, successful: 950, failed: 50, averageResponseTime: 150 },
          services: {}
        }
      ];

      mockSystemMonitoringService.getSystemMetrics.mockReturnValue(mockMetrics);

      const response = await request(app)
        .get('/api/system/metrics')
        .expect(200);

      expect(response.body.metrics).toEqual(mockMetrics);
      expect(response.body.count).toBe(1);
      expect(mockSystemMonitoringService.getSystemMetrics).toHaveBeenCalledWith(100);
    });

    it('should handle limit parameter', async () => {
      mockSystemMonitoringService.getSystemMetrics.mockReturnValue([]);

      await request(app)
        .get('/api/system/metrics?limit=50')
        .expect(200);

      expect(mockSystemMonitoringService.getSystemMetrics).toHaveBeenCalledWith(50);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/system/metrics?limit=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/system/events', () => {
    it('should return system events', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          timestamp: '2023-01-01T00:00:00Z',
          type: 'info',
          category: 'system',
          message: 'System started',
          source: 'system'
        },
        {
          id: 'event-2',
          timestamp: '2023-01-01T00:01:00Z',
          type: 'error',
          category: 'service',
          message: 'Service failed',
          source: 'database'
        }
      ];

      mockSystemMonitoringService.getSystemEvents.mockReturnValue(mockEvents);

      const response = await request(app)
        .get('/api/system/events')
        .expect(200);

      expect(response.body.events).toEqual(mockEvents);
      expect(response.body.count).toBe(2);
      expect(mockSystemMonitoringService.getSystemEvents).toHaveBeenCalledWith(100, undefined, undefined);
    });

    it('should handle filter parameters', async () => {
      mockSystemMonitoringService.getSystemEvents.mockReturnValue([]);

      await request(app)
        .get('/api/system/events?type=error&category=service&limit=50')
        .expect(200);

      expect(mockSystemMonitoringService.getSystemEvents).toHaveBeenCalledWith(50, 'error', 'service');
    });

    it('should validate type parameter', async () => {
      const response = await request(app)
        .get('/api/system/events?type=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate category parameter', async () => {
      const response = await request(app)
        .get('/api/system/events?category=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});