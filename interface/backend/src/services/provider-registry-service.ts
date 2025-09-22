import { getPromptLibraryService, RenderOptions, ProviderPayload } from './prompt-library-service.js';
import { logger } from '../utils/logger.js';
import { ServiceUnavailableError, ValidationError, NotFoundError } from '../types/errors.js';

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
}

export interface RenderResult {
  payload: ProviderPayload;
  metadata: {
    provider: string;
    model?: string | undefined;
    timestamp: Date;
    renderTime: number;
  };
}

/**
 * Service for managing multi-provider rendering capabilities
 */
export class ProviderRegistryService {
  private providerCache = new Map<string, ProviderDetails>();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
    
    const provider = this.providerCache.get(providerId);
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
      const promptLibraryService = getPromptLibraryService();
      const payload = await promptLibraryService.renderPrompt(
        request.promptId,
        request.provider,
        request.options
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
   * Refresh the provider cache
   */
  private async refreshProviderCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate < this.CACHE_TTL) {
      return; // Cache is still fresh
    }

    try {
      logger.debug('Refreshing provider cache');
      
      const promptLibraryService = getPromptLibraryService();
      const providers = await promptLibraryService.getAvailableProviders();

      // Clear old cache
      this.providerCache.clear();

      // Populate new cache
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
          logger.warn('Failed to get capabilities for provider', { providerId: provider.id, error });
          
          const defaultCapabilities = this.getDefaultCapabilities();
          const providerDetails: ProviderDetails = {
            id: provider.id,
            name: provider.name,
            supportedModels: defaultCapabilities.supportedModels,
            defaultModel: defaultCapabilities.supportedModels[0] || 'default',
            capabilities: defaultCapabilities,
            status: 'error',
            lastChecked: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          
          this.providerCache.set(provider.id, providerDetails);
        }
      }

      this.lastCacheUpdate = now;
      logger.debug('Provider cache refreshed', { count: this.providerCache.size });

    } catch (error) {
      logger.error('Failed to refresh provider cache', error);
      throw new ServiceUnavailableError('Failed to refresh provider information');
    }
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
  }
  return providerRegistryService;
}