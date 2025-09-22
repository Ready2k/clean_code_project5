// Provider factory for creating and configuring provider registries

import { ProviderRegistry } from './provider-registry';
import { ConcreteProviderRegistry } from './concrete-provider-registry';
import { ProviderAdapter } from './provider-adapter';

export class ProviderFactory {
  private static instance: ProviderRegistry | null = null;

  /**
   * Get the singleton provider registry instance
   */
  static getRegistry(): ProviderRegistry {
    if (!this.instance) {
      this.instance = new ConcreteProviderRegistry();
    }
    return this.instance;
  }

  /**
   * Create a new provider registry instance
   */
  static createRegistry(): ProviderRegistry {
    return new ConcreteProviderRegistry();
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetRegistry(): void {
    this.instance = null;
  }

  /**
   * Configure the registry with default adapters
   */
  static configureDefaultRegistry(adapters: ProviderAdapter[]): ProviderRegistry {
    const registry = this.getRegistry();
    
    // Register all provided adapters
    adapters.forEach(adapter => {
      try {
        registry.registerAdapter(adapter);
      } catch (error) {
        console.warn(`Failed to register adapter ${adapter.id}:`, error);
      }
    });

    return registry;
  }

  /**
   * Validate adapter before registration
   */
  static validateAdapter(adapter: ProviderAdapter): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required properties
    if (!adapter.id || typeof adapter.id !== 'string') {
      errors.push('Adapter must have a valid string id');
    }

    if (!adapter.name || typeof adapter.name !== 'string') {
      errors.push('Adapter must have a valid string name');
    }

    if (!Array.isArray(adapter.supportedModels) || adapter.supportedModels.length === 0) {
      errors.push('Adapter must have at least one supported model');
    }

    if (!adapter.capabilities) {
      errors.push('Adapter must define capabilities');
    }

    // Check required methods
    const requiredMethods = ['render', 'validate', 'supports', 'getDefaultOptions', 'getConfiguration'];
    for (const method of requiredMethods) {
      if (typeof adapter[method as keyof ProviderAdapter] !== 'function') {
        errors.push(`Adapter must implement ${method} method`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Register adapter with validation
   */
  static registerAdapterSafely(registry: ProviderRegistry, adapter: ProviderAdapter): boolean {
    const validation = this.validateAdapter(adapter);
    
    if (!validation.isValid) {
      console.error(`Invalid adapter ${adapter.id}:`, validation.errors);
      return false;
    }

    try {
      registry.registerAdapter(adapter);
      return true;
    } catch (error) {
      console.error(`Failed to register adapter ${adapter.id}:`, error);
      return false;
    }
  }
}