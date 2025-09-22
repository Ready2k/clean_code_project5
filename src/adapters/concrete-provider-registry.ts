// Concrete implementation of ProviderRegistry

import { ProviderAdapter } from './provider-adapter';
import { ProviderRegistry } from './provider-registry';
import { ProviderInfo } from '../types/common';

export class ConcreteProviderRegistry implements ProviderRegistry {
  private adapters: Map<string, ProviderAdapter> = new Map();

  /**
   * Register a new provider adapter
   */
  registerAdapter(adapter: ProviderAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Provider adapter with id '${adapter.id}' is already registered`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Get a provider adapter by ID
   */
  getAdapter(providerId: string): ProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`Provider adapter with id '${providerId}' not found`);
    }
    return adapter;
  }

  /**
   * List all registered providers
   */
  listProviders(): ProviderInfo[] {
    return Array.from(this.adapters.values()).map(adapter => ({
      id: adapter.id,
      name: adapter.name,
      supportedModels: [...adapter.supportedModels],
      defaultModel: adapter.getDefaultOptions().model
    }));
  }

  /**
   * Find providers that support a specific model
   */
  supportsModel(model: string): ProviderInfo[] {
    return Array.from(this.adapters.values())
      .filter(adapter => adapter.supports(model))
      .map(adapter => ({
        id: adapter.id,
        name: adapter.name,
        supportedModels: [...adapter.supportedModels],
        defaultModel: adapter.getDefaultOptions().model
      }));
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(providerId: string): boolean {
    return this.adapters.has(providerId);
  }

  /**
   * Unregister a provider adapter
   */
  unregisterAdapter(providerId: string): void {
    if (!this.adapters.has(providerId)) {
      throw new Error(`Provider adapter with id '${providerId}' not found`);
    }
    this.adapters.delete(providerId);
  }

  /**
   * Get all adapters
   */
  getAllAdapters(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Find the best provider for a given model
   */
  findBestProvider(model: string): ProviderAdapter | null {
    const supportingAdapters = Array.from(this.adapters.values())
      .filter(adapter => adapter.supports(model));
    
    if (supportingAdapters.length === 0) {
      return null;
    }

    // Return the first supporting adapter (could be enhanced with scoring logic)
    return supportingAdapters[0];
  }

  /**
   * Get provider recommendations based on requirements
   */
  getRecommendations(requirements: {
    supportsSystemMessages?: boolean;
    maxContextLength?: number;
    supportedRoles?: string[];
  }): ProviderInfo[] {
    return Array.from(this.adapters.values())
      .filter(adapter => {
        const capabilities = adapter.capabilities;
        
        // Check system messages requirement
        if (requirements.supportsSystemMessages !== undefined && 
            capabilities.supportsSystemMessages !== requirements.supportsSystemMessages) {
          return false;
        }

        // Check context length requirement
        if (requirements.maxContextLength !== undefined && 
            capabilities.maxContextLength < requirements.maxContextLength) {
          return false;
        }

        // Check supported roles requirement
        if (requirements.supportedRoles !== undefined) {
          const hasAllRoles = requirements.supportedRoles.every(role => 
            capabilities.supportedMessageRoles.includes(role)
          );
          if (!hasAllRoles) {
            return false;
          }
        }

        return true;
      })
      .map(adapter => ({
        id: adapter.id,
        name: adapter.name,
        supportedModels: [...adapter.supportedModels],
        defaultModel: adapter.getDefaultOptions().model
      }));
  }
}