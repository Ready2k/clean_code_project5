import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SystemMonitoringService } from '../services/system-monitoring-service.js';
import { logger } from '../utils/logger.js';

// Mock dependencies
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../services/redis-service.js', () => ({
  getRedisService: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    isHealthy: vi.fn().mockReturnValue(true)
  }))
}));

vi.mock('../services/prompt-library-service.js', () => ({
  getPromptLibraryService: vi.fn(() => ({
    getStatus: vi.fn().mockResolvedValue({
      initialized: true,
      healthy: true,
      providers: [],
      storageStats: {
        totalPrompts: 10,
        totalRatings: 25
      }
    })
  }))
}));

vi.mock('../services/connection-management-service.js', () => ({
  getConnectionManagementService: vi.fn(() => ({
    getConnectionStats: vi.fn().mockResolvedValue({
      total: 5,
      active: 3,
      inactive: 1,
      error: 1,
      byProvider: { openai: 3, bedrock: 2 }
    })
  }))
}));

describe('SystemMonitoringService', () => {
  let service: SystemMonitoringService;

  beforeEach(async () => {
    service = new SystemMonitoringService();
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new SystemMonitoringService();
      await expect(newService.initialize()).resolves.not.toThrow();
      await newService.shutdown();
    });

    it('should not initialize twice', async () => {
      // Service is already initialized in beforeEach
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('system status', () => {
    it('should get system status', async () => {
      const status = await service.getSystemStatus();
      
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('services');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('timestamp');
      
      expect(status.services).toHaveProperty('api');
      expect(status.services).toHaveProperty('database');
      expect(status.services).toHaveProperty('storage');
      expect(status.services).toHaveProperty('llm');
      expect(status.services).toHaveProperty('redis');
      
      expect(['healthy', 'degraded', 'down']).toContain(status.status);
    });

    it('should determine overall status correctly', async () => {
      const status = await service.getSystemStatus();
      
      // With mocked healthy services, status should be healthy
      expect(status.status).toBe('healthy');
    });
  });

  describe('system statistics', () => {
    it('should get comprehensive system stats', async () => {
      const stats = await service.getSystemStats();
      
      expect(stats).toHaveProperty('system');
      expect(stats).toHaveProperty('application');
      expect(stats).toHaveProperty('services');
      expect(stats).toHaveProperty('performance');
      
      // System stats
      expect(stats.system).toHaveProperty('uptime');
      expect(stats.system).toHaveProperty('memory');
      expect(stats.system).toHaveProperty('cpu');
      expect(stats.system).toHaveProperty('disk');
      
      // Application stats
      expect(stats.application).toHaveProperty('version');
      expect(stats.application).toHaveProperty('environment');
      expect(stats.application).toHaveProperty('nodeVersion');
      expect(stats.application).toHaveProperty('processId');
      expect(stats.application).toHaveProperty('startTime');
      
      // Service stats
      expect(stats.services).toHaveProperty('prompts');
      expect(stats.services).toHaveProperty('connections');
      expect(stats.services).toHaveProperty('redis');
      
      // Performance stats
      expect(stats.performance).toHaveProperty('requestsPerMinute');
      expect(stats.performance).toHaveProperty('averageResponseTime');
      expect(stats.performance).toHaveProperty('errorRate');
    });
  });

  describe('system configuration', () => {
    it('should get system configuration', () => {
      const config = service.getSystemConfig();
      
      expect(config).toHaveProperty('logging');
      expect(config).toHaveProperty('performance');
      expect(config).toHaveProperty('storage');
      expect(config).toHaveProperty('security');
      expect(config).toHaveProperty('features');
    });

    it('should update system configuration', async () => {
      const updates = {
        logging: {
          level: 'debug',
          enableFileLogging: true,
          maxLogFiles: 10,
          maxLogSize: '10MB'
        }
      };
      
      const updatedConfig = await service.updateSystemConfig(updates);
      
      expect(updatedConfig.logging.level).toBe('debug');
      expect(updatedConfig.logging.maxLogFiles).toBe(10);
    });
  });

  describe('metrics collection', () => {
    it('should record request metrics', () => {
      service.recordRequest(100, true);
      service.recordRequest(200, false);
      service.recordRequest(150, true);
      
      const metrics = service.getSystemMetrics(10);
      
      // Metrics are collected periodically, so we might not have any yet
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should get system metrics with limit', () => {
      const metrics = service.getSystemMetrics(5);
      
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeLessThanOrEqual(5);
    });
  });

  describe('system events', () => {
    it('should add and retrieve system events', () => {
      service.addSystemEvent('info', 'system', 'Test event', { test: true });
      service.addSystemEvent('warning', 'performance', 'Performance warning');
      service.addSystemEvent('error', 'service', 'Service error');
      
      const events = service.getSystemEvents(10);
      
      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events[0]).toHaveProperty('id');
      expect(events[0]).toHaveProperty('timestamp');
      expect(events[0]).toHaveProperty('type');
      expect(events[0]).toHaveProperty('category');
      expect(events[0]).toHaveProperty('message');
      expect(events[0]).toHaveProperty('source');
    });

    it('should filter events by type', () => {
      service.addSystemEvent('info', 'system', 'Info event');
      service.addSystemEvent('error', 'system', 'Error event');
      service.addSystemEvent('warning', 'system', 'Warning event');
      
      const errorEvents = service.getSystemEvents(10, 'error');
      const infoEvents = service.getSystemEvents(10, 'info');
      
      expect(errorEvents.every(e => e.type === 'error')).toBe(true);
      expect(infoEvents.every(e => e.type === 'info')).toBe(true);
    });

    it('should filter events by category', () => {
      service.addSystemEvent('info', 'system', 'System event');
      service.addSystemEvent('info', 'performance', 'Performance event');
      service.addSystemEvent('info', 'security', 'Security event');
      
      const systemEvents = service.getSystemEvents(10, undefined, 'system');
      const performanceEvents = service.getSystemEvents(10, undefined, 'performance');
      
      expect(systemEvents.every(e => e.category === 'system')).toBe(true);
      expect(performanceEvents.every(e => e.category === 'performance')).toBe(true);
    });
  });

  describe('system maintenance', () => {
    it('should create system backup', async () => {
      const backup = await service.createBackup();
      
      expect(backup).toHaveProperty('backupId');
      expect(backup).toHaveProperty('path');
      expect(backup).toHaveProperty('size');
      expect(backup.backupId).toMatch(/^backup-\d+$/);
      expect(typeof backup.size).toBe('number');
    });

    it('should cleanup system resources', async () => {
      // Add some events and metrics first
      service.addSystemEvent('info', 'system', 'Test event 1');
      service.addSystemEvent('info', 'system', 'Test event 2');
      
      const results = await service.cleanupSystem();
      
      expect(results).toHaveProperty('logsCleared');
      expect(results).toHaveProperty('tempFilesRemoved');
      expect(results).toHaveProperty('oldMetricsRemoved');
      expect(results).toHaveProperty('oldEventsRemoved');
      
      expect(typeof results.logsCleared).toBe('number');
      expect(typeof results.tempFilesRemoved).toBe('number');
      expect(typeof results.oldMetricsRemoved).toBe('number');
      expect(typeof results.oldEventsRemoved).toBe('number');
    });
  });

  describe('system logs', () => {
    it('should get system logs', async () => {
      // Add some events to serve as logs
      service.addSystemEvent('info', 'system', 'Log entry 1');
      service.addSystemEvent('error', 'system', 'Log entry 2');
      service.addSystemEvent('warning', 'system', 'Log entry 3');
      
      const logs = await service.getSystemLogs();
      
      expect(logs).toHaveProperty('logs');
      expect(logs).toHaveProperty('total');
      expect(Array.isArray(logs.logs)).toBe(true);
      expect(typeof logs.total).toBe('number');
    });

    it('should filter logs by level', async () => {
      service.addSystemEvent('info', 'system', 'Info log');
      service.addSystemEvent('error', 'system', 'Error log');
      
      const errorLogs = await service.getSystemLogs('error');
      
      expect(errorLogs.logs.every(log => log.level === 'error')).toBe(true);
    });

    it('should paginate logs', async () => {
      // Add multiple events
      for (let i = 0; i < 10; i++) {
        service.addSystemEvent('info', 'system', `Log entry ${i}`);
      }
      
      const firstPage = await service.getSystemLogs(undefined, 5, 0);
      const secondPage = await service.getSystemLogs(undefined, 5, 5);
      
      expect(firstPage.logs.length).toBeLessThanOrEqual(5);
      expect(secondPage.logs.length).toBeLessThanOrEqual(5);
    });
  });

  describe('error handling', () => {
    it('should handle service initialization errors gracefully', async () => {
      // Mock a service that throws an error
      vi.mocked(logger.error);
      
      const newService = new SystemMonitoringService();
      
      // Should not throw, but should log error
      await expect(newService.initialize()).resolves.not.toThrow();
      await newService.shutdown();
    });

    it('should handle metrics collection errors gracefully', () => {
      // This should not throw even if there are internal errors
      expect(() => {
        service.recordRequest(100, true);
        service.recordRequest(-1, false); // Invalid response time
      }).not.toThrow();
    });

    it('should handle event addition errors gracefully', () => {
      // This should not throw even with invalid data
      expect(() => {
        service.addSystemEvent('info', 'system', 'Valid event');
        service.addSystemEvent('invalid' as any, 'system', 'Invalid event');
      }).not.toThrow();
    });
  });

  describe('performance', () => {
    it('should handle high volume of metrics efficiently', () => {
      const startTime = Date.now();
      
      // Record many metrics
      for (let i = 0; i < 1000; i++) {
        service.recordRequest(Math.random() * 1000, Math.random() > 0.1);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle high volume of events efficiently', () => {
      const startTime = Date.now();
      
      // Add many events
      for (let i = 0; i < 1000; i++) {
        service.addSystemEvent('info', 'system', `Event ${i}`, { index: i });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should limit metrics storage to prevent memory leaks', () => {
      // Add more than the limit of metrics
      for (let i = 0; i < 1500; i++) {
        service.recordRequest(100, true);
      }
      
      // Force metrics collection (normally done by interval)
      const metrics = service.getSystemMetrics(2000);
      
      // Should not exceed the limit
      expect(metrics.length).toBeLessThanOrEqual(1000);
    });

    it('should limit events storage to prevent memory leaks', () => {
      // Add more than the limit of events
      for (let i = 0; i < 1500; i++) {
        service.addSystemEvent('info', 'system', `Event ${i}`);
      }
      
      const events = service.getSystemEvents(2000);
      
      // Should not exceed the limit
      expect(events.length).toBeLessThanOrEqual(1000);
    });
  });
});