import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { getProviderRegistryService } from './provider-registry-service.js';
import { ProviderHealth } from '../types/dynamic-providers.js';

export interface RegistryMonitoringConfig {
  refreshInterval: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  enableAutoRefresh: boolean;
  enableHealthMonitoring: boolean;
}

export interface RegistryEvent {
  type: 'provider_added' | 'provider_updated' | 'provider_removed' | 'health_changed' | 'registry_refreshed';
  providerId?: string;
  timestamp: Date;
  data?: any;
}

/**
 * Service for monitoring provider registry changes and health
 */
export class RegistryMonitoringService extends EventEmitter {
  private config: RegistryMonitoringConfig;
  private refreshInterval?: NodeJS.Timeout | undefined;
  private healthCheckInterval?: NodeJS.Timeout | undefined;
  private isRunning = false;
  private lastRefresh = 0;
  private lastHealthCheck = 0;

  constructor(config?: Partial<RegistryMonitoringConfig>) {
    super();
    
    this.config = {
      refreshInterval: 5 * 60 * 1000, // 5 minutes
      healthCheckInterval: 5 * 60 * 1000, // 5 minutes
      enableAutoRefresh: true,
      enableHealthMonitoring: true,
      ...config
    };

    logger.info('Registry monitoring service initialized', { config: this.config });
  }

  /**
   * Start monitoring the provider registry
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Registry monitoring service is already running');
      return;
    }

    logger.info('Starting registry monitoring service');
    this.isRunning = true;

    try {
      // Perform initial registry refresh
      await this.performRegistryRefresh();

      // Start auto-refresh if enabled
      if (this.config.enableAutoRefresh) {
        this.startAutoRefresh();
      }

      // Start health monitoring if enabled
      if (this.config.enableHealthMonitoring) {
        this.startHealthMonitoring();
      }

      this.emit('started');
      logger.info('Registry monitoring service started successfully');

    } catch (error) {
      logger.error('Failed to start registry monitoring service', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop monitoring the provider registry
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping registry monitoring service');
    this.isRunning = false;

    // Clear intervals
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    this.emit('stopped');
    logger.info('Registry monitoring service stopped');
  }

  /**
   * Manually trigger a registry refresh
   */
  async refreshRegistry(): Promise<void> {
    logger.info('Manual registry refresh requested');
    await this.performRegistryRefresh();
  }

  /**
   * Manually trigger health checks
   */
  async checkProviderHealth(): Promise<ProviderHealth[]> {
    logger.info('Manual health check requested');
    return await this.performHealthChecks();
  }

  /**
   * Handle provider change events
   */
  async onProviderChange(event: {
    type: 'created' | 'updated' | 'deleted';
    providerId: string;
    provider?: any;
  }): Promise<void> {
    logger.info('Provider change detected', { 
      type: event.type, 
      providerId: event.providerId 
    });

    try {
      const registryService = getProviderRegistryService();

      switch (event.type) {
        case 'created':
          await registryService.registerProvider(event.providerId);
          this.emitRegistryEvent({
            type: 'provider_added',
            providerId: event.providerId,
            timestamp: new Date(),
            data: event.provider
          });
          break;

        case 'updated':
          // Refresh the specific provider or full registry
          await registryService.refreshRegistry();
          this.emitRegistryEvent({
            type: 'provider_updated',
            providerId: event.providerId,
            timestamp: new Date(),
            data: event.provider
          });
          break;

        case 'deleted':
          await registryService.deregisterProvider(event.providerId);
          this.emitRegistryEvent({
            type: 'provider_removed',
            providerId: event.providerId,
            timestamp: new Date()
          });
          break;
      }

      logger.info('Provider change processed successfully', { 
        type: event.type, 
        providerId: event.providerId 
      });

    } catch (error) {
      logger.error('Failed to process provider change', { 
        type: event.type, 
        providerId: event.providerId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Get monitoring status and statistics
   */
  getStatus(): {
    isRunning: boolean;
    config: RegistryMonitoringConfig;
    lastRefresh: Date | null;
    lastHealthCheck: Date | null;
    nextRefresh: Date | null;
    nextHealthCheck: Date | null;
  } {
    // const now = Date.now(); // For future use
    
    return {
      isRunning: this.isRunning,
      config: this.config,
      lastRefresh: this.lastRefresh ? new Date(this.lastRefresh) : null,
      lastHealthCheck: this.lastHealthCheck ? new Date(this.lastHealthCheck) : null,
      nextRefresh: this.isRunning && this.config.enableAutoRefresh 
        ? new Date(this.lastRefresh + this.config.refreshInterval)
        : null,
      nextHealthCheck: this.isRunning && this.config.enableHealthMonitoring
        ? new Date(this.lastHealthCheck + this.config.healthCheckInterval)
        : null
    };
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<RegistryMonitoringConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    logger.info('Registry monitoring configuration updated', { 
      oldConfig, 
      newConfig: this.config 
    });

    // Restart intervals if they changed and service is running
    if (this.isRunning) {
      if (oldConfig.refreshInterval !== this.config.refreshInterval && this.config.enableAutoRefresh) {
        this.startAutoRefresh();
      }

      if (oldConfig.healthCheckInterval !== this.config.healthCheckInterval && this.config.enableHealthMonitoring) {
        this.startHealthMonitoring();
      }
    }
  }

  /**
   * Start automatic registry refresh
   */
  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      try {
        await this.performRegistryRefresh();
      } catch (error) {
        logger.error('Automatic registry refresh failed', error);
      }
    }, this.config.refreshInterval);

    logger.debug('Auto-refresh started', { interval: this.config.refreshInterval });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        logger.error('Automatic health check failed', error);
      }
    }, this.config.healthCheckInterval);

    logger.debug('Health monitoring started', { interval: this.config.healthCheckInterval });
  }

  /**
   * Perform registry refresh
   */
  private async performRegistryRefresh(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.debug('Performing registry refresh');
      
      const registryService = getProviderRegistryService();
      await registryService.refreshRegistry();
      
      this.lastRefresh = Date.now();
      const duration = this.lastRefresh - startTime;
      
      this.emitRegistryEvent({
        type: 'registry_refreshed',
        timestamp: new Date(this.lastRefresh),
        data: { duration }
      });

      logger.debug('Registry refresh completed', { duration });

    } catch (error) {
      logger.error('Registry refresh failed', error);
      throw error;
    }
  }

  /**
   * Perform health checks on all providers
   */
  private async performHealthChecks(): Promise<ProviderHealth[]> {
    const startTime = Date.now();
    
    try {
      logger.debug('Performing provider health checks');
      
      const registryService = getProviderRegistryService();
      const healthStatuses = registryService.getProviderHealth();
      
      this.lastHealthCheck = Date.now();
      const duration = this.lastHealthCheck - startTime;

      // Emit health change events for providers that changed status
      for (const health of healthStatuses) {
        this.emitRegistryEvent({
          type: 'health_changed',
          providerId: health.providerId,
          timestamp: new Date(this.lastHealthCheck),
          data: health
        });
      }

      logger.debug('Health checks completed', { 
        duration, 
        providerCount: healthStatuses.length 
      });

      return healthStatuses;

    } catch (error) {
      logger.error('Health checks failed', error);
      throw error;
    }
  }

  /**
   * Emit a registry event
   */
  private emitRegistryEvent(event: RegistryEvent): void {
    this.emit('registry_event', event);
    this.emit(event.type, event);
  }
}

// Singleton instance
let registryMonitoringService: RegistryMonitoringService | null = null;

/**
 * Get the singleton instance of the registry monitoring service
 */
export function getRegistryMonitoringService(config?: Partial<RegistryMonitoringConfig>): RegistryMonitoringService {
  if (!registryMonitoringService) {
    registryMonitoringService = new RegistryMonitoringService(config);
  }
  return registryMonitoringService;
}

/**
 * Initialize and start the registry monitoring service
 */
export async function initializeRegistryMonitoring(config?: Partial<RegistryMonitoringConfig>): Promise<RegistryMonitoringService> {
  const service = getRegistryMonitoringService(config);
  
  if (!service.getStatus().isRunning) {
    await service.start();
  }
  
  return service;
}