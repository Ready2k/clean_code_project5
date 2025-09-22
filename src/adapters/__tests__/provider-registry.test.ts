// Tests for provider registry implementation

import { describe, it, expect, beforeEach } from 'vitest';
import { ConcreteProviderRegistry } from '../concrete-provider-registry';
import { ProviderAdapter } from '../provider-adapter';
import { ProviderCapabilities } from '../../models/provider';
import { RenderOptions, ProviderPayload } from '../../types/common';
import { ValidationResult } from '../../types/validation';
import { StructuredPrompt } from '../../models/prompt';

// Mock adapter for testing
class MockProviderAdapter implements ProviderAdapter {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly supportedModels: string[] = ['test-model'],
    public readonly capabilities: ProviderCapabilities = {
      supportsSystemMessages: true,
      supportsMultipleMessages: true,
      supportsTemperature: true,
      supportsTopP: true,
      supportsMaxTokens: true,
      maxContextLength: 4096,
      supportedMessageRoles: ['system', 'user', 'assistant']
    }
  ) {}

  render(structured: StructuredPrompt, options: RenderOptions): ProviderPayload {
    return {
      provider: this.id,
      model: options.model,
      content: { messages: [{ role: 'user', content: 'test' }] }
    };
  }

  validate(payload: ProviderPayload): ValidationResult {
    return { isValid: true, errors: [] };
  }

  supports(model: string): boolean {
    return this.supportedModels.includes(model);
  }

  getDefaultOptions(): RenderOptions {
    return { model: this.supportedModels[0] };
  }

  getConfiguration() {
    return {
      id: this.id,
      name: this.name,
      defaultModel: this.supportedModels[0],
      models: []
    };
  }

  getModelInfo(model: string) {
    return this.supports(model) ? {
      maxTokens: 4096,
      contextLength: 4096,
      supportsSystemMessages: true
    } : null;
  }
}

describe('ConcreteProviderRegistry', () => {
  let registry: ConcreteProviderRegistry;
  let mockAdapter1: MockProviderAdapter;
  let mockAdapter2: MockProviderAdapter;

  beforeEach(() => {
    registry = new ConcreteProviderRegistry();
    mockAdapter1 = new MockProviderAdapter('test-provider-1', 'Test Provider 1', ['model-1', 'model-2']);
    mockAdapter2 = new MockProviderAdapter('test-provider-2', 'Test Provider 2', ['model-2', 'model-3']);
  });

  describe('registerAdapter', () => {
    it('should register a new adapter successfully', () => {
      expect(() => registry.registerAdapter(mockAdapter1)).not.toThrow();
      expect(registry.hasProvider('test-provider-1')).toBe(true);
    });

    it('should throw error when registering duplicate adapter', () => {
      registry.registerAdapter(mockAdapter1);
      expect(() => registry.registerAdapter(mockAdapter1)).toThrow(
        "Provider adapter with id 'test-provider-1' is already registered"
      );
    });
  });

  describe('getAdapter', () => {
    it('should return registered adapter', () => {
      registry.registerAdapter(mockAdapter1);
      const adapter = registry.getAdapter('test-provider-1');
      expect(adapter).toBe(mockAdapter1);
    });

    it('should throw error for non-existent adapter', () => {
      expect(() => registry.getAdapter('non-existent')).toThrow(
        "Provider adapter with id 'non-existent' not found"
      );
    });
  });

  describe('listProviders', () => {
    it('should return empty array when no providers registered', () => {
      const providers = registry.listProviders();
      expect(providers).toEqual([]);
    });

    it('should return all registered providers', () => {
      registry.registerAdapter(mockAdapter1);
      registry.registerAdapter(mockAdapter2);
      
      const providers = registry.listProviders();
      expect(providers).toHaveLength(2);
      expect(providers).toEqual([
        {
          id: 'test-provider-1',
          name: 'Test Provider 1',
          supportedModels: ['model-1', 'model-2'],
          defaultModel: 'model-1'
        },
        {
          id: 'test-provider-2',
          name: 'Test Provider 2',
          supportedModels: ['model-2', 'model-3'],
          defaultModel: 'model-2'
        }
      ]);
    });
  });

  describe('supportsModel', () => {
    beforeEach(() => {
      registry.registerAdapter(mockAdapter1);
      registry.registerAdapter(mockAdapter2);
    });

    it('should return providers that support the model', () => {
      const providers = registry.supportsModel('model-2');
      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.id)).toEqual(['test-provider-1', 'test-provider-2']);
    });

    it('should return single provider for unique model', () => {
      const providers = registry.supportsModel('model-1');
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('test-provider-1');
    });

    it('should return empty array for unsupported model', () => {
      const providers = registry.supportsModel('unsupported-model');
      expect(providers).toEqual([]);
    });
  });

  describe('hasProvider', () => {
    it('should return true for registered provider', () => {
      registry.registerAdapter(mockAdapter1);
      expect(registry.hasProvider('test-provider-1')).toBe(true);
    });

    it('should return false for non-registered provider', () => {
      expect(registry.hasProvider('non-existent')).toBe(false);
    });
  });

  describe('unregisterAdapter', () => {
    it('should unregister existing adapter', () => {
      registry.registerAdapter(mockAdapter1);
      expect(registry.hasProvider('test-provider-1')).toBe(true);
      
      registry.unregisterAdapter('test-provider-1');
      expect(registry.hasProvider('test-provider-1')).toBe(false);
    });

    it('should throw error when unregistering non-existent adapter', () => {
      expect(() => registry.unregisterAdapter('non-existent')).toThrow(
        "Provider adapter with id 'non-existent' not found"
      );
    });
  });

  describe('getAllAdapters', () => {
    it('should return all registered adapters', () => {
      registry.registerAdapter(mockAdapter1);
      registry.registerAdapter(mockAdapter2);
      
      const adapters = registry.getAllAdapters();
      expect(adapters).toHaveLength(2);
      expect(adapters).toContain(mockAdapter1);
      expect(adapters).toContain(mockAdapter2);
    });
  });

  describe('findBestProvider', () => {
    beforeEach(() => {
      registry.registerAdapter(mockAdapter1);
      registry.registerAdapter(mockAdapter2);
    });

    it('should return first supporting provider', () => {
      const provider = registry.findBestProvider('model-2');
      expect(provider).toBe(mockAdapter1); // First registered
    });

    it('should return null for unsupported model', () => {
      const provider = registry.findBestProvider('unsupported-model');
      expect(provider).toBeNull();
    });
  });

  describe('getRecommendations', () => {
    beforeEach(() => {
      const adapter1 = new MockProviderAdapter('provider-1', 'Provider 1', ['model-1'], {
        supportsSystemMessages: true,
        supportsMultipleMessages: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsMaxTokens: true,
        maxContextLength: 4096,
        supportedMessageRoles: ['system', 'user']
      });

      const adapter2 = new MockProviderAdapter('provider-2', 'Provider 2', ['model-2'], {
        supportsSystemMessages: false,
        supportsMultipleMessages: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsMaxTokens: true,
        maxContextLength: 8192,
        supportedMessageRoles: ['user', 'assistant']
      });

      registry.registerAdapter(adapter1);
      registry.registerAdapter(adapter2);
    });

    it('should filter by system messages support', () => {
      const recommendations = registry.getRecommendations({
        supportsSystemMessages: true
      });
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].id).toBe('provider-1');
    });

    it('should filter by context length', () => {
      const recommendations = registry.getRecommendations({
        maxContextLength: 6000
      });
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].id).toBe('provider-2');
    });

    it('should filter by supported roles', () => {
      const recommendations = registry.getRecommendations({
        supportedRoles: ['system', 'user']
      });
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].id).toBe('provider-1');
    });

    it('should return empty array when no providers match', () => {
      const recommendations = registry.getRecommendations({
        supportsSystemMessages: true,
        maxContextLength: 10000
      });
      
      expect(recommendations).toEqual([]);
    });
  });
});