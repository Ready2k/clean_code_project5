import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { getRedisService } from './redis-service.js';
import { getPromptLibraryService } from './prompt-library-service.js';
import { getConnectionManagementService } from './connection-management-service.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    api: ServiceStatus;
    database: ServiceStatus;
    storage: ServiceStatus;
    llm: ServiceStatus;
    redis: ServiceStatus;
  };
  uptime: number;
  version: string;
  timestamp: string;
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  lastChecked: string;
  details?: any;
}

export interface SystemStats {
  system: {
    uptime: number;
    memory: {
      total: number;
      used: number;
      free: number;
      usage: number;
    };
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    disk: {
      total: number;
      used: number;
      free: number;
      usage: number;
    };
  };
  application: {
    version: string;
    environment: string;
    nodeVersion: string;
    processId: number;
    startTime: string;
  };
  services: {
    prompts: {
      total: number;
      totalRatings: number;
    };
    connections: {
      total: number;
      active: number;
      inactive: number;
      error: number;
      byProvider: Record<string, number>;
    };
    redis: {
      connected: boolean;
      memoryUsage?: number;
      keyCount?: number;
    };
  };
  performance: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  services: {
    [serviceName: string]: {
      status: 'up' | 'down' | 'degraded';
      responseTime?: number;
      errorCount: number;
    };
  };
}

export interface SystemEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  category: 'system' | 'service' | 'security' | 'performance';
  message: string;
  details?: any;
  source: string;
}

export interface SystemConfig {
  logging: {
    level: string;
    enableFileLogging: boolean;
    maxLogFiles: number;
    maxLogSize: string;
  };
  performance: {
    requestTimeout: number;
    maxConcurrentRequests: number;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  storage: {
    dataDirectory: string;
    backupDirectory: string;
    maxBackups: number;
    autoBackupInterval: number;
  };
  security: {
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;
    passwordMinLength: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
  };
  features: {
    enableEnhancement: boolean;
    enableRating: boolean;
    enableExport: boolean;
    enableMetrics: boolean;
  };
}

export class SystemMonitoringService extends EventEmitter {
  private initialized = false;
  private metrics: SystemMetrics[] = [];
  private events: SystemEvent[] = [];
  private config: SystemConfig;
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private webSocketService: any = null;
  private lastSystemStatus: SystemStatus | null = null;
  private performanceCounters = {
    requests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalResponseTime: 0,
    lastMinuteRequests: 0,
    requestTimestamps: [] as number[]
  };

  constructor() {
    super();
    this.config = this.getDefaultConfig();
  }

  /**
   * Set WebSocket service for real-time updates
   */
  setWebSocketService(webSocketService: any): void {
    this.webSocketService = webSocketService;
    logger.info('WebSocket service connected to system monitoring');
  }

  /**
   * Initialize the system monitoring service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing System Monitoring Service...');

      // Load configuration
      await this.loadConfiguration();

      // Start metrics collection
      this.startMetricsCollection();

      // Start health checks
      this.startHealthChecks();

      // Add system event
      this.addSystemEvent('info', 'system', 'System monitoring service started', {
        version: this.getVersion(),
        environment: process.env['NODE_ENV'] || 'development'
      });

      this.initialized = true;
      logger.info('System Monitoring Service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize System Monitoring Service:', error);
      throw error;
    }
  }

  /**
   * Get current system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const startTime = Date.now();

    try {
      const services = await this.checkAllServices();
      const overallStatus = this.determineOverallStatus(services);

      const status: SystemStatus = {
        status: overallStatus,
        services,
        uptime: process.uptime(),
        version: this.getVersion(),
        timestamp: new Date().toISOString()
      };

      const responseTime = Date.now() - startTime;
      logger.debug('System status check completed', { 
        status: overallStatus, 
        responseTime 
      });

      return status;
    } catch (error) {
      logger.error('Failed to get system status:', error);
      throw error;
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<SystemStats> {
    try {
      const [systemInfo, appInfo, serviceStats] = await Promise.all([
        this.getSystemInfo(),
        this.getApplicationInfo(),
        this.getServiceStats()
      ]);

      const stats: SystemStats = {
        system: systemInfo,
        application: appInfo,
        services: serviceStats,
        performance: this.getPerformanceStats()
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get system stats:', error);
      throw error;
    }
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(limit = 100): SystemMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get system events
   */
  getSystemEvents(
    limit = 100,
    type?: SystemEvent['type'],
    category?: SystemEvent['category']
  ): SystemEvent[] {
    let events = this.events;

    if (type) {
      events = events.filter(e => e.type === type);
    }

    if (category) {
      events = events.filter(e => e.category === category);
    }

    return events.slice(-limit).reverse();
  }

  /**
   * Get system configuration
   */
  getSystemConfig(): SystemConfig {
    return { ...this.config };
  }

  /**
   * Update system configuration
   */
  async updateSystemConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
    try {
      this.config = { ...this.config, ...updates };
      await this.saveConfiguration();

      this.addSystemEvent('info', 'system', 'System configuration updated', {
        updatedFields: Object.keys(updates)
      });

      logger.info('System configuration updated', { updatedFields: Object.keys(updates) });
      this.emit('configUpdated', this.config);

      return this.config;
    } catch (error) {
      logger.error('Failed to update system configuration:', error);
      throw error;
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(responseTime: number, success: boolean): void {
    const now = Date.now();
    
    this.performanceCounters.requests++;
    this.performanceCounters.totalResponseTime += responseTime;
    this.performanceCounters.requestTimestamps.push(now);

    if (success) {
      this.performanceCounters.successfulRequests++;
    } else {
      this.performanceCounters.failedRequests++;
    }

    // Clean up old timestamps (keep only last minute)
    const oneMinuteAgo = now - 60000;
    this.performanceCounters.requestTimestamps = this.performanceCounters.requestTimestamps
      .filter(timestamp => timestamp > oneMinuteAgo);
    
    this.performanceCounters.lastMinuteRequests = this.performanceCounters.requestTimestamps.length;
  }

  /**
   * Add system event
   */
  addSystemEvent(
    type: SystemEvent['type'],
    category: SystemEvent['category'],
    message: string,
    details?: any,
    source = 'system-monitoring'
  ): void {
    const event: SystemEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      category,
      message,
      details,
      source
    };

    this.events.push(event);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Log critical and error events
    if (type === 'critical' || type === 'error') {
      logger.error(`System event [${category}]: ${message}`, details);
    } else if (type === 'warning') {
      logger.warn(`System event [${category}]: ${message}`, details);
    }

    this.emit('systemEvent', event);
  }

  /**
   * Create system backup
   */
  async createBackup(): Promise<{ backupId: string; path: string; size: number }> {
    try {
      const backupId = `backup-${Date.now()}`;
      const backupDir = path.join(this.config.storage.backupDirectory, backupId);
      
      await fs.mkdir(backupDir, { recursive: true });

      // Backup configuration
      const configPath = path.join(backupDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));

      // Backup prompt data (if using file storage)
      const dataDir = this.config.storage.dataDirectory;
      if (await this.pathExists(dataDir)) {
        const backupDataDir = path.join(backupDir, 'data');
        await this.copyDirectory(dataDir, backupDataDir);
      }

      // Get backup size
      const size = await this.getDirectorySize(backupDir);

      // Clean up old backups
      await this.cleanupOldBackups();

      this.addSystemEvent('info', 'system', 'System backup created', {
        backupId,
        size,
        path: backupDir
      });

      logger.info('System backup created', { backupId, size, path: backupDir });

      return { backupId, path: backupDir, size };
    } catch (error) {
      logger.error('Failed to create system backup:', error);
      this.addSystemEvent('error', 'system', 'System backup failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Cleanup system resources
   */
  async cleanupSystem(): Promise<{
    logsCleared: number;
    tempFilesRemoved: number;
    oldMetricsRemoved: number;
    oldEventsRemoved: number;
  }> {
    try {
      const results = {
        logsCleared: 0,
        tempFilesRemoved: 0,
        oldMetricsRemoved: 0,
        oldEventsRemoved: 0
      };

      // Clear old metrics (keep last 1000)
      if (this.metrics.length > 1000) {
        const removed = this.metrics.length - 1000;
        this.metrics = this.metrics.slice(-1000);
        results.oldMetricsRemoved = removed;
      }

      // Clear old events (keep last 500)
      if (this.events.length > 500) {
        const removed = this.events.length - 500;
        this.events = this.events.slice(-500);
        results.oldEventsRemoved = removed;
      }

      // Clear temporary files
      const tempDir = path.join(os.tmpdir(), 'prompt-library');
      if (await this.pathExists(tempDir)) {
        const files = await fs.readdir(tempDir);
        for (const file of files) {
          await fs.unlink(path.join(tempDir, file));
          results.tempFilesRemoved++;
        }
      }

      this.addSystemEvent('info', 'system', 'System cleanup completed', results);
      logger.info('System cleanup completed', results);

      return results;
    } catch (error) {
      logger.error('Failed to cleanup system:', error);
      this.addSystemEvent('error', 'system', 'System cleanup failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Get system logs
   */
  async getSystemLogs(
    level?: string,
    limit = 100,
    offset = 0
  ): Promise<{ logs: any[]; total: number }> {
    try {
      // This is a simplified implementation
      // In a real system, you'd read from log files or a logging service
      const logs = this.events
        .filter(event => !level || event.type === level)
        .slice(offset, offset + limit)
        .map(event => ({
          timestamp: event.timestamp,
          level: event.type,
          message: event.message,
          category: event.category,
          source: event.source,
          details: event.details
        }));

      return {
        logs,
        total: this.events.length
      };
    } catch (error) {
      logger.error('Failed to get system logs:', error);
      throw error;
    }
  }

  /**
   * Check all services health
   */
  private async checkAllServices(): Promise<SystemStatus['services']> {
    const services: SystemStatus['services'] = {
      api: await this.checkAPIService(),
      database: await this.checkDatabaseService(),
      storage: await this.checkStorageService(),
      llm: await this.checkLLMService(),
      redis: await this.checkRedisService()
    };

    return services;
  }

  /**
   * Check API service health
   */
  private async checkAPIService(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      // Simple health check - if we can execute this, API is up
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'up',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check database service health
   */
  private async checkDatabaseService(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      // For now, we don't have a traditional database
      // This would check PostgreSQL or similar if implemented
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'up',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          type: 'file-based',
          note: 'Using file-based storage'
        }
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check storage service health
   */
  private async checkStorageService(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const promptLibraryService = getPromptLibraryService();
      const status = await promptLibraryService.getStatus();
      const responseTime = Date.now() - startTime;
      
      return {
        status: status.healthy ? 'up' : 'down',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: status
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check LLM service health
   */
  private async checkLLMService(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const connectionService = getConnectionManagementService();
      const stats = await connectionService.getConnectionStats();
      const responseTime = Date.now() - startTime;
      
      const hasActiveConnections = stats.active > 0;
      const status = hasActiveConnections ? 'up' : (stats.total > 0 ? 'degraded' : 'down');
      
      return {
        status,
        responseTime,
        lastChecked: new Date().toISOString(),
        details: stats
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check Redis service health
   */
  private async checkRedisService(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const redisService = getRedisService();
      await redisService.ping();
      const responseTime = Date.now() - startTime;
      
      return {
        status: redisService.isHealthy() ? 'up' : 'down',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          connected: redisService.isHealthy()
        }
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(services: SystemStatus['services']): SystemStatus['status'] {
    const serviceStatuses = Object.values(services).map(s => s.status);
    
    if (serviceStatuses.every(s => s === 'up')) {
      return 'healthy';
    } else if (serviceStatuses.some(s => s === 'down')) {
      return 'down';
    } else {
      return 'degraded';
    }
  }

  /**
   * Get system information
   */
  private async getSystemInfo(): Promise<SystemStats['system']> {
    const memInfo = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Get disk usage for data directory
    const diskUsage = await this.getDiskUsage(this.config.storage.dataDirectory);

    return {
      uptime: os.uptime(),
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usage: (usedMem / totalMem) * 100
      },
      cpu: {
        usage: await this.getCPUUsage(),
        loadAverage: os.loadavg()
      },
      disk: diskUsage
    };
  }

  /**
   * Get application information
   */
  private getApplicationInfo(): SystemStats['application'] {
    return {
      version: this.getVersion(),
      environment: process.env['NODE_ENV'] || 'development',
      nodeVersion: process.version,
      processId: process.pid,
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
    };
  }

  /**
   * Get service statistics
   */
  private async getServiceStats(): Promise<SystemStats['services']> {
    try {
      const [promptLibraryStatus, connectionStats, redisService] = await Promise.all([
        getPromptLibraryService().getStatus(),
        getConnectionManagementService().getConnectionStats(),
        Promise.resolve(getRedisService())
      ]);

      return {
        prompts: {
          total: promptLibraryStatus.storageStats?.totalPrompts || 0,
          totalRatings: promptLibraryStatus.storageStats?.totalRatings || 0
        },
        connections: connectionStats,
        redis: {
          connected: redisService.isHealthy(),
          memoryUsage: undefined, // Would need Redis INFO command
          keyCount: undefined // Would need Redis DBSIZE command
        }
      };
    } catch (error) {
      logger.error('Failed to get service stats:', error);
      return {
        prompts: { total: 0, totalRatings: 0 },
        connections: { total: 0, active: 0, inactive: 0, error: 0, byProvider: {} },
        redis: { connected: false }
      };
    }
  }

  /**
   * Get performance statistics
   */
  private getPerformanceStats(): SystemStats['performance'] {
    const totalRequests = this.performanceCounters.requests;
    const averageResponseTime = totalRequests > 0 
      ? this.performanceCounters.totalResponseTime / totalRequests 
      : 0;
    const errorRate = totalRequests > 0 
      ? (this.performanceCounters.failedRequests / totalRequests) * 100 
      : 0;

    return {
      requestsPerMinute: this.performanceCounters.lastMinuteRequests,
      averageResponseTime,
      errorRate
    };
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics: SystemMetrics = {
          timestamp: new Date().toISOString(),
          cpu: {
            usage: await this.getCPUUsage(),
            loadAverage: os.loadavg()
          },
          memory: {
            total: os.totalmem(),
            used: os.totalmem() - os.freemem(),
            free: os.freemem(),
            usage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
          },
          requests: {
            total: this.performanceCounters.requests,
            successful: this.performanceCounters.successfulRequests,
            failed: this.performanceCounters.failedRequests,
            averageResponseTime: this.performanceCounters.requests > 0 
              ? this.performanceCounters.totalResponseTime / this.performanceCounters.requests 
              : 0
          },
          services: {} // Would be populated with service-specific metrics
        };

        this.metrics.push(metrics);

        // Keep only last 1000 metrics
        if (this.metrics.length > 1000) {
          this.metrics = this.metrics.slice(-1000);
        }
      } catch (error) {
        logger.error('Failed to collect metrics:', error);
      }
    }, 60000); // Collect every minute
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const status = await this.getSystemStatus();
        
        // Check if status has changed and broadcast via WebSocket
        if (this.webSocketService && this.hasStatusChanged(status)) {
          this.webSocketService.broadcastSystemStatus(status.status, status.services);
          this.lastSystemStatus = status;
        }
        
        if (status.status === 'down') {
          this.addSystemEvent('critical', 'system', 'System is down', status);
          if (this.webSocketService) {
            this.webSocketService.broadcastSystemAlert('error', 'System is down');
          }
        } else if (status.status === 'degraded') {
          this.addSystemEvent('warning', 'system', 'System is degraded', status);
          if (this.webSocketService) {
            this.webSocketService.broadcastSystemAlert('warning', 'System performance is degraded');
          }
        }
      } catch (error) {
        logger.error('Health check failed:', error);
        this.addSystemEvent('error', 'system', 'Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
        if (this.webSocketService) {
          this.webSocketService.broadcastSystemAlert('error', 'Health check failed');
        }
      }
    }, 30000); // Check every 30 seconds for real-time updates
  }

  /**
   * Check if system status has changed significantly
   */
  private hasStatusChanged(newStatus: SystemStatus): boolean {
    if (!this.lastSystemStatus) return true;
    
    // Check if overall status changed
    if (this.lastSystemStatus.status !== newStatus.status) return true;
    
    // Check if any service status changed
    for (const [serviceName, serviceStatus] of Object.entries(newStatus.services)) {
      const lastServiceStatus = this.lastSystemStatus.services[serviceName as keyof SystemStatus['services']];
      if (!lastServiceStatus || lastServiceStatus.status !== serviceStatus.status) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): SystemConfig {
    return {
      logging: {
        level: process.env['LOG_LEVEL'] || 'info',
        enableFileLogging: process.env['NODE_ENV'] === 'production',
        maxLogFiles: 5,
        maxLogSize: '5MB'
      },
      performance: {
        requestTimeout: 30000,
        maxConcurrentRequests: 100,
        rateLimitWindow: 900000, // 15 minutes
        rateLimitMax: 100
      },
      storage: {
        dataDirectory: process.env['DATA_DIR'] || path.resolve(process.cwd(), 'data'),
        backupDirectory: process.env['BACKUP_DIR'] || path.resolve(process.cwd(), 'backups'),
        maxBackups: 10,
        autoBackupInterval: 86400000 // 24 hours
      },
      security: {
        jwtExpiresIn: '1h',
        refreshTokenExpiresIn: '7d',
        passwordMinLength: 8,
        maxLoginAttempts: 5,
        lockoutDuration: 900000 // 15 minutes
      },
      features: {
        enableEnhancement: true,
        enableRating: true,
        enableExport: true,
        enableMetrics: true
      }
    };
  }

  /**
   * Load configuration from file
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'config', 'system.json');
      
      if (await this.pathExists(configPath)) {
        const configData = await fs.readFile(configPath, 'utf-8');
        const loadedConfig = JSON.parse(configData);
        this.config = { ...this.config, ...loadedConfig };
        logger.info('System configuration loaded from file');
      } else {
        logger.info('Using default system configuration');
      }
    } catch (error) {
      logger.warn('Failed to load configuration file, using defaults:', error);
    }
  }

  /**
   * Save configuration to file
   */
  private async saveConfiguration(): Promise<void> {
    try {
      const configDir = path.join(process.cwd(), 'config');
      const configPath = path.join(configDir, 'system.json');
      
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
      
      logger.info('System configuration saved to file');
    } catch (error) {
      logger.error('Failed to save configuration file:', error);
      throw error;
    }
  }

  /**
   * Get application version
   */
  private getVersion(): string {
    return process.env['npm_package_version'] || '1.0.0';
  }

  /**
   * Get CPU usage percentage
   */
  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = process.hrtime(startTime);
        
        const totalTime = currentTime[0] * 1000000 + currentTime[1] / 1000;
        const totalUsage = currentUsage.user + currentUsage.system;
        const cpuPercent = (totalUsage / totalTime) * 100;
        
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  /**
   * Get disk usage for a directory
   */
  private async getDiskUsage(dirPath: string): Promise<{
    total: number;
    used: number;
    free: number;
    usage: number;
  }> {
    try {
      const stats = await fs.stat(dirPath);
      // This is a simplified implementation
      // In a real system, you'd use a library like 'statvfs' or platform-specific commands
      return {
        total: 1000000000, // 1GB placeholder
        used: 500000000,   // 500MB placeholder
        free: 500000000,   // 500MB placeholder
        usage: 50          // 50% placeholder
      };
    } catch (error) {
      return {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      };
    }
  }

  /**
   * Check if path exists
   */
  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Get directory size
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          size += await this.getDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        }
      }
    } catch (error) {
      logger.error('Failed to get directory size:', error);
    }
    
    return size;
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backupDir = this.config.storage.backupDirectory;
      
      if (!(await this.pathExists(backupDir))) {
        return;
      }
      
      const entries = await fs.readdir(backupDir, { withFileTypes: true });
      const backups = entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('backup-'))
        .map(entry => ({
          name: entry.name,
          path: path.join(backupDir, entry.name),
          timestamp: parseInt(entry.name.replace('backup-', ''))
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
      
      // Keep only the configured number of backups
      const backupsToDelete = backups.slice(this.config.storage.maxBackups);
      
      for (const backup of backupsToDelete) {
        await fs.rm(backup.path, { recursive: true, force: true });
        logger.info('Deleted old backup', { backupId: backup.name });
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups:', error);
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    try {
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      this.addSystemEvent('info', 'system', 'System monitoring service shutting down');
      
      this.initialized = false;
      logger.info('System Monitoring Service shut down successfully');
      this.emit('shutdown');
    } catch (error) {
      logger.error('Error during system monitoring service shutdown:', error);
      throw error;
    }
  }
}

// Singleton instance
let systemMonitoringService: SystemMonitoringService | null = null;

/**
 * Initialize the system monitoring service
 */
export async function initializeSystemMonitoringService(): Promise<void> {
  if (systemMonitoringService) {
    logger.warn('System monitoring service already initialized');
    return;
  }
  
  systemMonitoringService = new SystemMonitoringService();
  await systemMonitoringService.initialize();
}

/**
 * Get the system monitoring service instance
 */
export function getSystemMonitoringService(): SystemMonitoringService {
  if (!systemMonitoringService) {
    throw new Error('System monitoring service not initialized');
  }
  
  return systemMonitoringService;
}