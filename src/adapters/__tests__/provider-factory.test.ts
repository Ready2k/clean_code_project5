// Tests for provider factory

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProviderFactory } from '../provider-factory';
import { ProviderAdapter } from '../provider-adapter';
import { ProviderCapabilities } from '../../models/provider';
import { RenderOptions, ProviderPayload } from '../../types/common';
import { ValidationResult } from '../../types/validation';
import { StructuredPrompt } from '../../models/prompt';

// Mock console methods
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock adapter for testing
class MockAdapter implements ProviderAdapter {
  constructor(
    public readonly id: string,
    public readonly name: string = 'Mock Adapter',
    public readonly supportedModels: string[] = ['mock-model'],
    public readonly capabilities: ProviderCapabilities = {
      supportsSystemMessages: true,
      supportsMultipleMessages: true,
      supportsTemperature: true,
      supportsTopP: true,
      supportsMaxTokens: true,
      maxContextLength: 4096,
      supportedMessageRoles: ['system', 'user']
    }
  ) {}

  render(): ProviderPayload {
    return { provider: this.id, model: 'mock-model', content: {} };
  }

  validate(): ValidationResult {
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
}

describe('ProviderFactory', () => {
  beforeEach(() => {
    ProviderFactory.resetRegistry();
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    ProviderFactory.resetRegistry();
  });

  describe('getRegistry', () => {
    it('should return singleton instance', () => {
      const registry1 = ProviderFactory.getRegistry();
      const registry2 = ProviderFactory.getRegistry();
      expect(registry1).toBe(registry2);
    });

    it('should create new instance after reset', () => {
      const registry1 = ProviderFactory.getRegistry();
      ProviderFactory.resetRegistry();
      const registry2 = ProviderFactory.getRegistry();
      expect(registry1).not.toBe(registry2);
    });
  });

  describe('createRegistry', () => {
    it('should create new registry instance each time', () => {
      const registry1 = ProviderFactory.createRegistry();
      const registry2 = ProviderFactory.createRegistry();
      expect(registry1).not.toBe(registry2);
    });
  });

  describe('configureDefaultRegistry', () => {
    it('should register all provided adapters', () => {
      const adapter1 = new MockAdapter('adapter-1');
      const adapter2 = new MockAdapter('adapter-2');
      
      const registry = ProviderFactory.configureDefaultRegistry([adapter1, adapter2]);
      
      expect(registry.hasProvider('adapter-1')).toBe(true);
      expect(registry.hasProvider('adapter-2')).toBe(true);
    });

    it('should handle registration failures gracefully', () => {
      const adapter1 = new MockAdapter('adapter-1');
      const adapter2 = new MockAdapter('adapter-1'); // Duplicate ID
      
      const registry = ProviderFactory.configureDefaultRegistry([adapter1, adapter2]);
      
      expect(registry.hasProvider('adapter-1')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to register adapter adapter-1:',
        expect.any(Error)
      );
    });
  });

  describe('validateAdapter', () => {
    it('should validate correct adapter', () => {
      const adapter = new MockAdapter('valid-adapter');
      const result = ProviderFactory.validateAdapter(adapter);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject adapter without id', () => {
      const adapter = { ...new MockAdapter('test'), id: '' };
      const result = ProviderFactory.validateAdapter(adapter as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Adapter must have a valid string id');
    });

    it('should reject adapter without name', () => {
      const adapter = { ...new MockAdapter('test'), name: '' };
      const result = ProviderFactory.validateAdapter(adapter as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Adapter must have a valid string name');
    });

    it('should reject adapter without supported models', () => {
      const adapter = { ...new MockAdapter('test'), supportedModels: [] };
      const result = ProviderFactory.validateAdapter(adapter as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Adapter must have at least one supported model');
    });

    it('should reject adapter without capabilities', () => {
      const adapter = { ...new MockAdapter('test'), capabilities: undefined };
      const result = ProviderFactory.validateAdapter(adapter as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Adapter must define capabilities');
    });

    it('should reject adapter missing required methods', () => {
      const adapter = { ...new MockAdapter('test'), render: undefined };
      const result = ProviderFactory.validateAdapter(adapter as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Adapter must implement render method');
    });

    it('should validate all required methods', () => {
      const requiredMethods = ['render', 'validate', 'supports', 'getDefaultOptions', 'getConfiguration'];
      
      for (const method of requiredMethods) {
        const adapter = { ...new MockAdapter('test'), [method]: undefined };
        const result = ProviderFactory.validateAdapter(adapter as any);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(`Adapter must implement ${method} method`);
      }
    });
  });

  describe('registerAdapterSafely', () => {
    it('should register valid adapter successfully', () => {
      const registry = ProviderFactory.createRegistry();
      const adapter = new MockAdapter('valid-adapter');
      
      const success = ProviderFactory.registerAdapterSafely(registry, adapter);
      
      expect(success).toBe(true);
      expect(registry.hasProvider('valid-adapter')).toBe(true);
    });

    it('should reject invalid adapter', () => {
      const registry = ProviderFactory.createRegistry();
      const adapter = { ...new MockAdapter('test'), id: '' };
      
      const success = ProviderFactory.registerAdapterSafely(registry, adapter as any);
      
      expect(success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid adapter :',
        expect.arrayContaining(['Adapter must have a valid string id'])
      );
    });

    it('should handle registration errors', () => {
      const registry = ProviderFactory.createRegistry();
      const adapter = new MockAdapter('test-adapter');
      
      // Register once successfully
      registry.registerAdapter(adapter);
      
      // Try to register again (should fail)
      const success = ProviderFactory.registerAdapterSafely(registry, adapter);
      
      expect(success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to register adapter test-adapter:',
        expect.any(Error)
      );
    });
  });
});