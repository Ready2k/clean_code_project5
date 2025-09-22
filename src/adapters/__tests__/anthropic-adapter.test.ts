// Tests for Anthropic provider adapter

import { describe, it, expect } from 'vitest';
import { AnthropicAdapter } from '../anthropic-adapter';
import { StructuredPrompt } from '../../models/prompt';
import { RenderOptions } from '../../types/common';

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    adapter = new AnthropicAdapter();
  });

  describe('basic properties', () => {
    it('should have correct id and name', () => {
      expect(adapter.id).toBe('anthropic');
      expect(adapter.name).toBe('Anthropic');
    });

    it('should support expected models', () => {
      expect(adapter.supportedModels).toContain('claude-3-5-sonnet-20241022');
      expect(adapter.supportedModels).toContain('claude-3-opus-20240229');
      expect(adapter.supportedModels).toContain('claude-3-haiku-20240307');
    });

    it('should have correct capabilities', () => {
      expect(adapter.capabilities.supportsSystemMessages).toBe(true);
      expect(adapter.capabilities.supportsMultipleMessages).toBe(true);
      expect(adapter.capabilities.supportsTemperature).toBe(true);
      expect(adapter.capabilities.supportsTopP).toBe(true);
      expect(adapter.capabilities.supportsMaxTokens).toBe(true);
      expect(adapter.capabilities.supportedMessageRoles).toEqual(['user', 'assistant']);
      expect(adapter.capabilities.maxContextLength).toBe(200000);
    });
  });

  describe('supports', () => {
    it('should support known models', () => {
      expect(adapter.supports('claude-3-5-sonnet-20241022')).toBe(true);
      expect(adapter.supports('claude-3-opus-20240229')).toBe(true);
      expect(adapter.supports('claude-3-haiku-20240307')).toBe(true);
    });

    it('should not support unknown models', () => {
      expect(adapter.supports('unknown-model')).toBe(false);
      expect(adapter.supports('gpt-4')).toBe(false);
    });
  });

  describe('getDefaultOptions', () => {
    it('should return valid default options', () => {
      const options = adapter.getDefaultOptions();
      expect(options.model).toBe('claude-3-5-sonnet-20241022');
      expect(options.temperature).toBe(0.7);
      expect(options.maxTokens).toBe(4096);
    });
  });

  describe('getModelInfo', () => {
    it('should return info for supported models', () => {
      const info = adapter.getModelInfo('claude-3-5-sonnet-20241022');
      expect(info).toEqual({
        maxTokens: 8192,
        contextLength: 200000,
        supportsSystemMessages: true
      });
    });

    it('should return null for unsupported models', () => {
      const info = adapter.getModelInfo('unsupported-model');
      expect(info).toBeNull();
    });

    it('should return correct max tokens for different models', () => {
      expect(adapter.getModelInfo('claude-3-5-sonnet-20241022')?.maxTokens).toBe(8192);
      expect(adapter.getModelInfo('claude-3-opus-20240229')?.maxTokens).toBe(4096);
      expect(adapter.getModelInfo('claude-3-haiku-20240307')?.maxTokens).toBe(4096);
    });
  });

  describe('render', () => {
    const basicPrompt: StructuredPrompt = {
      system: ['You are a helpful assistant'],
      user_template: 'Hello, how are you?',
      capabilities: [],
      rules: [],
      variables: []
    };

    const basicOptions: RenderOptions = {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096
    };

    it('should render basic prompt correctly', () => {
      const result = adapter.render(basicPrompt, basicOptions);
      
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.content).toEqual({
        model: 'claude-3-5-sonnet-20241022',
        system: 'You are a helpful assistant',
        messages: [
          { role: 'user', content: 'Hello, how are you?' }
        ],
        max_tokens: 4096
      });
    });

    it('should handle multiple system messages', () => {
      const prompt: StructuredPrompt = {
        ...basicPrompt,
        system: ['You are a helpful assistant', 'Be concise and accurate']
      };

      const result = adapter.render(prompt, basicOptions);
      const content = result.content as any;
      
      expect(content.system).toBe('You are a helpful assistant\n\nBe concise and accurate');
    });

    it('should apply system override', () => {
      const options: RenderOptions = {
        ...basicOptions,
        systemOverride: 'Custom system message'
      };

      const result = adapter.render(basicPrompt, options);
      const content = result.content as any;
      
      expect(content.system).toBe('Custom system message');
    });

    it('should substitute variables in user template', () => {
      const prompt: StructuredPrompt = {
        ...basicPrompt,
        user_template: 'Hello {{name}}, you are {{age}} years old'
      };

      const options: RenderOptions = {
        ...basicOptions,
        variables: { name: 'John', age: 30 }
      };

      const result = adapter.render(prompt, options);
      const content = result.content as any;
      
      expect(content.messages[0]).toEqual({
        role: 'user',
        content: 'Hello John, you are 30 years old'
      });
    });

    it('should include optional parameters', () => {
      const options: RenderOptions = {
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.8,
        topP: 0.9,
        maxTokens: 2000
      };

      const result = adapter.render(basicPrompt, options);
      const content = result.content as any;
      
      expect(content.temperature).toBe(0.8);
      expect(content.top_p).toBe(0.9);
      expect(content.max_tokens).toBe(2000);
    });

    it('should include metadata', () => {
      const result = adapter.render(basicPrompt, basicOptions);
      
      expect(result.metadata).toEqual({
        messageCount: 1,
        hasSystemMessage: true,
        estimatedTokens: expect.any(Number)
      });
    });

    it('should handle prompt without system messages', () => {
      const prompt: StructuredPrompt = {
        ...basicPrompt,
        system: []
      };

      const result = adapter.render(prompt, basicOptions);
      const content = result.content as any;
      
      expect(content.system).toBeUndefined();
      expect(content.messages).toHaveLength(1);
      expect(content.messages[0].role).toBe('user');
      expect(result.metadata?.hasSystemMessage).toBe(false);
    });

    it('should use default maxTokens if not provided', () => {
      const options: RenderOptions = {
        model: 'claude-3-5-sonnet-20241022'
        // No maxTokens specified
      };

      const result = adapter.render(basicPrompt, options);
      const content = result.content as any;
      
      expect(content.max_tokens).toBe(4096);
    });

    it('should throw error for invalid options', () => {
      const invalidOptions: RenderOptions = {
        model: 'unsupported-model',
        maxTokens: 4096
      };

      expect(() => adapter.render(basicPrompt, invalidOptions)).toThrow(
        'Invalid render options'
      );
    });

    it('should throw error for invalid prompt', () => {
      const invalidPrompt: StructuredPrompt = {
        ...basicPrompt,
        user_template: ''
      };

      expect(() => adapter.render(invalidPrompt, basicOptions)).toThrow(
        'Invalid structured prompt'
      );
    });
  });

  describe('validate', () => {
    const validPayload = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      content: {
        model: 'claude-3-5-sonnet-20241022',
        system: 'You are helpful',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 4096
      }
    };

    it('should validate correct payload', () => {
      const result = adapter.validate(validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject wrong provider', () => {
      const payload = { ...validPayload, provider: 'openai' };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Expected provider 'anthropic', got 'openai'");
    });

    it('should reject missing content', () => {
      const payload = { ...validPayload, content: undefined };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payload content is required');
    });

    it('should reject missing model', () => {
      const payload = {
        ...validPayload,
        content: { ...validPayload.content, model: undefined }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Model is required');
    });

    it('should reject unsupported model', () => {
      const payload = {
        ...validPayload,
        content: { ...validPayload.content, model: 'unsupported-model' }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported model: unsupported-model');
    });

    it('should require max_tokens', () => {
      const payload = {
        ...validPayload,
        content: { ...validPayload.content, max_tokens: undefined }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('max_tokens is required for Anthropic API');
    });

    it('should reject invalid max_tokens', () => {
      const payload = {
        ...validPayload,
        content: { ...validPayload.content, max_tokens: -1 }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('max_tokens must be a positive number');
    });

    it('should reject invalid messages array', () => {
      const payload = {
        ...validPayload,
        content: { ...validPayload.content, messages: 'not-an-array' }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Messages must be an array');
    });

    it('should reject empty messages array', () => {
      const payload = {
        ...validPayload,
        content: { ...validPayload.content, messages: [] }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one message is required');
    });

    it('should reject invalid message roles', () => {
      const payload = {
        ...validPayload,
        content: {
          ...validPayload.content,
          messages: [{ role: 'system', content: 'test' }]
        }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid role at message 0: system. Anthropic supports only 'user' and 'assistant' roles");
    });

    it('should reject non-string message content', () => {
      const payload = {
        ...validPayload,
        content: {
          ...validPayload.content,
          messages: [{ role: 'user', content: 123 }]
        }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message content must be string at index 0');
    });

    it('should reject non-string system message', () => {
      const payload = {
        ...validPayload,
        content: { ...validPayload.content, system: 123 }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('System message must be a string');
    });

    it('should validate temperature range (Anthropic specific)', () => {
      const validPayload1 = {
        ...validPayload,
        content: { ...validPayload.content, temperature: 0.7 }
      };
      expect(adapter.validate(validPayload1).isValid).toBe(true);

      const invalidPayload = {
        ...validPayload,
        content: { ...validPayload.content, temperature: 1.5 }
      };
      const result = adapter.validate(invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Temperature must be a number between 0 and 1 for Anthropic');
    });

    it('should validate top_p range', () => {
      const validPayload1 = {
        ...validPayload,
        content: { ...validPayload.content, top_p: 0.9 }
      };
      expect(adapter.validate(validPayload1).isValid).toBe(true);

      const invalidPayload = {
        ...validPayload,
        content: { ...validPayload.content, top_p: 1.5 }
      };
      const result = adapter.validate(invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('top_p must be a number between 0 and 1');
    });
  });

  describe('validateRenderOptions (Anthropic specific)', () => {
    it('should validate temperature range 0-1 for Anthropic', () => {
      const validOptions: RenderOptions = {
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4096
      };
      const result = adapter['validateRenderOptions'](validOptions);
      expect(result.isValid).toBe(true);

      const invalidOptions: RenderOptions = {
        model: 'claude-3-5-sonnet-20241022',
        temperature: 1.5,
        maxTokens: 4096
      };
      const invalidResult = adapter['validateRenderOptions'](invalidOptions);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Temperature must be between 0 and 1 for Anthropic');
    });
  });

  describe('getConfiguration', () => {
    it('should return valid configuration', () => {
      const config = adapter.getConfiguration();
      
      expect(config.id).toBe('anthropic');
      expect(config.name).toBe('Anthropic');
      expect(config.defaultModel).toBe('claude-3-5-sonnet-20241022');
      expect(config.models).toHaveLength(adapter.supportedModels.length);
      expect(config.rateLimits).toEqual({
        requestsPerMinute: 1000,
        tokensPerMinute: 40000
      });
    });

    it('should include model information', () => {
      const config = adapter.getConfiguration();
      const claudeModel = config.models.find(m => m.id === 'claude-3-5-sonnet-20241022');
      
      expect(claudeModel).toBeDefined();
      expect(claudeModel?.name).toBe('Claude 3.5 Sonnet (Latest)');
      expect(claudeModel?.contextLength).toBe(200000);
      expect(claudeModel?.capabilities).toEqual(adapter.capabilities);
    });
  });

  describe('parseResponse', () => {
    it('should parse valid Anthropic response', () => {
      const response = {
        model: 'claude-3-5-sonnet-20241022',
        content: [
          {
            type: 'text',
            text: 'Hello! How can I help you today?'
          }
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 8
        },
        stop_reason: 'end_turn'
      };

      const result = adapter.parseResponse(response);
      
      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.metadata).toEqual({
        model: 'claude-3-5-sonnet-20241022',
        usage: response.usage,
        stopReason: 'end_turn',
        stopSequence: undefined
      });
    });

    it('should handle multiple text blocks', () => {
      const response = {
        model: 'claude-3-5-sonnet-20241022',
        content: [
          { type: 'text', text: 'Hello! ' },
          { type: 'text', text: 'How can I help?' }
        ],
        usage: { input_tokens: 10, output_tokens: 8 },
        stop_reason: 'end_turn'
      };

      const result = adapter.parseResponse(response);
      expect(result.content).toBe('Hello! How can I help?');
    });

    it('should filter non-text content blocks', () => {
      const response = {
        model: 'claude-3-5-sonnet-20241022',
        content: [
          { type: 'text', text: 'Hello!' },
          { type: 'image', data: 'base64...' },
          { type: 'text', text: ' How are you?' }
        ],
        usage: { input_tokens: 10, output_tokens: 8 },
        stop_reason: 'end_turn'
      };

      const result = adapter.parseResponse(response);
      expect(result.content).toBe('Hello! How are you?');
    });

    it('should throw error for invalid response', () => {
      const response = { model: 'claude-3-5-sonnet-20241022', content: [] };
      
      expect(() => adapter.parseResponse(response)).toThrow(
        'Invalid Anthropic response: no content found'
      );
    });
  });
});