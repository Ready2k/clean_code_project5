import { getPromptLibraryService, RenderOptions, ProviderPayload } from './prompt-library-service.js';
import { getDynamicProviderService } from './dynamic-provider-service.js';
import { logger } from '../utils/logger.js';
import { ServiceUnavailableError, ValidationError, NotFoundError } from '../types/errors.js';
import { Provider, ProviderHealth } from '../types/dynamic-providers.js';

export interface ProviderInfo {
  id: string;
  name: string;
  supportedModels: string[];
  defaultModel: string;
}

export interface ProviderCapabilities {
  supportsSystemMessages: boolean;
  maxContextLength: number;
  supportedRoles: string[];
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportedModels: string[];
}

export interface ProviderDetails extends ProviderInfo {
  capabilities: ProviderCapabilities;
  status: 'available' | 'unavailable' | 'error';
  lastChecked: Date;
  error?: string;
}

export interface RenderRequest {
  promptId: string;
  provider: string;
  options: RenderOptions;
  userId: string;
  connectionId?: string;
}

export interface RenderResult {
  payload: ProviderPayload;
  metadata: {
    provider: string;
    model?: string | undefined;
    targetModel?: string | undefined;
    timestamp: Date;
    renderTime: number;
  };
}

/**
 * Service for managing multi-provider rendering capabilities
 * Now integrates with dynamic provider management system
 */
export class ProviderRegistryService {
  private providerCache = new Map<string, ProviderDetails>();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private healthMonitoringInterval?: NodeJS.Timeout;
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private providerHealthCache = new Map<string, ProviderHealth>();

  /**
   * Get all available providers with their capabilities
   */
  async getAvailableProviders(): Promise<ProviderDetails[]> {
    await this.refreshProviderCache();
    return Array.from(this.providerCache.values());
  }

  /**
   * Get a specific provider by ID
   */
  async getProvider(providerId: string): Promise<ProviderDetails> {
    await this.refreshProviderCache();
    
    // Try direct lookup first
    let provider = this.providerCache.get(providerId);
    
    // If not found, try with -basic suffix (for backward compatibility)
    if (!provider) {
      const basicProviderId = `${providerId}-basic`;
      provider = this.providerCache.get(basicProviderId);
    }
    
    if (!provider) {
      throw new NotFoundError(`Provider ${providerId} not found`);
    }
    
    return provider;
  }

  /**
   * Check if a provider supports a specific model
   */
  async supportsModel(providerId: string, model: string): Promise<boolean> {
    try {
      const provider = await this.getProvider(providerId);
      return provider.capabilities.supportedModels.includes(model) || 
             provider.capabilities.supportedModels.includes('*'); // Wildcard support
    } catch (error) {
      logger.warn('Failed to check model support', { providerId, model, error });
      return false;
    }
  }

  /**
   * Find providers that support specific requirements
   */
  async findProvidersWithCapabilities(requirements: {
    supportsSystemMessages?: boolean;
    minContextLength?: number;
    supportedRoles?: string[];
    supportsStreaming?: boolean;
    supportsTools?: boolean;
    model?: string;
  }): Promise<ProviderDetails[]> {
    const providers = await this.getAvailableProviders();
    
    return providers.filter(provider => {
      if (provider.status !== 'available') {
        return false;
      }

      const caps = provider.capabilities;

      if (requirements.supportsSystemMessages && !caps.supportsSystemMessages) {
        return false;
      }

      if (requirements.minContextLength && caps.maxContextLength < requirements.minContextLength) {
        return false;
      }

      if (requirements.supportedRoles) {
        const hasAllRoles = requirements.supportedRoles.every(role => 
          caps.supportedRoles.includes(role)
        );
        if (!hasAllRoles) {
          return false;
        }
      }

      if (requirements.supportsStreaming && !caps.supportsStreaming) {
        return false;
      }

      if (requirements.supportsTools && !caps.supportsTools) {
        return false;
      }

      if (requirements.model && !caps.supportedModels.includes(requirements.model) && 
          !caps.supportedModels.includes('*')) {
        return false;
      }

      return true;
    });
  }

  /**
   * Render a prompt using a specific provider
   */
  async renderPrompt(request: RenderRequest): Promise<RenderResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Rendering prompt', { 
        promptId: request.promptId, 
        provider: request.provider, 
        userId: request.userId 
      });

      // Validate provider exists and is available
      const provider = await this.getProvider(request.provider);
      if (provider.status !== 'available') {
        throw new ServiceUnavailableError(`Provider ${request.provider} is not available: ${provider.error || 'Unknown error'}`);
      }

      // Validate model if specified
      if (request.options.model && !await this.supportsModel(request.provider, request.options.model)) {
        throw new ValidationError(`Provider ${request.provider} does not support model ${request.options.model}`);
      }

      // Use the prompt library service to render
      logger.info('Calling prompt library service', { 
        promptId: request.promptId,
        provider: request.provider,
        userId: request.userId,
        connectionId: request.connectionId,
        optionsConnectionId: request.options.connectionId
      });
      
      const promptLibraryService = getPromptLibraryService();
      const payload = await promptLibraryService.renderPrompt(
        request.promptId,
        request.provider,
        request.options,
        request.userId
      );

      const renderTime = Date.now() - startTime;

      logger.info('Prompt rendered successfully', { 
        promptId: request.promptId, 
        provider: request.provider, 
        renderTime 
      });

      return {
        payload,
        metadata: {
          provider: request.provider,
          model: request.options.model || undefined,
          targetModel: request.options.targetModel || undefined,
          timestamp: new Date(),
          renderTime
        }
      };

    } catch (error) {
      const renderTime = Date.now() - startTime;
      logger.error('Failed to render prompt', { 
        promptId: request.promptId, 
        provider: request.provider, 
        renderTime,
        error 
      });

      if (error instanceof NotFoundError || error instanceof ValidationError || error instanceof ServiceUnavailableError) {
        throw error;
      }

      throw new ServiceUnavailableError('Failed to render prompt');
    }
  }

  /**
   * Compare rendering results across multiple providers
   */
  async compareProviders(
    promptId: string,
    providers: string[],
    options: RenderOptions,
    userId: string
  ): Promise<Array<{
    provider: string;
    result?: RenderResult;
    error?: string;
  }>> {
    logger.info('Comparing providers', { promptId, providers, userId });

    const results = await Promise.allSettled(
      providers.map(async (provider) => {
        const request: RenderRequest = {
          promptId,
          provider,
          options,
          userId
        };
        
        try {
          const result = await this.renderPrompt(request);
          return { provider, result };
        } catch (error) {
          return { 
            provider, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          provider: providers[index]!,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Get the best provider recommendation for a prompt
   */
  async getBestProvider(
    promptId: string,
    requirements?: {
      supportsSystemMessages?: boolean;
      minContextLength?: number;
      supportedRoles?: string[];
      model?: string;
    }
  ): Promise<ProviderDetails | null> {
    try {
      const suitableProviders = await this.findProvidersWithCapabilities(requirements || {});
      
      if (suitableProviders.length === 0) {
        return null;
      }

      // Simple scoring algorithm - can be enhanced later
      const scoredProviders = suitableProviders.map(provider => {
        let score = 0;
        
        // Prefer providers with higher context length
        score += Math.min(provider.capabilities.maxContextLength / 1000, 100);
        
        // Prefer providers with more capabilities
        if (provider.capabilities.supportsSystemMessages) score += 10;
        if (provider.capabilities.supportsStreaming) score += 5;
        if (provider.capabilities.supportsTools) score += 5;
        
        // Prefer providers with more supported roles
        score += provider.capabilities.supportedRoles.length;
        
        return { provider, score };
      });

      // Sort by score descending
      scoredProviders.sort((a, b) => b.score - a.score);
      
      return scoredProviders[0]?.provider || null;

    } catch (error) {
      logger.error('Failed to get best provider recommendation', { promptId, error });
      return null;
    }
  }

  /**
   * Test a provider's availability and capabilities
   */
  async testProvider(providerId: string): Promise<{
    available: boolean;
    capabilities?: ProviderCapabilities;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      logger.info('Testing provider', { providerId });
      
      const promptLibraryService = getPromptLibraryService();
      const providers = await promptLibraryService.getAvailableProviders();
      
      const provider = providers.find(p => p.id === providerId);
      if (!provider) {
        return {
          available: false,
          error: 'Provider not found'
        };
      }

      // Get capabilities from the provider registry
      const capabilities = await this.getProviderCapabilities(providerId);
      const responseTime = Date.now() - startTime;

      logger.info('Provider test completed', { providerId, responseTime, available: true });

      return {
        available: true,
        capabilities,
        responseTime
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Provider test failed', { providerId, responseTime, error });
      
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      };
    }
  }

  /**
   * Refresh the provider cache - now loads from dynamic provider system
   */
  private async refreshProviderCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate < this.CACHE_TTL) {
      return; // Cache is still fresh
    }

    try {
      logger.debug('Refreshing provider cache from dynamic provider system');
      
      const dynamicProviderService = getDynamicProviderService();
      
      // Get all active providers from the database
      const result = await dynamicProviderService.getProviders({
        status: ['active'],
        includeModels: true
      });
      const providers = result.providers;

      // Clear old cache
      this.providerCache.clear();

      // Populate new cache with dynamic providers
      for (const provider of providers) {
        try {
          const capabilities = await this.convertProviderToCapabilities(provider);
          const providerDetails: ProviderDetails = {
            id: provider.identifier,
            name: provider.name,
            supportedModels: capabilities.supportedModels,
            defaultModel: await this.getDefaultModelForProvider(provider),
            capabilities,
            status: provider.status === 'active' ? 'available' : 'unavailable',
            lastChecked: new Date(),
            ...(provider.testResult?.error && { error: provider.testResult.error })
          };
          
          this.providerCache.set(provider.identifier, providerDetails);
          logger.debug('Added provider to cache', { 
            providerId: provider.identifier, 
            modelCount: capabilities.supportedModels.length 
          });
        } catch (error) {
          logger.warn('Failed to process provider for cache', { 
            providerId: provider.identifier, 
            error 
          });
          
          // Add provider with error status
          const defaultCapabilities = this.getDefaultCapabilities();
          const providerDetails: ProviderDetails = {
            id: provider.identifier,
            name: provider.name,
            supportedModels: defaultCapabilities.supportedModels,
            defaultModel: defaultCapabilities.supportedModels[0] || 'default',
            capabilities: defaultCapabilities,
            status: 'error',
            lastChecked: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          
          this.providerCache.set(provider.identifier, providerDetails);
        }
      }

      // Also include legacy hardcoded providers for backward compatibility
      await this.addLegacyProvidersToCache();

      this.lastCacheUpdate = now;
      logger.info('Provider cache refreshed from dynamic system', { 
        totalProviders: this.providerCache.size,
        dynamicProviders: providers.length
      });

    } catch (error) {
      logger.error('Failed to refresh provider cache from dynamic system', error);
      
      // Fallback to legacy provider loading
      try {
        await this.loadLegacyProviders();
        logger.warn('Fell back to legacy provider loading');
      } catch (fallbackError) {
        logger.error('Legacy provider fallback also failed', fallbackError);
        throw new ServiceUnavailableError('Failed to refresh provider information');
      }
    }
  }

  /**
   * Convert dynamic provider to capabilities format
   */
  private async convertProviderToCapabilities(provider: Provider): Promise<ProviderCapabilities> {
    // Get models for this provider
    const dynamicProviderService = getDynamicProviderService();
    const modelsResult = await dynamicProviderService.getModels({ 
      providerId: provider.id,
      status: ['active']
    });
    const supportedModels = modelsResult.models.map((model: any) => model.identifier);

    return {
      supportsSystemMessages: provider.capabilities?.supportsSystemMessages ?? false,
      maxContextLength: provider.capabilities?.maxContextLength ?? 4096,
      supportedRoles: provider.capabilities?.supportedRoles ?? ['user', 'assistant'],
      supportsStreaming: provider.capabilities?.supportsStreaming ?? false,
      supportsTools: provider.capabilities?.supportsTools ?? false,
      supportedModels
    };
  }

  /**
   * Get default model for a provider
   */
  private async getDefaultModelForProvider(provider: Provider): Promise<string> {
    // Get models for this provider
    const dynamicProviderService = getDynamicProviderService();
    const modelsResult = await dynamicProviderService.getModels({ 
      providerId: provider.id,
      status: ['active']
    });
    
    if (modelsResult.models.length === 0) {
      return 'default';
    }

    // Find the default model
    const defaultModel = modelsResult.models.find((model: any) => 
      model.isDefault && model.status === 'active'
    );
    
    if (defaultModel) {
      return defaultModel.identifier;
    }

    // Fall back to first active model
    const firstActiveModel = modelsResult.models.find((model: any) => 
      model.status === 'active'
    );
    
    return firstActiveModel?.identifier || 'default';
  }

  /**
   * Add legacy hardcoded providers to cache for backward compatibility
   */
  private async addLegacyProvidersToCache(): Promise<void> {
    try {
      const promptLibraryService = getPromptLibraryService();
      const legacyProviders = await promptLibraryService.getAvailableProviders();

      for (const provider of legacyProviders) {
        // Only add if not already in cache (dynamic providers take precedence)
        if (!this.providerCache.has(provider.id)) {
          const capabilities = await this.getProviderCapabilities(provider.id);
          const providerDetails: ProviderDetails = {
            id: provider.id,
            name: provider.name,
            supportedModels: capabilities.supportedModels,
            defaultModel: capabilities.supportedModels[0] || 'default',
            capabilities,
            status: 'available',
            lastChecked: new Date()
          };
          
          this.providerCache.set(provider.id, providerDetails);
          logger.debug('Added legacy provider to cache', { providerId: provider.id });
        }
      }
    } catch (error) {
      logger.warn('Failed to add legacy providers to cache', error);
    }
  }

  /**
   * Load legacy providers as fallback
   */
  private async loadLegacyProviders(): Promise<void> {
    const promptLibraryService = getPromptLibraryService();
    const providers = await promptLibraryService.getAvailableProviders();

    this.providerCache.clear();

    for (const provider of providers) {
      try {
        const capabilities = await this.getProviderCapabilities(provider.id);
        const providerDetails: ProviderDetails = {
          id: provider.id,
          name: provider.name,
          supportedModels: capabilities.supportedModels,
          defaultModel: capabilities.supportedModels[0] || 'default',
          capabilities,
          status: 'available',
          lastChecked: new Date()
        };
        
        this.providerCache.set(provider.id, providerDetails);
      } catch (error) {
        logger.warn('Failed to get capabilities for legacy provider', { 
          providerId: provider.id, 
          error 
        });
      }
    }

    this.lastCacheUpdate = Date.now();
  }

  /**
   * Get capabilities for a specific provider
   */
  private async getProviderCapabilities(providerId: string): Promise<ProviderCapabilities> {
    // This would ideally query the actual provider adapter for its capabilities
    // For now, we'll return default capabilities based on known provider types
    
    switch (providerId) {
      case 'openai':
        return {
          supportsSystemMessages: true,
          maxContextLength: 128000, // GPT-4 Turbo
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportedModels: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
        };
      
      case 'anthropic':
        return {
          supportsSystemMessages: true,
          maxContextLength: 200000, // Claude 3
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportedModels: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
        };
      
      case 'meta':
        return {
          supportsSystemMessages: true,
          maxContextLength: 32000, // Llama 2
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: false,
          supportsTools: false,
          supportedModels: ['llama-2-70b', 'llama-2-13b', 'llama-2-7b']
        };
      
      default:
        return this.getDefaultCapabilities();
    }
  }

  /**
   * Get default capabilities for unknown providers
   */
  private getDefaultCapabilities(): ProviderCapabilities {
    return {
      supportsSystemMessages: false,
      maxContextLength: 4096,
      supportedRoles: ['user', 'assistant'],
      supportsStreaming: false,
      supportsTools: false,
      supportedModels: ['*'] // Wildcard - assume all models supported
    };
  }

  /**
   * Force refresh of provider registry (invalidate cache)
   */
  async refreshRegistry(): Promise<void> {
    logger.info('Force refreshing provider registry');
    this.lastCacheUpdate = 0; // Force cache refresh
    await this.refreshProviderCache();
  }

  /**
   * Register a new dynamic provider in the registry
   */
  async registerProvider(providerId: string): Promise<void> {
    try {
      logger.info('Registering new provider in registry', { providerId });
      
      const dynamicProviderService = getDynamicProviderService();
      const provider = await dynamicProviderService.getProvider(providerId);
      
      if (provider.status !== 'active') {
        logger.warn('Attempted to register inactive provider', { 
          providerId, 
          status: provider.status 
        });
        return;
      }

      const capabilities = await this.convertProviderToCapabilities(provider);
      const providerDetails: ProviderDetails = {
        id: provider.identifier,
        name: provider.name,
        supportedModels: capabilities.supportedModels,
        defaultModel: await this.getDefaultModelForProvider(provider),
        capabilities,
        status: 'available',
        lastChecked: new Date()
      };
      
      this.providerCache.set(provider.identifier, providerDetails);
      logger.info('Provider registered successfully', { providerId });
      
    } catch (error) {
      logger.error('Failed to register provider', { providerId, error });
      throw error;
    }
  }

  /**
   * Deregister a provider from the registry
   */
  async deregisterProvider(providerId: string): Promise<void> {
    logger.info('Deregistering provider from registry', { providerId });
    
    this.providerCache.delete(providerId);
    this.providerHealthCache.delete(providerId);
    
    logger.info('Provider deregistered successfully', { providerId });
  }

  /**
   * Start health monitoring for all registered providers
   */
  startHealthMonitoring(): void {
    if (this.healthMonitoringInterval) {
      return; // Already started
    }

    logger.info('Starting provider health monitoring', { 
      interval: this.HEALTH_CHECK_INTERVAL 
    });

    this.healthMonitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);

    // Perform initial health check
    setImmediate(() => this.performHealthChecks());
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthMonitoringInterval) {
      clearInterval(this.healthMonitoringInterval);
      delete this.healthMonitoringInterval;
      logger.info('Stopped provider health monitoring');
    }
  }

  /**
   * Perform health checks on all registered providers
   */
  private async performHealthChecks(): Promise<void> {
    const providers = Array.from(this.providerCache.keys());
    
    if (providers.length === 0) {
      return;
    }

    logger.debug('Performing health checks', { providerCount: providers.length });

    const healthCheckPromises = providers.map(async (providerId) => {
      try {
        const result = await this.testProvider(providerId);
        
        const health: ProviderHealth = {
          providerId,
          status: result.available ? 'healthy' : 'down',
          lastCheck: new Date(),
          responseTime: result.responseTime || 0,
          error: result.error || '',
          uptime: 0 // This would be calculated based on historical data
        };

        this.providerHealthCache.set(providerId, health);

        // Update provider cache status
        const cachedProvider = this.providerCache.get(providerId);
        if (cachedProvider) {
          cachedProvider.status = result.available ? 'available' : 'unavailable';
          if (result.error) {
            cachedProvider.error = result.error;
          } else {
            delete cachedProvider.error;
          }
          cachedProvider.lastChecked = new Date();
        }

        return health;
      } catch (error) {
        logger.warn('Health check failed for provider', { providerId, error });
        
        const health: ProviderHealth = {
          providerId,
          status: 'down',
          lastCheck: new Date(),
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          uptime: 0
        };

        this.providerHealthCache.set(providerId, health);
        return health;
      }
    });

    const results = await Promise.allSettled(healthCheckPromises);
    const healthyCount = results.filter(r => 
      r.status === 'fulfilled' && r.value.status === 'healthy'
    ).length;

    logger.info('Health checks completed', { 
      total: providers.length, 
      healthy: healthyCount,
      unhealthy: providers.length - healthyCount
    });
  }

  /**
   * Get health status for all providers
   */
  getProviderHealth(): ProviderHealth[] {
    return Array.from(this.providerHealthCache.values());
  }

  /**
   * Get health status for a specific provider
   */
  getProviderHealthStatus(providerId: string): ProviderHealth | null {
    return this.providerHealthCache.get(providerId) || null;
  }

  /**
   * Get registry status and diagnostics
   */
  async getRegistryStatus(): Promise<{
    totalProviders: number;
    activeProviders: number;
    inactiveProviders: number;
    systemProviders: number;
    customProviders: number;
    lastRefresh: Date;
    cacheAge: number;
    healthStatus: {
      healthy: number;
      degraded: number;
      down: number;
      lastHealthCheck?: Date;
    };
  }> {
    await this.refreshProviderCache();
    
    const providers = Array.from(this.providerCache.values());
    const healthStatuses = Array.from(this.providerHealthCache.values());
    
    // Try to get dynamic provider stats
    let systemProviders = 0;
    let customProviders = 0;
    
    try {
      const dynamicProviderService = getDynamicProviderService();
      const registryStatus = await dynamicProviderService.getRegistryStatus();
      systemProviders = registryStatus.systemProviders;
      customProviders = registryStatus.customProviders;
    } catch (error) {
      logger.warn('Failed to get dynamic provider stats', error);
      // Estimate based on known system providers
      const knownSystemProviders = ['openai', 'anthropic', 'meta', 'aws-bedrock', 'microsoft-copilot'];
      systemProviders = providers.filter(p => knownSystemProviders.includes(p.id)).length;
      customProviders = providers.length - systemProviders;
    }

    const lastHealthCheck = healthStatuses.length > 0 
      ? new Date(Math.max(...healthStatuses.map(h => h.lastCheck.getTime())))
      : undefined;

    return {
      totalProviders: providers.length,
      activeProviders: providers.filter(p => p.status === 'available').length,
      inactiveProviders: providers.filter(p => p.status !== 'available').length,
      systemProviders,
      customProviders,
      lastRefresh: new Date(this.lastCacheUpdate),
      cacheAge: Date.now() - this.lastCacheUpdate,
      healthStatus: {
        healthy: healthStatuses.filter(h => h.status === 'healthy').length,
        degraded: healthStatuses.filter(h => h.status === 'degraded').length,
        down: healthStatuses.filter(h => h.status === 'down').length,
        ...(lastHealthCheck && { lastHealthCheck })
      }
    };
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalProviders: number;
    availableProviders: number;
    unavailableProviders: number;
    lastCacheUpdate: Date;
    cacheAge: number;
  } {
    return {
      totalProviders: this.providerCache.size,
      availableProviders: Array.from(this.providerCache.values()).filter(p => p.status === 'available').length,
      unavailableProviders: Array.from(this.providerCache.values()).filter(p => p.status !== 'available').length,
      lastCacheUpdate: new Date(this.lastCacheUpdate),
      cacheAge: Date.now() - this.lastCacheUpdate
    };
  }
}

// Singleton instance
let providerRegistryService: ProviderRegistryService | null = null;

/**
 * Get the singleton instance of the provider registry service
 */
export function getProviderRegistryService(): ProviderRegistryService {
  if (!providerRegistryService) {
    providerRegistryService = new ProviderRegistryService();
    // Start health monitoring automatically
    providerRegistryService.startHealthMonitoring();
  }
  return providerRegistryService;
}