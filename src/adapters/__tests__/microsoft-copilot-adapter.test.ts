// Microsoft Copilot Adapter Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { MicrosoftCopilotAdapter } from '../microsoft-copilot-adapter';
import { StructuredPrompt } from '../../models/prompt';
import { RenderOptions } from '../../types/common';

describe('MicrosoftCopilotAdapter', () => {
  let adapter: MicrosoftCopilotAdapter;

  beforeEach(() => {
    adapter = new MicrosoftCopilotAdapter();
  });

  describe('Basic Properties', () => {
    it('should have correct id and name', () => {
      expect(adapter.id).toBe('microsoft-copilot');
      expect(adapter.name).toBe('Microsoft Copilot');
    });

    it('should support expected models', () => {
      expect(adapter.supportedModels).toContain('gpt-4');
      expect(adapter.supportedModels).toContain('gpt-4-turbo');
      expect(adapter.supportedModels).toContain('gpt-35-turbo');
      expect(adapter.supportedModels).toContain('gpt-4-32k');
    });

    it('should have correct capabilities', () => {
      expect(adapter.capabilities.supportsSystemMessages).toBe(true);
      expect(adapter.capabilities.supportsMultipleMessages).toBe(true);
      expect(adapter.capabilities.supportsTemperature).toBe(true);
      expect(adapter.capabilities.supportsTopP).toBe(true);
      expect(adapter.capabilities.supportsMaxTokens).toBe(true);
      expect(adapter.capabilities.supportedMessageRoles).toEqual(['system', 'user', 'assistant']);
    });
  });

  describe('Model Support', () => {
    it('should support valid models', () => {
      expect(adapter.supports('gpt-4')).toBe(true);
      expect(adapter.supports('gpt-4-turbo')).toBe(true);
      expect(adapter.supports('gpt-35-turbo')).toBe(true);
    });

    it('should not support invalid models', () => {
      expect(adapter.supports('invalid-model')).toBe(false);
      expect(adapter.supports('claude-3')).toBe(false);
    });
  });

  describe('Rendering', () => {
    const mockStructuredPrompt: StructuredPrompt = {
      system: ['You are a helpful assistant.'],
      user_template: 'Hello, {{name}}!',
      variables: [
        {
          name: 'name',
          type: 'string',
          description: 'User name',
          required: true
        }
      ]
    };

    const mockRenderOptions: RenderOptions = {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000
    };

    it('should render basic prompt correctly', () => {
      const result = adapter.render(mockStructuredPrompt, mockRenderOptions);

      expect(result.provider).toBe('microsoft-copilot');
      expect(result.model).toBe('gpt-4');
      expect(result.content).toBeDefined();

      const content = result.content as any;
      expect(content.model).toBe('gpt-4');
      expect(content.messages).toHaveLength(2);
      expect(content.messages[0].role).toBe('system');
      expect(content.messages[0].content).toBe('You are a helpful assistant.');
      expect(content.messages[1].role).toBe('user');
      expect(content.messages[1].content).toBe('Hello, {{name}}!');
      expect(content.temperature).toBe(0.7);
      expect(content.max_tokens).toBe(1000);
    });

    it('should substitute variables when provided', () => {
      const optionsWithVariables: RenderOptions = {
        ...mockRenderOptions,
        variables: { name: 'Alice' }
      };

      const result = adapter.render(mockStructuredPrompt, optionsWithVariables);
      const content = result.content as any;
      
      expect(content.messages[1].content).toBe('Hello, Alice!');
    });

    it('should handle system override', () => {
      const optionsWithOverride: RenderOptions = {
        ...mockRenderOptions,
        systemOverride: 'You are a coding assistant.'
      };

      const result = adapter.render(mockStructuredPrompt, optionsWithOverride);
      const content = result.content as any;
      
      expect(content.messages[0].content).toBe('You are a coding assistant.');
    });

    it('should include Microsoft Copilot specific parameters', () => {
      const optionsWithCopilotParams: RenderOptions = {
        ...mockRenderOptions,
        presencePenalty: 0.5,
        frequencyPenalty: 0.3
      };

      const result = adapter.render(mockStructuredPrompt, optionsWithCopilotParams);
      const content = result.content as any;
      
      expect(content.presence_penalty).toBe(0.5);
      expect(content.frequency_penalty).toBe(0.3);
    });

    it('should include metadata', () => {
      const result = adapter.render(mockStructuredPrompt, mockRenderOptions);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.messageCount).toBe(2);
      expect(result.metadata?.hasSystemMessage).toBe(true);
      expect(result.metadata?.estimatedTokens).toBeGreaterThan(0);
      expect(result.metadata?.apiVersion).toBe('2024-02-15-preview');
    });
  });

  describe('Validation', () => {
    it('should validate correct payload', () => {
      const validPayload = {
        provider: 'microsoft-copilot',
        model: 'gpt-4',
        content: {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hello!' }
          ],
          temperature: 0.7
        }
      };

      const result = adapter.validate(validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid provider', () => {
      const invalidPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello!' }]
        }
      };

      const result = adapter.validate(invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expected provider \'microsoft-copilot\', got \'openai\'');
    });

    it('should reject unsupported model', () => {
      const invalidPayload = {
        provider: 'microsoft-copilot',
        model: 'claude-3',
        content: {
          model: 'claude-3',
          messages: [{ role: 'user', content: 'Hello!' }]
        }
      };

      const result = adapter.validate(invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported model: claude-3');
    });

    it('should validate temperature range', () => {
      const invalidPayload = {
        provider: 'microsoft-copilot',
        model: 'gpt-4',
        content: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello!' }],
          temperature: 3.0
        }
      };

      const result = adapter.validate(invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Temperature must be a number between 0 and 2');
    });

    it('should validate presence and frequency penalty ranges', () => {
      const invalidPayload = {
        provider: 'microsoft-copilot',
        model: 'gpt-4',
        content: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello!' }],
          presence_penalty: 3.0,
          frequency_penalty: -3.0
        }
      };

      const result = adapter.validate(invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('presence_penalty must be a number between -2 and 2');
      expect(result.errors).toContain('frequency_penalty must be a number between -2 and 2');
    });
  });

  describe('Configuration', () => {
    it('should return correct default options', () => {
      const defaults = adapter.getDefaultOptions();
      
      expect(defaults.model).toBe('gpt-4');
      expect(defaults.temperature).toBe(0.7);
      expect(defaults.maxTokens).toBe(4096);
    });

    it('should return correct configuration', () => {
      const config = adapter.getConfiguration();
      
      expect(config.id).toBe('microsoft-copilot');
      expect(config.name).toBe('Microsoft Copilot');
      expect(config.defaultModel).toBe('gpt-4');
      expect(config.models).toBeDefined();
      expect(config.models.length).toBeGreaterThan(0);
      expect(config.rateLimits).toBeDefined();
    });

    it('should return model info for supported models', () => {
      const modelInfo = adapter.getModelInfo('gpt-4');
      
      expect(modelInfo).toBeDefined();
      expect(modelInfo?.maxTokens).toBe(4096);
      expect(modelInfo?.contextLength).toBe(8192);
      expect(modelInfo?.supportsSystemMessages).toBe(true);
    });

    it('should return null for unsupported models', () => {
      const modelInfo = adapter.getModelInfo('claude-3');
      expect(modelInfo).toBeNull();
    });
  });

  describe('Response Parsing', () => {
    it('should parse valid response', () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'Hello there!' },
            finish_reason: 'stop',
            index: 0
          }
        ],
        model: 'gpt-4',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        api_version: '2024-02-15-preview'
      };

      const result = adapter.parseResponse(mockResponse);
      
      expect(result.content).toBe('Hello there!');
      expect(result.metadata.model).toBe('gpt-4');
      expect(result.metadata.usage).toBeDefined();
      expect(result.metadata.finishReason).toBe('stop');
      expect(result.metadata.apiVersion).toBe('2024-02-15-preview');
    });

    it('should throw error for invalid response', () => {
      const invalidResponse = { choices: [] };
      
      expect(() => adapter.parseResponse(invalidResponse))
        .toThrow('Invalid Microsoft Copilot response: no choices found');
    });
  });
});