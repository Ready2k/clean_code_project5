// Tests for base provider adapter

import { describe, it, expect } from 'vitest';
import { BaseProviderAdapter } from '../base-provider-adapter';
import { ProviderCapabilities, ProviderConfiguration } from '../../models/provider';
import { RenderOptions, ProviderPayload } from '../../types/common';
import { ValidationResult } from '../../types/validation';
import { StructuredPrompt } from '../../models/prompt';

// Concrete implementation for testing
class TestProviderAdapter extends BaseProviderAdapter {
  readonly id = 'test-provider';
  readonly name = 'Test Provider';
  readonly supportedModels = ['test-model-1', 'test-model-2'];
  readonly capabilities: ProviderCapabilities = {
    supportsSystemMessages: true,
    supportsMultipleMessages: true,
    supportsTemperature: true,
    supportsTopP: true,
    supportsMaxTokens: true,
    maxContextLength: 4096,
    supportedMessageRoles: ['system', 'user', 'assistant']
  };

  render(structured: StructuredPrompt, options: RenderOptions): ProviderPayload {
    return {
      provider: this.id,
      model: options.model,
      content: { messages: [{ role: 'user', content: structured.user_template }] }
    };
  }

  validate(payload: ProviderPayload): ValidationResult {
    return { isValid: true, errors: [] };
  }

  getDefaultOptions(): RenderOptions {
    return { model: 'test-model-1' };
  }

  getConfiguration(): ProviderConfiguration {
    return {
      id: this.id,
      name: this.name,
      defaultModel: 'test-model-1',
      models: []
    };
  }
}

describe('BaseProviderAdapter', () => {
  let adapter: TestProviderAdapter;

  beforeEach(() => {
    adapter = new TestProviderAdapter();
  });

  describe('supports', () => {
    it('should return true for supported models', () => {
      expect(adapter.supports('test-model-1')).toBe(true);
      expect(adapter.supports('test-model-2')).toBe(true);
    });

    it('should return false for unsupported models', () => {
      expect(adapter.supports('unsupported-model')).toBe(false);
    });
  });

  describe('getModelInfo', () => {
    it('should return model info for supported models', () => {
      const info = adapter.getModelInfo('test-model-1');
      expect(info).toEqual({
        maxTokens: 4096,
        contextLength: 4096,
        supportsSystemMessages: true
      });
    });

    it('should return null for unsupported models', () => {
      const info = adapter.getModelInfo('unsupported-model');
      expect(info).toBeNull();
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const prompt = 'This is a test prompt';
      const tokens = adapter.estimateTokens(prompt);
      expect(tokens).toBe(Math.ceil(prompt.length / 4));
    });

    it('should handle empty strings', () => {
      expect(adapter.estimateTokens('')).toBe(0);
    });
  });

  describe('validateRenderOptions', () => {
    it('should validate supported model', () => {
      const options: RenderOptions = { model: 'test-model-1' };
      const result = adapter['validateRenderOptions'](options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject unsupported model', () => {
      const options: RenderOptions = { model: 'unsupported-model' };
      const result = adapter['validateRenderOptions'](options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Model 'unsupported-model' is not supported by Test Provider");
    });

    it('should validate temperature range', () => {
      const validOptions: RenderOptions = { model: 'test-model-1', temperature: 0.7 };
      const validResult = adapter['validateRenderOptions'](validOptions);
      expect(validResult.isValid).toBe(true);

      const invalidOptions: RenderOptions = { model: 'test-model-1', temperature: 3.0 };
      const invalidResult = adapter['validateRenderOptions'](invalidOptions);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Temperature must be between 0 and 2');
    });

    it('should validate topP range', () => {
      const validOptions: RenderOptions = { model: 'test-model-1', topP: 0.9 };
      const validResult = adapter['validateRenderOptions'](validOptions);
      expect(validResult.isValid).toBe(true);

      const invalidOptions: RenderOptions = { model: 'test-model-1', topP: 1.5 };
      const invalidResult = adapter['validateRenderOptions'](invalidOptions);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('TopP must be between 0 and 1');
    });

    it('should validate maxTokens', () => {
      const validOptions: RenderOptions = { model: 'test-model-1', maxTokens: 1000 };
      const validResult = adapter['validateRenderOptions'](validOptions);
      expect(validResult.isValid).toBe(true);

      const invalidOptions: RenderOptions = { model: 'test-model-1', maxTokens: -1 };
      const invalidResult = adapter['validateRenderOptions'](invalidOptions);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('MaxTokens must be greater than 0');
    });
  });

  describe('substituteVariables', () => {
    it('should substitute variables in template', () => {
      const template = 'Hello {{name}}, you are {{age}} years old';
      const variables = { name: 'John', age: 30 };
      const result = adapter['substituteVariables'](template, variables);
      expect(result).toBe('Hello John, you are 30 years old');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = '{{greeting}} {{name}}, {{greeting}} again {{name}}!';
      const variables = { greeting: 'Hello', name: 'World' };
      const result = adapter['substituteVariables'](template, variables);
      expect(result).toBe('Hello World, Hello again World!');
    });

    it('should handle variables with whitespace', () => {
      const template = '{{ name }} and {{  age  }}';
      const variables = { name: 'John', age: 30 };
      const result = adapter['substituteVariables'](template, variables);
      expect(result).toBe('John and 30');
    });

    it('should leave unmatched variables unchanged', () => {
      const template = 'Hello {{name}}, you have {{unmatched}} items';
      const variables = { name: 'John' };
      const result = adapter['substituteVariables'](template, variables);
      expect(result).toBe('Hello John, you have {{unmatched}} items');
    });
  });

  describe('validateStructuredPrompt', () => {
    it('should validate prompt with system instructions', () => {
      const prompt: StructuredPrompt = {
        system: ['You are a helpful assistant'],
        user_template: 'Hello {{name}}',
        capabilities: [],
        rules: [],
        variables: []
      };
      const result = adapter['validateStructuredPrompt'](prompt);
      expect(result.isValid).toBe(true);
    });

    it('should require user template', () => {
      const prompt: StructuredPrompt = {
        system: ['You are a helpful assistant'],
        user_template: '',
        capabilities: [],
        rules: [],
        variables: []
      };
      const result = adapter['validateStructuredPrompt'](prompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User template is required');
    });
  });
});

// Test adapter with limited capabilities
class LimitedCapabilitiesAdapter extends BaseProviderAdapter {
  readonly id = 'limited-provider';
  readonly name = 'Limited Provider';
  readonly supportedModels = ['limited-model'];
  readonly capabilities: ProviderCapabilities = {
    supportsSystemMessages: false,
    supportsMultipleMessages: false,
    supportsTemperature: false,
    supportsTopP: false,
    supportsMaxTokens: false,
    maxContextLength: 2048,
    supportedMessageRoles: ['user']
  };

  render(): ProviderPayload {
    return { provider: this.id, model: 'limited-model', content: {} };
  }

  validate(): ValidationResult {
    return { isValid: true, errors: [] };
  }

  getDefaultOptions(): RenderOptions {
    return { model: 'limited-model' };
  }

  getConfiguration(): ProviderConfiguration {
    return { id: this.id, name: this.name, defaultModel: 'limited-model', models: [] };
  }
}

describe('BaseProviderAdapter with limited capabilities', () => {
  let adapter: LimitedCapabilitiesAdapter;

  beforeEach(() => {
    adapter = new LimitedCapabilitiesAdapter();
  });

  it('should reject unsupported parameters', () => {
    const options: RenderOptions = {
      model: 'limited-model',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 1000
    };
    
    const result = adapter['validateRenderOptions'](options);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Limited Provider does not support temperature parameter');
    expect(result.errors).toContain('Limited Provider does not support topP parameter');
    expect(result.errors).toContain('Limited Provider does not support maxTokens parameter');
  });
});