// Tests for Meta provider adapter

import { describe, it, expect } from 'vitest';
import { MetaAdapter } from '../meta-adapter';
import { StructuredPrompt } from '../../models/prompt';
import { RenderOptions } from '../../types/common';

describe('MetaAdapter', () => {
  let adapter: MetaAdapter;

  beforeEach(() => {
    adapter = new MetaAdapter();
  });

  describe('basic properties', () => {
    it('should have correct id and name', () => {
      expect(adapter.id).toBe('meta');
      expect(adapter.name).toBe('Meta');
    });

    it('should support expected models', () => {
      expect(adapter.supportedModels).toContain('llama-3.1-405b-instruct');
      expect(adapter.supportedModels).toContain('llama-3.1-70b-instruct');
      expect(adapter.supportedModels).toContain('llama-2-70b-chat');
    });

    it('should have correct capabilities', () => {
      expect(adapter.capabilities.supportsSystemMessages).toBe(true);
      expect(adapter.capabilities.supportsMultipleMessages).toBe(true);
      expect(adapter.capabilities.supportsTemperature).toBe(true);
      expect(adapter.capabilities.supportsTopP).toBe(true);
      expect(adapter.capabilities.supportsMaxTokens).toBe(true);
      expect(adapter.capabilities.supportedMessageRoles).toEqual(['system', 'user', 'assistant']);
      expect(adapter.capabilities.maxContextLength).toBe(128000);
    });
  });

  describe('supports', () => {
    it('should support known models', () => {
      expect(adapter.supports('llama-3.1-70b-instruct')).toBe(true);
      expect(adapter.supports('llama-3-70b-instruct')).toBe(true);
      expect(adapter.supports('llama-2-70b-chat')).toBe(true);
    });

    it('should not support unknown models', () => {
      expect(adapter.supports('unknown-model')).toBe(false);
      expect(adapter.supports('gpt-4')).toBe(false);
      expect(adapter.supports('claude-3')).toBe(false);
    });
  });

  describe('getDefaultOptions', () => {
    it('should return valid default options', () => {
      const options = adapter.getDefaultOptions();
      expect(options.model).toBe('llama-3.1-70b-instruct');
      expect(options.temperature).toBe(0.7);
      expect(options.maxTokens).toBe(4096);
    });
  });

  describe('getModelInfo', () => {
    it('should return info for supported models', () => {
      const info = adapter.getModelInfo('llama-3.1-70b-instruct');
      expect(info).toEqual({
        maxTokens: 4096,
        contextLength: 128000,
        supportsSystemMessages: true
      });
    });

    it('should return null for unsupported models', () => {
      const info = adapter.getModelInfo('unsupported-model');
      expect(info).toBeNull();
    });

    it('should return correct context lengths for different models', () => {
      expect(adapter.getModelInfo('llama-3.1-70b-instruct')?.contextLength).toBe(128000);
      expect(adapter.getModelInfo('llama-3-70b-instruct')?.contextLength).toBe(8192);
      expect(adapter.getModelInfo('llama-2-70b-chat')?.contextLength).toBe(4096);
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
      model: 'llama-3.1-70b-instruct'
    };

    it('should render basic prompt correctly', () => {
      const result = adapter.render(basicPrompt, basicOptions);
      
      expect(result.provider).toBe('meta');
      expect(result.model).toBe('llama-3.1-70b-instruct');
      expect(result.content).toEqual({
        model: 'llama-3.1-70b-instruct',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello, how are you?' }
        ]
      });
    });

    it('should handle multiple system messages', () => {
      const prompt: StructuredPrompt = {
        ...basicPrompt,
        system: ['You are a helpful assistant', 'Be concise and accurate']
      };

      const result = adapter.render(prompt, basicOptions);
      const content = result.content as any;
      
      expect(content.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant\n\nBe concise and accurate'
      });
    });

    it('should apply system override', () => {
      const options: RenderOptions = {
        ...basicOptions,
        systemOverride: 'Custom system message'
      };

      const result = adapter.render(basicPrompt, options);
      const content = result.content as any;
      
      expect(content.messages[0]).toEqual({
        role: 'system',
        content: 'Custom system message'
      });
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
      
      expect(content.messages[1]).toEqual({
        role: 'user',
        content: 'Hello John, you are 30 years old'
      });
    });

    it('should include optional parameters', () => {
      const options: RenderOptions = {
        model: 'llama-3.1-70b-instruct',
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

    it('should include metadata with model family', () => {
      const result = adapter.render(basicPrompt, basicOptions);
      
      expect(result.metadata).toEqual({
        messageCount: 2,
        hasSystemMessage: true,
        estimatedTokens: expect.any(Number),
        modelFamily: 'Llama 3.1'
      });
    });

    it('should handle prompt without system messages', () => {
      const prompt: StructuredPrompt = {
        ...basicPrompt,
        system: []
      };

      const result = adapter.render(prompt, basicOptions);
      const content = result.content as any;
      
      expect(content.messages).toHaveLength(1);
      expect(content.messages[0].role).toBe('user');
      expect(result.metadata?.hasSystemMessage).toBe(false);
    });

    it('should detect different model families', () => {
      const llama3Options: RenderOptions = { model: 'llama-3-70b-instruct' };
      const llama2Options: RenderOptions = { model: 'llama-2-70b-chat' };

      const llama3Result = adapter.render(basicPrompt, llama3Options);
      const llama2Result = adapter.render(basicPrompt, llama2Options);

      expect(llama3Result.metadata?.modelFamily).toBe('Llama 3');
      expect(llama2Result.metadata?.modelFamily).toBe('Llama 2');
    });

    it('should throw error for invalid options', () => {
      const invalidOptions: RenderOptions = {
        model: 'unsupported-model'
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
      provider: 'meta',
      model: 'llama-3.1-70b-instruct',
      content: {
        model: 'llama-3.1-70b-instruct',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' }
        ]
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
      expect(result.errors).toContain("Expected provider 'meta', got 'openai'");
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
          messages: [{ role: 'invalid', content: 'test' }]
        }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid role at message 0: invalid');
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

    it('should reject multiple system messages', () => {
      const payload = {
        ...validPayload,
        content: {
          ...validPayload.content,
          messages: [
            { role: 'system', content: 'First system' },
            { role: 'system', content: 'Second system' },
            { role: 'user', content: 'Hello' }
          ]
        }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Llama models support only one system message');
    });

    it('should reject system message not in first position', () => {
      const payload = {
        ...validPayload,
        content: {
          ...validPayload.content,
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'system', content: 'System message' }
          ]
        }
      };
      const result = adapter.validate(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('System message must be the first message for Llama models');
    });

    it('should validate temperature range', () => {
      const validPayload1 = {
        ...validPayload,
        content: { ...validPayload.content, temperature: 0.7 }
      };
      expect(adapter.validate(validPayload1).isValid).toBe(true);

      const invalidPayload = {
        ...validPayload,
        content: { ...validPayload.content, temperature: 3.0 }
      };
      const result = adapter.validate(invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Temperature must be a number between 0 and 2');
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

    it('should validate max_tokens', () => {
      const validPayload1 = {
        ...validPayload,
        content: { ...validPayload.content, max_tokens: 1000 }
      };
      expect(adapter.validate(validPayload1).isValid).toBe(true);

      const invalidPayload = {
        ...validPayload,
        content: { ...validPayload.content, max_tokens: -1 }
      };
      const result = adapter.validate(invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('max_tokens must be a positive number');
    });
  });

  describe('getConfiguration', () => {
    it('should return valid configuration', () => {
      const config = adapter.getConfiguration();
      
      expect(config.id).toBe('meta');
      expect(config.name).toBe('Meta');
      expect(config.defaultModel).toBe('llama-3.1-70b-instruct');
      expect(config.models).toHaveLength(adapter.supportedModels.length);
      expect(config.rateLimits).toEqual({
        requestsPerMinute: 200,
        tokensPerMinute: 10000
      });
    });

    it('should include model information', () => {
      const config = adapter.getConfiguration();
      const llamaModel = config.models.find(m => m.id === 'llama-3.1-70b-instruct');
      
      expect(llamaModel).toBeDefined();
      expect(llamaModel?.name).toBe('Llama 3.1 70B Instruct');
      expect(llamaModel?.contextLength).toBe(128000);
      expect(llamaModel?.capabilities).toEqual(adapter.capabilities);
    });

    it('should mark deprecated models', () => {
      const config = adapter.getConfiguration();
      const deprecatedModel = config.models.find(m => m.id === 'llama-2-7b-chat');
      
      expect(deprecatedModel?.deprecated).toBe(true);
    });
  });

  describe('parseResponse', () => {
    it('should parse valid Meta response', () => {
      const response = {
        model: 'llama-3.1-70b-instruct',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18
        }
      };

      const result = adapter.parseResponse(response);
      
      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.metadata).toEqual({
        model: 'llama-3.1-70b-instruct',
        usage: response.usage,
        finishReason: 'stop',
        index: 0
      });
    });

    it('should handle response with text field (legacy)', () => {
      const response = {
        model: 'llama-2-70b-chat',
        choices: [
          {
            index: 0,
            text: 'Legacy response format',
            finish_reason: 'stop'
          }
        ]
      };

      const result = adapter.parseResponse(response);
      expect(result.content).toBe('Legacy response format');
    });

    it('should throw error for invalid response', () => {
      const response = { model: 'llama-3.1-70b-instruct', choices: [] };
      
      expect(() => adapter.parseResponse(response)).toThrow(
        'Invalid Meta response: no choices found'
      );
    });
  });

  describe('model family detection', () => {
    it('should detect Llama 3.1 models', () => {
      const prompt: StructuredPrompt = {
        system: [],
        user_template: 'test',
        capabilities: [],
        rules: [],
        variables: []
      };

      const result = adapter.render(prompt, { model: 'llama-3.1-405b-instruct' });
      expect(result.metadata?.modelFamily).toBe('Llama 3.1');
    });

    it('should detect Llama 3 models', () => {
      const prompt: StructuredPrompt = {
        system: [],
        user_template: 'test',
        capabilities: [],
        rules: [],
        variables: []
      };

      const result = adapter.render(prompt, { model: 'llama-3-70b-instruct' });
      expect(result.metadata?.modelFamily).toBe('Llama 3');
    });

    it('should detect Llama 2 models', () => {
      const prompt: StructuredPrompt = {
        system: [],
        user_template: 'test',
        capabilities: [],
        rules: [],
        variables: []
      };

      const result = adapter.render(prompt, { model: 'llama-2-70b-chat' });
      expect(result.metadata?.modelFamily).toBe('Llama 2');
    });
  });
});